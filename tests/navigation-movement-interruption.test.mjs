import assert from "node:assert/strict";
import test from "node:test";
import {describeRejectedNativeTravelMove} from "../scripts/navigation-movement-lifecycle.js";

const waypoints=[{x:100,y:200},{x:180,y:260}];

test("native false before movement yields actionable guard, not a fabricated blocker",()=>{
  const outcome=describeRejectedNativeTravelMove({
    waypoints,position:{x:100,y:200},gridSize:100,chunkIndex:0});
  assert.equal(outcome.kind,"blocked-at-origin");
  assert.match(outcome.message,/stretch 1/);
  assert.match(outcome.message,/walls/);
  assert.match(outcome.message,/preMoveToken/);
  assert.equal(outcome.movedPixels,0);
  assert.deepEqual(outcome.position,{x:100,y:200});
});

test("partial native movement is unconfirmed and requires manual Journal reconciliation",()=>{
  const outcome=describeRejectedNativeTravelMove({
    waypoints,position:{x:140,y:230},gridSize:100,chunkIndex:2});
  assert.equal(outcome.kind,"unconfirmed-partial");
  assert.match(outcome.message,/do not replay automatically/);
  assert.ok(outcome.remainingPixels>0);
});

test("a false result is still unconfirmed when the TokenDocument reached the endpoint",()=>{
  const outcome=describeRejectedNativeTravelMove({
    waypoints,position:{x:180,y:260},gridSize:100,chunkIndex:0});
  assert.equal(outcome.kind,"unconfirmed-partial");
  assert.match(outcome.message,/not confirmed/);
  assert.equal(outcome.remainingPixels,0);
});

test("missing position is bounded and never mistaken for confirmed travel",()=>{
  const outcome=describeRejectedNativeTravelMove({
    waypoints,position:{x:NaN,y:0},gridSize:100,chunkIndex:0});
  assert.equal(outcome.kind,"blocked-at-origin");
  assert.equal(outcome.position,null);
  assert.equal(outcome.movedPixels,null);
});
