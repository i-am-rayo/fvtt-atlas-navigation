import { buildNavigationSteps } from "./navigation-instructions.js";
import { navigationHours } from "./navigation-time.js";

/**
 * Versioned, read-only itinerary projection for later Atlas token movement and
 * optional Journal export. This is an independent snapshot, NOT a Scene flag,
 * Journal, route recalculation, or instruction to move a Foundry Token.
 */
export const NAVIGATION_ITINERARY_SCHEMA = 1;
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const copyPoint=p=>({x:p.x,y:p.y});
const nonnegative=n=>Number.isFinite(n)&&n>=0;
const nullableText=value=>value==null?null:String(value);

export function createNavigationItinerary({
  sceneId,sceneName="",sceneUnits="",atlasRevision=null,
  route,roadName=id=>id,travel=null
}={}) {
  if(typeof sceneId!=="string"||!sceneId.trim()||route?.status!=="ok"||
      !validPoint(route.start)||!validPoint(route.end)||
      !nonnegative(route.distance)||!nonnegative(route.cost)||
      !Array.isArray(route.legs)||route.legs.length>4096||
      typeof roadName!=="function")throw Error("A valid calculated navigation route is required.");
  const legs=route.legs.map((leg,index)=>{
    if(!["road","off-road"].includes(leg.kind)||
        !nonnegative(leg.distance)||!nonnegative(leg.cost)||
        !Array.isArray(leg.points)||leg.points.length<2||leg.points.length>8192||
        !leg.points.every(validPoint)||
        (leg.terrainSlices!=null&&(!Array.isArray(leg.terrainSlices)||
          leg.terrainSlices.length>4096||leg.terrainSlices.some(slice=>
            !nonnegative(slice.distance)||!nonnegative(slice.multiplier))))||
        (leg.kind==="road"&&(!leg.roadId||!leg.segmentId)))
      throw Error("Navigation route contains invalid leg geometry.");
    return {
      order:index,kind:leg.kind,
      roadId:leg.kind==="road"?String(leg.roadId):null,
      roadName:leg.kind==="road"?String(roadName(leg.roadId)??"Road"):null,
      segmentId:leg.kind==="road"?String(leg.segmentId):null,
      points:leg.points.map(copyPoint),
      distance:leg.distance,cost:leg.cost,
      terrainSlices:(leg.terrainSlices??[]).map(slice=>({
        regionId:nullableText(slice.regionId),
        regionName:nullableText(slice.regionName),
        terrain:String(slice.terrain??"Unspecified terrain"),
        distance:slice.distance,
        multiplier:slice.multiplier
      }))
    };
  });
  const directions=buildNavigationSteps(route.legs,roadName).map((step,index)=>({
    order:index,kind:step.kind,roadId:nullableText(step.roadId),
    instruction:String(step.instruction),direction:String(step.direction??""),
    distance:step.distance,cost:step.cost,
    terrain:String(step.terrain),regionId:nullableText(step.regionId),
    regionName:nullableText(step.regionName)
  }));
  const speed=Number.isFinite(travel?.speed)&&travel.speed>0?travel.speed:null;
  const weightedDistance=route.terrainAware?route.cost:route.distance;
  return {
    schemaVersion:NAVIGATION_ITINERARY_SCHEMA,
    scene:{id:sceneId,name:String(sceneName),units:String(sceneUnits),
      atlasRevision:Number.isSafeInteger(atlasRevision)?atlasRevision:null},
    endpoints:{departure:copyPoint(route.start),destination:copyPoint(route.end)},
    measurements:{distance:route.distance,weightedDistance,
      terrainAware:Boolean(route.terrainAware),
      travelHours:speed?navigationHours(weightedDistance,speed):null},
    travel:{speedPerHour:speed,pace:nullableText(travel?.pace),
      source:nullableText(travel?.source),
      ...(travel?.methodId?{methodId:nullableText(travel.methodId)}:{}),
      hoursPerDay:nonnegative(travel?.hoursPerDay)?travel.hoursPerDay:null},
    terrainWarning:nullableText(route.terrainWarning),
    legs,directions
  };
}
