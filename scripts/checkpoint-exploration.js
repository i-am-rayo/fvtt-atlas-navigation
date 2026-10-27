import { checkpointRevealRadiusCells, checkpointKnowledge } from "./party-exploration-model.js";
import { cellKey } from "./atlas-manual-fog-model.js";

/**
 * Project saved, GM-authored checkpoint discovery into native square/hex cells.
 * This is read-only: the resulting cells are NEVER written into manual brush state.
 * Positions are Scene-image-relative for Atlas v2+ road graph schemas.
 */
export function checkpointRevealKeys(cells, atlas, exploration, gridSize, origin={x:0,y:0}) {
  const keys=new Set();
  if (!exploration?.enabled || !Array.isArray(cells) ||
      !Number.isFinite(gridSize) || gridSize<=0) return keys;
  const nodes=new Map((atlas?.nodes??[]).map(point=>[point.id,point]));
  // Spatial lookup keeps projection bounded to the cells near each checkpoint.
  const buckets=new Map();
  for (const cell of cells) {
    const x=Math.floor(cell.x/gridSize),y=Math.floor(cell.y/gridSize);
    const key=x+","+y, list=buckets.get(key)??[];
    list.push(cell);buckets.set(key,list);
  }
  for (const checkpoint of atlas?.checkpoints??[]) {
    const knowledge=checkpointKnowledge(exploration,checkpoint.id);
    if (knowledge!=="visited"&&knowledge!=="lore") continue;
    const radius=checkpointRevealRadiusCells(exploration,checkpoint.id);
    if (!(radius>0)) continue; // radius 0 reveals marker only, no terrain
    const point=nodes.get(checkpoint.nodeId);
    if (!Number.isFinite(point?.x)||!Number.isFinite(point?.y)) continue;
    const x=point.x-(atlas.schemaVersion>=2?0:origin.x);
    const y=point.y-(atlas.schemaVersion>=2?0:origin.y);
    const reach=radius*gridSize+1e-6;
    const minX=Math.floor((x-reach)/gridSize),maxX=Math.floor((x+reach)/gridSize);
    const minY=Math.floor((y-reach)/gridSize),maxY=Math.floor((y+reach)/gridSize);
    for(let bx=minX;bx<=maxX;bx++)for(let by=minY;by<=maxY;by++){
      for(const cell of buckets.get(bx+","+by)??[]) {
        if(Math.hypot(cell.x-x,cell.y-y)<=reach)keys.add(cellKey(cell));
      }
    }
  }
  return keys;
}

/** Clear only old manually-hidden overrides covered by an explicit GM reveal. */
export function clearHiddenForCheckpoint(hidden, projectedKeys) {
  return hidden.filter(point => !projectedKeys.has(cellKey(point)));
}
