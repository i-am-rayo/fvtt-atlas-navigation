import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_CHECKPOINT_APPEARANCE,validateCheckpointAppearance,
  validateCheckpointBanner,resolveCheckpointBanner,withCheckpointBanner}
  from "../scripts/checkpoint-appearance.js";
import {checkpointBannerLines,formatCheckpointBannerElevation}
  from "../scripts/checkpoint-banner.js";
import {playerAtlasOverlay} from "../scripts/player-overlay-model.js";

test("legacy checkpoint appearance remains readable, no implicit banner or migration",()=>{
  const original={...DEFAULT_CHECKPOINT_APPEARANCE,showRoadName:true};
  assert.deepEqual(validateCheckpointAppearance(original),original);
  assert.equal(Object.hasOwn(original,"banner"),false);
  assert.deepEqual(resolveCheckpointBanner(original),{
    showType:false,showElevation:false,territoryRegionId:null});
  assert.deepEqual(withCheckpointBanner(original,{
    showType:false,showElevation:false,territoryRegionId:null}),original,
    "default Checkpoint banner leaves legacy schema exact");
  const previous={...original};delete previous.borderColor;
  assert.equal(validateCheckpointAppearance(previous).borderColor,"#000000");
  assert.equal(Object.hasOwn(previous,"banner"),false,
    "read-only validation never writes a migration to the input");
});
test("explicit banner options validate booleans, Region IDs and reject unsafe metadata",()=>{
  const base=DEFAULT_CHECKPOINT_APPEARANCE;
  const appearance=withCheckpointBanner(base,{
    showType:true,showElevation:true,territoryRegionId:"continent-123"});
  assert.deepEqual(appearance.banner,{
    showType:true,showElevation:true,territoryRegionId:"continent-123"});
  assert.deepEqual(validateCheckpointAppearance(appearance),appearance);
  for(const bad of [
    {showType:"yes",showElevation:false,territoryRegionId:null},
    {showType:true,showElevation:0,territoryRegionId:null},
    {showType:false,showElevation:false,territoryRegionId:"../../../secret"},
    {showType:false,showElevation:false,territoryRegionId:"a".repeat(130)},
    {showType:false,showElevation:false,territoryRegionId:null,secret:"name"},
    {showType:true,showElevation:true}
  ])assert.throws(()=>validateCheckpointBanner(bad),/Invalid/);
  assert.throws(()=>validateCheckpointAppearance({...base,
    banner:{...appearance.banner,regionName:"GM secret"}}),/Invalid/);
});
test("shared banner composition retains name hierarchy and only provided filtered details",()=>{
  const appearance=withCheckpointBanner({...DEFAULT_CHECKPOINT_APPEARANCE,
    showRoadName:true},{showType:true,showElevation:true,
      territoryRegionId:"valecor"});
  assert.deepEqual(checkpointBannerLines({appearance,
    checkpointType:"City",elevationMeters:100,
    elevationUnits:"metric",roadName:"Road to Dirwest",
    territoryName:"Valecor"}),[
    {kind:"type",text:"Type: City"},
    {kind:"elevation",text:"Elevation: 100 m"},
    {kind:"road",text:"Road to Dirwest"},
    {kind:"territory",text:"Territory: Valecor"}]);
  assert.equal(formatCheckpointBannerElevation(30.48,"imperial"),"Elevation: 100 ft");
  assert.deepEqual(checkpointBannerLines({appearance,
    checkpointType:null,elevationMeters:null,roadName:null,territoryName:null}),[],
    "missing or withheld Region/Road names cannot be fabricated");
  assert.equal(checkpointBannerLines({appearance:{...DEFAULT_CHECKPOINT_APPEARANCE,
    showRoadName:true},roadName:"Old Road"}).length,1,
    "old Road label appears exactly once");
});
test("player overlay projects opt-in elevation only for shown or discovered checkpoint",()=>{
  const banner=withCheckpointBanner({...DEFAULT_CHECKPOINT_APPEARANCE,
    showRoadName:true},{showType:true,showElevation:true,
      territoryRegionId:"valecor"});
  const bare={...DEFAULT_CHECKPOINT_APPEARANCE};
  const atlas={schemaVersion:10,roads:[{id:"hiddenRoad",name:"Secret Pass",playerVisible:false}],
    segments:[{id:"segment",roadId:"hiddenRoad",from:"a",to:"b",via:[],
      bidirectional:true}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:10,y:0}],
    checkpoints:[
      {id:"shown",name:"Dirwest",nodeId:"a",roadId:"hiddenRoad",
        elevationMeters:123.45,appearance:banner,playerVisible:true},
      {id:"hidden",name:"Hidden Town",nodeId:"b",roadId:"hiddenRoad",
        elevationMeters:123,appearance:banner,playerVisible:false},
      {id:"legacy",name:"Old",nodeId:"b",roadId:"hiddenRoad",
        elevationMeters:500,appearance:bare,playerVisible:true}
    ]};
  const projected=playerAtlasOverlay(atlas,null);
  assert.deepEqual(projected.roads,[],"Road name cannot leak through Road projection");
  assert.deepEqual(projected.checkpoints.map(c=>c.id),["shown","legacy"]);
  assert.equal(projected.checkpoints[0].roadId,null);
  assert.equal(projected.checkpoints[0].elevationMeters,123.45);
  assert.deepEqual(projected.checkpoints[0].appearance.banner,banner.banner);
  assert.equal(projected.checkpoints[1].elevationMeters,null,
    "legacy elevation remains redacted");
  assert.deepEqual(checkpointBannerLines({
    appearance:projected.checkpoints[0].appearance,
    checkpointType:"City",elevationMeters:projected.checkpoints[0].elevationMeters,
    roadName:projected.roads.find(r=>r.id===projected.checkpoints[0].roadId)?.name,
    territoryName:null}).filter(item=>item.kind==="road"),[],
    "a hidden Road cannot be revealed by an opted-in banner");
});
