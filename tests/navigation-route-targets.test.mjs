import assert from "node:assert/strict";
import test from "node:test";
import {buildJourneyTargets,confirmJourneyTarget,nextJourneyTarget,
  assessJourneyAnchor,captureJourneyAnchor,validateJourneyTargets}
  from "../scripts/navigation-route-targets.js";
import {createJourneyRecord,checkpointJourneyRecord,resumeJourneyRecord,
  validateJourneyRecord} from "../scripts/navigation-journey-journal.js";

const A={x:0,y:0},B={x:100,y:0},C={x:200,y:0};
const atlas={segments:[
  {id:"s-land",roadId:"land-road",from:"a",to:"b",via:[]},
  {id:"s-sea",roadId:"sea-road",from:"b",to:"c",via:[]}
],nodes:[{id:"a",...A},{id:"b",...B},{id:"c",...C}],
checkpoints:[{id:"port",nodeId:"b"},{id:"dock",nodeId:"c"}]};
const route={status:"ok",start:A,end:C,legs:[
  {kind:"road",roadId:"land-road",segmentId:"s-land",points:[A,B],distance:100},
  {kind:"road",roadId:"sea-road",segmentId:"s-sea",points:[B,C],distance:100}
]};
const transitions={legs:[
  {lastRouteLeg:0,end:B,arrivalCheckpoint:{id:"port",name:"Port"}},
  {lastRouteLeg:1,end:C,arrivalCheckpoint:{id:"dock",name:"Dock"}}
]};
const itinerary=(start,end)=>({schemaVersion:1,scene:{name:"Paedor",units:"mi"},
  endpoints:{departure:start,destination:end},
  measurements:{distance:100,travelHours:8,terrainAware:false},
  travel:{speedPerHour:12.5},directions:[]});
const schedule={completedHours:8,todayHours:8,permittedExtraUntil:0,
  restEvents:0,lastForcedCheck:null,events:[]};

test("A/B/C targets preserve scene-local checkpoint, road and segment identities",()=>{
  const plan=buildJourneyTargets({route,transitions,atlas});
  assert.deepEqual(plan.targets.map(item=>item.id),["A","B","C"]);
  assert.deepEqual(plan.targets.map(item=>item.point),[A,B,C]);
  assert.equal(plan.targets[1].roadId,"land-road");
  assert.equal(plan.targets[1].segmentId,"s-land");
  assert.equal(plan.targets[1].checkpointId,"port");
  assert.equal(plan.targets[2].checkpointId,"dock");
  assert.equal(plan.targets[2].levelId,null,"no invented native Level mapping");
  assert.equal(nextJourneyTarget(plan).id,"B");
  assert.equal(nextJourneyTarget(confirmJourneyTarget(plan,{
    checkpointId:"other",position:B})).id,"B","wrong checkpoint cannot advance");
  const confirmed=confirmJourneyTarget(plan,{checkpointId:"port",position:B,
    transport:{methodId:"ship-hire",arrangement:"hire"}});
  assert.equal(nextJourneyTarget(confirmed).id,"C");
  assert.equal(confirmed.targets[1].approvedTransport.methodId,"ship-hire");
  assert.equal(nextJourneyTarget(plan).id,"B","plan is immutable");
  assert.throws(()=>validateJourneyTargets({...plan,nextTargetIndex:99}),/Invalid/);
  assert.throws(()=>confirmJourneyTarget(plan,{checkpointId:"port",position:C}),/inconsistent/);
});

test("Journal checkpoint and resume retain ABC intent, final B, and confirmed anchors",()=>{
  const targets=buildJourneyTargets({route,transitions,atlas});
  const initialAnchor=captureJourneyAnchor({point:A,atlas,gridSize:100});
  const initial=createJourneyRecord({sceneId:"scene",tokenId:"token",atlasRevision:1,
    itinerary:itinerary(A,B),journeyDestination:C,
    routeTargets:targets,initialAnchor});
  const reached=checkpointJourneyRecord(initial,{schedule,progress:100,status:"paused",
    confirmedAnchor:captureJourneyAnchor({point:B,atlas,gridSize:100}),
    arrivedCheckpoint:{id:"port",point:B}});
  assert.equal(reached.routeTargets.nextTargetIndex,2);
  assert.equal(reached.lastConfirmedAnchor.checkpointId,"port");
  assert.deepEqual(reached.destination,C);
  assert.equal(reached.legs.length,1);
  const resumed=resumeJourneyRecord(reached,{itinerary:itinerary(B,C),atlasRevision:1});
  assert.equal(resumed.routeTargets.nextTargetIndex,2);
  assert.deepEqual(resumed.destination,C,"a checkpoint destination must not replace final B");
  assert.deepEqual(nextJourneyTarget(resumed.routeTargets).point,C);
  assert.equal(resumed.legs.length,2);
  assert.equal(initial.routeTargets.nextTargetIndex,1);
  const legacy=createJourneyRecord({sceneId:"scene",tokenId:"token",atlasRevision:1,
    itinerary:itinerary(A,B)});
  assert.equal(validateJourneyRecord(legacy).routeTargets,undefined,
    "legacy Journeys load unchanged without write-on-read migration");
});

test("small token drift and matching road IDs permit recovery; distant moves fail closed",()=>{
  const anchor=captureJourneyAnchor({point:{x:20,y:0},atlas,gridSize:100});
  assert.equal(anchor.segmentId,"s-land");
  assert.equal(assessJourneyAnchor({anchor,position:{x:21,y:8},atlas,gridSize:100}).kind,
    "coordinate");
  assert.equal(assessJourneyAnchor({anchor,position:{x:75,y:0},atlas,gridSize:100}).kind,
    "road");
  assert.equal(assessJourneyAnchor({anchor,position:{x:600,y:0},atlas,gridSize:100}).safe,
    false);
  assert.equal(assessJourneyAnchor({anchor,position:{x:75,y:95},atlas,gridSize:100}).safe,
    false,"unrelated off-road coordinates cannot be trusted");
  assert.throws(()=>assessJourneyAnchor({anchor,position:B,atlas,gridSize:0}),
    /Grid size/);
});
