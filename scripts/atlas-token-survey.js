/** Pure Foundry v14 movement geometry for persistent Atlas survey. */
export function tokenTravelPath(movement, gridSize) {
  if (!Number.isFinite(gridSize)||gridSize<=0)throw new Error("Invalid Scene grid size.");
  const samples=[movement?.origin,...(movement?.passed?.waypoints??[]),movement?.destination];
  const points=[];
  for(const p of samples) {
    if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))continue;
    const width=Number.isFinite(p.width)&&p.width>0?p.width:1;
    const height=Number.isFinite(p.height)&&p.height>0?p.height:1;
    const point={x:p.x+width*gridSize/2,y:p.y+height*gridSize/2};
    const last=points.at(-1);
    if(!last||last.x!==point.x||last.y!==point.y)points.push(point);
  }
  return points;
}
export function distanceToSegment(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y;
  const length=dx*dx+dy*dy;
  const t=length>0?Math.max(0,Math.min(1,
    ((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
/** Include all native cell centers within a swept survey corridor, not endpoints only. */
export function surveyTrailCells(cells,path,radiusPx) {
  if(!Array.isArray(path)||!path.length||
      !Number.isFinite(radiusPx)||radiusPx<=0)throw new Error("Invalid Atlas survey.");
  const result=[];
  for(const cell of cells) {
    if(!Number.isFinite(cell.canvasX)||!Number.isFinite(cell.canvasY))continue;
    const p={x:cell.canvasX,y:cell.canvasY};
    let revealed=path.length===1?
      Math.hypot(p.x-path[0].x,p.y-path[0].y)<=radiusPx: false;
    for(let i=1;i<path.length&&!revealed;i++){
      const a=path[i-1],b=path[i];
      if(p.x<Math.min(a.x,b.x)-radiusPx||p.x>Math.max(a.x,b.x)+radiusPx||
         p.y<Math.min(a.y,b.y)-radiusPx||p.y>Math.max(a.y,b.y)+radiusPx)continue;
      revealed=distanceToSegment(p,a,b)<=radiusPx;
    }
    if(revealed)result.push({x:cell.x,y:cell.y});
  }
  return result;
}
/** Independent checkpoint proximity test uses the same traveled path. */
export function discoveredOnPath(atlas,path,radiusPx,origin={x:0,y:0}) {
  const discovered=[];
  const nodes=new Map((atlas?.nodes??[]).map(n=>[n.id,n]));
  for(const checkpoint of atlas?.checkpoints??[]){
    const point=nodes.get(checkpoint.nodeId);
    if(!point)continue;
    const p={x:point.x+(atlas.schemaVersion>=2?origin.x:0),
      y:point.y+(atlas.schemaVersion>=2?origin.y:0)};
    const segments=path.length>1?path.slice(1).map((to,i)=>[path[i],to]):
      [[path[0],path[0]]];
    if(segments.some(([a,b])=>distanceToSegment(p,a,b)<=radiusPx))
      discovered.push(checkpoint.id);
  }
  return discovered;
}
