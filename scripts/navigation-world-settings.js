import { NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED } from "./navigation-time.js";
import { NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT,
  NAVIGATION_PLAYBACK_MIN,NAVIGATION_PLAYBACK_MAX } from "./navigation-playback.js";
import { NAVIGATION_RULES_PROFILE_SETTING,NAVIGATION_RULES_PROFILE_DEFAULT,
  NAVIGATION_RULES_PROFILES,CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
  CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING }
  from "./navigation-rules-profile.js";
import { NAVIGATION_WORLD_CLOCK_SETTING,NAVIGATION_WORLD_CLOCK_DEFAULT }
  from "./navigation-world-clock.js";

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
    name:"Atlas Guided Travel — Rules Profile",
    hint:"Choose D&D 2014, D&D 2024/5.5e, Custom, or system defaults for daily travel " +
      "and GM-confirmed rests. An unknown game system has no automatic daily limit. " +
      "Atlas never automatically changes Actor resources or exhaustion.",
    scope:"world",config:true,type:String,default:NAVIGATION_RULES_PROFILE_DEFAULT,
    choices:{...NAVIGATION_RULES_PROFILES}
  });
  const custom=(key,name,hint,defaultValue,range)=>settings.register(MODULE_ID,key,{
    name,hint,scope:"world",config:true,type:Number,default:defaultValue,range
  });
  custom(CUSTOM_DAY_HOURS_SETTING,"Atlas Custom — Travel Hours Per Day",
    "Maximum moving hours before the GM chooses a rest or continued travel. Used only with Custom rules.",
    8,{min:1,max:24,step:1});
  custom(CUSTOM_OVERNIGHT_HOURS_SETTING,"Atlas Custom — Overnight Downtime (Hours)",
    "Time added for an overnight camp, including any long rest. Used only with Custom rules.",
    16,{min:0,max:24,step:1});
  custom(CUSTOM_SHORT_REST_HOURS_SETTING,"Atlas Custom — Short Rest (Hours)",
    "Adds World time but does not reset daily travel hours. Used only with Custom rules.",
    1,{min:0.5,max:8,step:0.5});
  custom(CUSTOM_LONG_REST_HOURS_SETTING,"Atlas Custom — Long Rest (Hours)",
    "Adds World time and resets Atlas's journey-day counter; Actor resources are not changed.",
    8,{min:1,max:24,step:1});
  settings.register(MODULE_ID,NAVIGATION_WORLD_CLOCK_SETTING,{
    name:"Atlas Guided Travel — Advance World Time",
    hint:"Disabled by default. When enabled, the active GM advances Foundry World time " +
      "after confirmed token movement and after an explicitly selected short rest, long rest, " +
      "or overnight camp. No Actor, exhaustion, or currency changes are applied.",
    scope:"world",config:true,type:Boolean,default:NAVIGATION_WORLD_CLOCK_DEFAULT
  });
}
