import {playerAtlasOverlay} from "./player-overlay-model.js";

/** Read-only public narration. A checkpoint must be at the original saved
 * Point B, unambiguous unless the approved route names its stable ID, and
 * independently eligible for the existing player overlay projection. */
export function publicJourneyDestinationName({atlas,exploration,record,
  gridSize}={}){
  const point=record?.destination;
  if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||
      !Array.isArray(atlas?.checkpoints)||!Array.isArray(atlas?.nodes)||
      !Number.isFinite(gridSize)||gridSize<=0)return null;
  if(record.status==="completed"){
    const anchor=record.lastConfirmedAnchor?.point;
    if(!Number.isFinite(anchor?.x)||!Number.isFinite(anchor?.y)||
        Math.hypot(anchor.x-point.x,anchor.y-point.y)>
          Math.max(2,gridSize*.75))return null;
  }
  const radius=Math.max(2,Math.min(24,gridSize*.2));
  const nodes=new Map(atlas.nodes.map(node=>[node.id,node]));
  const matches=atlas.checkpoints.filter(checkpoint=>{
    const node=nodes.get(checkpoint.nodeId);
    return Number.isFinite(node?.x)&&Number.isFinite(node?.y)&&
      Math.hypot(node.x-point.x,node.y-point.y)<=radius;
  });
  const finalTarget=record.routeTargets?.targets?.at(-1);
  if(finalTarget){
    const saved=finalTarget.point;
    if(!Number.isFinite(saved?.x)||!Number.isFinite(saved?.y)||
        Math.hypot(saved.x-point.x,saved.y-point.y)>.01)return null;
  }
  const selected=finalTarget?.checkpointId?
    matches.find(checkpoint=>checkpoint.id===finalTarget.checkpointId):
    matches.length===1?matches[0]:null;
  if(!selected||typeof selected.name!=="string"||!selected.name.trim()||
      selected.name.length>120||/[\u0000-\u001f\u007f]/.test(selected.name))return null;
  // Foundry's player projection permits GM-revealed legacy checkpoints and
  // Lore/Visited checkpoint knowledge. No hidden authored data is transmitted.
  const visible=playerAtlasOverlay(atlas,exploration).checkpoints;
  return visible.some(checkpoint=>checkpoint.id===selected.id)?
    selected.name.trim():null;
}
