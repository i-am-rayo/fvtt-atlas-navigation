import assert from "node:assert/strict";
import test from "node:test";
import {planGuidedTravelChunks,waitForTokenTravelAnimation}
  from "../scripts/navigation-movement-lifecycle.js";

test("waits for a client animation after the document has already finished moving",async()=>{
  let finish;
  const token={object:{movementAnimationPromise:new Promise(resolve=>{finish=resolve;})}};
  let settled=false;
  const pending=waitForTokenTravelAnimation(token).then(()=>{settled=true;});
  await Promise.resolve();
  assert.equal(settled,false);
  finish();
  await pending;
  assert.equal(settled,true);
});

test("tokens without a rendered canvas animation complete without polling",async()=>{
  await waitForTokenTravelAnimation({object:{movementAnimationPromise:null}});
  await waitForTokenTravelAnimation(null);
});

test("native movement chunks preserve the full curved path without shortcuts",()=>{
  const path=[{x:0,y:0},{x:100,y:0},{x:100,y:100}];
  const chunks=planGuidedTravelChunks(path,{gridSize:100,movementSpeed:.25,
    secondsPerChunk:2});
  assert.equal(chunks.length,4);
  assert.deepEqual(chunks[0].waypoints,[{x:0,y:0},{x:50,y:0}]);
  assert.deepEqual(chunks[1].waypoints,[{x:50,y:0},{x:100,y:0}]);
  assert.deepEqual(chunks[2].waypoints,[{x:100,y:0},{x:100,y:50}]);
  assert.deepEqual(chunks[3].waypoints,[{x:100,y:50},{x:100,y:100}]);
  assert.equal(chunks.reduce((sum,chunk)=>sum+chunk.distance,0),200);
});

test("chunk planner bounds movement work and rejects malformed travel paths",()=>{
  assert.throws(()=>planGuidedTravelChunks([{x:0,y:0},{x:1000,y:0}],{
    gridSize:100,movementSpeed:.00001}),/too long/);
  assert.throws(()=>planGuidedTravelChunks([{x:0,y:0},{x:NaN,y:0}],{
    gridSize:100,movementSpeed:1}),/invalid/);
  assert.throws(()=>planGuidedTravelChunks([{x:0,y:0},{x:0,y:0}],{
    gridSize:100,movementSpeed:1}),/cannot be divided/);
});
