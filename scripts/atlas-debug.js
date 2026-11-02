import { MODULE_ID } from "./atlas-storage.js";

/** Independent GM-selectable diagnostics; quiet by default. */
export const ATLAS_DEBUG_LEVEL_SETTING="debugLoggingLevel";
export const ATLAS_DEBUG_LEVELS=Object.freeze({
  off:"Off (warnings and errors only)",
  info:"Info (journey milestones)",
  verbose:"Verbose (each movement and clock commit)",
  trace:"Trace (fog refreshes and Scene changes)"
});
const LEVEL_VALUE={off:0,info:1,verbose:2,trace:3};
export const ATLAS_DEBUG_CATEGORIES=Object.freeze({
  journey:{key:"debugJourney",name:"Atlas Debug — Journey",hint:"Log journey start, pause, rest decisions, completion, and unexpected interruption."},
  movement:{key:"debugMovement",name:"Atlas Debug — Token Movement",hint:"Log confirmed native token movement stretches and blocked movement."},
  clock:{key:"debugClock",name:"Atlas Debug — World Time",hint:"Log World clock commits, rest time, and failed time updates."},
  fog:{key:"debugFog",name:"Atlas Debug — Exploration & Fog",hint:"Log exploration saves and fog refresh events without exposing map cell data."},
  lifecycle:{key:"debugLifecycle",name:"Atlas Debug — Scene & Windows",hint:"Log canvas redraws, Scene updates, and navigation window closure."}
});

export function registerAtlasDebugSettings({settings=game.settings}={}){
  settings.register(MODULE_ID,ATLAS_DEBUG_LEVEL_SETTING,{
    name:"Atlas Debug — Console Logging Level",
    hint:"GM diagnostics in the browser console. Enable individual categories below to select what to log. Warnings and errors are always reported.",
    scope:"world",config:true,type:String,default:"off",choices:ATLAS_DEBUG_LEVELS
  });
  for(const {key,name,hint} of Object.values(ATLAS_DEBUG_CATEGORIES)){
    settings.register(MODULE_ID,key,{
      name,hint,scope:"world",config:true,type:Boolean,default:false
    });
  }
}

export function atlasDebugEnabled(category,{settings=globalThis.game?.settings,user=globalThis.game?.user,level="info"}={}){
  const option=ATLAS_DEBUG_CATEGORIES[category];
  if(!option||!user?.isGM)return false;
  try{
    const selected=settings?.get?.(MODULE_ID,ATLAS_DEBUG_LEVEL_SETTING);
    return (LEVEL_VALUE[selected]??0)>=(LEVEL_VALUE[level]??1)&&
      settings?.get?.(MODULE_ID,option.key)===true;
  }
  catch{return false;}
}

/** Keep messages compact; never print Actor data, geometry, or exploration cells. */
export function atlasDebug(category,message,details,{level="info"}={}){
  if(!atlasDebugEnabled(category,{level}))return;
  const prefix=`[fvtt-atlas-navigation][${category}] ${message}`;
  if(details===undefined)console.debug(prefix);
  else console.debug(prefix,details);
}

/** Failures are visible even with debug disabled, with no private Scene dump. */
export function atlasWarn(category,message,error){
  console.warn(`[fvtt-atlas-navigation][${category}] ${message}`,error);
}
