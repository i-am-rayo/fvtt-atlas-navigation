/**
 * Checkpoint presentation-only banner model. Callers provide only text that
 * has already passed the applicable GM/player visibility projection.
 * No Foundry globals, native Region access, persistence, or markup.
 */
import {resolveCheckpointBanner} from "./checkpoint-appearance.js";

export function formatCheckpointBannerElevation(meters,unitFamily="metric"){
  if(!Number.isFinite(meters))return null;
  if(!["metric","imperial"].includes(unitFamily))return null;
  const value=unitFamily==="imperial"?meters*3.280839895:meters;
  const rounded=Math.round(value*100)/100;
  return "Elevation: "+rounded+" "+(unitFamily==="imperial"?"ft":"m");
}

/** All labels here are plain text, never HTML. Unknown/withheld values simply
 * omit their line; they never fabricate a fallback Region or Road name. */
export function checkpointBannerLines({appearance,checkpointType=null,
  elevationMeters=null,elevationUnits="metric",roadName=null,
  territoryName=null}={}){
  const banner=resolveCheckpointBanner(appearance);
  const lines=[];
  if(banner.showType&&typeof checkpointType==="string"&&checkpointType.trim())
    lines.push({kind:"type",text:"Type: "+checkpointType.trim()});
  if(banner.showElevation){
    const elevation=formatCheckpointBannerElevation(elevationMeters,elevationUnits);
    if(elevation)lines.push({kind:"elevation",text:elevation});
  }
  if(appearance?.showRoadName&&typeof roadName==="string"&&roadName.trim())
    lines.push({kind:"road",text:roadName.trim()});
  if(banner.territoryRegionId&&typeof territoryName==="string"&&territoryName.trim())
    lines.push({kind:"territory",text:"Territory: "+territoryName.trim()});
  return lines;
}
