/** Pure policy for territory border analysis. A Continent intentionally
 * contains its settlements; only equivalent geographic peers compete. */
export const MAX_BORDER_REGIONS=40;
export const MAX_NATIVE_OVERLAP_TESTS=80;
export const MAX_GAP_SEGMENT_TESTS=100000;
export const MAX_TRIM_AREA_FRACTION=.30;

const SETTLEMENTS=new Set(["city","town","village","settlement"]);
export function competingTerritories(a,b){
  const ak=a?.geography?.kind,bk=b?.geography?.kind;
  return ak==="continent"&&bk==="continent" ||
    SETTLEMENTS.has(ak)&&SETTLEMENTS.has(bk);
}

export function boundsNear(a,b,gap=0){
  if(!a||!b||![a.x,a.y,a.width,a.height,b.x,b.y,b.width,b.height,gap]
    .every(Number.isFinite)||a.width<0||a.height<0||b.width<0||b.height<0||gap<0)
    return false;
  return a.x<=b.x+b.width+gap&&a.x+a.width+gap>=b.x&&
    a.y<=b.y+b.height+gap&&a.y+a.height+gap>=b.y;
}

function squaredDistanceToSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,denom=dx*dx+dy*dy;
  const t=denom>0?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/denom)):0;
  return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;
}

function orientation(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function crosses(a,b,c,d){
  const ab1=orientation(a,b,c),ab2=orientation(a,b,d),cd1=orientation(c,d,a),cd2=orientation(c,d,b);
  return ab1*ab2<=0&&cd1*cd2<=0&&
    Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&
    Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
}

/** Cheap bounded proximity *hint*. A small distance is not proof of an
 * enclosed polygon gap; the GM must inspect the native outline. */
export function nearestPolygonBorderDistance(flatA,flatB,{maxTests=MAX_GAP_SEGMENT_TESTS}={}){
  if(!Array.isArray(flatA)||!Array.isArray(flatB)||flatA.length<6||flatB.length<6||
      flatA.length%2||flatB.length%2||![...flatA,...flatB].every(Number.isFinite)||
      (flatA.length/2)*(flatB.length/2)>maxTests)return null;
  const as=[],bs=[];
  for(let i=0;i<flatA.length;i+=2)as.push({x:flatA[i],y:flatA[i+1]});
  for(let i=0;i<flatB.length;i+=2)bs.push({x:flatB[i],y:flatB[i+1]});
  let closest=Infinity;
  for(let i=0;i<as.length;i++)for(let j=0;j<bs.length;j++){
    const a=as[i],b=as[(i+1)%as.length],c=bs[j],d=bs[(j+1)%bs.length];
    if(crosses(a,b,c,d))return 0;
    closest=Math.min(closest,squaredDistanceToSegment(a,c,d),
      squaredDistanceToSegment(b,c,d),squaredDistanceToSegment(c,a,b),
      squaredDistanceToSegment(d,a,b));
  }
  return Number.isFinite(closest)?Math.sqrt(closest):null;
}

/** Only a nonempty, single-ring, bounded trim is safe for a one-Region update.
 * Any holes, splits, excessive loss or unexpected clipping result fail closed. */
export function validateBorderTrim({sourceArea,resultArea,overlapArea,
  resultingPolygonCount,hasHoles,vertexCount}){
  if(![sourceArea,resultArea,overlapArea].every(Number.isFinite)||sourceArea<=0||
      resultArea<=0||overlapArea<=0||overlapArea>sourceArea*1.001||
      resultingPolygonCount!==1||hasHoles||!Number.isInteger(vertexCount)||
      vertexCount<3||vertexCount>2048)
    throw Error("The native polygon difference cannot be represented as one safe boundary. No Region was changed.");
  const removed=(sourceArea-resultArea)/sourceArea;
  if(removed<=0||removed>MAX_TRIM_AREA_FRACTION||
      Math.abs((sourceArea-resultArea)-overlapArea)>Math.max(1,sourceArea*.002))
    throw Error("The proposed trim removes too much land or does not match native overlap. Edit the boundary manually.");
  return {removedPercent:Number((removed*100).toFixed(2))};
}
