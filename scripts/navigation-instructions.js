/** Pure navigation instructions; image-local coordinates are north-up map coordinates. */
const DIRECTIONS=["north","northeast","east","southeast","south","southwest","west","northwest"];
export function navigationDirection(points) {
  const first=points?.[0], last=points?.at(-1);
  if(!first || !last)return "";
  let dx=last.x-first.x,dy=last.y-first.y;
  if(Math.hypot(dx,dy)<1e-8)return "";
  const sector=Math.round(Math.atan2(dx,-dy)/(Math.PI/4));
  return DIRECTIONS[(sector+8)%8];
}

/** Split by terrain, merge consecutive legs with the same road and surface. */
export function buildNavigationSteps(legs, roadName = id => id) {
  const steps=[];
  for(const leg of legs){
    if(!Number.isFinite(leg.distance)||leg.distance<0.005)continue;
    const slices=leg.terrainSlices?.length ? leg.terrainSlices :
      [{terrain:"Unspecified terrain",distance:leg.distance,multiplier:1}];
    for(const slice of slices){
      if(slice.distance<0.005)continue;
      const kind=leg.kind;
      const direction=navigationDirection(leg.points);
      const roadId=kind==="road"?leg.roadId:null;
      const terrain=slice.terrain;
      const prev=steps.at(-1);
      const cost=slice.distance*slice.multiplier;
      if(prev && prev.kind===kind && prev.roadId===roadId && prev.terrain===terrain &&
          (prev.regionId??null)===(slice.regionId??null)){
        prev.distance+=slice.distance;prev.cost+=cost;
      }else{
        const verb=steps.length?"Continue":"Head";
        const where=kind==="road" ? " on "+roadName(roadId) : " toward the road or destination";
        steps.push({kind,roadId,terrain,regionId:slice.regionId??null,
          regionName:slice.regionName??null,direction,distance:slice.distance,cost,
          instruction:verb+(direction?" "+direction:"")+where});
      }
    }
  }
  return steps;
}
