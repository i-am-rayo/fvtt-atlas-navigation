import {compareAtlasLabels} from "./settings-select.js";

/**
 * Shared navigation transportation dropdown renderer.
 * Every method choice belongs to an owner/source group (Party or checkpoint).
 * Only callers decide availability and route compatibility.
 */
export function appendGroupedTransportationOptions(select,choices,{documentProvider=()=>document}={}){
  if(!select||typeof select.appendChild!=="function"||!Array.isArray(choices))
    throw Error("Invalid transportation choices.");
  const doc=documentProvider();
  const groups=new Map(),bySource=new Map();
  for(const choice of choices){
    if(!choice||typeof choice.value!=="string"||typeof choice.label!=="string")
      throw Error("Invalid transportation choice.");
    const source=typeof choice.group==="string"&&choice.group.trim()?choice.group:"Party";
    if(!groups.has(source)){
      const optgroup=doc.createElement("optgroup");optgroup.label=source;
      groups.set(source,optgroup);bySource.set(source,[]);
      select.appendChild(optgroup);
    }
    bySource.get(source).push(choice);
  }
  for(const [source,items] of bySource){
    items.sort((a,b)=>compareAtlasLabels(a.label,b.label)||
      compareAtlasLabels(a.value,b.value));
    for(const choice of items){
      const option=doc.createElement("option");
      option.value=choice.value;
      option.textContent=choice.label;
      groups.get(source).appendChild(option);
    }
  }
  return groups;
}
