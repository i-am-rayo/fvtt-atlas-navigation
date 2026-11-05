import test from "node:test";
import assert from "node:assert/strict";
import {planNativeCheckpointPath}
  from "../scripts/navigation-native-movement-plan.js";
import {validatePendingNativeMove,assessPendingNativeMove}
  from "../scripts/navigation-native-movement-reconciliation.js";

const pt=(x,y)=>({x,y});
const pending=()=>({schemaVersion:1,operationId:"native-motion-1",
  tokenId:"party",checkpointIndex:2,from:pt(20,30),to:pt(30,30),
  nativeDistance:10,movingHours:4,worldTimeBefore:1000,
  worldAdvanceSeconds:14400,atlasRevision:3});

test("one Foundry movement keeps all road bends with checkpoints, not separate token moves",()=>{
  const authored=[pt(0,0),pt(30,0),pt(30,40),pt(80,40)];
  const before=structuredClone(authored);
  const plan=planNativeCheckpointPath(authored,{movementSpeed:1,gridSize:10,
    secondsPerCheckpoint:2,totalMovingHours:12});
  assert.deepEqual(authored,before,"the planner may not modify authoritative road points");
  assert.deepEqual(plan.path.filter(p=>p.checkpoint).map(({x,y})=>pt(x,y)),
    [pt(20,0),pt(30,10),pt(30,30),pt(40,40),pt(60,40),pt(80,40)]);
  assert.ok(plan.path.some(p=>p.x===30&&p.y===0),
    "the original first right-angle bend remains on the native path");
  assert.ok(plan.path.some(p=>p.x===30&&p.y===40),
    "the original second right-angle bend remains on the native path");
  assert.equal(plan.totalDistance,120);
  assert.equal(plan.checkpoints.length,6);
  assert.equal(plan.checkpoints.at(-1).completedMovingHours,12);
  assert.equal(plan.checkpoints.at(-1).completedDistance,120);
  assert.equal(plan.path.filter(p=>p.checkpoint).length,plan.checkpoints.length);
});

test("native waypoint planning rejects invalid or unbounded movement",()=>{
  assert.throws(()=>planNativeCheckpointPath([pt(0,0),pt(1,1)],{
    gridSize:10,movementSpeed:1,totalMovingHours:-1}),/approved travel hours/);
  assert.throws(()=>planNativeCheckpointPath([pt(0,0),pt(10000,0)],{
    gridSize:1,movementSpeed:1,totalMovingHours:1}),/too long for safe/);
});

test("native recovery classifies only uniquely witnessed endpoint and clock state",()=>{
  const intent=pending();
  assert.deepEqual(validatePendingNativeMove(intent),intent);
  const context={tokenId:"party",atlasRevision:3,recordedMovementIds:["native-motion-1"]};
  assert.deepEqual(assessPendingNativeMove(intent,{...context,tokenPoint:pt(20,30),
    worldTime:1000}),{status:"at-start",confirmed:false,worldClockAction:"none"});
  assert.equal(assessPendingNativeMove(intent,{...context,tokenPoint:pt(20,30),
    worldTime:1001}).status,"review",
  "a clock change before token movement may not be silently ignored");
  assert.deepEqual(assessPendingNativeMove(intent,{...context,tokenPoint:pt(30,30),
    worldTime:1000}),{status:"at-end",confirmed:true,worldClockAction:"advance"});
  assert.deepEqual(assessPendingNativeMove(intent,{...context,tokenPoint:pt(30,30),
    worldTime:15400}),{status:"at-end",confirmed:true,worldClockAction:"already-advanced"});
  assert.match(assessPendingNativeMove(intent,{...context,tokenPoint:pt(30,30),
    recordedMovementIds:[],worldTime:1000}).reason,/movement ID/);
  assert.equal(assessPendingNativeMove(intent,{...context,tokenPoint:pt(30,30),
    worldTime:1001}).status,"review");
  assert.equal(assessPendingNativeMove(intent,{...context,tokenPoint:pt(31,30),
    worldTime:1000}).status,"review");
  assert.equal(assessPendingNativeMove(intent,{...context,tokenId:"other",
    tokenPoint:pt(30,30),worldTime:1000}).status,"review");
  assert.equal(assessPendingNativeMove(intent,{...context,atlasRevision:4,
    tokenPoint:pt(30,30),worldTime:1000}).status,"review");
  assert.deepEqual(intent,pending(),"classification must not alter the durable intent");
});

test("native recovery cannot accept tampered, missing, or oversized intent",()=>{
  assert.throws(()=>validatePendingNativeMove({...pending(),operationId:"unsafe/id"}),
    /Invalid pending/);
  assert.throws(()=>validatePendingNativeMove({...pending(),nativeDistance:-3}),
    /Invalid pending/);
  assert.throws(()=>validatePendingNativeMove({...pending(),to:{x:NaN,y:2}}),
    /Invalid pending/);
  assert.equal(assessPendingNativeMove({...pending(),worldAdvanceSeconds:0},{
    tokenId:"party",atlasRevision:3,recordedMovementIds:["native-motion-1"],
    tokenPoint:pt(30,30),worldTime:1000}).worldClockAction,"none");
});
