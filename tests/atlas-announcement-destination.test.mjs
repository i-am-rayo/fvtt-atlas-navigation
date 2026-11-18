import assert from "node:assert/strict";
import test from "node:test";
import {publicJourneyDestinationName}
  from "../scripts/atlas-announcement-destination.js";
import {upgradeAtlasPlayerVisibility} from "../scripts/atlas-model.js";
import {defaultPartyExploration} from "../scripts/party-exploration-model.js";

export function destinationFixture(){
  const atlas=upgradeAtlasPlayerVisibility({schemaVersion:4,
    coordinateSpace:"image",revision:7,enabled:true,calibration:null,
    roads:[{id:"r",name:"Dirwest Road"}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}],
    checkpoints:[{id:"city",roadId:"r",nodeId:"b",name:"Dirwest",
      elevationMeters:null}]});
  const record={sceneId:"scene-1",atlasRevision:atlas.revision,status:"moving",
    destination:{x:100,y:0},lastConfirmedAnchor:{point:{x:0,y:0}}};
  return {atlas,record,exploration:defaultPartyExploration(),gridSize:100};
}

test("only a player-visible checkpoint at the actual saved Point B names a destination",()=>{
  const state=destinationFixture();
  assert.equal(publicJourneyDestinationName(state),null);
  state.atlas.checkpoints[0].playerVisible=true;
  assert.equal(publicJourneyDestinationName(state),"Dirwest");
  assert.equal(publicJourneyDestinationName({...state,record:{...state.record,
    destination:{x:45,y:0}}}),null,
    "do not use the nearest city merely because there is no closer checkpoint");
  assert.equal(publicJourneyDestinationName({...state,record:{...state.record,
    destination:{x:83,y:0}}}),"Dirwest",
    "a Point B clicked inside the checkpoint icon may be slightly off its node");
});

test("party Lore and Seen/Visited reveal checkpoint names even with legacy visibility off",()=>{
  const state=destinationFixture();
  const enabled={...state.exploration,enabled:true,tokenId:"party"};
  assert.equal(publicJourneyDestinationName({...state,exploration:enabled}),null);
  assert.equal(publicJourneyDestinationName({...state,exploration:{...enabled,
    loreKnownCheckpointIds:["city"]}}),"Dirwest");
  assert.equal(publicJourneyDestinationName({...state,exploration:{...enabled,
    discoveredCheckpointIds:["city"]}}),"Dirwest");
});

test("ambiguous overlapping checkpoints require an explicit matching route target",()=>{
  const state=destinationFixture();
  state.atlas.checkpoints[0].playerVisible=true;
  state.atlas.checkpoints.push({id:"bridge",roadId:"r",nodeId:"b",
    name:"Northern Bridge",playerVisible:true,elevationMeters:null});
  assert.equal(publicJourneyDestinationName(state),null,
    "a coordinate alone cannot choose between a bridge and a city");
  const record={...state.record,routeTargets:{targets:[
    {id:"A",point:{x:0,y:0},checkpointId:null},
    {id:"B",point:{x:100,y:0},checkpointId:"bridge"}]}};
  assert.equal(publicJourneyDestinationName({...state,record}),"Northern Bridge");
  record.routeTargets.targets[1].point={x:300,y:0};
  assert.equal(publicJourneyDestinationName({...state,record}),null,
    "an inconsistent saved target cannot authorize a public label");
});

test("arrival naming requires the saved native endpoint to match Point B",()=>{
  const state=destinationFixture();
  state.atlas.checkpoints[0].playerVisible=true;
  const completed={...state.record,status:"completed",
    lastConfirmedAnchor:{point:{x:100,y:0}}};
  assert.equal(publicJourneyDestinationName({...state,record:completed}),"Dirwest");
  assert.equal(publicJourneyDestinationName({...state,record:{...completed,
    lastConfirmedAnchor:{point:{x:-300,y:0}}}}),null);
  const broken={...state.atlas,checkpoints:[{...state.atlas.checkpoints[0],
    name:"Hidden\nName"}]};
  assert.equal(publicJourneyDestinationName({...state,atlas:broken,
    record:completed}),null);
});
