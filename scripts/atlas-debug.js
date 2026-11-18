import { MODULE_ID } from "./atlas-storage.js";

/** Browser-local GM console diagnostics; quiet by default. */
export const ATLAS_DEBUG_LEVEL_SETTING="debugConsoleLevel";
export const ATLAS_DEBUG_LEVELS=Object.freeze({
  off:"Off (warnings and errors only)",
  standard:"Standard (journey milestones)",
  verbose:"Verbose (feature decisions and actions)",
  trace:"Trace (Scene changes and fog refreshes)"
});
const LEVEL_VALUE={off:0,standard:1,info:1,verbose:2,trace:3};
export const ATLAS_DEBUG_CATEGORIES=Object.freeze({
  journey:"Journey",movement:"Token Movement",clock:"World Time",
  fog:"Exploration & Fog",lifecycle:"Scene & Windows",
  announcement:"Discovery & Banner Delivery",
  territory:"Territories & Native Regions"
});

export function registerAtlasDebugSettings({settings=game.settings}={}){
  settings.register(MODULE_ID,ATLAS_DEBUG_LEVEL_SETTING,{
    name:"Atlas Debug — Console Logging Level",
    hint:"Controls Atlas logs in this browser only. Standard shows major journey events; " +
      "Verbose adds GM-only feature decisions, territory editing, movement, clock, exploration and announcements; " +
      "new features should add bounded Verbose diagnostics. Trace adds Scene and fog refreshes. " +
      "Warnings and errors always appear.",
    scope:"client",config:true,type:String,default:"off",choices:ATLAS_DEBUG_LEVELS
  });
}

export function atlasDebugEnabled(category,{settings=globalThis.game?.settings,user=globalThis.game?.user,level="info"}={}){
  if(!Object.hasOwn(ATLAS_DEBUG_CATEGORIES,category)||!user?.isGM)return false;
  try{
    const selected=settings?.get?.(MODULE_ID,ATLAS_DEBUG_LEVEL_SETTING);
    return (LEVEL_VALUE[selected]??0)>=(LEVEL_VALUE[level]??1);
  }
  catch{return false;}
}

/** Keep messages compact; never print Actor data, geometry, or exploration cells. */
export function atlasDebug(category,message,details,{level="info"}={}){
  if(!atlasDebugEnabled(category,{level}))return;
  const prefix=`[fvtt-atlas-navigation][${category}] ${message}`;
  // Chrome/Firefox commonly hide console.debug behind a Verbose filter.
  // Standard journey milestones must remain visible with normal Info logs.
  const output=(LEVEL_VALUE[level]??1)<=1?console.info:console.debug;
  if(details===undefined)output(prefix);
  else output(prefix,details);
}

/** Failures are visible even with debug disabled, with no private Scene dump. */
export function atlasWarn(category,message,error){
  console.warn(`[fvtt-atlas-navigation][${category}] ${message}`,error);
}
