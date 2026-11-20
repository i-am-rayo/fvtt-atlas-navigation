import test from "node:test";
import assert from "node:assert/strict";
import {renderNavigationMixedLandControls}
  from "../scripts/navigation-mixed-land-view.js";

test("theater-of-mind UI has no individual rider dropdowns or hidden writes",()=>{
  const original=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,children:[],style:{},listeners:new Map(),
    append(...nodes){this.children.push(...nodes);},
    addEventListener(name,listener){this.listeners.set(name,listener);},
    setAttribute(){}
  })};
  try{
    const changes=[];
    const root=renderNavigationMixedLandControls({
      methods:[
        {key:"owned|walking",name:"Walking",arrangement:"owned",
          speedLabel:"3 mph",available:null},
        {key:"owned|camel",name:"Camel",arrangement:"owned",
          speedLabel:"3 mph",available:1,canAdjustRiders:false,
          personalAssignments:["Dr. Cassian Voss"]},
        {key:"hire|coach",name:"Coach",arrangement:"hire",
          speedLabel:"4 mph",available:1,canAdjustRiders:true,
          suggestedRiders:1,maximumRiders:4}
      ],riderCounts:{},units:{},recommended:"3.00",
      maximum:"3.00",unit:"mph",
      preview:{speed:"3.00",moving:"8h",passengers:2,walking:3,
        seats:2,cost:"200 CP"},
      onRiders:(key,count)=>changes.push(["riders",key,count]),
      onUnits:(key,count)=>changes.push(["units",key,count]),
      onPace:pace=>changes.push(["pace",pace])
    });
    const all=node=>[node,...node.children.flatMap(all)];
    assert.equal(all(root).filter(node=>node.tag==="select").length,0);
    assert.ok(all(root).some(node=>String(node.textContent??"").includes(
      "Dr. Cassian Voss")),"party-owned mount assignment is summarized");
    assert.deepEqual(changes,[],"rendering never edits Actors or navigation state");
    const rider=all(root).find(node=>node.tag==="input"&&node.min==="0");
    const units=all(root).find(node=>node.tag==="input"&&node.min==="1");
    assert.equal(rider.value,"1");
    rider.value="3";rider.listeners.get("change")();
    units.value="2";units.listeners.get("change")();
    const radios=all(root).filter(node=>node.tag==="input"&&node.type==="radio");
    radios[1].checked=true;radios[1].listeners.get("change")();
    assert.deepEqual(changes,[
      ["riders","hire|coach",3],["units","hire|coach",2],
      ["pace","custom"]
    ]);
  }finally{globalThis.document=original;}
});
