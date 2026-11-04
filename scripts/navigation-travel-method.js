/**
 * Overland methods are distinct from Foundry Token movement actions.
 * Walking keeps its native guided travel lifecycle. Compatible land transport
 * can use the same road-following lifecycle with explicit GM authorization;
 * water and air still require approved checkpoint transfers.
 */
import { validateNavigationSpeed } from "./navigation-time.js";
import { convertGroupSpeed } from "./navigation-party-speed.js";
import { findTransportationPreset,listTransportationPresets }
  from "./navigation-transport-catalog.js";

export const NAVIGATION_MOUNTED_SPEED_SETTING="guidedMountedSpeed";
export const NAVIGATION_SAILING_SPEED_SETTING="guidedSailingSpeed";
export const NAVIGATION_MOUNTED_SPEED_DEFAULT=3;
export const NAVIGATION_SAILING_SPEED_DEFAULT=2;

/** Backward-compatible reference for beta.1 callers and existing tests. */
export const NAVIGATION_TRAVEL_METHODS=Object.freeze({
  walking:Object.freeze({label:"Walking",kind:"foot",surface:"land",guided:true}),
  mounted:Object.freeze({label:"Mounted",kind:"mount",surface:"land",guided:true}),
  sailing:Object.freeze({label:"Sailing Ship",kind:"vehicle",surface:"water",guided:false})
});
export function availableNavigationTravelMethods(settings,systemId){
  return listTransportationPresets(settings,systemId);
}

/** New custom and built-in methods use the same World catalog projection. */
export function resolveNavigationMethodTravel(method,walkingTravel,settings,sceneUnits,
  {systemId=globalThis.game?.system?.id}={}){
  const selected=findTransportationPreset(method,settings,systemId);
  if(!selected)throw Error("Unknown Atlas travel method.");
  if(method==="walking")return {...walkingTravel,methodId:method,methodLabel:selected.name};
  const speed=convertGroupSpeed(selected.speedMph,"mph",sceneUnits);
  if(speed===null)throw Error("Transport estimates need a Scene Grid in miles or kilometers.");
  return {speed:validateNavigationSpeed(speed),actorName:null,pace:null,
    mode:selected.surface,source:"atlas-method",hoursPerDay:null,
    methodId:method,methodLabel:selected.name,speedMph:selected.speedMph,
    costCp:selected.costCp,costBasis:selected.costBasis,
    purchaseGp:selected.purchaseGp};
}

/** Surface constraints fail closed. No implicit boarding or flying allowed. */
export function assessNavigationMethodRoute(method,route,atlas,presets=[],
  {settings=globalThis.game?.settings,systemId=globalThis.game?.system?.id}={}){
  const selected=findTransportationPreset(method,settings,systemId);
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
      reason:selected.name+" needs "+selected.surface+" routes throughout; this route crosses another surface."};
  }
  const guided=selected.surface==="land";
  return {compatible:true,guided,
    reason:guided?
      selected.name+" may follow this land-only road route after GM confirmation.":
      selected.name+" is available for distance/time planning. Guided movement requires an approved checkpoint transfer."};
}
