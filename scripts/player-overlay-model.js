import { checkpointKnowledge } from "./party-exploration-model.js";
import { PLAYER_VISIBILITY_ATLAS_SCHEMA_VERSION } from "./atlas-model.js";

/** A canvas-specific visual projection, not a confidentiality boundary for
 * Foundry's client-readable Scene flags. No persistence or GM-only metadata. */
const ROAD_STYLE_FIELDS=["color","width","opacity","pattern","labelVisibility",
  "textColor","borderColor","borderEnabled"];
const CHECKPOINT_STYLE_FIELDS=["type","icon","image","size","color",
  "borderColor","labelMode","showRoadName","textColor"];

const projectAppearance=(value,fields)=>value==null?value:
  Object.fromEntries(fields.filter(field=>Object.hasOwn(value,field))
    .map(field=>[field,value[field]]));

export function isRoadVisibleToPlayers(atlas,roadId){
  return atlas.schemaVersion>=PLAYER_VISIBILITY_ATLAS_SCHEMA_VERSION&&
    atlas.roads?.some(road=>road.id===roadId&&road.playerVisible===true)===true;
}

/** Keep only attributes consumed by the existing player canvas painter.
 * Explicit copies avoid spreading future GM-only root/child schema fields. */
export function playerAtlasOverlay(atlas,exploration=null){
  const canReveal=atlas.schemaVersion>=PLAYER_VISIBILITY_ATLAS_SCHEMA_VERSION;
  const roads=(atlas.roads??[]).filter(road=>canReveal&&road.playerVisible===true)
    .map(road=>({id:road.id,name:road.name,travelPresetId:road.travelPresetId??null,
      appearance:projectAppearance(road.appearance,ROAD_STYLE_FIELDS)}));
  const allowed=new Set(roads.map(road=>road.id));
  const segments=(atlas.segments??[]).filter(segment=>allowed.has(segment.roadId))
    .map(segment=>({id:segment.id,roadId:segment.roadId,
      from:segment.from,to:segment.to,bidirectional:segment.bidirectional,
      via:segment.via.map(p=>({x:p.x,y:p.y}))}));
  // Discovery can reveal a checkpoint independently of the owning road.
  const checkpoints=(atlas.checkpoints??[]).filter(checkpoint=>canReveal&&
    (exploration?.enabled===true
      ? checkpointKnowledge(exploration,checkpoint.id)!=="unknown"
      : checkpoint.playerVisible===true))
    .map(checkpoint=>({id:checkpoint.id,nodeId:checkpoint.nodeId,
      name:checkpoint.name,elevationMeters:null,
      appearance:projectAppearance(checkpoint.appearance,CHECKPOINT_STYLE_FIELDS),
      discoveryMode:checkpointKnowledge(exploration,checkpoint.id),
      roadId:allowed.has(checkpoint.roadId)?checkpoint.roadId:null}));
  const nodeIds=new Set(segments.flatMap(segment=>[segment.from,segment.to]));
  for(const checkpoint of checkpoints)nodeIds.add(checkpoint.nodeId);
  const nodes=(atlas.nodes??[]).filter(node=>nodeIds.has(node.id))
    .map(node=>({id:node.id,x:node.x,y:node.y}));
  // Only schemaVersion is required by image-local canvas coordinate conversion.
  return {schemaVersion:atlas.schemaVersion,roads,segments,nodes,checkpoints};
}
