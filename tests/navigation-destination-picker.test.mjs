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
    addEventListener(type,callback){this.listeners[type]=callback;}
  })};
  return ()=>{globalThis.document=previous;};
};
const child=(parent,tag)=>parent.children.find(c=>c.tag===tag);
const point=(x,y)=>({x,y});

test("GM can choose B by a named checkpoint, then switch to map clicks without writing a Journey",async()=>{
  const restore=mockDOM();
  const previous={game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui};
  try{
    const scene={id:"scene",regions:new Map(),
      canUserModify:()=>true};
    const atlas={revision:4,roads:[{id:"road",name:"Road to Eyrie"}],
      nodes:[{id:"node",x:50,y:25}],
      checkpoints:[{id:"eyrie",name:"The Eyrie",nodeId:"node",roadId:"road"}]};
    const view={scene,ready:true};
    globalThis.canvas=view;
    globalThis.game={user:{isGM:true},settings:{get:()=>null}};
    globalThis.ui={notifications:{error:message=>{throw Error(message);}}};
    const calls=[];
    const planner={scene,start:point(0,0),end:point(10,0),sourceMode:"party",
      destinationMode:"map",selectedCheckpointId:null,
      atlasProvider:()=>atlas,canvasProvider:()=>view,
      syncPartyDeparture(){calls.push("party-origin");},
      calculateRoute(){calls.push("calculate");},
      draw(){calls.push("draw");},
      async render(){calls.push("render");}
    };
    const root=checkpointDestinationControl(planner);
    const method=child(child(root,"label"),"select");
    const cpLabel=root.children.find(node=>node.htmlFor===
      "atlas-navigation-destination-checkpoint");
    const cpSelect=child(cpLabel,"select");
    assert.equal(method.value,"map");
    assert.equal(cpLabel.hidden,true);
    assert.equal(cpSelect.children[1].tag,"optgroup");
    assert.equal(cpSelect.children[1].children[0].value,"eyrie");
    assert.deepEqual(calls,[],"constructing controls is side-effect free");

    method.value="checkpoint";
    method.listeners.change();
    assert.equal(planner.destinationMode,"checkpoint");
    assert.equal(planner.end,null,"switching preview method clears only old Point B");
    cpSelect.value="eyrie";
    await cpSelect.listeners.change();
    assert.deepEqual(planner.end,point(50,25));
    assert.equal(planner.selectedCheckpointId,"eyrie");
    assert.ok(calls.includes("calculate"));
    assert.ok(calls.includes("party-origin"));
    planner.end=point(50,25);
    method.value="map";
    method.listeners.change();
    assert.equal(planner.destinationMode,"map");
    assert.equal(planner.end,null);
    assert.equal(planner.selectedCheckpointId,null);
  }finally{
    restore();
    globalThis.game=previous.game;
    globalThis.canvas=previous.canvas;
    globalThis.ui=previous.ui;
  }
});

test("unresolved saved Journey blocks both destination modes",()=>{
  const restore=mockDOM();
  try{
    const planner={scene:{id:"scene"},recoveryRecord:{status:"interrupted"}};
    assert.equal(checkpointDestinationControl(planner),null);
  }finally{restore();}
});
