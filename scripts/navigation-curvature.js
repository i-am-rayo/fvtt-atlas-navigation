/** Clip a sampled, rendered road spline to the selected road leg endpoints. */
export function clipNavigationSpline(points,start,end) {
  if(!Array.isArray(points)||points.length<2)return [start,end];
  const offsets=[0];
  for(let i=1;i<points.length;i++)offsets.push(offsets.at(-1)+
    Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const project=p=>{
    let best=null;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
      const len2=dx*dx+dy*dy;if(len2<1e-8)continue;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2));
      const x=a.x+t*dx,y=a.y+t*dy;
      const d=Math.hypot(p.x-x,p.y-y),offset=offsets[i-1]+t*Math.sqrt(len2);
      if(!best||d<best.d)best={x,y,d,offset};
    }
    return best;
  };
  const a=project(start),b=project(end);
  if(!a||!b)return [start,end];
  const reverse=a.offset>b.offset;
  const lo=Math.min(a.offset,b.offset),hi=Math.max(a.offset,b.offset);
  const mid=points.filter((_,i)=>offsets[i]>lo+1e-8&&offsets[i]<hi-1e-8);
  const result=[{x:reverse?b.x:a.x,y:reverse?b.y:a.y},...mid,
    {x:reverse?a.x:b.x,y:reverse?a.y:b.y}];
  return reverse?result.reverse():result;
}
