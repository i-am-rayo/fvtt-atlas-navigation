/**
 * Stateless DOM controls shared by Atlas settings windows.
 * These controls never write World settings, Scene flags, or native Regions.
 * Each caller owns validation, save/cancel, and document permissions.
 */
import { readWorldTravelPresets, travelPresetDisplayGroup } from "./travel-preset-settings.js";
import { presetCostSummary } from "./travel-preset-model.js";
import { CHECKPOINT_TYPE_GROUPS } from "./checkpoint-types.js";
import { createSettingsGroupedSelect } from "./settings-select.js";

const node=(tag,text)=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=text;
  return element;
};

/** A single category structure for road, Region, and checkpoint travel selectors. */
export function createTravelPresetSelect({selectedId=null,name="atlasTravelPresetId",
  noneLabel="None (no Atlas travel preset)",includeCosts=false}={}){
  const presets=readWorldTravelPresets().presets;
  const ranks=new Map([["land-dirt",0],["land-gravel",1],["land-stone",2]]);
  const indexed=presets.map((preset,index)=>({preset,index}));
  indexed.sort((a,b)=>{
    const rank=entry=>({land:0,water:1,air:2})[entry.preset.mode]??3;
    const diff=rank(a)-rank(b);if(diff)return diff;
    if(a.preset.mode==="land"&&b.preset.mode==="land"){
      const order=(ranks.get(a.preset.id)??3)-(ranks.get(b.preset.id)??3);
      if(order)return order;
    }
    return a.index-b.index;
  });
  const groups=new Map();
  for(const {preset} of indexed){
    const display=travelPresetDisplayGroup(preset);
    const groupName=display.subgroup?display.group+" — "+display.subgroup:display.group;
    if(!groups.has(groupName)){
      groups.set(groupName,[]);
    }
    groups.get(groupName).push([preset.id,
      display.name+(includeCosts?" ("+presetCostSummary(preset)+")":"")]);
  }
  return createSettingsGroupedSelect([
    {label:null,options:[["",noneLabel]]},
    ...[...groups].map(([label,options])=>({label,options}))
  ],{name,selectedId});
}

/** Whole-World checkpoint preset catalog, not only the current checkpoint type. */
export function createCheckpointPresetSelect(presets,{selectedId=null,
  noneLabel="None — keep current settings"}={}){
  const groups=[{label:null,options:[["",noneLabel]]}];
  for(const [heading,types] of CHECKPOINT_TYPE_GROUPS){
    const matches=presets.filter(p=>types.some(([type])=>type===p.category));
    if(!matches.length)continue;
    groups.push({label:heading,options:matches.map(preset=>[preset.id,preset.name])});
  }
  return createSettingsGroupedSelect(groups,{selectedId});
}

/** Accessible glyph-only control; can be wired by a delegated editor handler. */
export function createSettingsIconButton({icon,label,onClick=null,danger=false}){
  if(!/^[a-z-]+$/.test(icon)||!label?.trim()||
      (onClick!==null&&typeof onClick!=="function"))
    throw Error("Invalid Atlas settings action.");
  const button=node("button");button.type="button";
  button.title=label;button.setAttribute("aria-label",label);
  button.style.cssText="flex:0 0 2.5rem;width:2.5rem;min-width:2.5rem;"+
    "height:2.5rem;min-height:2.5rem;display:inline-grid;place-items:center;";
  if(danger)button.style.color="var(--color-level-error, #d56859)";
  const glyph=node("i");glyph.className="fa-solid fa-"+icon;
  glyph.setAttribute("aria-hidden","true");button.appendChild(glyph);
  if(onClick)button.addEventListener("click",onClick);
  return button;
}

/** Consistent, directly-handled settings actions. */
export function createSettingsActionButton({icon,label,onClick,danger=false}){
  if(typeof onClick!=="function")throw Error("Invalid Atlas settings action.");
  return createSettingsIconButton({icon,label,onClick,danger});
}
