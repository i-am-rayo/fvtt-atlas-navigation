import assert from "node:assert/strict";
import test from "node:test";
import {checkpointDestinationControl}
  from "../scripts/navigation-checkpoint-destination.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,style:{},children:[],listeners:{},hidden:false,
    append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},
    addEventListener(type,callback){this.listeners[type]=callback;},
    setAttribute(name,value){this[name]=value;}
  })};
  return ()=>{globalThis.document=previous;};
};
const find=(root,tag)=>root.children.find(x=>x.tag===tag);
const point=(x,y)=>({x,y});

test("Checkpoint default selects exact Point B; map-pick button leaves approved state untouched",async()=>{
  const restore=mockDOM();
  const previous={game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui};
  try{
    const scene={id:"scene",regions:new Map(),canUserModify:()=>true};
    const atlas={revision:4,roads:[{id:"road",name:"Road to Eyrie"}],
      nodes:[{id:"node",x:50,y:25}],
      checkpoints:[{id:"eyrie",name:"The Eyrie",nodeId:"node",roadId:"road"}]};
    const view={scene,ready:true};
    globalThis.canvas=view;
    globalThis.game={user:{isGM:true},settings:{get:()=>null}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const calls=[];
    const planner={scene,start:point(0,0),end:null,sourceMode:"party",
      destinationMode:"checkpoint",selectedCheckpointId:null,
      atlasProvider:()=>atlas,canvasProvider:()=>view,
      syncPartyDeparture(){calls.push("party-origin");},
      calculateRoute(){calls.push("calculate");},draw(){calls.push("draw");},
      async render(){calls.push("render");},
      beginMapDestinationPick(){calls.push("map-pick");return true;}
    };
    const root=checkpointDestinationControl(planner);
    const row=root.children[1];
    const label=find(row,"label"),select=find(label,"select");
    const map=find(row,"button");
    assert.equal(label.htmlFor,"atlas-navigation-destination-checkpoint");
    assert.equal(select.value,"");
    assert.equal(select.children[1].tag,"optgroup");
    assert.equal(select.children[1].label,"Land");
    assert.equal(select.children[1].children[0].value,"eyrie");
    assert.equal(map.textContent,"Pick on map");
    assert.deepEqual(calls,[],"rendering cannot select or move a token");
    select.value="eyrie";
    await select.listeners.change();
    assert.equal(planner.destinationMode,"checkpoint");
    assert.deepEqual(planner.end,point(50,25));
    assert.equal(planner.selectedCheckpointId,"eyrie");
    assert.deepEqual(calls,["party-origin","calculate","draw","render"]);
    const selectedBefore={...planner.end};
    map.listeners.click();
    assert.deepEqual(planner.end,selectedBefore,
      "button enters a modeless map workflow; no new destination until actual click");
    assert.equal(calls.at(-1),"map-pick");
  }finally{
    restore();
    globalThis.game=previous.game;globalThis.canvas=previous.canvas;
    globalThis.ui=previous.ui;
  }
});

test("recoverable Journey and missing Point A hide or disable destination actions",()=>{
  const restore=mockDOM();
  try{
    const planner={scene:{id:"scene"},recoveryRecord:{status:"interrupted"}};
    assert.equal(checkpointDestinationControl(planner),null);
    const scene={id:"scene"},atlas={roads:[],checkpoints:[]};
    const blank=checkpointDestinationControl({scene,start:null,
      atlasProvider:()=>atlas});
    assert.equal(blank.children[1].children[0].children[0].disabled,true);
    assert.equal(blank.children[1].children[1].disabled,true);
  }finally{restore();}
});
