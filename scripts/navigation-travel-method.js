/**
 * Overland transport is separate from Foundry's native Token movement actions.
 * These methods only estimate a journey in beta.1; guided non-walking travel
 * requires explicit checkpoint transfer support in a later beta.
 */
import { validateNavigationSpeed } from "./navigation-time.js";
import { convertGroupSpeed } from "./navigation-party-speed.js";

export const NAVIGATION_MOUNTED_SPEED_SETTING="guidedMountedSpeed";
export const NAVIGATION_SAILING_SPEED_SETTING="guidedSailingSpeed";
// D&D 2024 / 5.5e (Basic Rules): Normal travel 3 mph; Sailing Ship 2 mph.
// A mount's double-distance burst is only available for ONE hour before rest.
// It is NOT the sustained speed and is not automated in this planning slice.
export const NAVIGATION_MOUNTED_SPEED_DEFAULT=3;
export const NAVIGATION_SAILING_SPEED_DEFAULT=2;
export const NAVIGATION_TRAVEL_METHODS=Object.freeze({
  walking:Object.freeze({label:"Walking",kind:"foot",surface:"land",guided:true}),
  mounted:Object.freeze({label:"Mounted",kind:"mount",surface:"land",guided:false,
    speedSetting:NAVIGATION_MOUNTED_SPEED_SETTING,referenceMph:NAVIGATION_MOUNTED_SPEED_DEFAULT}),
  sailing:Object.freeze({label:"Sailing Ship",kind:"vehicle",surface:"water",guided:false,
    speedSetting:NAVIGATION_SAILING_SPEED_SETTING,referenceMph:NAVIGATION_SAILING_SPEED_DEFAULT})
});

const MODULE_ID="fvtt-atlas-navigation";
const speedSetting=(settings,key,fallback)=>{
  let value;
  try{value=settings?.get?.(MODULE_ID,key);}catch{/* old Worlds use defaults */}
  return validateNavigationSpeed(value??fallback);
};

/** Walking retains the system's Group Actor pace. Transport has GM-set speeds. */
export function resolveNavigationMethodTravel(method,walkingTravel,settings,sceneUnits){
  const selected=NAVIGATION_TRAVEL_METHODS[method];
  if(!selected)throw Error("Unknown Atlas travel method.");
  if(method==="walking")return {...walkingTravel,methodId:method,methodLabel:selected.label};
  const speedMph=speedSetting(settings,selected.speedSetting,selected.referenceMph);
  const speed=convertGroupSpeed(speedMph,"mph",sceneUnits);
  if(speed===null)throw Error("Transport estimates need a Scene Grid in miles or kilometers.");
  return {speed:validateNavigationSpeed(speed),actorName:null,pace:null,
    mode:selected.surface,source:"atlas-method",hoursPerDay:null,
    methodId:method,methodLabel:selected.label,speedMph};
}

/**
 * Read-only, conservative surface check. Unassigned roads are legacy Land;
 * dangling preset IDs are unknown, never silently declared Water or Land.
 * Off-road endpoint connectors don't prove a vessel can enter/leave water.
 */
export function assessNavigationMethodRoute(method,route,atlas,presets=[]){
  const selected=NAVIGATION_TRAVEL_METHODS[method];
  if(!selected)throw Error("Unknown Atlas travel method.");
  if(method==="walking")return {compatible:true,guided:true,reason:null};
  if(route?.status!=="ok")return {compatible:false,guided:false,
    reason:"Calculate a route before checking this transport method."};
  const roads=new Map((atlas?.roads??[]).map(road=>[road.id,road]));
  const catalog=new Map(presets.map(preset=>[preset.id,preset]));
  const roadLegs=route.legs?.filter(leg=>leg.kind==="road")??[];
  if(!roadLegs.length)return {compatible:false,guided:false,
    reason:"This method needs an authored road or waterway."};
  for(const leg of roadLegs){
    const road=roads.get(leg.roadId);
    const presetId=road?.travelPresetId;
    const surface=presetId?catalog.get(presetId)?.mode:null;
    if(!road || (presetId&&!surface))return {compatible:false,guided:false,
      reason:"A route road has an unknown travel surface preset. Ask the GM to verify it."};
    if((surface??"land")!==selected.surface)return {compatible:false,guided:false,
      reason:`${selected.label} needs ${selected.surface} routes throughout; this route crosses another surface.`};
  }
  return {compatible:true,guided:false,
    reason:`${selected.label} is available for distance/time planning. Guided movement awaits explicit checkpoint transfers.`};
}
