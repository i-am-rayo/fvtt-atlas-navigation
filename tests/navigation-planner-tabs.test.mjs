import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationPlannerTabs,renderNavigationJourneyTabs}
  from "../scripts/navigation-planner-tabs-view.js";

const mockDOM=()=>{
  const old=globalThis.document;
  const create=tag=>({
    tag,children:[],attributes:{},style:{},listeners:{},hidden:false,
    append(...items){this.children.push(...items);},
    appendChild(node){this.children.push(node);},
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(name,callback){this.listeners[name]=callback;},
    focus(){this.focused=true;}
  });
  globalThis.document={createElement:create};
  return {create,restore(){globalThis.document=old;}};
};

test("Navigation opens in Travel with accessible Playback and Directions tabs",()=>{
  const dom=mockDOM();
  try{
    const selected=[];
    const panels={travel:dom.create("div"),playback:dom.create("div"),
      directions:dom.create("div")};
    const root=renderNavigationPlannerTabs({active:"travel",...panels,
      onTabChange:value=>selected.push(value)});
    assert.equal(root.children[0].tag,"div");
    const bar=root.children[0],tabs=bar.children;
    assert.equal(bar.attributes.role,"tablist");
    assert.equal(tabs.length,3);
    assert.deepEqual(tabs.map(x=>x.attributes.role),["tab","tab","tab"]);
    assert.equal(tabs[0].attributes["aria-selected"],"true");
    assert.equal(panels.travel.style.display,"flex");
    assert.equal(panels.directions.style.display,"none");
    tabs[1].listeners.click();
    assert.deepEqual(selected,["playback"]);
    assert.equal(panels.playback.hidden,false);
    assert.equal(panels.travel.hidden,true);
    assert.equal(tabs[1].attributes["aria-selected"],"true");
    let prevented=0;
    tabs[1].listeners.keydown({key:"ArrowRight",preventDefault(){prevented++;}});
    assert.deepEqual(selected,["playback","directions"]);
    assert.equal(tabs[2].focused,true);
    assert.equal(prevented,1);
    assert.equal(panels.directions.style.display,"flex");
  }finally{dom.restore();}
});

test("invalid tab is rejected without rendering any gameplay action",()=>{
  const dom=mockDOM();
  try{
    assert.throws(()=>renderNavigationPlannerTabs({
      active:"editor",travel:dom.create("div"),playback:dom.create("div"),
      directions:dom.create("div")}),/all three planner tabs/);
  }finally{dom.restore();}
});

test("active Journey has its own accessible Journey, Directions, Journey Speed tabs",()=>{
  const dom=mockDOM();
  try{
    const changed=[];
    const panels={journey:dom.create("div"),directions:dom.create("div"),
      speed:dom.create("div")};
    const root=renderNavigationJourneyTabs({active:"journey",...panels,
      onTabChange:value=>changed.push(value)});
    const tabs=root.children[0].children;
    assert.deepEqual(tabs.map(tab=>tab.textContent),
      ["Journey","Directions","Journey Speed"]);
    assert.equal(panels.journey.style.display,"flex");
    assert.equal(panels.directions.style.display,"none");
    tabs[1].listeners.click();
    assert.deepEqual(changed,["directions"]);
    assert.equal(panels.directions.style.display,"flex");
    tabs[1].listeners.keydown({key:"ArrowRight",preventDefault(){}});
    assert.equal(panels.speed.style.display,"flex");
    assert.equal(tabs[2].focused,true);
  }finally{dom.restore();}
});
