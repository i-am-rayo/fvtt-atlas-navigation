/**
 * GM Navigation source/method selectors.
 *
 * These controls receive resolved values and callbacks. They do not inspect
 * Foundry documents, decide method eligibility, modify a Journey or apply
 * any gameplay change when rendered.
 */
import {appendGroupedTransportationOptions} from "./navigation-transport-choices.js";

const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

export function renderNavigationDepartureSelector({sourceMode,partyMode,disabled=false,
  onSourceChange,onRefresh}){
  const row=el("div");
  row.style.cssText="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;";
  const label=el("label","Start from");
  label.htmlFor="atlas-navigation-departure";
  const select=el("select");
  select.id="atlas-navigation-departure";
  select.title="Choose the route departure source";
  select.disabled=disabled;
  select.style.cssText="flex:1;min-width:12rem;";
  for(const [value,optionLabel] of [["map","Map Point A"],["party","Party token location"]]){
    const option=el("option",optionLabel);
    option.value=value;
    select.appendChild(option);
  }
  select.value=sourceMode;
  select.addEventListener("change",()=>onSourceChange(select.value));
  row.append(label,select);
  if(partyMode){
    const refresh=el("button","Refresh location");
    refresh.type="button";
    refresh.title="Recalculate from the party token's current location";
    refresh.disabled=disabled;
    refresh.addEventListener("click",()=>onRefresh());
    row.appendChild(refresh);
  }
  return row;
}

export function renderNavigationTravelMethodSelector({choices,selectedValue,
  disabled=false,showEditor=false,onMethodChange,onEdit}){
  const row=el("div");
  row.style.cssText="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;";
  const label=el("label","Travel method");
  label.htmlFor="atlas-navigation-travel-method";
  const select=el("select");
  select.id="atlas-navigation-travel-method";
  select.title="Party transport or services offered at the departure checkpoint";
  select.disabled=disabled;
  select.style.cssText="flex:1;min-width:12rem;";
  appendGroupedTransportationOptions(select,choices);
  select.value=selectedValue;
  select.addEventListener("change",()=>onMethodChange(select.value));
  row.append(label,select);
  if(showEditor){
    const edit=el("button");
    edit.type="button";
    edit.title="Edit this journey's travel method using the World preset fields";
    edit.setAttribute?.("aria-label","Edit selected travel method for this journey");
    edit.innerHTML='<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
    edit.disabled=disabled;
    edit.style.cssText="min-width:2.5rem;min-height:2.5rem;";
    edit.addEventListener("click",()=>onEdit());
    row.appendChild(edit);
  }
  return row;
}
