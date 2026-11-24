/** Native Scene/Grid distance of the unsaved authored Road centerline.
 * Each persisted Road section is measured once; visual splines and terrain
 * weighting are deliberately excluded. The caller provides native Grid measurement.
 */
export function measureAuthoredRoadDistance(focus,measurePath){
  if(!focus?.atlas||typeof measurePath!=="function")return null;
  let paths;
  if(typeof focus.roadId==="string"){
    const nodes=new Map((focus.atlas.nodes??[]).map(node=>[node.id,node]));
    const sections=(focus.atlas.segments??[]).filter(s=>s.roadId===focus.roadId);
    if(!sections.length)return null;
    paths=sections.map(s=>[nodes.get(s.from),...(s.via??[]),nodes.get(s.to)]);
  }else paths=[focus.points];
  let distance=0;
  for(const path of paths){
    if(!Array.isArray(path)||path.length<2||path.some(p=>
        !Number.isFinite(p?.x)||!Number.isFinite(p?.y)))return null;
    const result=measurePath(path.map(p=>({x:p.x,y:p.y})));
    if(!Number.isFinite(result?.distance)||result.distance<0)return null;
    distance+=result.distance;
  }
  return Number.isFinite(distance)?distance:null;
}
