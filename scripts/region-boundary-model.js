/** Pure, bounded native-polygon border assistant. The native Region remains the
 * only source of saved geometry. This model does not infer shared seams. */

const MAX_SOURCE_VERTICES = 64;
const MAX_RESULT_VERTICES = 256;

function pointsFromPolygon(shape) {
  if (shape?.type !== "polygon" || shape.hole === true ||
      shape.gridBased === true || !Array.isArray(shape.points) ||
      shape.points.length % 2 !== 0) {
    throw new Error("Choose one ordinary native polygon without holes or grid-based points.");
  }
  const vertices = [];
  for (let i = 0; i < shape.points.length; i += 2) {
    const x = shape.points[i], y = shape.points[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("The native polygon contains non-finite coordinates.");
    }
    vertices.push({x, y});
  }
  if (vertices.length > 3 &&
      vertices[0].x === vertices.at(-1).x &&
      vertices[0].y === vertices.at(-1).y) vertices.pop();
  if (vertices.length < 3 || vertices.length > MAX_SOURCE_VERTICES) {
    throw new Error("Smoothing supports polygons with 3–64 distinct border vertices.");
  }
  return vertices;
}

function signedArea(vertices) {
  return vertices.reduce((total, p, i) => {
    const next = vertices[(i + 1) % vertices.length];
    return total + p.x * next.y - next.x * p.y;
  }, 0) / 2;
}

function orientation(a, b, c) {
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function onSegment(a, b, p) {
  return p.x >= Math.min(a.x,b.x)-1e-8 && p.x <= Math.max(a.x,b.x)+1e-8 &&
    p.y >= Math.min(a.y,b.y)-1e-8 && p.y <= Math.max(a.y,b.y)+1e-8;
}

function crosses(a, b, c, d) {
  const abC=orientation(a,b,c),abD=orientation(a,b,d);
  const cdA=orientation(c,d,a),cdB=orientation(c,d,b);
  if ((abC>1e-8 && abD< -1e-8 || abC< -1e-8 && abD>1e-8) &&
      (cdA>1e-8 && cdB< -1e-8 || cdA< -1e-8 && cdB>1e-8))return true;
  return (Math.abs(abC)<=1e-8&&onSegment(a,b,c)) ||
    (Math.abs(abD)<=1e-8&&onSegment(a,b,d)) ||
    (Math.abs(cdA)<=1e-8&&onSegment(c,d,a)) ||
    (Math.abs(cdB)<=1e-8&&onSegment(c,d,b));
}

function assertSimple(vertices) {
  if (Math.abs(signedArea(vertices)) < 1e-3) {
    throw new Error("The polygon has no meaningful area.");
  }
  const n=vertices.length;
  for(let i=0;i<n;i++){
    const a=vertices[i],b=vertices[(i+1)%n];
    if(Math.hypot(b.x-a.x,b.y-a.y)<1e-5)
      throw Error("The polygon contains duplicate adjoining vertices.");
  }
  for (let i=0;i<n;i++) {
    const a=vertices[i],b=vertices[(i+1)%n];
    for(let j=i+1;j<n;j++) {
      if(j===i+1 || i===0&&j===n-1)continue;
      if(crosses(a,b,vertices[j],vertices[(j+1)%n])) {
        throw new Error("The polygon would contain crossed or touching borders.");
      }
    }
  }
}

/** Chaikin corner cutting stays within each original edge and never invents
 * control handles. Output is a closed path encoded as a native point polygon. */
export function smoothClosedBoundary(flatPoints, passes=1) {
  if (![1,2].includes(passes))throw Error("Choose Gentle or Moderate smoothing.");
  const source=pointsFromPolygon({type:"polygon",points:flatPoints});
  assertSimple(source);
  let points=source;
  for(let pass=0;pass<passes;pass++) {
    const next=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25},
        {x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});
    }
    if(next.length>MAX_RESULT_VERTICES)throw Error("Too many boundary points to preview safely.");
    assertSimple(next);
    points=next;
  }
  return points.flatMap(p=>[p.x,p.y]);
}

/** The first assistant slice intentionally excludes multi-shape Regions,
 * native holes, and generated road corridors. It never replaces them. */
export function planSmoothedNativeRegion(shapes, passes=1) {
  if (!Array.isArray(shapes)||shapes.length!==1) {
    throw Error("This first editor supports a Region with exactly one polygon; multi-shape Regions and holes remain in Foundry's editor.");
  }
  const original=shapes[0];
  const source=pointsFromPolygon(original);
  const smoothed=smoothClosedBoundary(original.points,passes);
  return Object.freeze({
    sourcePoints:source.flatMap(p=>[p.x,p.y]),
    resultPoints:smoothed,
    shapes:[{...original,points:smoothed}],passes
  });
}
