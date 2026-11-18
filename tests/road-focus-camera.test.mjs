import test from "node:test";
import assert from "node:assert/strict";
import { roadFocusCamera } from "../scripts/road-focus-camera.js";

const view=(sceneX=100,sceneY=200)=>({
  dimensions:{sceneX,sceneY},
  stage:{scale:{x:.5}},
  app:{renderer:{screen:{width:1000,height:700}}}
});
const atlas={schemaVersion:3};
const road=[{x:0,y:0},{x:400,y:200}];

test("Locate keeps current zoom while editor focuses and zooms into road bounds",()=>{
  assert.deepEqual(roadFocusCamera(view(),atlas,road),{x:300,y:300,scale:.5});
  assert.deepEqual(roadFocusCamera(view(),atlas,road,{zoomIntoRoad:true}),
    {x:300,y:300,scale:2.2});
});

test("focus target remains image-relative after changing Scene padding",()=>{
  const before=roadFocusCamera(view(100,200),atlas,road,{zoomIntoRoad:true});
  const after=roadFocusCamera(view(500,600),atlas,road,{zoomIntoRoad:true});
  assert.deepEqual({x:after.x-before.x,y:after.y-before.y},{x:400,y:400});
  assert.equal(after.scale,before.scale);
});

test("long roads zoom out to fit, tiny drafts cannot zoom beyond safe cap",()=>{
  const big=roadFocusCamera(view(),atlas,[{x:0,y:0},{x:2400,y:2000}],
    {zoomIntoRoad:true});
  assert.ok(big.scale<.5);
  const single=roadFocusCamera(view(),atlas,[{x:50,y:80}],{zoomIntoRoad:true});
  assert.equal(single.scale,2.2);
  assert.throws(()=>roadFocusCamera(view(),atlas,[]),/No road points/);
  assert.throws(()=>roadFocusCamera(view(),atlas,[{x:NaN,y:5}]),/invalid/);
});
