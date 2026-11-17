/**
 * Foundry adapter for one explicitly selected native geographic Territory.
 * The native Region owns its name, geometry, hidden state and Behaviors.
 * Scene Atlas stores ONLY a stable selected Region ID in Checkpoint appearance.
 * This reader never mutates any Scene or Region. Missing or invalid data fails
 * closed; selecting a name never publishes a native boundary or Journal.
 */
import {readAtlas} from "./atlas-storage.js";
import {toCanvasPoint} from "./road-coordinates.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {readTerritoryCheckpointLink} from "./territory-checkpoint-link.js";
import {readPublicTerritory} from "./region-narration.js";

const MAX_CHECKED_OFFSETS=20000;
const kindLabel=kind=>({
  continent:"Continent",area:"Area",city:"City",town:"Town",
  village:"Village",settlement:"Settlement"
})[kind]??"Territory";

function containsNativeGridOffset(region,offset){
  if(!offset||!Number.isSafeInteger(offset.i)||!Number.isSafeInteger(offset.j))
    return false;
  const shapes=Array.from(region?.shapes??[],shape=>shape?.toObject?.()??shape);
  if(!shapes.length||shapes.some(shape=>shape?.type!=="grid"||
    !Array.isArray(shape.offsets)))return false;
  let seen=0;
  for(const shape of shapes){
    seen+=shape.offsets.length;
    if(seen>MAX_CHECKED_OFFSETS)return false;
    if(shape.offsets.some(o=>o?.i===offset.i&&o?.j===offset.j))return true;
  }
  return false;
}

/** Only use native grid.getOffset on an actual active Foundry canvas. */
function checkpointNativeOffset(scene,checkpoint,atlas,view){
  if(!scene||!checkpoint||!atlas||!view?.ready||view.scene?.id!==scene.id||
      view.grid?.isGridless||typeof view.grid?.getOffset!=="function")
    return null;
  const node=atlas.nodes?.find(n=>n.id===checkpoint.nodeId);
  if(!Number.isFinite(node?.x)||!Number.isFinite(node?.y))return null;
  try{
    const offset=view.grid.getOffset(toCanvasPoint(view,atlas,node));
    return Number.isSafeInteger(offset?.i)&&Number.isSafeInteger(offset?.j)?
      offset:null;
  }catch{return null;}
}

/** Candidates include distinct nested City/Continent memberships. No default
 * winner is inferred; GM explicitly chooses one stable Region ID. */
export function checkpointBannerTerritoryCandidates(scene,checkpoint,{
  atlas=null,view=globalThis.canvas,forPlayer=false
}={}){
  if(!scene||!checkpoint)return [];
  const data=atlas??readAtlas(scene);
  const offset=checkpointNativeOffset(scene,checkpoint,data,view);
  const candidates=[];
  for(const territory of listSceneGeography(scene)){
    if(!territory.linked||territory.invalid||!territory.geography||
        forPlayer&&territory.hidden)continue;
    const region=scene.regions?.get?.(territory.id);
    if(!region)continue;
    let explicit=false;
    try{explicit=readTerritoryCheckpointLink(region)?.checkpointId===checkpoint.id;}
    catch{continue;}
    const contains=containsNativeGridOffset(region,offset);
    if(!contains&&!explicit)continue;
    // A selected publicly visible Checkpoint is an independent, explicit
    // publication of this label, not of the native Region boundary. Prefer
    // the authored public alias when available, never disclose GM-only
    // alternate names when a published alias exists.
    let publicName=null;
    try{
      const known=readPublicTerritory(region);
      if(known?.enabled)publicName=known.label;
    }catch{
      if(forPlayer)continue;
    }
    const displayName=forPlayer?(publicName||region.name):region.name;
    if(typeof displayName!=="string"||!displayName.trim())continue;
    candidates.push({id:territory.id,name:displayName.trim(),
      kind:territory.geography.kind,label:kindLabel(territory.geography.kind),
      contains,explicit,hidden:territory.hidden});
  }
  return candidates.sort((a,b)=>a.label.localeCompare(b.label)||
    a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}

/** Identity is checked each draw: deleted, moved, unlinked, invalid and hidden
 * Regions do not produce a cached or invented label. */
export function checkpointSelectedTerritoryName(scene,checkpoint,regionId,{
  sourceSceneId=null,atlas=null,view=globalThis.canvas,forPlayer=false
}={}){
  if(!regionId||!scene?.id||sourceSceneId!==scene.id)return null;
  return checkpointBannerTerritoryCandidates(scene,checkpoint,
    {atlas,view,forPlayer}).find(item=>item.id===regionId)?.name??null;
}
