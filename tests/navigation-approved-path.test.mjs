import assert from "node:assert/strict";
import test from "node:test";
import {captureApprovedJourneyPath,assessApprovedJourneyRecovery,
  validateApprovedJourneyPath} from "../scripts/navigation-approved-path.js";

const p=(x,y)=>({x,y});
const leg=(id,points)=>({kind:"road",roadId:"ocean",segmentId:id,points});
const original={status:"ok",start:p(0,0),end:p(1000,0),legs:[
  leg("west",[p(0,0),p(500,0)]),leg("east",[p(500,0),p(1000,0)])]};
const approvedPath=captureApprovedJourneyPath(original);
const anchor=x=>({point:p(x,0),roadId:"ocean",segmentId:"east",
  checkpointId:null,levelId:null,elevation:null});
const resumed=(start=p(900,0),legs=[leg("east",[start,p(1000,0)])])=>({
  status:"ok",start,end:p(1000,0),legs});
const assess=(route,confirmed=anchor(900),gridSize=100)=>
  assessApprovedJourneyRecovery({approvedPath,route,anchor:confirmed,
    tokenPosition:route.start,gridSize});

test("new Journal evidence copies the approved polyline and stable segment identities",()=>{
  assert.equal(approvedPath.schemaVersion,1);
  assert.deepEqual(approvedPath.legs.map(leg=>leg.segmentId),["west","east"]);
  original.legs[0].points[0].x=1234;
  assert.equal(approvedPath.legs[0].points[0].x,0,
    "later Scene geometry edits cannot rewrite a Journey's snapshot");
  assert.deepEqual(validateApprovedJourneyPath(approvedPath),approvedPath);
  assert.throws(()=>validateApprovedJourneyPath({...approvedPath,legs:[{
    ...approvedPath.legs[0],points:[p(0,0),p(Infinity,0)]}]}),/invalid/i);
});

test("a confirmed original route suffix can resume without guessing distance from spline percent",()=>{
  const outcome=assess(resumed());
  assert.equal(outcome.safe,true);
  assert.equal(outcome.kind,"approved-route");
  assert.equal(outcome.routeDifferencePixels,0);
});

test("two cells are the maximum *lateral route* tolerance, not token-travel credit",()=>{
  const within={...resumed(),legs:[leg("east",[
    p(900,0),p(930,120),p(1000,0)])]};
  assert.equal(assess(within).safe,true);
  const tenCells={...resumed(),legs:[leg("east",[
    p(900,0),p(930,1000),p(1000,0)])]};
  assert.equal(assess(tenCells).safe,false);
  assert.equal(assess(tenCells).reason,"route-deviated");
  const manuallyMoved=resumed(p(960,0),[leg("east",[p(960,0),p(1000,0)])]);
  assert.equal(assess(manuallyMoved).reason,"unconfirmed-native-movement",
    "native position mismatch needs Journal verification, not auto-teleport");
});

test("saved branch identity and destination are never substituted by a new shortest path",()=>{
  assert.equal(assess(resumed(p(900,0),[leg("other",[
    p(900,0),p(1000,0)])])).reason,"road-sequence-changed");
  const different={...resumed(),end:p(990,0),legs:[leg("east",[
    p(900,0),p(990,0)])]};
  assert.equal(assess(different).reason,"destination-changed");
  const backtrack=resumed(p(900,0),[leg("east",[
    p(900,0),p(700,0),p(1000,0)])]);
  assert.equal(assess(backtrack).reason,"route-deviated");
});

test("an ambiguous return/crossing cannot infer which visit was confirmed",()=>{
  const crossing=captureApprovedJourneyPath({status:"ok",legs:[
    leg("loop",[p(0,0),p(400,0),p(0,0),p(1000,0)])]});
  const outcome=assessApprovedJourneyRecovery({approvedPath:crossing,
    route:resumed(p(0,0),[leg("loop",[p(0,0),p(1000,0)])]),
    anchor:anchor(0),tokenPosition:p(0,0),gridSize:100});
  assert.equal(outcome.reason,"ambiguous-approved-position");
});
