import test from "node:test";
import assert from "node:assert/strict";
import {planNativeCheckpointPath,anchorNativeTokenWaypoints,
  describeNativeCheckpointSources,NATIVE_CONTINUOUS_CHECKPOINT_SECONDS}
  from "../scripts/navigation-native-movement-plan.js";
import {validatePendingNativeMove,assessPendingNativeMove}
  from "../scripts/navigation-native-movement-reconciliation.js";

const pt=(x,y)=>({x,y});
const pending=()=>({schemaVersion:1,operationId:"native-motion-1",
  tokenId:"party",checkpointIndex:2,from:pt(20,30),to:pt(30,30),
  nativeDistance:10,movingHours:4,worldTimeBefore:1000,
  worldAdvanceSeconds:14400,atlasRevision:3});

test("native pause checkpoints target at most two seconds of nominal playback",()=>{
  assert.equal(NATIVE_CONTINUOUS_CHECKPOINT_SECONDS,2);
  const route=planNativeCheckpointPath([pt(0,0),pt(100,0)],{
    movementSpeed:1,gridSize:10,
    secondsPerCheckpoint:NATIVE_CONTINUOUS_CHECKPOINT_SECONDS,totalMovingHours:2});
  assert.equal(route.checkpoints.length,5);
  assert.ok(route.checkpoints.every(checkpoint=>checkpoint.distance<=20),
    "the next durable checkpoint bounds pause latency without requiring road nodes");
});

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

test("bounded arrival verifies native identity, ordered waypoints and exact clock before credit",async()=>{
  const {assessBoundedNativeArrival}=await import("../scripts/navigation-native-movement-reconciliation.js");
  const from={x:0,y:0},bend={x:10,y:4},to={x:20,y:0};
  const pending={schemaVersion:1,bounded:true,previousMovementId:null,
    operationId:"bounded-op",tokenId:"party",checkpointIndex:2,from,to,
    path:[from,bend,to],completedPercent:50,nativeDistance:22,movingHours:1,
    worldTimeBefore:100,worldAdvanceSeconds:3600,atlasRevision:4};
  const movement={id:"bounded-op",state:"stopped",origin:from,destination:to,
    passed:{waypoints:[from,bend,to]}};
  const context={tokenId:"party",tokenPoint:to,atlasRevision:4,worldTime:100,movement};
  assert.equal(assessBoundedNativeArrival(pending,context).worldClockAction,"advance");
  assert.equal(assessBoundedNativeArrival(pending,{...context,worldTime:3700}).worldClockAction,"already-advanced");
  assert.equal(assessBoundedNativeArrival(pending,{...context,worldTime:200}).status,"review");
  assert.equal(assessBoundedNativeArrival(pending,{...context,tokenPoint:{x:430,y:0}}).status,"review");
  assert.equal(assessBoundedNativeArrival(pending,{...context,movement:{...movement,id:"other"}}).status,"review");
  assert.equal(assessBoundedNativeArrival(pending,{...context,movement:{...movement,
    passed:{waypoints:[from,to,bend]}}}).status,"review");
});

test("live v14 checkpoint 10 uses separate origin and ordered destination waypoints",async()=>{
  const {assessBoundedNativeArrival}=await import("../scripts/navigation-native-movement-reconciliation.js");
  const path=[pt(3964,2178),pt(3959,2214),pt(3953,2225),pt(3942,2237),pt(3935,2243)];
  const operationId="A4lYQ7BRk9Bg0mxJ";
  const intent={schemaVersion:1,bounded:true,previousMovementId:"2HK8P3WTVosg7yHB",
    operationId,tokenId:"party",checkpointIndex:9,from:path[0],to:path.at(-1),
    path,completedPercent:83.89029316924135,nativeDistance:74.80603416676962,
    movingHours:4.00516488699251,worldTimeBefore:28978478955,worldAdvanceSeconds:14419,
    atlasRevision:587};
  const passed=path.slice(1).map(p=>({...p,movementId:operationId,elevation:0}));
  const movement={id:operationId,chain:[],state:"completed",constrained:false,
    origin:path[0],destination:path.at(-1),passed:{waypoints:passed},pending:{waypoints:[]}};
  const context={tokenId:"party",tokenPoint:path.at(-1),atlasRevision:587,
    worldTime:28978478955,movement};
  assert.deepEqual(assessBoundedNativeArrival(intent,context),
    {status:"at-end",confirmed:true,worldClockAction:"advance"});
  assert.equal(assessBoundedNativeArrival(intent,{...context,worldTime:28978493374}).worldClockAction,
    "already-advanced");
  for(const changed of [
    {...movement,origin:pt(3968,2178)},
    {...movement,id:"foreign"},
    {...movement,passed:{waypoints:passed.slice(1)}},
    {...movement,passed:{waypoints:[passed[1],passed[0],...passed.slice(2)]}},
    {...movement,passed:{waypoints:[...passed,pt(4000,2300)]}},
    {...movement,pending:{waypoints:[pt(4000,2300)]}},
    {...movement,constrained:true}
  ])assert.equal(assessBoundedNativeArrival(intent,{...context,movement:changed}).status,"review");
  assert.equal(assessBoundedNativeArrival(intent,{...context,worldTime:28978478956}).status,"review");
  assert.equal(assessBoundedNativeArrival(intent,{...context,tokenPoint:pt(3939,2243)}).status,"review");
  // Existing mocks/versions may include the origin; require it to match as well.
  assert.equal(assessBoundedNativeArrival(intent,{...context,movement:{...movement,
    passed:{waypoints:path}}}).status,"at-end");
  assert.equal(assessBoundedNativeArrival(intent,{...context,movement:{...movement,
    origin:pt(3968,2178),passed:{waypoints:path}}}).status,"review");
});

test("dev.22 live snapped intermediate waypoint is native evidence, not an authored bend",async()=>{
  const {assessBoundedNativeArrival}=await import("../scripts/navigation-native-movement-reconciliation.js");
  const path=[pt(3763,1675),pt(3816,1716),pt(3823,1720)];
  const operationId="AWT1ypT9qflk7VTs";
  const intent={schemaVersion:1,bounded:true,previousMovementId:"gG8WwHMSOFHJLQXG",
    operationId,tokenId:"party",checkpointIndex:0,from:path[0],to:path.at(-1),
    path,completedPercent:8.389029316924134,nativeDistance:74.80603416676962,
    movingHours:4.005164886992507,worldTimeBefore:28978493833,worldAdvanceSeconds:14419,
    atlasRevision:587};
  const intermediate={...pt(3798,1697),intermediate:true,snapped:true,
    explicit:false,checkpoint:false,movementId:operationId,subpathId:operationId};
  const passed=[intermediate,...path.slice(1).map(p=>({...p,movementId:operationId}))];
  const movement={id:operationId,state:"completed",constrained:false,
    origin:path[0],destination:path.at(-1),passed:{waypoints:passed},pending:{waypoints:[]}};
  const context={movement,tokenId:"party",tokenPoint:path.at(-1),atlasRevision:587,
    worldTime:28978493833};
  assert.equal(assessBoundedNativeArrival(intent,context).worldClockAction,"advance");
  assert.equal(assessBoundedNativeArrival(intent,{...context,worldTime:28978508252}).worldClockAction,"already-advanced");
  for(const bad of [
    [{...intermediate,y:1680},...passed.slice(1)],
    [{...intermediate,movementId:"foreign"},...passed.slice(1)],
    [{...intermediate,explicit:true},...passed.slice(1)],
    [{...intermediate,checkpoint:true},...passed.slice(1)],
    [{...intermediate,snapped:false},...passed.slice(1)],
    [intermediate,passed[2]],
    [passed[1],intermediate,passed[2]],
    [intermediate,{...intermediate,x:3789,y:1692},...passed.slice(1)]
  ])assert.equal(assessBoundedNativeArrival(intent,{...context,
    movement:{...movement,passed:{waypoints:bad}}}).status,"review");
});

test("durable endpoint evidence survives a reload but cannot override conflicting native identity or clock",async()=>{
  const {assessBoundedNativeArrival,captureNativeArrivalEvidence,validatePendingNativeMove}=
    await import("../scripts/navigation-native-movement-reconciliation.js");
  const from=pt(0,0),to=pt(20,0),operationId="receipt-op";
  const intent={schemaVersion:1,bounded:true,previousMovementId:null,
    operationId,tokenId:"party",checkpointIndex:0,from,to,path:[from,to],
    completedPercent:50,nativeDistance:20,movingHours:1,
    worldTimeBefore:100,worldAdvanceSeconds:3600,atlasRevision:4};
  const movement={id:operationId,state:"completed",origin:from,destination:to,
    constrained:false,passed:{waypoints:[{...to,movementId:operationId}]},pending:{waypoints:[]}};
  const evidence=captureNativeArrivalEvidence(intent,{movement,tokenPoint:to});
  assert.ok(evidence);
  assert.equal(captureNativeArrivalEvidence(intent,{movement,tokenPoint:from}),null);
  assert.equal(captureNativeArrivalEvidence(intent,{movement:{...movement,constrained:true},tokenPoint:to}),null);
  assert.equal(captureNativeArrivalEvidence(intent,{movement:{...movement,passed:{waypoints:[]}},tokenPoint:to}),null);
  const saved=validatePendingNativeMove({...intent,arrivalEvidence:evidence});
  const context={tokenId:"party",tokenPoint:to,atlasRevision:4,worldTime:100,
    movement:{id:"",state:"completed"}};
  assert.equal(assessBoundedNativeArrival(intent,context).status,"review");
  assert.equal(assessBoundedNativeArrival(saved,context).worldClockAction,"advance");
  assert.equal(assessBoundedNativeArrival(saved,{...context,worldTime:3700}).worldClockAction,"already-advanced");
  assert.equal(assessBoundedNativeArrival(saved,{...context,worldTime:101}).status,"review");
  assert.equal(assessBoundedNativeArrival(saved,{...context,tokenPoint:from}).status,"review");
  assert.equal(assessBoundedNativeArrival(saved,{...context,movement:{id:"foreign",state:"completed"}}).status,"review");
  assert.equal(assessBoundedNativeArrival(saved,{...context,movement:{id:"",state:"moving"}}).status,"review");
  assert.throws(()=>validatePendingNativeMove({...saved,arrivalEvidence:{...evidence,id:"foreign"}}),/Invalid/);
});
