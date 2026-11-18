import {checkpointKnowledge} from "./party-exploration-model.js";

const validPoint=point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y);
const cleanName=value=>typeof value==="string"?
  value.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,100):"";

/**
 * A trip direction is named for the original Point B, not for each authored
 * road segment. This is a pure, transient label; road IDs/names and the
 * approved Journey target are not rewritten.
 *
 * Use only a uniquely matched destination checkpoint whose name the party
 * already knows. Atlas's legacy no-exploration mode requires explicit public
 * checkpoint visibility. Mere proximity to a hidden checkpoint never reveals
 * its name. Unnamed/ambiguous/off-road destinations keep canonical road names.
 */
export function contextualDestinationRoadName({
  atlas,route,destination=route?.end,exploration=null,tolerancePixels=0.01
}={}){
  if(route?.status!=="ok"||!route.legs?.some(leg=>leg.kind==="road")||
      !validPoint(destination)||!Number.isFinite(tolerancePixels)||
      tolerancePixels<0)return null;
  const nodes=new Map((atlas?.nodes??[]).map(node=>[node.id,node]));
  const matches=(atlas?.checkpoints??[]).filter(checkpoint=>{
    const node=nodes.get(checkpoint.nodeId);
    return validPoint(node)&&Math.hypot(node.x-destination.x,
      node.y-destination.y)<=tolerancePixels;
  });
  // Do not guess between co-located or closely adjacent authored destinations.
  if(matches.length!==1)return null;
  const checkpoint=matches[0],name=cleanName(checkpoint.name);
  if(!name)return null;
  try{
    const knowledge=checkpointKnowledge(exploration,checkpoint.id);
    if(knowledge==="unknown"||
        (knowledge==="legacy"&&checkpoint.playerVisible!==true))return null;
  }catch{return null;}
  return "Road to "+name;
}
