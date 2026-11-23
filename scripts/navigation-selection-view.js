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

/**
 * Travel methods are checkbox selections during fresh GM planning.
 * The controller alone authorizes compatible combinations; presentation never
 * approves a multi-method journey or assigns passengers to vehicles.
 */
export function travelMethodIconClass(value,label){
    const key=value.split("|").at(-1)?.toLowerCase()??"";
    const labelText=String(label??"").toLowerCase();
    const symbol=key==="walking"?"fa-person-walking":
      /caravan|wagon|coach|cart/.test(key+" "+labelText)?"fa-wagon-covered":
      /horse|pony|mount/.test(key+" "+labelText)?"fa-horse":
      /camel/.test(key+" "+labelText)?"fa-paw":
      /ship|boat|barge|warship/.test(key+" "+labelText)?"fa-ship":
      /fly|air/.test(key+" "+labelText)?"fa-dove":"fa-route";
    return "fa-solid "+symbol;
}

export function renderNavigationTravelMethodButtons({choices,selectedValue,
  selectedValues=null,disabled=false,showEditor=false,onMethodChange,onMethodToggle,onEdit,
  onEditMethod}){
  const section=el("fieldset");
  section.className="atlas-navigation-methods";
  section.style.cssText="display:grid;gap:.55rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:9px;padding:.7rem;margin:0;min-width:0;";
  const title=el("legend","2 · How are we traveling?");
  title.style.cssText="font-weight:700;padding:0 .35rem;";
  section.appendChild(title);
  if(Array.isArray(selectedValues)){
    const help=el("small","Choose one or more methods.");
    help.style.cssText="opacity:.8;line-height:1.35;";
    section.appendChild(help);
  }
  const selected=new Set(selectedValues??[selectedValue]);
  const multiple=Array.isArray(selectedValues);
  const groups=new Map();
  for(const choice of choices??[]){
    const origin=choice.group==="Party"?"Party Owned":
      choice.group?.startsWith("Approved")?choice.group:
      "Available at "+(choice.group||"departure checkpoint");
    let group=groups.get(origin);
    if(!group){
      group=el("div");group.style.cssText="display:grid;gap:.35rem;";
      const heading=el("small",origin);
      heading.style.cssText="font-weight:600;opacity:.8;";
      const buttons=el("div");
      buttons.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem;";
      group.append(heading,buttons);
      groups.set(origin,buttons);
      section.appendChild(group);
      group=buttons;
    }
    const id="atlas-navigation-method-"+choice.value.replace(/[^a-zA-Z0-9_-]/g,"-");
    const label=el("label");
    label.htmlFor=id;
    const active=selected.has(choice.value);
    const canEdit=Boolean(onEditMethod&&active&&choice.value!=="owned|walking");
    label.style.cssText="display:flex;align-items:center;gap:.35rem;"+
      "padding:.4rem "+(canEdit?"2.6rem":".5rem")+" .4rem .5rem;"+
      "border-radius:7px;min-width:0;cursor:pointer;"+
      "border:1px solid "+(active?"#3eaf93":
        "var(--color-border-light-tertiary,#555)")+";"+
      (active?"background:rgba(22,169,101,.12);":"");
    const input=el("input");
    input.type=multiple?"checkbox":"radio";
    input.name="atlas-navigation-travel-method";
    input.id=id;input.value=choice.value;input.checked=active;
    input.disabled=Boolean(disabled);
    input.style.cssText="margin:0;accent-color:#3eaf93;flex:0 0 auto;";
    const icon=el("i");
    icon.className=travelMethodIconClass(choice.value,choice.label);
    icon.setAttribute?.("aria-hidden","true");
    const content=el("span");
    content.style.cssText="display:grid;gap:.1rem;min-width:0;overflow-wrap:anywhere;";
    const text=el("span",choice.label);
    text.style.cssText="font-size:.87em;";
    content.appendChild(text);
    if(choice.secondary){
      const detail=el("small",choice.secondary);
      detail.style.cssText="font-size:.75em;opacity:.8;";
      content.appendChild(detail);
    }
    if(choice.insufficient){
      label.title="Insufficient configured seats for the chosen travelers";
      if(!choice.cargoOnly)label.style.borderColor="#ad694e";
    }
    label.append(input,icon,content);
    input.addEventListener("change",()=>{
      if(disabled)return;
      if(multiple)onMethodToggle?.(input.value,input.checked);
      else if(input.checked)onMethodChange?.(input.value);
    });
    if(canEdit){
      // A sibling button, never nested in a label: editing must not toggle
      // the checkbox or change the staged mixed-party assignment.
      const tile=el("div");
      tile.style.cssText="position:relative;min-width:0;";
      const edit=el("button");
      edit.type="button";edit.disabled=Boolean(disabled);
      edit.title="Edit "+choice.label+" for this journey or its Map Marker";
      edit.setAttribute?.("aria-label","Edit "+choice.label+" transportation");
      edit.innerHTML='<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
      edit.style.cssText="position:absolute;right:.3rem;top:50%;transform:translateY(-50%);"+
        "min-width:2rem;min-height:2rem;";
      edit.addEventListener("click",()=>{
        if(!disabled)onEditMethod(choice.value);
      });
      tile.append(label,edit);
      group.appendChild(tile);
    }else group.appendChild(label);
  }
  if(showEditor){
    const edit=el("button","Edit selected method");
    edit.type="button";
    edit.title="Adjust this method's World preset fields for this trip";
    edit.disabled=Boolean(disabled);
    edit.style.cssText="justify-self:start;";
    edit.addEventListener("click",()=>onEdit?.());
    section.appendChild(edit);
  }
  return section;
}

/** Trip operation is an explicit GM decision, distinct from the transport's
 * World or Map Marker capability. Rendering and selecting never commits travel. */
export function renderNavigationOperatingSchedule({method,operation="normal",
  regularHours=8,disabled=false,onChange}){
  const label=el("label");
  label.style.cssText="display:grid;gap:.3rem;min-width:0;padding-top:.35rem;";
  const heading=el("strong","Operating schedule for this leg");
  heading.style.cssText="font-size:.87em;";
  const select=el("select");
  select.setAttribute?.("aria-label","Operating schedule for "+method.name);
  select.disabled=disabled;
  const modes=[["normal","Standard — "+regularHours+"h/day"]];
  if(method.overtimeEnabled)modes.push(["overtime",
    "Overtime — up to "+(8+(method.overtimeExtraHours??8))+"h/day"]);
  if(method.kind==="vehicle"&&method.continuousEnabled)
    modes.push(["continuous","Continuous — 24h/day (rotating crew)"]);
  for(const [value,text] of modes){
    const option=el("option",text);option.value=value;select.append(option);
  }
  select.value=operation;
  select.addEventListener("change",()=>{
    if(!disabled)onChange?.(select.value);
  });
  const help=el("small","Continuous operation requires a capable vehicle and an "+
    "explicit Journey selection. Enabling the method alone does not "+
    "authorize 24-hour travel or give passengers a rest.");
  help.style.cssText="font-size:.8em;opacity:.8;line-height:1.4;";
  label.append(heading,select,help);
  return label;
}
