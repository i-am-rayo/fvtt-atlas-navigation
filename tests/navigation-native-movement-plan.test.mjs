import test from "node:test";
import assert from "node:assert/strict";
import {planNativeCheckpointPath,anchorNativeTokenWaypoints,
  describeNativeCheckpointSources}
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
  for(const checkpoint of plan.checkpoints){
    assert.deepEqual(pt(plan.path[checkpoint.pathStartIndex].x,
      plan.path[checkpoint.pathStartIndex].y),checkpoint.from);
    assert.deepEqual(pt(plan.path[checkpoint.pathEndIndex].x,
      plan.path[checkpoint.pathEndIndex].y),checkpoint.point);
  }
});

test("native waypoint planning rejects invalid or unbounded movement",()=>{
  assert.throws(()=>planNativeCheckpointPath([pt(0,0),pt(1,1)],{
    gridSize:10,movementSpeed:1,totalMovingHours:-1}),/approved travel hours/);
  assert.throws(()=>planNativeCheckpointPath([pt(0,0),pt(10000,0)],{
    gridSize:1,movementSpeed:1,totalMovingHours:1}),/too long for safe/);
});

test("native movement origin follows the committed TokenDocument, not the nearby route hex",()=>{
  const route=[pt(50,50),pt(100,50),pt(150,50)];
  const anchored=anchorNativeTokenWaypoints(route,pt(43,58),100);
  assert.deepEqual(anchored,[pt(43,58),...route],
    "a nearby actual token must approach the authored start, without a teleport");
  const plan=planNativeCheckpointPath(anchored,{movementSpeed:.5,gridSize:100,
    secondsPerCheckpoint:2,totalMovingHours:3});
  assert.deepEqual(plan.path[0],pt(43,58));
  assert.deepEqual(plan.checkpoints[0].from,pt(43,58));
  assert.deepEqual(route,[pt(50,50),pt(100,50),pt(150,50)]);
  assert.deepEqual(anchorNativeTokenWaypoints(route,pt(50.4,49.6),100)[0],pt(50,50));
  assert.throws(()=>anchorNativeTokenWaypoints(route,pt(-100,58),100),
    /too far from the approved route/);
});

test("GM checkpoint diagnostics attribute the nearest authored road and final checkpoint ID",()=>{
  const native=planNativeCheckpointPath([pt(0,0),pt(20,0),pt(40,0)],{
    movementSpeed:1,gridSize:10,secondsPerCheckpoint:2,totalMovingHours:4});
  const annotated=describeNativeCheckpointSources(native,{gridSize:10,
    token:{width:1,height:1},arrivalCheckpointId:"dock-c",
    legPaths:[{kind:"road",roadId:"waterway",segmentId:"sea-s1",
      points:[pt(5,5),pt(45,5)]}]});
  assert.equal(annotated.checkpoints[0].roadId,"waterway");
  assert.equal(annotated.checkpoints[0].segmentId,"sea-s1");
  assert.equal(annotated.checkpoints[0].atlasCheckpointId,null);
  assert.equal(annotated.checkpoints.at(-1).atlasCheckpointId,"dock-c");
  assert.equal(native.checkpoints[0].roadId,undefined,
    "derived diagnostic labels must not modify the original path plan");
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
