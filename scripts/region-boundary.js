import {MODULE_ID} from "./atlas-storage.js";
import {GENERATED_REGION_FLAG} from "./generated-region-model.js";
import {planSmoothedNativeRegion} from "./region-boundary-model.js";

function plainShapes(region) {
  return Array.from(region?.shapes??[],shape=>
    typeof shape.toObject==="function"?shape.toObject():structuredClone(shape));
}

function editableRegion(scene,regionId) {
  const user=globalThis.game?.user;
  if(!user?.isGM||!scene?.canUserModify?.(user,"update"))
    throw Error("Only a Scene-authorized GM may edit native Region borders.");
  const region=scene.regions?.get?.(regionId);
  if(!region||region.parent?.id!==scene.id||
      !region.canUserModify?.(user,"update"))
    throw Error("This native Region is missing or cannot be edited.");
  if(region.getFlag?.(MODULE_ID,GENERATED_REGION_FLAG)!=null)
    throw Error("Atlas-generated road Regions use their separate regeneration tool; their shape integrity must not be bypassed.");
  return region;
}

/** Preview reads only; no geometry or Atlas flags are written. */
export function planNativeRegionSmoothing(scene,regionId,passes=1) {
  const region=editableRegion(scene,regionId);
  const before=plainShapes(region),shapeSnapshot=JSON.stringify(before);
  const proposal=planSmoothedNativeRegion(before,passes);
  return Object.freeze({sceneId:scene.id,regionId,regionName:region.name,
    shapeSnapshot,sourcePoints:proposal.sourcePoints,
    resultPoints:proposal.resultPoints,shapes:proposal.shapes,passes});
}

/** Update precisely one existing native Region's shapes after a fresh GM
 * confirmation, preserving IDs, native Behaviors, names, visibility and flags. */
export async function saveNativeRegionSmoothing(scene,plan) {
  if(!plan||plan.sceneId!==scene?.id||!Number.isInteger(plan.passes))
    throw Error("Reopen the Region smoothing preview.");
  const region=editableRegion(scene,plan.regionId);
  if(region.name!==plan.regionName||
      JSON.stringify(plainShapes(region))!==plan.shapeSnapshot) {
    throw Error("The native Region changed while previewing. Reopen the editor; no shapes were updated.");
  }
  const fresh=planSmoothedNativeRegion(plainShapes(region),plan.passes);
  if(JSON.stringify(fresh.shapes)!==JSON.stringify(plan.shapes))
    throw Error("The preview is stale or invalid; no native Region was changed.");
  await region.update({shapes:fresh.shapes});
  return region.id;
}
