import assert from "node:assert/strict";
import test from "node:test";
import {validateTransportJourneyInfo,confirmedTransportJourneyLines}
  from "../scripts/navigation-transport-journal.js";
import {createJourneyRecord,checkpointJourneyRecord,resumeJourneyRecord,
  validateJourneyRecord,formatJourneyJournalHTML}
  from "../scripts/navigation-journey-journal.js";

const transport=()=>({
  methodId:"sailing",methodName:"Sailing Ship",kind:"vehicle",
  arrangement:"hire",surface:"water",
  departureCheckpointName:"Port Barthos",
  arrivalCheckpointId:"dock",arrivalCheckpointName:"Hearth's Heart Dock",
  roadNames:["Barthos Strait"],estimatedFareCp:450
});
const itinerary=destination=>({
  schemaVersion:1,scene:{name:"Paedor",units:"mi"},
  endpoints:{departure:{x:0,y:0},destination},
  measurements:{distance:12,travelHours:6,terrainAware:false},
  travel:{speedPerHour:2},
  directions:[{instruction:"Across the strait",distance:12,cost:12,kind:"road"}]
});
const schedule=()=>({completedHours:6,todayHours:6,permittedExtraUntil:0,
  restEvents:0,lastForcedCheck:null,events:[]});

test("confirmed transport narratives never narrate before native progress",()=>{
  const t=transport();
  assert.deepEqual(confirmedTransportJourneyLines(t,{movingHours:0,complete:true}),[]);
  const during=confirmedTransportJourneyLines(t,{movingHours:2,complete:false});
  assert.match(during.join(" "),/booked passage.*Port Barthos/);
  assert.doesNotMatch(during.join(" "),/Disembarked/);
  assert.match(confirmedTransportJourneyLines(t,{movingHours:6,complete:true}).join(" "),
    /Disembarked at Hearth's Heart Dock/);
  assert.deepEqual(validateTransportJourneyInfo(t),t);
});

test("journal preserves method and arrival without exposing unconfirmed future legs",()=>{
  const plan={...itinerary({x:12,y:0}),transport:transport()};
  const started=createJourneyRecord({sceneId:"scene",tokenId:"party",
    atlasRevision:4,itinerary:plan});
  assert.ok(started.legs[0].transport);
  assert.doesNotMatch(formatJourneyJournalHTML(started),/booked passage/);
  const arrived=checkpointJourneyRecord(started,{schedule:schedule(),progress:100,
    status:"paused"});
  const html=formatJourneyJournalHTML(arrived);
  assert.match(html,/booked passage/);
  assert.match(html,/Disembarked at Hearth&#39;s Heart Dock/);
  assert.equal(arrived.status,"paused");
  const onward=resumeJourneyRecord(arrived,{atlasRevision:4,
    itinerary:itinerary({x:25,y:0})});
  assert.deepEqual(onward.destination,{x:25,y:0},"new leg owns recovery destination");
  assert.equal(onward.legs.length,2);
  assert.equal(onward.legs[1].transport,undefined);
  assert.doesNotMatch(formatJourneyJournalHTML(onward),/Disembarked at.*<li>.*Disembarked/);
  assert.deepEqual(validateJourneyRecord(onward),onward);
});

test("invalid untrusted transport journal metadata fails closed",()=>{
  const bad=transport();bad.arrivalCheckpointName="<img onerror=alert(1)>";
  // Escaped HTML must never execute; ordinary names may contain punctuation.
  const safe=confirmedTransportJourneyLines(bad,{movingHours:1,complete:true}).join(" ");
  assert.match(safe,/img/);
  const invalid=transport();invalid.roadNames=["Uncontrolled".repeat(100)];
  assert.throws(()=>validateTransportJourneyInfo(invalid),/Invalid/);
});
