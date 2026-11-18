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
 * Only one GM-approved planning method can be selected at a time.
 * Each choice retains its original owned/hire identifier, availability
 * checks and editor workflow; radio controls are a presentation replacement
 * for the previous optgroup select, not new transportation authority.
 */
export function renderNavigationTravelMethodButtons({choices,selectedValue,
  disabled=false,showEditor=false,onMethodChange,onEdit}){
  const section=el("fieldset");
  section.className="atlas-navigation-methods";
  section.style.cssText="display:grid;gap:.55rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:9px;padding:.7rem;margin:0;min-width:0;";
  const title=el("legend","Travel method");
  title.style.cssText="font-weight:700;padding:0 .35rem;";
  section.appendChild(title);
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
    label.style.cssText="display:flex;align-items:center;gap:.35rem;"+
      "padding:.4rem .5rem;border-radius:7px;min-width:0;cursor:pointer;"+
      "border:1px solid "+(choice.value===selectedValue?"#3eaf93":
        "var(--color-border-light-tertiary,#555)")+";"+
      (choice.value===selectedValue?"background:rgba(22,169,101,.12);":"");
    const input=el("input");
    input.type="radio";input.name="atlas-navigation-travel-method";
    input.id=id;input.value=choice.value;input.checked=choice.value===selectedValue;
    input.disabled=Boolean(disabled);
    input.style.cssText="margin:0;accent-color:#3eaf93;flex:0 0 auto;";
    const icon=el("i");
    const key=choice.value.split("|").at(-1)?.toLowerCase()??"";
    const labelText=String(choice.label??"").toLowerCase();
    const symbol=key==="walking"?"fa-person-walking":
      /caravan|wagon|coach|cart/.test(key+" "+labelText)?"fa-wagon-covered":
      /horse|pony|mount/.test(key+" "+labelText)?"fa-horse":
      /camel/.test(key+" "+labelText)?"fa-paw":
      /ship|boat|barge|warship/.test(key+" "+labelText)?"fa-ship":
      /fly|air/.test(key+" "+labelText)?"fa-dove":"fa-route";
    icon.className="fa-solid "+symbol;
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
      label.style.borderColor="#ad694e";
    }
    label.append(input,icon,content);
    input.addEventListener("change",()=>{
      if(!disabled&&input.checked)onMethodChange?.(input.value);
    });
    group.appendChild(label);
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
