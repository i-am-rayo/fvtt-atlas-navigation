/** Recoverable GM-owned transfer between exactly two native grid Regions.
 * A Scene intent is written BEFORE either RegionDocument changes. Incomplete
 * work stays persisted for explicit Resume / Roll Back; it is never replayed
 * automatically on canvas redraw, reconnect or read. */
import {MODULE_ID} from "./atlas-storage.js";
import {BOUNDARY_SOURCE_FLAG,BOUNDARY_SOURCE_VERSION,GRID_TRANSFER_INTENT_FLAG,
  GRID_CONVERSION_BACKUP_FLAG,validateGridOffsets} from "./territory-authoring-model.js";
import {GENERATED_REGION_FLAG} from "./generated-region-model.js";
import {readRegionAtlasLink} from "./region-atlas.js";
import {listSceneGeography,readRegionGeography} from "./territory-geography-storage.js";
import {territoryTier} from "./territory-view-model.js";
import {readBoundarySource,readTerritoryDraft,nativeTerritoryShapeDigest,
  validateTerritoryCoverage} from "./territory-authoring.js";
import {nativeSceneGridIdentity} from "./territory-grid-conversion.js";

const clone=v=>structuredClone(v);
const key=p=>`${p.i},${p.j}`;
const shapes=region=>Array.from(region.shapes??[],s=>s.toObject?.()??clone(s));
const gridShape=offsets=>({type:"grid",origin:null,offsets:validateGridOffsets(offsets)});
const flag=key=>`flags.${MODULE_ID}.${key}`;
const stateOf=region=>({shapes:shapes(region),source:readBoundarySource(region),
  geography:readRegionGeography(region),name:region.name});
const canonical=v=>Array.isArray(v)?v.map(canonical):
  v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
// Foundry may materialize default grid Shape fields after update. Compare
// canonical native geometry, not its particular serialized document keys.
const sameState=(a,b)=>nativeTerritoryShapeDigest(a.shapes)===
  nativeTerritoryShapeDigest(b.shapes)&&same(a.source,b.source)&&
  same(a.geography,b.geography)&&a.name===b.name;
const isGrid=region=>{const s=shapes(region);return s.length===1&&s[0].type==="grid";};

function authorize(scene,id){
  const user=globalThis.game?.user,region=scene?.regions?.get?.(id);
  if(!user?.isGM||!scene?.canUserModify?.(user,"update")||
      !region||region.parent?.id!==scene.id||
      !region.canUserModify?.(user,"update")||!readRegionAtlasLink(region)||
      region.getFlag?.(MODULE_ID,GENERATED_REGION_FLAG)!=null)
    throw Error("Only a Scene-authorized GM may transfer linked native Territory cells.");
  return region;
}

/** Foundry's geometry validator needs a read-only proposed document view;
 * constructing plain read adapters never mutates native Scene collections. */
function virtualScene(scene,changes){
  const all=[...(scene.regions?.values?.()??[])].map(region=>{
    const proposed=changes.get(region.id);
    if(!proposed)return region;
    return {id:region.id,name:region.name,hidden:region.hidden,
      shapes:proposed, getFlag:(...args)=>region.getFlag(...args)};
  });
  const index=new Map(all.map(region=>[region.id,region]));
  return {id:scene.id,regions:{values:()=>all.values(),get:id=>index.get(id)}};
}

function gridSource(prior,shape){
  return {schemaVersion:BOUNDARY_SOURCE_VERSION,kind:"grid",
    coordinateSpace:"scene-image",offsets:clone(shape.offsets),
    wallIds:clone(prior?.wallIds??[]),smoothing:0,
    shapeDigest:nativeTerritoryShapeDigest([shape])};
}

export function readPendingTerritoryCellTransfer(scene){
  const value=scene?.getFlag?.(MODULE_ID,GRID_TRANSFER_INTENT_FLAG);
  if(value==null)return null;
  if(typeof value!=="object"||value.schemaVersion!==1||
      value.sceneId!==scene?.id||!value.sourceId||!value.targetId||
      value.sourceId===value.targetId||typeof value.gridIdentity!=="string"||
      !Array.isArray(value.records)||value.records.length!==2||
      value.records[0]?.id!==value.sourceId||
      value.records[1]?.id!==value.targetId||
      JSON.stringify(value).length>1000000)
    throw Error("Atlas transfer recovery record is unsupported. Do not edit Region geometry; inspect the Scene backup.");
  return clone(value);
}

export function planTerritoryCellTransfer(scene,targetId,draft,{view=globalThis.canvas}={}){
  if(draft?.kind!=="grid")return null;
  if(readPendingTerritoryCellTransfer(scene))
    throw Error("A Territory transfer needs recovery. Resolve it in the Workspace first.");
  const target=authorize(scene,targetId);
  if(!view?.ready||view.scene?.id!==scene.id||!view.grid||view.grid.isGridless||
      !globalThis.foundry?.data?.GridShapeData||!isGrid(target))return null;
  const original=readTerritoryDraft(scene,targetId,{view});
  if(original.kind!=="grid"||original.sourceDigest!==draft.sourceDigest)
    throw Error("The selected native grid Region changed. Reopen the editor.");
  const targetOffsets=validateGridOffsets(draft.offsets);
  const existing=new Set(original.offsets.map(key));
  const additions=targetOffsets.filter(p=>!existing.has(key));
  if(!additions.length)return null;
  const entries=listSceneGeography(scene);
  const targetEntry=entries.find(e=>e.id===targetId);
  const tier=territoryTier(targetEntry);
  if(tier==="unclassified"||!same(targetEntry.geography,draft.geography))
    throw Error("Reopen this Territory's geography before moving native cells.");
  const addedKeys=new Set(additions.map(key));
  const owners=[];
  for(const entry of entries){
    if(entry.id===targetId||territoryTier(entry)!==tier||!entry.linked||entry.invalid)continue;
    const peer=scene.regions.get(entry.id),peerShapes=shapes(peer);
    if(peerShapes.length!==1||peerShapes[0].type!=="grid")continue;
    const claimed=peerShapes[0].offsets.filter(offset=>addedKeys.has(key(offset)));
    if(claimed.length)owners.push({id:entry.id,claimed});
  }
  if(!owners.length)return null;
  if(owners.length!==1)
    throw Error("This stroke crosses multiple peer owners; transfer from one Region at a time.");
  const owner=owners[0],source=authorize(scene,owner.id);
  const sourceDraft=readTerritoryDraft(scene,owner.id,{view});
  if(sourceDraft.kind!=="grid"||territoryTier(entries.find(e=>e.id===source.id))!==tier)
    throw Error("Both Territories must be editable native grid Shapes of the same geographic tier.");
  const transferred=new Set(owner.claimed.map(key));
  const sourceOffsets=sourceDraft.offsets.filter(p=>!transferred.has(key(p)));
  if(!sourceOffsets.length)
    throw Error("Transfer would leave the source Region empty. Split or redraw it explicitly first.");
  if(owner.claimed.length>500)
    throw Error("A single reviewed transfer may move at most 500 cells.");
  const sourceAfter=gridShape(sourceOffsets),targetAfter=gridShape(targetOffsets);
  const simulated=virtualScene(scene,new Map([
    [source.id,[sourceAfter]],[target.id,[targetAfter]]]));
  // Exact native grid geometry validation: peer offset conflicts plus polygon
  // intersection and parent containment, in the FINAL two-Region state.
  validateTerritoryCoverage(simulated,{geography:draft.geography},targetAfter,
    {regionId:targetId,view});
  validateTerritoryCoverage(simulated,{geography:readRegionGeography(source)},sourceAfter,
    {regionId:source.id,view});
  const beforeSource=stateOf(source),beforeTarget=stateOf(target);
  const afterSource={...beforeSource,shapes:[sourceAfter],
    source:gridSource(beforeSource.source,sourceAfter)};
  const afterTarget={...beforeTarget,shapes:[targetAfter],
    source:gridSource(beforeTarget.source,targetAfter)};
  return {sceneId:scene.id,sourceId:source.id,sourceName:source.name,
    targetId,targetName:target.name,gridIdentity:nativeSceneGridIdentity(scene,view),
    movedCells:owner.claimed.length,sourceCellCount:sourceAfter.offsets.length,
    targetCellCount:targetAfter.offsets.length,
    convertedBackupAffected:[source,target].some(r=>
      r.getFlag(MODULE_ID,GRID_CONVERSION_BACKUP_FLAG)!=null),
    records:[{id:source.id,before:beforeSource,after:afterSource},
      {id:target.id,before:beforeTarget,after:afterTarget}]};
}

function checkRecord(scene,record){
  const region=authorize(scene,record.id),current=stateOf(region);
  if(sameState(current,record.before))return "before";
  if(sameState(current,record.after))return "after";
  throw Error(`Region ${region.name} changed outside the transfer. Recovery blocked; preserve the Scene backup.`);
}

function validatePlan(scene,intent,desired,view){
  const changes=new Map(intent.records.map(r=>[r.id,desired==="after"?
    r.after.shapes:r.before.shapes]));
  const simulated=virtualScene(scene,changes);
  for(const record of intent.records){
    const state=desired==="after"?record.after:record.before;
    validateTerritoryCoverage(simulated,{geography:state.geography},state.shapes[0],
      {regionId:record.id,view});
  }
}

async function finish(scene,intent,mode,view,onProgress=()=>{}){
  const destination=mode==="resume"?"after":"before";
  if(intent.gridIdentity!==nativeSceneGridIdentity(scene,view)||
      !view?.ready||view.scene?.id!==scene.id)
    throw Error("The Scene grid changed. Transfer recovery is blocked; restore the World backup.");
  for(const record of intent.records)checkRecord(scene,record);
  validatePlan(scene,intent,destination,view);
  onProgress({step:1,total:4,message:"Recovery record verified; updating native Regions"});
  // Forward removes source ownership before target adds it. Reverse removes
  // target ownership before source restores it. No duplicate cell ownership.
  const order=mode==="resume"?intent.records:[...intent.records].reverse();
  for(const [index,record] of order.entries()){
    const region=authorize(scene,record.id),current=checkRecord(scene,record);
    if(current===destination)continue;
    const state=record[destination];
    await region.update({shapes:clone(state.shapes),
      ...(state.source===null?{[`flags.${MODULE_ID}.-=${BOUNDARY_SOURCE_FLAG}`]:null}:
        {[flag(BOUNDARY_SOURCE_FLAG)]:clone(state.source)})});
    onProgress({step:index+2,total:4,message:`Updated ${index+1} of 2 native Regions`});
  }
  // Retain the intent if removing it fails; repeated Resume/Roll Back is safe.
  await scene.unsetFlag(MODULE_ID,GRID_TRANSFER_INTENT_FLAG);
  onProgress({step:4,total:4,message:"Transfer completed"});
  return destination;
}

/** The intent is persisted before either native Region update. */
export async function commitTerritoryCellTransfer(scene,plan,{view=globalThis.canvas,onProgress=()=>{}}={}){
  if(!plan||plan.sceneId!==scene?.id||!plan.sourceId||!plan.targetId||
      readPendingTerritoryCellTransfer(scene))
    throw Error("Reopen the native cell transfer; resolve any pending transaction first.");
  const target=authorize(scene,plan.targetId);
  const draft=readTerritoryDraft(scene,target.id,{view});
  const refreshed=planTerritoryCellTransfer(scene,target.id,{...draft,
    offsets:plan.records[1].after.shapes[0].offsets,
    geography:readRegionGeography(target)},{view});
  if(!refreshed||!same(refreshed,plan))
    throw Error("Native Regions, membership or grid changed since preview. No changes written.");
  const intent={schemaVersion:1,sceneId:scene.id,
    sourceId:plan.sourceId,targetId:plan.targetId,gridIdentity:plan.gridIdentity,
    records:clone(plan.records)};
  if(JSON.stringify(intent).length>1000000)
    throw Error("Transfer exceeds the safe recovery-record budget. Select fewer cells.");
  await scene.update({[flag(GRID_TRANSFER_INTENT_FLAG)]:intent});
  onProgress({step:0,total:4,message:"Recovery record saved; validating transfer"});
  if(!same(readPendingTerritoryCellTransfer(scene),intent))
    throw Error("Transfer recovery intent was not persisted. No Region was edited.");
  return finish(scene,intent,"resume",view,onProgress);
}

export async function resolveTerritoryCellTransfer(scene,mode,{view=globalThis.canvas}={}){
  if(!["resume","rollback"].includes(mode))throw Error("Choose Resume or Roll Back.");
  const intent=readPendingTerritoryCellTransfer(scene);
  if(!intent)throw Error("No interrupted Region transfer needs recovery.");
  authorize(scene,intent.sourceId);authorize(scene,intent.targetId);
  return finish(scene,intent,mode,view);
}
