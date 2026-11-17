import test from "node:test";
import assert from "node:assert/strict";
import {RoadPointEditor} from "../scripts/road-point-editor.js";

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
  assert.equal(editor.getState({id:"scene"}).canRedo,false);
  assert.deepEqual(callbacks,["refresh","change","refresh","change"]);
  assert.equal(a.nodes[0].x,1,"original Scene snapshot is unchanged");
});
