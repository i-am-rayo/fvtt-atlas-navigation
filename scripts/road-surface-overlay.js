/** Read-only surface styling. Native Region colors and Behaviors are untouched. */
import { orderedRoutingRegions, regionContainsPoint, resolveRoutingRegion,
  routingPriority, REGION_ROUTING_PRIORITY_FLAG, REGION_ROUTING_ORDER_FLAG }
  from "./navigation-terrain.js";
import { MODULE_ID } from "./atlas-storage.js";
import { REGION_TRAVEL_PRESET_FLAG } from "./travel-preset-model.js";

export function sceneRoadSurfaces(scene, presets) {
  const lookup=new Map(presets.map(p=>[p.id,p]));
  const candidates=[];
  for(const region of scene?.regions?.contents??[]){
    const id=region.getFlag?.(MODULE_ID,REGION_TRAVEL_PRESET_FLAG)?.presetId;
    const preset=lookup.get(id);
    const shapes=Array.from(region.shapes??[]);
    if(!preset||!shapes.length||shapes.some(s=>!["polygon","ellipse"].includes(s.type)))continue;
    candidates.push({id:region.id,shapes,color:preset.color,name:preset.name,
      priority:routingPriority(region.getFlag?.(MODULE_ID,REGION_ROUTING_PRIORITY_FLAG))});
  }
  const ordered=orderedRoutingRegions(candidates,
    scene?.getFlag?.(MODULE_ID,REGION_ROUTING_ORDER_FLAG)??null);
  return ordered.map((item,index)=>({...item,rank:index}));
}

/** Split a curved canvas polyline into color runs; bounded sub-grid sampling. */
export function roadSurfaceSpans(path, regions, defaultColor, gridSize, maxSamples=4096) {
  if(path.length<2)return [];
  if(!regions.length||!Number.isFinite(gridSize)||gridSize<=0)
    return [{points:path,color:defaultColor}];
  let count=0;
  const runs=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1], b=path[i];
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(gridSize/2)));
    count+=n;
    if(count>maxSamples)return [{points:path,color:defaultColor}];
    for(let j=0;j<n;j++){
      const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      const first=at(j/n),last=at((j+1)/n),middle=at((j+.5)/n);
      const winner=resolveRoutingRegion(regions.filter(r=>regionContainsPoint(r.shapes,middle)));
      const color=winner?.color??defaultColor;
      const previous=runs.at(-1);
      if(previous?.color===color)previous.points.push(last);
      else runs.push({points:[first,last],color});
    }
  }
  return runs;
}

/** Label only the currently hovered, explicitly preset-backed terrain. */
export function roadSurfaceAtPoint(point, regions) {
  if(!point)return null;
  return resolveRoutingRegion(regions.filter(r=>regionContainsPoint(r.shapes,point)))?.name??null;
}
