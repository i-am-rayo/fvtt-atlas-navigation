/**
 * GM transfer selection controls for the current checkpoint leg.
 *
 * Options, recovery eligibility, operation choices and authorizations are
 * decided by the controller. Rendering these controls has no Journey effects.
 */
import {appendGroupedTransportationOptions} from "./navigation-transport-choices.js";

const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

export function renderRecoveredVoyageOperation({operation,disabled=false,onChange}){
  const info=el("small","This older Journey Journal did not retain its operating schedule. The GM must confirm whether the hired vessel has rotating crew before restoring continuous travel.");
  const label=el("label","Operating schedule for recovered voyage");
  label.style.cssText="display:grid;gap:.3rem;font-size:.87em;";
  const select=el("select");
  select.disabled=disabled;
  for(const [value,description] of [
    ["normal","Standard — 8h/day"],
    ["continuous","Continuous — crewed 24h operation"]
  ]){
    const entry=el("option",description);
    entry.value=value;
    select.append(entry);
  }
  select.value=operation;
  select.addEventListener("change",()=>onChange(select.value));
  label.append(select);
  return [info,label];
}

export function renderCurrentTransferMethodSelector({options,selectedValue,
  disabled=false,editable=false,onChange,onEdit}){
  const label=el("label","Transportation for this leg");
  label.style.cssText="display:grid;gap:.3rem;min-width:0;";
  const row=el("div");
  row.style.cssText="display:flex;gap:.5rem;align-items:center;min-width:0;";
  const select=el("select");
  select.style.cssText="flex:1;min-width:0;";
  select.disabled=disabled;
  select.setAttribute("aria-label","Transportation method for current leg");
  const placeholder=el("option","Select a transport method");
  placeholder.value="";
  select.append(placeholder);
  appendGroupedTransportationOptions(select,options);
  select.value=selectedValue;
  select.addEventListener("change",()=>onChange(select.value));
  row.append(select);
  if(editable){
    const edit=el("button");
    edit.type="button";
    edit.title="Edit this leg's transportation and save for trip or checkpoint";
    edit.setAttribute("aria-label","Edit current leg transportation");
    edit.innerHTML='<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
    edit.style.cssText="min-width:2.5rem;min-height:2.5rem;";
    edit.disabled=disabled;
    edit.addEventListener("click",()=>onEdit());
    row.append(edit);
  }
  label.append(row);
  return label;
}
