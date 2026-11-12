/**
 * Pure, image-local candidate projection for authoring a NEW Road through
 * independent Checkpoints. This is read-only: candidate proximity is never
 * authoritative graph connectivity until an explicitly approved Road save.
 */
import {validateAtlas} from "./atlas-model.js";

export const CHECKPOINT_ROAD_REVIEW_TOLERANCE = 14;

export function independentCheckpointRoadCandidates(atlas,points,{
  tolerance=CHECKPOINT_ROAD_REVIEW_TOLERANCE
}={}) {
  const current=validateAtlas(atlas);
  if(current.schemaVersion<10)return [];
  if(!Array.isArray(points)||points.length<2||
     points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y))||
     !Number.isFinite(tolerance)||tolerance<0||tolerance>14)
    throw Error("Invalid Road draft for Checkpoint connection preview.");
  const segments=[];
  let along=0;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<1)throw Error("Road draft contains a too-short segment.");
    segments.push({a,b,index:i,length,start:along});
    along+=length;
  }
  const total=along;
  const nodes=new Map(current.nodes.map(n=>[n.id,n]));
  const incident=new Set(current.segments.flatMap(s=>[s.from,s.to]));
  const nodeCounts=new Map();
  for(const cp of current.checkpoints){
    nodeCounts.set(cp.nodeId,(nodeCounts.get(cp.nodeId)??0)+1);
  }
  const candidates=[];
  for(const cp of current.checkpoints){
    if(incident.has(cp.nodeId)||nodeCounts.get(cp.nodeId)!==1)continue;
    const point=nodes.get(cp.nodeId);
    if(!point)continue;
    const hits=[];
    for(const segment of segments){
      const dx=segment.b.x-segment.a.x;
      const dy=segment.b.y-segment.a.y;
      const t=Math.max(0,Math.min(1,
        ((point.x-segment.a.x)*dx+(point.y-segment.a.y)*dy)/
        (segment.length*segment.length)));
      const x=segment.a.x+dx*t,y=segment.a.y+dy*t;
      const distance=Math.hypot(point.x-x,point.y-y);
      if(distance<=tolerance){
        hits.push({segmentIndex:segment.index,t,
          along:segment.start+t*segment.length,distance,
          x,y});
      }
    }
    if(!hits.length)continue;
    hits.sort((a,b)=>a.distance-b.distance||a.along-b.along);
    const best=hits[0];
    // If a path loops close to the same node at two distinct places, the
    // chosen cut order is ambiguous. Fail closed for this candidate.
    if(hits.some(h=>h!==best&&
      Math.abs(h.distance-best.distance)<.1&&
      Math.abs(h.along-best.along)>1))continue;
    candidates.push({checkpointId:cp.id,nodeId:cp.nodeId,name:cp.name,
      distance:best.distance,along:best.along,
      segmentIndex:best.segmentIndex,t:best.t,
      projected:{x:best.x,y:best.y},
      position:{x:point.x,y:point.y},
      endpoint:best.along<=1?"start":total-best.along<=1?"end":null});
  }
  candidates.sort((a,b)=>a.along-b.along||a.checkpointId.localeCompare(b.checkpointId));
  // Two independent Nodes at almost the same distance create a zero-length
  // graph section. Neither should be offered without separate reconciliation.
  const ambiguous=new Set();
  for(let i=1;i<candidates.length;i++){
    if(Math.abs(candidates[i].along-candidates[i-1].along)<1){
      ambiguous.add(candidates[i].checkpointId);
      ambiguous.add(candidates[i-1].checkpointId);
    }
  }
  return candidates.filter(c=>!ambiguous.has(c.checkpointId));
}
