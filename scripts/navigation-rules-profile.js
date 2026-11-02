/** Pure, system-aware travel-day policy; never changes Actor or Token data. */
export const NAVIGATION_RULES_PROFILE_SETTING="guidedTravelRulesProfile";
export const NAVIGATION_RULES_PROFILE_DEFAULT="system";
export const CUSTOM_DAY_HOURS_SETTING="guidedTravelCustomDayHours";
export const CUSTOM_OVERNIGHT_HOURS_SETTING="guidedTravelCustomOvernightHours";
export const CUSTOM_SHORT_REST_HOURS_SETTING="guidedTravelCustomShortRestHours";
export const CUSTOM_LONG_REST_HOURS_SETTING="guidedTravelCustomLongRestHours";
export const NAVIGATION_RULES_PROFILES=Object.freeze({
  system:"Use current game system (recommended)",
  dnd5e2014:"D&D 5e — 2014 rules",
  dnd5e2024:"D&D 5e — 2024 / 5.5e rules",
  custom:"Custom travel rules"
});

export function validateNavigationRulesProfile(value){
  if(typeof value!=="string"||!Object.hasOwn(NAVIGATION_RULES_PROFILES,value))
    throw Error("Unknown travel rules profile.");
  return value;
}

const MODULE_ID="fvtt-atlas-navigation";
const bounded=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const readSetting=(settings,key,fallback)=>{
  try{return settings?.get?.(MODULE_ID,key)??fallback;}
  catch{return fallback;}
};
const readCustom=(settings,key,fallback,min,max)=>{
  const value=readSetting(settings,key,fallback);
  return bounded(value,min,max)?value:fallback;
};

/** Unrecognized systems do not inherit D&D fatigue rules by accident. */
export function resolveNavigationTravelRules({settings,systemId,actorHoursPerDay=null}={}){
  const stored=readSetting(settings,NAVIGATION_RULES_PROFILE_SETTING,NAVIGATION_RULES_PROFILE_DEFAULT);
  const profile=Object.hasOwn(NAVIGATION_RULES_PROFILES,stored)?stored:NAVIGATION_RULES_PROFILE_DEFAULT;
  if(profile==="system"&&systemId!=="dnd5e")return Object.freeze({
    profile,label:"System-neutral (no automatic daily limit)",dailyHours:null,
    overnightHours:0,shortRestHours:1,longRestHours:8,forcedMarch:"custom"
  });
  if(profile==="custom")return Object.freeze({
    profile,label:"Custom travel rules",
    dailyHours:readCustom(settings,CUSTOM_DAY_HOURS_SETTING,8,1,24),
    overnightHours:readCustom(settings,CUSTOM_OVERNIGHT_HOURS_SETTING,16,0,24),
    shortRestHours:readCustom(settings,CUSTOM_SHORT_REST_HOURS_SETTING,1,0.5,8),
    longRestHours:readCustom(settings,CUSTOM_LONG_REST_HOURS_SETTING,8,1,24),
    forcedMarch:"custom"
  });
  const dailyHours=profile==="system"&&bounded(actorHoursPerDay,1,24)?actorHoursPerDay:8;
  return Object.freeze({
    profile,label:profile==="dnd5e2024"?"D&D 2024 / 5.5e":
      profile==="dnd5e2014"?"D&D 2014 / 5e":"D&D 5e system defaults",
    dailyHours,overnightHours:16,shortRestHours:1,longRestHours:8,
    forcedMarch:profile==="dnd5e2024"?"dnd5e2024":"dnd5e2014"
  });
}
