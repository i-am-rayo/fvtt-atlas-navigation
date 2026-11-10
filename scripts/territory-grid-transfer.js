/** Recoverable GM-owned transfer between native grid Regions (up to four sources).
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
// A visual review draws only the highest-priority changes when a very large
// native grid Region is being edited. Counts always cover the full draft.
const MAX_OWNERSHIP_PREVIEW_CELLS=500;
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

/** Read-only ownership review for a draft Hex/Grid boundary. This can inspect
 * several peer Regions at once. Never use these counts as authorization to write. */
export function inspectTerritoryGridOwnership(scene,targetId,draft,
  {view=globalThis.canvas}={}){
  if(draft?.kind!=="grid")throw Error("Review native Hex/Grid cells only.");
  if(readPendingTerritoryCellTransfer(scene))
    throw Error("Resolve the interrupted Territory transfer before reviewing new edits.");
  const target=authorize(scene,targetId);
  if(!view?.ready||view.scene?.id!==scene.id||view.grid?.isGridless||
      !globalThis.foundry?.data?.GridShapeData||!isGrid(target))
    throw Error("The active Scene needs an editable native Grid Region.");
  const original=readTerritoryDraft(scene,targetId,{view});
  if(original.kind!=="grid"||original.sourceDigest!==draft.sourceDigest)
    throw Error("The native Territory changed. Reopen Paint Territory.");
  const entries=listSceneGeography(scene);
  const entry=entries.find(e=>e.id===targetId);
  const tier=territoryTier(entry);
  if(tier==="unclassified"||!same(entry.geography,draft.geography))
    throw Error("Review this Territory's geography before inspecting shared cells.");
  const before=new Set(original.offsets.map(key));
  const after=validateGridOffsets(draft.offsets);
  const afterKeys=new Set(after.map(key));
  const added=after.filter(cell=>!before.has(key(cell)));
  const removed=original.offsets.filter(cell=>!afterKeys.has(key(cell)));
  const addedKeys=new Set(added.map(key));
  const owners=new Map();
  const peers=[];
  for(const candidate of entries){
    if(candidate.id===targetId||!candidate.linked||candidate.invalid||
        territoryTier(candidate)!==tier)continue;
    const peer=scene.regions.get(candidate.id);
    if(!peer||!isGrid(peer))continue;
    let count=0;
    for(const offset of shapes(peer)[0].offsets){
      const cellKey=key(offset);
      if(!addedKeys.has(cellKey))continue;
      const list=owners.get(cellKey)??[];
      list.push(peer.id);owners.set(cellKey,list);count++;
    }
    if(count)peers.push({id:peer.id,name:peer.name,cells:count});
  }
  peers.sort((a,b)=>b.cells-a.cells||a.name.localeCompare(b.name));
  const contested=[...owners.values()].filter(ids=>ids.length>1).length;
  const peerOwned=owners.size;
  const previewCandidates=[...added.map(cell=>{
    const claimedBy=owners.get(key(cell))??[];
    return {i:cell.i,j:cell.j,status:claimedBy.length>1?"contested":
      claimedBy.length===1?"peer":"unclaimed"};
  }),...removed.map(cell=>({i:cell.i,j:cell.j,status:"removed"}))];
  const priority={contested:0,peer:1,unclaimed:2,removed:3};
  // Surface any ownership conflicts first, even when the preview is capped.
  previewCandidates.sort((a,b)=>priority[a.status]-priority[b.status]);
  return {targetId,targetName:target.name,originalCells:original.offsets.length,
    proposedCells:after.length,addedCells:added.length,removedCells:removed.length,
    unclaimedAddedCells:added.length-peerOwned,peerOwnedAddedCells:peerOwned,
    contestedAddedCells:contested,peers,
    previewCells:previewCandidates.slice(0,MAX_OWNERSHIP_PREVIEW_CELLS),
    previewTotalCells:previewCandidates.length,
    previewTruncated:previewCandidates.length>MAX_OWNERSHIP_PREVIEW_CELLS,
    canUseExistingTransferWriter:peers.length===1&&contested===0,
    requiresMultiRegionReview:peers.length>1||contested>0};
}

export function readPendingTerritoryCellTransfer(scene){
  const value=scene?.getFlag?.(MODULE_ID,GRID_TRANSFER_INTENT_FLAG);
  if(value==null)return null;
  const records=Array.isArray(value?.records)?value.records:null;
  const single=value?.schemaVersion===1&&value?.sourceId&&value?.targetId&&
    value.sourceId!==value.targetId&&records?.length===2&&
    records[0]?.id===value.sourceId&&records[1]?.id===value.targetId;
  const ids=value?.sourceIds;
  const multiple=value?.schemaVersion===2&&Array.isArray(ids)&&
    ids.length>=2&&ids.length<=4&&ids.every(id=>typeof id==="string"&&id)&&
    typeof value.targetId==="string"&&value.targetId&&
    new Set([...ids,value.targetId]).size===ids.length+1&&
    records?.length===ids.length+1&&
    records.every((record,index)=>record?.id===
      (index<ids.length?ids[index]:value.targetId));
  const targets=value?.targetIds;
  const batch=value?.schemaVersion===3&&Array.isArray(ids)&&
    ids.length<=4&&ids.every(id=>typeof id==="string"&&id)&&
    Array.isArray(targets)&&targets.length>=2&&targets.length<=4&&
    targets.every(id=>typeof id==="string"&&id)&&
    new Set([...ids,...targets]).size===ids.length+targets.length&&
    records?.length===ids.length+targets.length&&
    records.every((record,index)=>record?.id===
      (index<ids.length?ids[index]:targets[index-ids.length]));
  if(typeof value!=="object"||(!single&&!multiple&&!batch)||
      value.sceneId!==scene?.id||typeof value.gridIdentity!=="string"||
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
  if(owners.length>4)
    throw Error("Transfer spans over four peer Territories. Review smaller groups first.");
  owners.sort((a,b)=>a.id.localeCompare(b.id));
  const ownedKeys=new Set();
  for(const owner of owners)for(const cell of owner.claimed){
    const cellKey=key(cell);
    if(ownedKeys.has(cellKey))
      throw Error("A painted cell belongs to multiple peer Territories. Resolve ownership before transferring.");
    ownedKeys.add(cellKey);
  }
  if(ownedKeys.size>500)
    throw Error("A single reviewed transfer may move at most 500 cells.");
  const sources=owners.map(owner=>{
    const source=authorize(scene,owner.id);
    const sourceDraft=readTerritoryDraft(scene,owner.id,{view});
    if(sourceDraft.kind!=="grid"||territoryTier(entries.find(e=>e.id===source.id))!==tier)
      throw Error("All Territories must be editable native grid Shapes of the same geographic tier.");
    const transferred=new Set(owner.claimed.map(key));
    const remaining=sourceDraft.offsets.filter(p=>!transferred.has(key(p)));
    if(!remaining.length)
      throw Error(owners.length===1?
        "Transfer would leave the source Region empty. Split or redraw it explicitly first.":
        `Transfer would leave ${source.name} empty. Split or redraw it explicitly first.`);
    const after=gridShape(remaining),before=stateOf(source);
    return {region:source,claimed:owner.claimed.length,remaining:remaining.length,
      after,record:{id:source.id,before,after:{...before,shapes:[after],
        source:gridSource(before.source,after)}}};
  });
  const targetAfter=gridShape(targetOffsets);
  const changes=new Map(sources.map(s=>[s.region.id,[s.after]]));
  changes.set(target.id,[targetAfter]);
  const simulated=virtualScene(scene,changes);
  // Validate every native grid Region against the same FINAL N-Region state.
  // No Source/Target document is updated during this planning phase.
  validateTerritoryCoverage(simulated,{geography:draft.geography},targetAfter,
    {regionId:targetId,view});
  for(const source of sources)validateTerritoryCoverage(simulated,
    {geography:readRegionGeography(source.region)},source.after,
    {regionId:source.region.id,view});
  const beforeTarget=stateOf(target);
  const afterTarget={...beforeTarget,shapes:[targetAfter],
    source:gridSource(beforeTarget.source,targetAfter)};
  const records=[...sources.map(s=>s.record),
    {id:target.id,before:beforeTarget,after:afterTarget}];
  const base={sceneId:scene.id,
    targetId,targetName:target.name,gridIdentity:nativeSceneGridIdentity(scene,view),
    movedCells:ownedKeys.size,targetCellCount:targetAfter.offsets.length,
    convertedBackupAffected:[...sources.map(s=>s.region),target].some(r=>
      r.getFlag(MODULE_ID,GRID_CONVERSION_BACKUP_FLAG)!=null),
    records};
  if(sources.length===1)return {...base,sourceId:sources[0].region.id,
    sourceName:sources[0].region.name,sourceCellCount:sources[0].remaining};
  return {...base,sourceIds:sources.map(s=>s.region.id),
    sources:sources.map(s=>({id:s.region.id,name:s.region.name,
      movedCells:s.claimed,remainingCells:s.remaining}))};
}

/** Batch stage 1: two to four distinct destinations may edit unclaimed cells
 * and/or take cells from same-tier, source-only peers. A Region cannot be both
 * source and target in this writer: swaps need an intermediate durable state and
 * a separate gate.
 * Staged drafts are transient and absolutely no native state is written here. */
export function planMultiDestinationTerritoryCellTransfer(scene,staged,
  {view=globalThis.canvas}={}){
  if(readPendingTerritoryCellTransfer(scene))
    throw Error("Resolve the interrupted native transfer before planning another batch.");
  if(!Array.isArray(staged)||staged.length<2||staged.length>4)
    throw Error("Stage two to four distinct destination Territories for one batch.");
  if(!view?.ready||view.scene?.id!==scene?.id||!view.grid||view.grid.isGridless||
      !globalThis.foundry?.data?.GridShapeData)
    throw Error("Open the matching native Hex/Grid Scene to review this batch.");
  const targets=new Map(),entries=listSceneGeography(scene);
  let tier=null;
  for(const {regionId,draft} of staged){
    if(targets.has(regionId)||draft?.kind!=="grid")
      throw Error("Each batch destination must have one distinct native Hex/Grid draft.");
    const region=authorize(scene,regionId),prior=readTerritoryDraft(scene,regionId,{view});
    const geography=entries.find(entry=>entry.id===regionId);
    const currentTier=territoryTier(geography);
    if(!isGrid(region)||prior.kind!=="grid"||
        prior.sourceDigest!==draft.sourceDigest||currentTier==="unclassified"||
        !same(geography?.geography,draft.geography)||
        (tier!==null&&tier!==currentTier))
      throw Error("A batch destination changed or has a different geographic tier. Reopen its editor.");
    tier=currentTier;
    const offsets=validateGridOffsets(draft.offsets);
    if(!offsets.length)throw Error(`Destination ${region.name} would be empty.`);
    const original=new Set(prior.offsets.map(key));
    targets.set(regionId,{region,prior,offsets,
      additions:offsets.filter(offset=>!original.has(key(offset)))});
  }
  const finalClaims=new Map(),additions=new Map();
  let removedCells=0;
  for(const [id,target] of targets)for(const offset of target.offsets){
    const k=key(offset),existing=finalClaims.get(k);
    if(existing&&existing!==id)
      throw Error("Two batch destinations claim the same Hex/Grid cell. Remove the overlap first.");
    finalClaims.set(k,id);
  }
  for(const [id,target] of targets){
    const final=new Set(target.offsets.map(key));
    removedCells+=target.prior.offsets.filter(offset=>!final.has(key(offset))).length;
    for(const offset of target.additions)additions.set(key(offset),id);
  }
  const sourceClaims=new Map();
  let movedCells=0;
  for(const entry of entries){
    if(territoryTier(entry)!==tier||!entry.linked||entry.invalid||
        targets.has(entry.id))continue;
    const source=scene.regions.get(entry.id);
    if(!source||!isGrid(source))continue;
    const claimed=shapes(source)[0].offsets.filter(offset=>additions.has(key(offset)));
    if(claimed.length){sourceClaims.set(entry.id,claimed);movedCells+=claimed.length;}
  }
  if(!additions.size&&!removedCells)
    throw Error("The staged batch has no Hex/Grid cell changes to save.");
  if(sourceClaims.size>4||movedCells>500)
    throw Error("Batch exceeds four peer sources or 500 transferred cells. Use smaller groups.");
  // No destination may take cells from another staged destination, even if
  // that other Region is being trimmed in this draft. Avoid native swaps.
  for(const [id,target] of targets){
    for(const peer of targets.values())if(peer.region.id!==id){
      const owned=new Set(peer.prior.offsets.map(key));
      if(target.additions.some(offset=>owned.has(key(offset))))
        throw Error("Destination-to-destination cell moves need a later guarded swap workflow.");
    }
  }
  const seen=new Set();
  for(const [id,claimed] of sourceClaims)for(const offset of claimed){
    const k=key(offset);
    if(seen.has(k))throw Error("A batch cell has multiple native source owners.");
    seen.add(k);
  }
  const sourceRecords=[],sources=[],changes=new Map();
  for(const id of [...sourceClaims.keys()].sort()){
    const region=authorize(scene,id),before=stateOf(region);
    const claimed=new Set(sourceClaims.get(id).map(key));
    const remaining=shapes(region)[0].offsets.filter(offset=>!claimed.has(key(offset)));
    if(!remaining.length)throw Error(`Batch would leave ${region.name} empty.`);
    const shape=gridShape(remaining);
    changes.set(id,[shape]);
    sourceRecords.push({id,before,after:{...before,shapes:[shape],
      source:gridSource(before.source,shape)}});
    sources.push({id,name:region.name,movedCells:claimed.size,remainingCells:remaining.length});
  }
  const targetRecords=[],destinations=[];
  for(const id of [...targets.keys()].sort()){
    const target=targets.get(id),shape=gridShape(target.offsets);
    const before=stateOf(target.region);
    changes.set(id,[shape]);
    targetRecords.push({id,before,after:{...before,shapes:[shape],
      source:gridSource(before.source,shape)}});
    destinations.push({id,name:target.region.name,
      addedCells:target.additions.length,
      removedCells:target.prior.offsets.length+target.additions.length-target.offsets.length,
      finalCells:target.offsets.length});
  }
  const proposed=virtualScene(scene,changes);
  for(const record of [...sourceRecords,...targetRecords]){
    const after=record.after;
    validateTerritoryCoverage(proposed,{geography:after.geography},after.shapes[0],
      {regionId:record.id,view});
  }
  return {schemaVersion:3,sceneId:scene.id,gridIdentity:nativeSceneGridIdentity(scene,view),
    sourceIds:sources.map(source=>source.id),targetIds:destinations.map(target=>target.id),
    movedCells,unclaimedAddedCells:additions.size-movedCells,removedCells,
    convertedBackupAffected:[...sourceRecords,...targetRecords].some(record=>
      scene.regions.get(record.id).getFlag(MODULE_ID,GRID_CONVERSION_BACKUP_FLAG)!=null),
    sources,destinations,records:[...sourceRecords,...targetRecords]};
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

/** Read-only GM recovery preflight. Each Region's actual native state must
 * match one of the durable snapshots; otherwise both actions fail closed.
 * Neither the result nor an earlier dialog authorizes a later native write. */
export function inspectPendingTerritoryCellTransfer(scene,{view=globalThis.canvas}={}){
  const intent=readPendingTerritoryCellTransfer(scene);
  if(!intent)return null;
  const regions=intent.records.map(record=>authorize(scene,record.id));
  const gridMatches=!!view?.ready&&view.scene?.id===scene.id&&
    intent.gridIdentity===nativeSceneGridIdentity(scene,view);
  const records=intent.records.map((record,index)=>{
    const region=regions[index];
    let state="blocked",reason=null;
    try{state=checkRecord(scene,record);}catch(error){reason=error.message;}
    const cells=value=>value?.shapes?.reduce((sum,shape)=>sum+
      (shape.type==="grid"&&Array.isArray(shape.offsets)?shape.offsets.length:0),0)??0;
    return {id:region.id,name:region.name,
      role:region.id===intent.targetId||intent.targetIds?.includes(region.id)?
        "target":"source",state,reason,
      beforeCells:cells(record.before),afterCells:cells(record.after)};
  });
  const blocked=records.find(record=>record.state==="blocked");
  const gridBlocker="The Scene grid or active canvas changed. Restore the World backup if needed.";
  const checkMode=mode=>{
    if(!gridMatches)return gridBlocker;
    if(blocked)return blocked.reason;
    try{validatePlan(scene,intent,mode,view);return null;}
    catch(error){return error.message;}
  };
  const resumeBlocker=checkMode("after"),rollbackBlocker=checkMode("before");
  return {regionCount:records.length,records,gridMatches,
    appliedRegions:records.filter(record=>record.state==="after").length,
    originalRegions:records.filter(record=>record.state==="before").length,
    canResume:!resumeBlocker,canRollback:!rollbackBlocker,
    resumeBlocker,rollbackBlocker};
}

async function finish(scene,intent,mode,view,onProgress=()=>{}){
  const destination=mode==="resume"?"after":"before";
  if(intent.gridIdentity!==nativeSceneGridIdentity(scene,view)||
      !view?.ready||view.scene?.id!==scene.id)
    throw Error("The Scene grid changed. Transfer recovery is blocked; restore the World backup.");
  for(const record of intent.records)checkRecord(scene,record);
  validatePlan(scene,intent,destination,view);
  const total=intent.records.length+3;
  onProgress({step:1,total,message:"Recovery record verified; updating native Regions"});
  // Forward removes source ownership before target adds it. Reverse removes
  // target ownership before source restores it. No duplicate cell ownership.
  const order=mode==="resume"?intent.records:[...intent.records].reverse();
  for(const [index,record] of order.entries()){
    const region=authorize(scene,record.id),current=checkRecord(scene,record);
    if(current!==destination){
      const state=record[destination];
      await region.update({shapes:clone(state.shapes),
        ...(state.source===null?{[`flags.${MODULE_ID}.-=${BOUNDARY_SOURCE_FLAG}`]:null}:
          {[flag(BOUNDARY_SOURCE_FLAG)]:clone(state.source)})});
    }
    onProgress({step:index+2,total,
      message:`Processed ${index+1} of ${intent.records.length} native Regions`});
  }
  onProgress({step:total-1,total,message:"Verifying native Region geometry before cleanup"});
  for(const record of intent.records)if(checkRecord(scene,record)!==destination)
    throw Error(`Region ${record.id} did not retain the expected native geometry. `+
      "Recovery record preserved; choose Resume or Roll Back after investigating.");
  validatePlan(scene,intent,destination,view);
  // Retain the intent if removing it fails; repeated Resume/Roll Back is safe.
  await scene.unsetFlag(MODULE_ID,GRID_TRANSFER_INTENT_FLAG);
  if(readPendingTerritoryCellTransfer(scene))
    throw Error("The Scene did not clear the recovery record. Native Regions were verified; " +
      "reopen recovery and retry before editing Territories.");
  onProgress({step:total,total,message:"Transfer completed"});
  return destination;
}

/** The intent is persisted before either native Region update. */
export async function commitTerritoryCellTransfer(scene,plan,{view=globalThis.canvas,onProgress=()=>{}}={}){
  if(!plan||plan.sceneId!==scene?.id||
      !(plan.sourceId||Array.isArray(plan.sourceIds))||!plan.targetId||
      readPendingTerritoryCellTransfer(scene))
    throw Error("Reopen the native cell transfer; resolve any pending transaction first.");
  const target=authorize(scene,plan.targetId);
  const draft=readTerritoryDraft(scene,target.id,{view});
  const refreshed=planTerritoryCellTransfer(scene,target.id,{...draft,
    offsets:plan.records.at(-1).after.shapes[0].offsets,
    geography:readRegionGeography(target)},{view});
  if(!refreshed||!same(refreshed,plan))
    throw Error("Native Regions, membership or grid changed since preview. No changes written.");
  const multi=Array.isArray(plan.sourceIds),total=plan.records.length+3;
  const intent={schemaVersion:multi?2:1,sceneId:scene.id,
    ...(multi?{sourceIds:clone(plan.sourceIds)}:{sourceId:plan.sourceId}),
    targetId:plan.targetId,gridIdentity:plan.gridIdentity,records:clone(plan.records)};
  if(JSON.stringify(intent).length>1000000)
    throw Error("Transfer exceeds the safe recovery-record budget. Select fewer cells.");
  await scene.update({[flag(GRID_TRANSFER_INTENT_FLAG)]:intent});
  onProgress({step:0,total,message:"Recovery record saved; validating transfer"});
  if(!same(readPendingTerritoryCellTransfer(scene),intent))
    throw Error("Transfer recovery intent was not persisted. No Region was edited.");
  return finish(scene,intent,"resume",view,onProgress);
}

/** Independent batch writer: refuses cross-target swaps and re-derives the
 * entire plan after the GM confirmation, then persists one v3 recovery ledger. */
export async function commitMultiDestinationTerritoryCellTransfer(scene,plan,
  {view=globalThis.canvas,onProgress=()=>{}}={}){
  if(plan?.schemaVersion!==3||plan.sceneId!==scene?.id||
      readPendingTerritoryCellTransfer(scene))
    throw Error("Reopen and review the batch transfer; resolve any pending recovery first.");
  const staged=plan.targetIds.map(id=>{
    const region=authorize(scene,id),draft=readTerritoryDraft(scene,id,{view});
    draft.geography=readRegionGeography(region);
    draft.offsets=plan.records.find(record=>record.id===id).after.shapes[0].offsets;
    return {regionId:id,draft};
  });
  const refreshed=planMultiDestinationTerritoryCellTransfer(scene,staged,{view});
  if(!same(refreshed,plan))
    throw Error("Native batch Regions changed since preview. No changes written.");
  const intent={schemaVersion:3,sceneId:scene.id,
    sourceIds:clone(plan.sourceIds),targetIds:clone(plan.targetIds),
    gridIdentity:plan.gridIdentity,records:clone(plan.records)};
  if(JSON.stringify(intent).length>1000000)
    throw Error("Batch exceeds safe recovery storage. Use smaller cell groups.");
  const total=intent.records.length+3;
  await scene.update({[flag(GRID_TRANSFER_INTENT_FLAG)]:intent});
  onProgress({step:0,total,message:"Multi-destination recovery record saved"});
  if(!same(readPendingTerritoryCellTransfer(scene),intent))
    throw Error("Batch recovery record was not persisted; no Region was edited.");
  return finish(scene,intent,"resume",view,onProgress);
}

export async function resolveTerritoryCellTransfer(scene,mode,
  {view=globalThis.canvas,onProgress=()=>{}}={}){
  if(!["resume","rollback"].includes(mode))throw Error("Choose Resume or Roll Back.");
  const intent=readPendingTerritoryCellTransfer(scene);
  if(!intent)throw Error("No interrupted Region transfer needs recovery.");
  for(const record of intent.records)authorize(scene,record.id);
  return finish(scene,intent,mode,view,onProgress);
}
