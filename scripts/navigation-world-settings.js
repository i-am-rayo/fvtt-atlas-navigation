import { NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED } from "./navigation-time.js";
import { NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT,
  NAVIGATION_PLAYBACK_MIN,NAVIGATION_PLAYBACK_MAX } from "./navigation-playback.js";
import { NAVIGATION_RULES_PROFILE_SETTING,NAVIGATION_RULES_PROFILE_DEFAULT,
  NAVIGATION_RULES_PROFILES } from "./navigation-rules-profile.js";

const MODULE_ID="fvtt-atlas-navigation";

/** One centralized registration point for World navigation/travel preferences. */
export function registerNavigationWorldSettings({settings=game.settings,onPlaybackChange=()=>{}}={}){
  settings.register(MODULE_ID,NAVIGATION_SPEED_SETTING,{
    name:"Atlas Default Overland Speed",
    hint:"Default GM navigation speed in the active Scene's grid distance units per hour (e.g. km/hour for a km Scene). Can be overridden in Navigation. Does not alter token speeds.",
    scope:"world",config:true,type:Number,default:DEFAULT_NAVIGATION_SPEED,
    range:{min:0.1,max:1000,step:0.1}
  });
  settings.register(MODULE_ID,NAVIGATION_PLAYBACK_SETTING,{
    name:"Atlas Guided Travel Animation Speed",
    hint:"Real seconds per in-game travel hour. Smaller values animate faster. " +
      "Atlas derives token movement from the Group Actor's travel pace and the curved road path. " +
      "This only changes playback; it never advances World time or changes Actor movement.",
    scope:"world",config:true,type:Number,default:NAVIGATION_PLAYBACK_DEFAULT,
    range:{min:NAVIGATION_PLAYBACK_MIN,max:NAVIGATION_PLAYBACK_MAX,step:0.5},
    onChange:onPlaybackChange
  });
  settings.register(MODULE_ID,NAVIGATION_RULES_PROFILE_SETTING,{
    name:"Atlas Travel Rules Profile (Upcoming Rest Rules)",
    hint:"Choose the ruleset Atlas should use for future travel-day/rest/forced-march features. " +
      "This beta does not yet apply rest, exhaustion, or other character effects. " +
      "Custom parameters will be editable when those features arrive.",
    scope:"world",config:true,type:String,default:NAVIGATION_RULES_PROFILE_DEFAULT,
    choices:{...NAVIGATION_RULES_PROFILES}
  });
}
