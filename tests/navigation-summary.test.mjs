import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationSummaryMetrics,renderNavigationSummaryStatus}
  from "../scripts/navigation-summary.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  let actions=0;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],
    attributes:{},textContent:"",append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node);},
    addEventListener(){actions++;},
    setAttribute(key,value){this.attributes[key]=value;}})};
  return {restore:()=>{globalThis.document=previous;},
    get actions(){return actions;}};
};
const flatten=nodes=>nodes.flatMap(node=>[node,...flatten(node.children??[])]);

test("Navigation summary is a read-only, ordered projection with no side effects",()=>{
  const dom=mockDOM();
  try{
    const metrics=[
      {label:"Current Leg Distance",value:"37.31 mi"},
      {label:"Current Leg Time",value:"9h 20m"},
      {label:"Current Leg Total",value:"1d 10h 20m"}];
    const model={metrics,explanation:"Plan: 8h travel/day.",
      progressPercent:57.9};
    const view=renderNavigationSummaryMetrics(model);
    assert.deepEqual(metrics,model.metrics,
      "a rendered view must not change its input model");
    assert.equal(view.nodes.length,3);
    const cards=view.nodes[0].children;
    assert.deepEqual(cards.map(card=>card.children.map(child=>child.textContent)),
      [["Current Leg Distance","37.31 mi"],["Current Leg Time","9h 20m"],
        ["Current Leg Total","1d 10h 20m"]]);
    assert.equal(view.nodes[1].textContent,"Plan: 8h travel/day.");
    assert.equal(view.progressUI.bar.value,57.9);
    assert.equal(view.progressUI.bar.max,100);
    assert.equal(view.progressUI.bar.attributes["aria-label"],"Journey progress");
    assert.equal(view.progressUI.label.textContent,"57% complete");
    view.progressUI.bar.value=75;
    view.progressUI.label.textContent="75% complete";
    view.timeUI.moving.textContent="8h 0m";
    assert.equal(view.timeUI.moving.textContent,"8h 0m",
      "the controller can still update the existing elements in place");
    assert.deepEqual(Object.keys(view.timeUI),["moving","elapsed","eta"]);
    assert.equal(dom.actions,0,"rendering cannot register GM actions");
  }finally{dom.restore();}
});

test("Navigation summary hides progress until travel and omits optional status lines",()=>{
  const dom=mockDOM();
  try{
    const preview=renderNavigationSummaryMetrics({metrics:[
      {label:"Distance",value:"10 mi"},
      {label:"Travel Time",value:"Unavailable"},
      {label:"Total Trip",value:"Unavailable"}
    ]});
    assert.equal(preview.nodes.length,1);
    assert.equal(preview.progressUI,null);
    assert.equal(preview.timeUI,null);
    const status=renderNavigationSummaryStatus({
      clockHint:"World time stays unchanged."});
    assert.deepEqual(status.nodes.map(node=>node.textContent),
      ["World time stays unchanged."]);
    assert.equal(status.worldTimeUI,null);
    assert.equal(dom.actions,0);
  }finally{dom.restore();}
});

test("Navigation status preserves World time, speed, playback and terrain line order",()=>{
  const dom=mockDOM();
  try{
    const status=renderNavigationSummaryStatus({
      clockHint:"Clock enabled.",
      worldTimeStatus:"Foundry World time advanced: +9h 20m",
      speedSource:"Speed: The Party · normal pace · 3 mi/hour",
      playbackLabel:"Token playback: about 14s",
      terrainCostLabel:"Terrain-weighted distance: 42 mi-equivalent"});
    assert.deepEqual(status.nodes.map(node=>node.textContent),[
      "Clock enabled.","Foundry World time advanced: +9h 20m",
      "Speed: The Party · normal pace · 3 mi/hour",
      "Token playback: about 14s",
      "Terrain-weighted distance: 42 mi-equivalent"]);
    assert.equal(status.worldTimeUI,status.nodes[1]);
    assert.equal(flatten(status.nodes).some(node=>node.tag==="button"),false);
    assert.equal(dom.actions,0);
  }finally{dom.restore();}
});
