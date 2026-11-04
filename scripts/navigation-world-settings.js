import { NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED } from "./navigation-time.js";
import { NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT,
  NAVIGATION_PLAYBACK_MIN,NAVIGATION_PLAYBACK_MAX } from "./navigation-playback.js";
import { NAVIGATION_RULES_PROFILE_SETTING,NAVIGATION_RULES_PROFILE_DEFAULT,
  NAVIGATION_RULES_PROFILES,CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
  CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING }
  from "./navigation-rules-profile.js";
import { NAVIGATION_WORLD_CLOCK_SETTING,NAVIGATION_WORLD_CLOCK_DEFAULT }
  from "./navigation-world-clock.js";
import { NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING,
  NAVIGATION_MOUNTED_SPEED_DEFAULT,NAVIGATION_SAILING_SPEED_DEFAULT }
  from "./navigation-travel-method.js";
import { TRANSPORT_CATALOG_SETTING,defaultTransportationCatalog }
  from "./navigation-transport-catalog.js";
import { AtlasTransportationSettings } from "./navigation-transport-settings.js";
import { GROUP_TRANSPORT_SETTING,defaultGroupTransportation }
  from "./navigation-group-transport.js";
import {ATLAS_LEVEL_PLANNER_SETTING} from "./navigation-native-level-model.js";

const MODULE_ID="fvtt-atlas-navigation";

/** One centralized registration point for World navigation/travel preferences. */
export function registerNavigationWorldSettings({settings=game.settings,onPlaybackChange=()=>{}}={}){
  settings.register(MODULE_ID,ATLAS_LEVEL_PLANNER_SETTING,{
    name:"Atlas — Enable Native Scene Level Setup",
    hint:"Make GM-reviewed native Level setup available in Atlas Scene tabs. " +
      "Each Scene must also opt in. Proposed ranges are reviewed and confirmed " +
      "before native Level creation or in-place updates. No road, Region or Token changes.",
    scope:"world",config:true,restricted:true,type:Boolean,default:true
  });
  settings.register(MODULE_ID,TRANSPORT_CATALOG_SETTING,{
    name:"Atlas Transportation Catalog",
    hint:"Versioned World transportation preset overrides and custom mounts/vehicles.",
    scope:"world",config:false,type:Object,default:defaultTransportationCatalog()
  });
  settings.register(MODULE_ID,GROUP_TRANSPORT_SETTING,{
    name:"Atlas Group Transportation Assignments",
    hint:"Versioned Atlas-only NPC roles, quantities and stable transport profile IDs for D&D5e Groups. "+
      "Manage them from the Group sheet Travel Pace header; native Actor data stays unchanged.",
    scope:"world",config:false,type:Object,default:defaultGroupTransportation()
  });
  settings.registerMenu?.(MODULE_ID,"atlasTransportationPresetsMenu",{
    name:"Atlas — Transportation Presets",
    label:"Configure Transportation and Travel Rules",
    hint:"Walking, mounts, vehicles, speeds, costs, rest rules and journey options in one GM-only window.",
    icon:"fa-solid fa-horse",type:AtlasTransportationSettings,restricted:true
  });
  settings.register(MODULE_ID,NAVIGATION_SPEED_SETTING,{
    name:"Atlas Default Overland Speed",
    hint:"Default GM navigation speed in the active Scene's grid distance units per hour (e.g. km/hour for a km Scene). Can be overridden in Navigation. Does not alter token speeds.",
    scope:"world",config:false,type:Number,default:DEFAULT_NAVIGATION_SPEED,
    range:{min:0.1,max:1000,step:0.1}
  });
  for(const [key,name,initial] of [
    [NAVIGATION_MOUNTED_SPEED_SETTING,"Mounted",NAVIGATION_MOUNTED_SPEED_DEFAULT],
    [NAVIGATION_SAILING_SPEED_SETTING,"Sailing",NAVIGATION_SAILING_SPEED_DEFAULT]
  ])settings.register(MODULE_ID,key,{
    name:`Atlas ${name} Travel Speed`,
    hint:`GM-configured ${name.toLowerCase()} speed in miles per hour, converted to the active Scene's `+
      "mile/km Grid units for estimates. Defaults reference D&D 2024: a mount's Normal pace " +
      "(3 mph sustained; one-hour double-speed burst needs rest) or a Sailing Ship (2 mph). " +
      "Used for transport planning only until checkpoint transfers are implemented. " +
      "Does not change Group Actor speeds, native Token movement or Region Behaviors.",
    scope:"world",config:false,type:Number,default:initial,
    range:{min:0.1,max:1000,step:0.1}
  });
  settings.register(MODULE_ID,NAVIGATION_PLAYBACK_SETTING,{
    name:"Atlas Guided Travel Animation Speed",
    hint:"Real seconds per in-game travel hour. Smaller values animate faster. " +
      "Atlas derives token movement from the Group Actor's travel pace and the curved road path. " +
      "This only changes playback; it never advances World time or changes Actor movement.",
    scope:"world",config:false,type:Number,default:NAVIGATION_PLAYBACK_DEFAULT,
    range:{min:NAVIGATION_PLAYBACK_MIN,max:NAVIGATION_PLAYBACK_MAX,step:0.5},
    onChange:onPlaybackChange
  });
  settings.register(MODULE_ID,NAVIGATION_RULES_PROFILE_SETTING,{
    name:"Atlas Guided Travel — Rules Profile",
    hint:"Choose D&D 2014, D&D 2024/5.5e, Custom, or system defaults for daily travel " +
      "and GM-confirmed rests. An unknown game system has no automatic daily limit. " +
      "Atlas never automatically changes Actor resources or exhaustion.",
    scope:"world",config:false,type:String,default:NAVIGATION_RULES_PROFILE_DEFAULT,
    choices:{...NAVIGATION_RULES_PROFILES}
  });
  const custom=(key,name,hint,defaultValue,range)=>settings.register(MODULE_ID,key,{
    name,hint,scope:"world",config:false,type:Number,default:defaultValue,range
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
    scope:"world",config:false,type:Boolean,default:NAVIGATION_WORLD_CLOCK_DEFAULT
  });
}
