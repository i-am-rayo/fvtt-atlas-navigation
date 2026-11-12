/**
 * Pure, read-only eligibility and explicitly selected Road-graph attachment.
 *
 * Native Regions, Scene documents, player discovery and Journeys are never
 * modified here. Only isolated, unshared v10 Checkpoint Nodes can be bound
 * to a Road. Geometric proximity alone never authorizes connectivity.
 */
import { validateAtlas } from "./atlas-model.js";
import { independentCheckpointRoadCandidates,
  CHECKPOINT_ROAD_REVIEW_TOLERANCE } from "./road-checkpoint-attachments.js";

function idFrom(factory, used) {
  if(typeof factory!=="function")throw Error("A graph ID generator is required.");
  for(let i=0;i<20;i++){
    const id=factory();
    if(typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id)&&!used.has(id)){
      used.add(id);return id;
    }
  }
  throw Error("Could not allocate a distinct Road section ID.");
}

function pathFor(atlas,segment,nodes){
  const from=nodes.get(segment.from),to=nodes.get(segment.to);
  if(!from||!to)throw Error("A Road section has a missing graph endpoint.");
  return [from,...segment.via,to];
}
function lengths(path){
  const result=[0];
  for(let i=1;i<path.length;i++){
    const d=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
    if(d<1)throw Error("Road section has a too-short edge.");
    result.push(result.at(-1)+d);
  }
  return result;
}

/**
 * Candidate Rows are read-only. If the same isolated Node is near more than
 * one section, or if multiple Nodes demand a cut at the same position, do
 * not offer an automatic attachment to ambiguous topology.
 */
export function roadCheckpointEditCandidates(atlas,{roadId,tolerance=CHECKPOINT_ROAD_REVIEW_TOLERANCE}={}){
  const current=validateAtlas(atlas);
  if(current.schemaVersion<10)return [];
  if(!current.roads.some(road=>road.id===roadId))
    throw Error("This Road no longer exists.");
  const nodes=new Map(current.nodes.map(node=>[node.id,node]));
  const byCheckpoint=new Map();
  for(const segment of current.segments.filter(s=>s.roadId===roadId)){
    const path=pathFor(current,segment,nodes);
    const total=lengths(path).at(-1);
    const candidates=independentCheckpointRoadCandidates(current,path,{tolerance});
    for(const c of candidates){
      if(c.endpoint||c.along<1||total-c.along<1)continue;
      const list=byCheckpoint.get(c.checkpointId)??[];
      list.push({...c,segmentId:segment.id,roadId});
      byCheckpoint.set(c.checkpointId,list);
    }
  }
  const eligible=[...byCheckpoint.values()].filter(list=>list.length===1)
    .map(list=>list[0]);
  const ambiguous=new Set();
  const bySegment=new Map();
  for(const candidate of eligible){
    const list=bySegment.get(candidate.segmentId)??[];
    list.push(candidate);bySegment.set(candidate.segmentId,list);
  }
  for(const list of bySegment.values()){
    list.sort((a,b)=>a.along-b.along);
    for(let i=1;i<list.length;i++){
      if(list[i].along-list[i-1].along<1){
        ambiguous.add(list[i].checkpointId);
        ambiguous.add(list[i-1].checkpointId);
      }
    }
  }
  return eligible.filter(c=>!ambiguous.has(c.checkpointId))
    .sort((a,b)=>a.segmentId.localeCompare(b.segmentId)||
      a.along-b.along||a.checkpointId.localeCompare(b.checkpointId));
}

/**
 * An isolated Checkpoint can join any saved Road graph Node (terminal or
 * junction) by sharing that exact graph Node. This is a *merge*, not a new edge.
 *
 * Preserve the established Road endpoint ID and Checkpoint ID. The isolated
 * Node ID is intentionally retired after confirmation, because retaining two
 * distinct coincident Nodes would not make them graph-connected.
 *
 * At a multi-Road junction a roadId MUST be selected explicitly by the GM.
 * Road/segment IDs and coordinates are never rewritten. Nodes already owned
 * by another Checkpoint and non-isolated source Nodes require separate review.
 */
export function attachIndependentCheckpointToRoadEndpoint(atlas,{
  checkpointId,roadId,roadNodeId
}={}){
  const current=validateAtlas(atlas);
  if(current.schemaVersion<10)throw Error("Endpoint Checkpoint attachment requires schema v10.");
  const checkpoint=current.checkpoints.find(c=>c.id===checkpointId);
  if(!checkpoint)throw Error("Checkpoint no longer exists.");
  const source=current.nodes.find(node=>node.id===checkpoint.nodeId);
  const destination=current.nodes.find(node=>node.id===roadNodeId);
  if(!source||!destination||source.id===destination.id)
    throw Error("Choose distinct existing Checkpoint and Road Nodes.");
  if(current.segments.some(s=>s.from===source.id||s.to===source.id)||
      current.checkpoints.some(c=>c.id!==checkpointId&&c.nodeId===source.id))
    throw Error("Only an isolated, unshared Checkpoint can merge into a Road endpoint.");
  if(current.checkpoints.some(c=>c.nodeId===destination.id))
    throw Error("The Road endpoint already has a Checkpoint; review shared ownership separately.");
  const incident=current.segments.filter(s=>s.from===destination.id||s.to===destination.id);
  const roadIds=new Set(incident.map(s=>s.roadId));
  if(!roadIds.size||!roadIds.has(roadId))
    throw Error("Choose a Road actually incident to this saved graph Node.");
  return validateAtlas({
    ...current,
    nodes:current.nodes.filter(node=>node.id!==source.id),
    checkpoints:current.checkpoints.map(c=>c.id===checkpointId
      ? {...c,nodeId:destination.id,roadId}:c)
  });
}

export function attachIndependentCheckpointToRoadNode(atlas,options={}) {
  return attachIndependentCheckpointToRoadEndpoint(atlas,options);
}

/** Split only affected Road sections, retaining the upstream original ID and
 * all existing Node IDs, via shapes, Roads and Checkpoint metadata. */
export function attachIndependentCheckpointsToRoad(atlas,{
  roadId,checkpointIds,idFactory
}={}){
  const current=validateAtlas(atlas);
  if(current.schemaVersion<10)throw Error("Road Checkpoint attachment requires schema v10.");
  if(!Array.isArray(checkpointIds)||checkpointIds.length>100||
     checkpointIds.some(id=>typeof id!=="string")||
     new Set(checkpointIds).size!==checkpointIds.length)
    throw Error("Select at most 100 distinct Checkpoints.");
  if(!checkpointIds.length)return current;
  const candidates=new Map(roadCheckpointEditCandidates(current,{roadId})
    .map(candidate=>[candidate.checkpointId,candidate]));
  const groups=new Map();
  for(const id of checkpointIds){
    const candidate=candidates.get(id);
    if(!candidate)throw Error("Checkpoint attachment is ambiguous or no longer eligible.");
    const list=groups.get(candidate.segmentId)??[];
    list.push(candidate);groups.set(candidate.segmentId,list);
  }
  // The graph Node is authoritative for both the Road junction and the
  // Checkpoint marker. Project each chosen independent Node onto the saved
  // Road polyline BEFORE splitting, eliminating near-miss visual offsets.
  // Non-selected Checkpoints retain their authored coordinates.
  const selectedNodes=new Map([...groups.values()].flatMap(list=>
    list.map(item=>[item.nodeId,{x:item.projected.x,y:item.projected.y}])));
  const alignedNodes=current.nodes.map(node=>selectedNodes.has(node.id)
    ? {...node,...selectedNodes.get(node.id)}:node);
  const nodes=new Map(alignedNodes.map(n=>[n.id,n]));
  const used=new Set(current.segments.map(s=>s.id));
  const segments=current.segments.flatMap(segment=>{
    const selected=groups.get(segment.id);
    if(!selected)return [segment];
    selected.sort((a,b)=>a.along-b.along);
    const path=pathFor(current,segment,nodes),distances=lengths(path);
    const total=distances.at(-1);
    const cuts=[
      {along:0,nodeId:segment.from},
      ...selected.map(item=>({along:item.along,nodeId:item.nodeId})),
      {along:total,nodeId:segment.to}
    ];
    const result=[];
    for(let i=1;i<cuts.length;i++){
      const before=cuts[i-1],after=cuts[i];
      if(after.along-before.along<1||before.nodeId===after.nodeId)
        throw Error("Checkpoint connection would create a zero-length Road section.");
      const via=segment.via.filter((_,j)=>
        distances[j+1]>before.along+1e-6&&
        distances[j+1]<after.along-1e-6);
      const points=[nodes.get(before.nodeId),...via,nodes.get(after.nodeId)];
      if(points.some(p=>!p)||points.some((p,j)=>j>0&&
          Math.hypot(p.x-points[j-1].x,p.y-points[j-1].y)<1))
        throw Error("Checkpoint connection would create invalid Road geometry.");
      result.push({...segment,id:i===1?segment.id:idFrom(idFactory,used),
        from:before.nodeId,to:after.nodeId,via});
    }
    return result;
  });
  const chosen=new Set(checkpointIds);
  return validateAtlas({...current,nodes:alignedNodes,segments,
    checkpoints:current.checkpoints.map(cp=>chosen.has(cp.id)
      ? {...cp,roadId}:cp)});
}
