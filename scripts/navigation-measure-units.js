/**
 * Atlas measurement preferences are presentation-only. World travel presets stay
 * in mph, Scene routes stay in Scene grid units, and elevations stay in meters.
 * None of the conversions in this module change saved coordinates or distances.
 */
export const ATLAS_MEASURING_UNITS_SETTING = "measuringUnits";
export const ATLAS_MEASURING_UNITS_CHOICES = Object.freeze({
  system:"System Default",metric:"Metric",imperial:"Imperial"
});
const MODULE_ID="fvtt-atlas-navigation";
export const METERS_PER_MILE=1609.344;
const metersFor={m:1,meter:1,meters:1,metre:1,metres:1,
  km:1000,kilometer:1000,kilometers:1000,kilometre:1000,kilometres:1000,
  ft:0.3048,foot:0.3048,feet:0.3048,
  mi:METERS_PER_MILE,mile:METERS_PER_MILE,miles:METERS_PER_MILE,
  yd:0.9144,yard:0.9144,yards:0.9144};
const normalize=unit=>String(unit??"").trim().toLowerCase();
const METRIC_SCENE_UNITS=new Set(["m","meter","meters","metre","metres","km",
  "kilometer","kilometers","kilometre","kilometres"]);
const get=(settings,namespace,key)=>{
  try{return settings?.get?.(namespace,key);}catch{return undefined;}
};

/** The D&D 5e length-unit toggle is dnd5e.metricLengthUnits (not volume/weight). */
export function resolveAtlasMeasuringUnits(settings=globalThis.game?.settings,
  systemId=globalThis.game?.system?.id,sceneUnit=globalThis.canvas?.scene?.grid?.units??""){
  const requested=get(settings,MODULE_ID,ATLAS_MEASURING_UNITS_SETTING);
  if(requested==="metric"||requested==="imperial")return requested;
  if(systemId==="dnd5e"){
    const systemMetric=get(settings,"dnd5e","metricLengthUnits");
    if(typeof systemMetric==="boolean")return systemMetric?"metric":"imperial";
  }
  const factor=metersFor[normalize(sceneUnit)];
  if(factor!==undefined)return METRIC_SCENE_UNITS.has(normalize(sceneUnit))?
    "metric":"imperial";
  return "imperial";
}
/** Elevation uses recognized native Scene grid units; unknown units fall
 * back to the Atlas/system preference. Stored heights remain canonical meters. */
export function resolveCheckpointElevationUnits(sceneUnit,
  settings=globalThis.game?.settings,systemId=globalThis.game?.system?.id){
  const unit=normalize(sceneUnit);
  if(metersFor[unit]!==undefined)
    return METRIC_SCENE_UNITS.has(unit)?"metric":"imperial";
  return resolveAtlasMeasuringUnits(settings,systemId,sceneUnit);
}
const convertDistance=(amount,sourceUnit,targetUnit)=>{
  const source=metersFor[normalize(sourceUnit)],target=metersFor[normalize(targetUnit)];
  if(!Number.isFinite(amount)||source===undefined||target===undefined)return null;
  return amount*source/target;
};
/** Physical route measurements are displayed in km or miles, never used for pathfinding. */
export function atlasDisplayDistance(amount,sceneUnit,settings,systemId){
  const target=resolveAtlasMeasuringUnits(settings,systemId,sceneUnit)==="metric"?"km":"mi";
  const converted=convertDistance(amount,sceneUnit,target);
  return converted===null?{value:amount,unit:String(sceneUnit||"Scene units")}:
    {value:converted,unit:target};
}
export function atlasDisplaySpeed(amount,sceneUnit,settings,systemId){
  const distance=atlasDisplayDistance(amount,sceneUnit,settings,systemId);
  return {value:distance.value,unit:distance.unit+"/hour"};
}
/** Canonical transportation speed is mph regardless of display settings. */
export function atlasDisplayPresetSpeed(speedMph,settings,systemId){
  const metric=resolveAtlasMeasuringUnits(settings,systemId)==="metric";
  return {value:metric?speedMph*1.609344:speedMph,unit:metric?"kph":"mph"};
}
export function atlasPresetSpeedFromDisplay(speed,settings,systemId){
  return resolveAtlasMeasuringUnits(settings,systemId)==="metric"?speed/1.609344:speed;
}
/** A stored radius is still in the Scene's units, even when Atlas shows another system. */
export function atlasSceneDistanceFromDisplay(amount,sceneUnit,settings,systemId){
  const displayUnit=resolveAtlasMeasuringUnits(settings,systemId,sceneUnit)==="metric"?"km":"mi";
  return convertDistance(amount,displayUnit,sceneUnit)??amount;
}
/** Convert a UI speed to Scene units/hour; the hour divisor cancels.
 * Honor the rounded maximum shown beside the control without exceeding it.
 */
export function atlasSceneSpeedFromDisplay(speed,sceneUnit,settings,systemId,
  canonicalMaximum=null){
  const converted=atlasSceneDistanceFromDisplay(speed,sceneUnit,settings,systemId);
  if(Number.isFinite(canonicalMaximum)){
    const shown=atlasDisplaySpeed(canonicalMaximum,sceneUnit,settings,systemId).value;
    if(Number.isFinite(shown)&&
        Math.abs(speed-Number(shown.toFixed(2)))<1e-8)
      return canonicalMaximum;
  }
  return converted;
}
export function atlasDisplayElevation(meters,settings,systemId){
  const imperial=resolveAtlasMeasuringUnits(settings,systemId)==="imperial";
  return {value:imperial?meters/0.3048:meters,unit:imperial?"ft":"m"};
}
/** Cost storage is CP/mile. Metric Worlds may edit an equivalent CP/km rate. */
export function atlasDisplayCostPerDistance(cpPerMile,settings,systemId){
  return resolveAtlasMeasuringUnits(settings,systemId)==="metric"?cpPerMile/1.609344:cpPerMile;
}
export function atlasCostPerMileFromDisplay(cpPerUnit,settings,systemId){
  return resolveAtlasMeasuringUnits(settings,systemId)==="metric"?cpPerUnit*1.609344:cpPerUnit;
}
export function atlasFormatMeasure({value,unit},digits=2){
  const displayedUnit=unit==="mi/hour"?"mph":
    unit==="km/hour"||unit==="km/h"?"kph":unit;
  return Number(value).toLocaleString(undefined,{maximumFractionDigits:digits})+
    " "+displayedUnit;
}
