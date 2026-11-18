import test from "node:test";
import assert from "node:assert/strict";
import {RoadPointEditor} from "../scripts/road-point-editor.js";
import {applyRoadGeometryEdit} from "../scripts/road-model.js";

test("Road point Undo/Redo restores only transient immutable snapshots",()=>{
  const callbacks=[],a={revision:2,nodes:[{id:"a",x:1}]};
  const b={revision:2,nodes:[{id:"a",x:9}]};
  const editor=new RoadPointEditor({canvasProvider:()=>null,doc:()=>null,
    notify:()=>null,refresh:()=>callbacks.push("refresh")});
  editor.session={sceneId:"scene",roadId:"road",source:"road",working:b,
    operations:[{kind:"move-node",nodeId:"a",x:9,y:1}],
    history:[a,b],redo:[],onChange:()=>callbacks.push("change"),
    drag:null,extending:null,selectedHandle:null,confirming:false};
  assert.equal(editor.session.operations.length,1);
  assert.equal(editor.session.redo.length,0);
  editor.undo();
  assert.equal(editor.session.working,a);
  assert.equal(editor.session.operations.length,0);
  assert.equal(editor.session.redo.length,1);
  editor.redo();
  assert.equal(editor.session.working,b);
  assert.equal(editor.session.operations.length,1);
  assert.equal(editor.session.redo.length,0);
  assert.deepEqual(callbacks,["refresh","change","refresh","change"]);
  assert.equal(a.nodes[0].x,1,"original Scene snapshot is unchanged");
});

test("multiple Road edits Undo/Redo and a new edit invalidate redo without writes",()=>{
  const original={
    schemaVersion:10,coordinateSpace:"image",revision:3,enabled:true,calibration:null,
    roads:[{id:"road",name:"Coast Road",appearance:null,
      travelPresetId:null,playerVisible:false}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    segments:[{id:"section",roadId:"road",from:"a",to:"b",
      via:[{x:50,y:0}],bidirectional:true}],checkpoints:[]
  };
  const first={kind:"move-bend",segmentId:"section",viaIndex:0,x:50,y:10};
  const second={kind:"move-bend",segmentId:"section",viaIndex:0,x:50,y:20};
  const afterFirst=applyRoadGeometryEdit(original,{roadId:"road",operation:first});
  const afterSecond=applyRoadGeometryEdit(afterFirst,{roadId:"road",operation:second});
  const calls=[],scene={id:"scene",setFlag(){throw Error("unexpected Scene write");}};
  let next=0;
  const editor=new RoadPointEditor({canvasProvider:()=>null,doc:()=>null,
    notify:()=>null,refresh:()=>calls.push("refresh"),
    idFactory:()=>["new-node","new-section"][next++]});
  editor.session={scene,sceneId:"scene",roadId:"road",source:"road",
    working:afterSecond,history:[original,afterFirst,afterSecond],
    operations:[first,second],redo:[],onChange:()=>calls.push("change"),
    element:{removeEventListener(){}},drag:null,extending:null,selectedHandle:null,
    confirming:false};
  assert.equal(editor.getState(scene).canUndo,true);
  editor.undo();editor.undo();
  assert.equal(editor.getState(scene).canUndo,false,"Undo reaches initial snapshot");
  assert.equal(editor.getState(scene).canRedo,true);
  assert.equal(editor.session.working,original);
  editor.redo();
  assert.equal(editor.session.working,afterFirst);
  assert.equal(editor.session.redo.length,1);
  editor.insertJunction({kind:"edge",segmentId:"section",edgeIndex:1,
    atVertex:true,x:50,y:10});
  assert.equal(editor.session.operations.length,2);
  assert.equal(editor.getState(scene).canRedo,false,
    "newly applied geometry edit clears stale redo history");
  editor.redo();
  assert.equal(editor.session.operations.length,2,"stale redo is not replayed");
  assert.equal(editor.session.working.nodes.length,3);
  assert.equal(original.nodes.length,2,"draft operations never modify saved graph");
  editor.cancel();
  assert.equal(editor.session,null);
  assert.equal(editor.getState(scene),null,"cancel disposes of editing history");
  assert.ok(calls.length>0);
});
