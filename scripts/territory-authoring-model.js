/** Pure, bounded authoring geometry. These control points are not native
 * gameplay geometry: a confirmed Region Shape is always the runtime owner. */
export const BOUNDARY_SOURCE_VERSION=1;
export const BOUNDARY_SOURCE_FLAG="territoryBoundarySource";
export const MAX_TERRITORY_NODES=256;
export const MAX_TERRITORY_CELLS=6000;

/** Feature detection keeps the polygon editor usable on earlier v14 builds
 * and gridless Scenes without treating the newest native shape as mandatory. */
export function preferredTerritoryCreationMethod({nativeGridShape=false,gridless=false}={}){
  return nativeGridShape&&!gridless?"grid":"polygon";
}

const finitePoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const key=p=>`${p.i},${p.j}`;

function cross(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function between(a,b,c){return Math.min(a,b)-1e-8<=c&&c<=Math.max(a,b)+1e-8;}
function onSegment(a,b,c){return Math.abs(cross(a,b,c))<=1e-7&&
  between(a.x,b.x,c.x)&&between(a.y,b.y,c.y);}
function intersect(a,b,c,d){
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return (x*y<0&&z*w<0)||onSegment(a,b,c)||onSegment(a,b,d)||
    onSegment(c,d,a)||onSegment(c,d,b);
}

export function validateBoundaryNodes(points){
  if(!Array.isArray(points)||points.length<3||points.length>MAX_TERRITORY_NODES||
      points.some(p=>!finitePoint(p)||typeof p.id!=="string"||
        !/^[A-Za-z0-9_-]{1,80}$/.test(p.id)))
    throw Error("Territory boundary requires 3–256 finite, individually identified nodes.");
  if(new Set(points.map(p=>p.id)).size!==points.length)
    throw Error("Territory boundary has duplicate node IDs.");
  const n=points.length;
  for(let i=0;i<n;i++){
    const a=points[i],b=points[(i+1)%n];
    if(Math.hypot(b.x-a.x,b.y-a.y)<0.01)
      throw Error("Territory boundary has coincident or near-zero-length edges.");
    for(let j=i+1;j<n;j++){
      if(j===i+1||(i===0&&j===n-1))continue;
      if(intersect(a,b,points[j],points[(j+1)%n]))
        throw Error("Territory boundary crosses itself or touches a nonadjacent edge.");
    }
  }
  const signed=points.reduce((sum,p,i)=>{
    const q=points[(i+1)%n];return sum+p.x*q.y-q.x*p.y;
  },0)/2;
  if(Math.abs(signed)<1)throw Error("Territory boundary area is too small.");
  return Math.abs(signed);
}

export function polygonShapeFromNodes(points){
  validateBoundaryNodes(points);
  const origin={x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y))};
  // Foundry v14 stores polygon vertices in absolute canvas coordinates. Its
  // separate origin is an anchor, not an offset to add to or subtract from
  // every point. Normalizing points against the origin shifts the native Shape.
  return {type:"polygon",origin,points:points.flatMap(p=>[p.x,p.y]),
    hole:false,gridBased:false};
}

/** Require a single simple closed cycle. Snapping only within the requested
 * tolerance is explicit; malformed or gameplay-affecting Walls fail closed. */
export function boundaryFromBlankWalls(walls,{tolerance=0.5}={}){
  if(!Array.isArray(walls)||walls.length<3||walls.length>MAX_TERRITORY_NODES||
      !Number.isFinite(tolerance)||tolerance<0||tolerance>2)
    throw Error("Select 3–256 Blank Walls forming one closed Territory outline.");
  const vertices=[];
  const vertexFor=(x,y)=>{
    const found=vertices.findIndex(p=>Math.hypot(p.x-x,p.y-y)<=tolerance);
    if(found>=0)return found;
    vertices.push({x,y});return vertices.length-1;
  };
  const edges=[],wallIds=new Set();
  for(const wall of walls){
    const c=wall?.c;
    if(typeof wall.id!=="string"||wallIds.has(wall.id)||!Array.isArray(c)||
        c.length!==4||!c.every(Number.isFinite)||
        ["move","sight","light","sound"].some(k=>wall[k]!==0)||
        (wall.door??0)!==0)
      throw Error("Use distinct, non-blocking native Blank Walls only (no doors).");
    wallIds.add(wall.id);
    const a=vertexFor(c[0],c[1]),b=vertexFor(c[2],c[3]);
    if(a===b)throw Error("A selected Wall has a zero-length edge.");
    edges.push([a,b]);
  }
  if(vertices.length!==walls.length)
    throw Error("Selected Walls have an open, branched or duplicate boundary.");
  const adjacent=vertices.map(()=>[]);
  for(const [a,b] of edges){adjacent[a].push(b);adjacent[b].push(a);}
  if(adjacent.some(list=>list.length!==2||list[0]===list[1]))
    throw Error("Every Territory Wall endpoint must connect exactly two segments.");
  const order=[0],seen=new Set([0]);let previous=-1,current=0;
  while(true){
    const next=adjacent[current].find(v=>v!==previous);
    if(next===0)break;
    if(next===undefined||seen.has(next))throw Error("Selected Walls do not form one simple loop.");
    order.push(next);seen.add(next);previous=current;current=next;
  }
  if(seen.size!==vertices.length)throw Error("Selected Walls contain multiple disconnected loops.");
  const nodes=order.map((v,index)=>({id:`wallnode_${index}`,x:vertices[v].x,y:vertices[v].y}));
  validateBoundaryNodes(nodes);
  return {nodes,wallIds:[...wallIds]};
}

export function validateGridOffsets(offsets){
  if(!Array.isArray(offsets)||!offsets.length||offsets.length>MAX_TERRITORY_CELLS||
      offsets.some(p=>!Number.isSafeInteger(p?.i)||!Number.isSafeInteger(p?.j)||
        Math.abs(p.i)>1000000||Math.abs(p.j)>1000000))
    throw Error("A painted Territory requires 1–6,000 valid grid cells.");
  if(new Set(offsets.map(key)).size!==offsets.length)
    throw Error("Painted Territory contains duplicate cells.");
  return offsets.map(({i,j})=>({i,j}));
}

export function paintGridCells(existing,stroke,erase=false){
  if(!Array.isArray(existing))throw Error("Invalid existing Territory grid selection.");
  const map=new Map((existing.length?validateGridOffsets(existing):[]).map(p=>[key(p),p]));
  if(!Array.isArray(stroke)||stroke.length>100||stroke.some(p=>
    !Number.isSafeInteger(p?.i)||!Number.isSafeInteger(p?.j)))
    throw Error("Invalid grid brush stroke.");
  for(const offset of stroke){
    if(erase)map.delete(key(offset));else map.set(key(offset),{i:offset.i,j:offset.j});
  }
  if(map.size>MAX_TERRITORY_CELLS)throw Error("Territory exceeds the 6,000-cell authoring limit.");
  return [...map.values()].sort((a,b)=>a.i-b.i||a.j-b.j);
}

export function gridCellConflicts(proposal,peers){
  const selected=new Set(validateGridOffsets(proposal).map(key));
  const conflicts=[];
  for(const peer of peers){
    const overlap=peer.offsets.filter(p=>selected.has(key(p)));
    if(overlap.length)conflicts.push({regionId:peer.regionId,count:overlap.length});
  }
  return conflicts;
}
