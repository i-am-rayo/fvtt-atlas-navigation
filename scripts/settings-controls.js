/**
 * Stateless DOM controls shared by Atlas settings windows.
 * These controls never write World settings, Scene flags, or native Regions.
 * Each caller owns validation, save/cancel, and document permissions.
 */
import { readWorldTravelPresets, travelPresetDisplayGroup } from "./travel-preset-settings.js";
import { presetCostSummary } from "./travel-preset-model.js";

const node=(tag,text)=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=text;
  return element;
};

/** A single category structure for road, Region, and checkpoint travel selectors. */
export function createTravelPresetSelect({selectedId=null,name="atlasTravelPresetId",
  noneLabel="None (no Atlas travel preset)",includeCosts=false}={}){
  const select=node("select");select.name=name;
  const none=node("option",noneLabel);none.value="";select.appendChild(none);
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
      const group=node("optgroup");group.label=groupName;
      groups.set(groupName,group);select.appendChild(group);
    }
    const option=node("option",display.name+(includeCosts?" ("+presetCostSummary(preset)+")":""));
    option.value=preset.id;groups.get(groupName).appendChild(option);
  }
  select.value=selectedId??"";
  return select;
}
