/**
 * Explicit selective application of one World checkpoint template to placed
 * checkpoints. One Scene Document.update batches Atlas, discovery method and
 * transport flags. Graph geometry and exploration history are not rewritten.
 */
import { MODULE_ID,ATLAS_FLAG,readAtlas } from "./atlas-storage.js";
import { validateAtlas,upgradeAtlasCheckpointAppearance } from "./atlas-model.js";
import { resolveCheckpointAppearance,validateCheckpointAppearance }
  from "./checkpoint-appearance.js";
import { checkpointCategory } from "./checkpoint-types.js";
import { checkpointAssignedPresetId } from "./checkpoint-preset-assignment.js";
import { readCheckpointDiscoveryMethods,withCheckpointDiscoveryMethod,
  CHECKPOINT_METHOD_FLAG } from "./checkpoint-discovery-method.js";
import { readCheckpointTransportStore,validateCheckpointTransportStore,
  validateCheckpointTransportOffers,CHECKPOINT_TRANSPORT_FLAG }
  from "./checkpoint-transportation.js";

export const CHECKPOINT_BULK_FIELDS=Object.freeze([
  ["icon","Marker icon or image"],["size","Marker size"],
  ["color","Icon / dot color"],["borderColor","Border color"],
  ["labelMode","Checkpoint label display"],["showRoadName","Include road name"],
  ["textColor","Label text color"],["discoveryMethod","Discovery method"],
  ["transportation","Transportation offers"]
]);
const FIELD_IDS=new Set(CHECKPOINT_BULK_FIELDS.map(([id])=>id));
const SCOPES=["all","category","assigned"];
export function buildCheckpointBulkUpdate(scene,preset,{scope="category",fields=[],
  expectedRevision=null}={}){
  if(!SCOPES.includes(scope)||!Array.isArray(fields)||!fields.length||
    fields.some(field=>!FIELD_IDS.has(field)))throw Error("Choose valid fields to update.");
  const atlas=readAtlas(scene);
  if(expectedRevision!==null&&atlas.revision!==expectedRevision)
    throw Error("The Scene Atlas changed. Reopen bulk apply.");
  const targets=atlas.checkpoints.filter(c=>
    scope==="all"||scope==="category"&&checkpointCategory(scene,c.id)===preset.category||
    scope==="assigned"&&checkpointAssignedPresetId(scene,c.id)===preset.id);
  if(!targets.length)throw Error("No checkpoints match the chosen target scope.");
  const targetIds=new Set(targets.map(c=>c.id));
  const chosen=new Set(fields);
  const appearance=validateCheckpointAppearance(resolveCheckpointAppearance(preset.appearance));
  const appearanceKeys=["type","icon","image","size","color","borderColor",
    "labelMode","showRoadName","textColor"];
  const modifiesAppearance=chosen.has("icon")||appearanceKeys.some(k=>chosen.has(k));
  const styledAtlas=modifiesAppearance?upgradeAtlasCheckpointAppearance(atlas):atlas;
  const nextCheckpoints=styledAtlas.checkpoints.map(checkpoint=>{
    if(!targetIds.has(checkpoint.id)||!appearanceKeys.some(k=>chosen.has(k))&&
      !chosen.has("icon"))return checkpoint;
    const style=resolveCheckpointAppearance(checkpoint.appearance);
    if(chosen.has("icon")){style.type=appearance.type;style.icon=appearance.icon;style.image=appearance.image;}
    for(const key of appearanceKeys){
      if(key!=="type"&&key!=="icon"&&key!=="image"&&chosen.has(key))style[key]=appearance[key];
    }
    return {...checkpoint,appearance:validateCheckpointAppearance(style)};
  });
  const updates={};
  if(chosen.has("icon")||appearanceKeys.some(k=>chosen.has(k))){
    updates["flags."+MODULE_ID+"."+ATLAS_FLAG]=validateAtlas({
      ...styledAtlas,revision:atlas.revision+1,checkpoints:nextCheckpoints});
  }
  if(chosen.has("discoveryMethod")){
    let methods=readCheckpointDiscoveryMethods(scene);
    for(const checkpoint of targets)
      methods=withCheckpointDiscoveryMethod(methods,checkpoint.id,preset.discoveryMethod);
    updates["flags."+MODULE_ID+"."+CHECKPOINT_METHOD_FLAG]=methods;
  }
  if(chosen.has("transportation")){
    const store=readCheckpointTransportStore(scene);
    const offers=validateCheckpointTransportOffers(preset.transportation??[]);
    const entries={...store.entries};
    for(const checkpoint of targets)entries[checkpoint.id]=offers.map(o=>({
      methodId:o.methodId,mode:o.mode,overrides:{...o.overrides}}));
    updates["flags."+MODULE_ID+"."+CHECKPOINT_TRANSPORT_FLAG]=
      validateCheckpointTransportStore({...store,entries});
  }
  return {targets:targets.map(c=>({id:c.id,name:c.name})),updates,
    expectedRevision:atlas.revision};
}
export async function applyCheckpointPresetBulk(scene,preset,options){
  if(!globalThis.game?.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
    throw Error("Only a GM with Scene update permission may bulk-update checkpoints.");
  const plan=buildCheckpointBulkUpdate(scene,preset,options);
  if(readAtlas(scene).revision!==plan.expectedRevision)
    throw Error("The Scene Atlas changed while confirming. No changes were applied.");
  await scene.update(plan.updates);
  return plan.targets.length;
}
