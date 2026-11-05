import assert from "node:assert/strict";
import test from "node:test";
import {mayCheckpointJourneyStatus,assessJourneyTeardown,
  mayAttemptCanvasJourneyRecovery,classifyRecoveredJourneyBoundary}
  from "../scripts/navigation-journey-lifecycle.js";

test("durable terminal Journeys cannot be downgraded by delayed callbacks",()=>{
  for(const terminal of ["completed","ended"]){
    assert.equal(mayCheckpointJourneyStatus(terminal,"interrupted"),false);
    assert.equal(mayCheckpointJourneyStatus(terminal,"paused"),false);
    assert.equal(mayCheckpointJourneyStatus(terminal,terminal),true);
  }
  assert.equal(mayCheckpointJourneyStatus("moving","paused"),true);
  assert.equal(mayCheckpointJourneyStatus("interrupted","completed"),true);
});

test("canvas teardown retains only verified arrivals and manual pauses",()=>{
  const session={phase:"moving",completedDistance:100,totalDistance:100,
    journeyRecord:{status:"paused",pendingNativeMove:null}};
  assert.deepEqual(assessJourneyTeardown(session),{
    terminal:false,confirmedArrival:true,confirmedPause:false,
    interruptedStatus:"paused"});
  session.phase="paused";session.completedDistance=65;
  assert.equal(assessJourneyTeardown(session).confirmedPause,true);
  session.journeyRecord.pendingNativeMove={operationId:"unfinished"};
  assert.equal(assessJourneyTeardown(session).interruptedStatus,"interrupted",
    "an in-flight native operation prevents a confirmed pause");
  session.journeyRecord.status="completed";
  assert.equal(assessJourneyTeardown(session).terminal,true);
  assert.equal(assessJourneyTeardown(null).confirmedArrival,false);
});

test("auto recovery is limited to involuntary canvas teardown while moving",()=>{
  const session={phase:"moving",manualRestApplying:false,
    journal:{id:"journal"},journeyRecord:{status:"moving"}};
  assert.equal(mayAttemptCanvasJourneyRecovery("canvasTearDown",session),true);
  assert.equal(mayAttemptCanvasJourneyRecovery("canvasReady",session),false);
  session.phase="rest-applying";
  assert.equal(mayAttemptCanvasJourneyRecovery("canvasTearDown",session),true);
  session.manualRestApplying=true;
  assert.equal(mayAttemptCanvasJourneyRecovery("canvasTearDown",session),false);
  session.manualRestApplying=false;session.phase="paused";
  assert.equal(mayAttemptCanvasJourneyRecovery("canvasTearDown",session),false);
  session.phase="moving";session.journal=null;
  assert.equal(mayAttemptCanvasJourneyRecovery("canvasTearDown",session),false);
});

test("fully travelled but unfinalized checkpoint cannot be guessed from token location",()=>{
  const journal={status:"interrupted",pendingNativeMove:null,
    legs:[{completedPercent:100,destination:{x:200,y:0},
      transport:{arrivalCheckpointId:"port"}}],
    routeTargets:{nextTargetIndex:1,targets:[
      {id:"A",checkpointId:null},
      {id:"B",checkpointId:"port",point:{x:200,y:0}},
      {id:"C",checkpointId:"dock"}]}};
  assert.deepEqual(classifyRecoveredJourneyBoundary(journal),{
    kind:"review",reason:"checkpoint-not-finalized"});
  journal.status="paused";
  assert.deepEqual(classifyRecoveredJourneyBoundary(journal),{
    kind:"review",reason:"checkpoint-target-not-committed"},
  "a rounded 100% must not advance the durable A/B/C target");
  journal.routeTargets.nextTargetIndex=2;
  assert.deepEqual(classifyRecoveredJourneyBoundary(journal,{gridSize:100}),{
    kind:"confirmed-transfer",checkpointId:"port"});
  journal.routeTargets.targets[1].point.x=300;
  assert.equal(classifyRecoveredJourneyBoundary(journal,{gridSize:100}).reason,
    "checkpoint-target-coordinate-changed");
  journal.routeTargets.targets[1].point.x=200;
  journal.pendingNativeMove={operationId:"still-in-flight"};
  assert.equal(classifyRecoveredJourneyBoundary(journal).reason,"unresolved-native-intent");
  journal.pendingNativeMove=null;
  journal.legs[0].completedPercent=99.9;
  assert.equal(classifyRecoveredJourneyBoundary(journal).kind,"unfinished",
    "a nearly complete Journey still needs its remaining verified movement");
  journal.legs[0].completedPercent=100;
  delete journal.legs[0].transport;
  assert.equal(classifyRecoveredJourneyBoundary(journal).reason,
    "completed-leg-without-arrival-decision");
});
