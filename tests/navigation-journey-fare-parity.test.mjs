import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {describeJourneyMountFare,renderNavigationTransportApproval}
  from "../scripts/navigation-transport-summary-view.js";

const livestock={estimatedFareCp:1910,resources:[
  {name:"Riding Horse",aboard:3},{name:"Warhorse",aboard:1},
  {name:"Pony",aboard:0}]};
const money=value=>value+" CP";
const doc=()=>({createElement(tag){return {tag,className:"",textContent:"",
  children:[],append(...nodes){this.children.push(...nodes);},
  get attributes(){return this.className?[{name:"class"}]:[];}};}});
const walk=(node)=>[node,...(node.children??[]).flatMap(walk)];

test("World-inherited mount percentage is visible without writing overrides",()=>{
  const summary=describeJourneyMountFare(livestock,{
    method:{hireApplies:"passenger",livestockFareCp:null,livestockFarePercent:null},
    worldPercent:50,formatMoney:money});
  assert.match(summary,/Riding Horse ×3, Warhorse ×1/);
  assert.match(summary,/4 mounts/);
  assert.match(summary,/World default 50% of passenger fare/);
  assert.match(summary,/1910 CP/);
  assert.match(summary,/included in total; not charged/);
});

test("effective method/fixed mount fare and approved historical fares are not mislabeled",()=>{
  assert.match(describeJourneyMountFare(livestock,{
    method:{livestockFarePercent:200},worldPercent:50,formatMoney:money}),
    /Method override 200%/);
  assert.match(describeJourneyMountFare(livestock,{
    method:{livestockFareCp:300,livestockFareBasis:"day"},
    worldPercent:50,formatMoney:money}),/Fixed mount fare override/);
  const recovered=describeJourneyMountFare(livestock,{
    approved:true,worldPercent:0,formatMoney:money});
  assert.match(recovered,/Previously approved fare/);
  assert.doesNotMatch(recovered,/World default/);
  assert.match(describeJourneyMountFare(livestock,{
    arrangement:"owned",method:{livestockFareCp:300},
    formatMoney:money}),/No boarding fee on party-owned transport/,
    "an owned cart does not charge the World/hired mount passenger percentage");
  assert.equal(describeJourneyMountFare({...livestock,resources:[
    {name:"Horse",aboard:0}]},{formatMoney:money}),null);
});

test("approved vessel summary separates mount subtotal from aggregate fare",()=>{
  const previous=globalThis.document;globalThis.document=doc();
  try{
    const content=renderNavigationTransportApproval({
      rows:[{method:"Ship passage",travelers:"5 adventurers",units:"1",cost:"5700 CP"}],
      metrics:[["Total travelers","5"],["Group travel speed","2 mph"],
        ["Estimated moving time","47h"],["Estimated transportation cost","5700 CP"]],
      fareRows:[["Passenger/transport and crew","3790 CP"],["Physical mounts","1910 CP"]]
    });
    assert.equal(content.attributes.length,0,"DialogV2 outer content stays attribute-free");
    const nodes=walk(content);
    assert.ok(nodes.some(n=>n.textContent==="Fare breakdown"));
    assert.ok(nodes.some(n=>n.textContent==="Passenger/transport and crew"));
    assert.ok(nodes.some(n=>n.textContent==="3790 CP"));
    assert.ok(nodes.some(n=>n.textContent==="Physical mounts"));
    assert.ok(nodes.some(n=>n.textContent==="1910 CP"));
    assert.equal(nodes.filter(n=>n.tag==="dd").length,6);
  }finally{globalThis.document=previous;}
});

test("onward single-method legs reuse first-leg roster and quoted fare components",()=>{
  const controller=readFileSync(new URL("../scripts/navigation-controller.js",import.meta.url),"utf8");
  const onward=controller.slice(controller.indexOf("if(transferPlan?.hasTransitions&&!this.pendingTransfer)"));
  assert.match(onward,/singleChoice:leg\.selectedOption,mountBoard/);
  assert.doesNotMatch(onward,/transferColumns:true/,
    "water/air lone method must not force a separate drag/drop traveler deck");
  assert.match(onward,/card\.append\(renderTransportQuote\(/,
    "a transfer quote should use the same read-only breakdown component");
});

test("a first-leg land quote uses explicit boarded animals like a later water leg",()=>{
  const controller=readFileSync(new URL("../scripts/navigation-controller.js",import.meta.url),"utf8");
  const firstQuote=controller.slice(controller.indexOf("const quoteArgs={arrangement:this.transportArrangement"),
    controller.indexOf("const quote=quoteTransportationService(method,{...quoteArgs"));
  assert.match(firstQuote,/livestockCount/,
    "the initial hired-land preview must price committed mount draft counts");
  const firstBreakdown=controller.slice(controller.indexOf("const quote=quoteTransportationService(method,{...quoteArgs"),
    controller.indexOf("body.append(renderTransportQuote({",controller.indexOf("const quote=quoteTransportationService(method,{...quoteArgs")));
  assert.match(firstBreakdown,/describeJourneyMountFare/,
    "the first leg and onward legs must use one visible mount-fare description");
});
