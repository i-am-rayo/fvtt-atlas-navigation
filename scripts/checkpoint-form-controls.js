import { CHECKPOINT_REGION_RADIUS } from "./checkpoint-field-definitions.js";
import { createSettingsSelect } from "./settings-select.js";
import { createSettingsInput } from "./settings-input.js";

/** Presentation-only checkpoint controls. Persistence belongs to the editor. */
export function createCheckpointChoice(choices, selected, {label}={}) {
  return createSettingsSelect(choices,{selectedId:selected,ariaLabel:label});
}

export function createCheckpointNumber(value,{min,max,step="any",label,empty=false}={}) {
  return createSettingsInput("number",empty&&value==null?"":value,
    {min,max,step,ariaLabel:label});
}

/** Linked range/number fields are kept in sync without touching persisted data. */
export function createCheckpointRange(value,{min,max,step=1,label,numberWidth="5rem"}) {
  const container=document.createElement("div");
  container.style.cssText="display:flex;align-items:center;gap:.35rem;";
  const slider=createSettingsInput("range",value,{min,max,step,
    ariaLabel:label?label+" slider":null});
  const number=createCheckpointNumber(value,{min,max,step,label});
  number.style.width=numberWidth;
  slider.addEventListener("input",()=>{number.value=slider.value;});
  number.addEventListener("input",()=>{if(number.value!=="")slider.value=number.value;});
  container.append(slider,number);
  return {element:container,slider,number};
}

export function createCheckpointRegionRadius(value,{label="Checkpoint Region radius in grid cells"}={}) {
  return createCheckpointNumber(value,{...CHECKPOINT_REGION_RADIUS,label});
}

/** Same geometry slider in both the generator and preset template editor. */
export function createCheckpointRegionWidth(value,{label="Region radius or width in grid cells",onChange}={}){
  const element=document.createElement("div");
  element.style.cssText="display:flex;align-items:center;gap:.75rem;width:100%;";
  const slider=createSettingsInput("range",value,{...CHECKPOINT_REGION_RADIUS,
    ariaLabel:label});
  slider.style.cssText="flex:1;min-width:8rem;";
  const output=document.createElement("output");
  output.textContent=slider.value+" cells";
  output.style.cssText="min-width:4.3rem;text-align:right;";
  slider.addEventListener("input",()=>{
    output.textContent=slider.value+" cells";
    onChange?.(Number(slider.value));
  });
  element.append(slider,output);
  return {element,input:slider,output};
}

/** Optional elevation: an empty numeric input remains an unspecified elevation. */
export function createCheckpointElevation(value,{imperial=false}={}){
  const factor=imperial?3.280839895:1;
  const display=value==null?"":String(Math.round(value*factor*100)/100);
  const control=createCheckpointRange(display===""?0:display,{
    min:-1000,max:10000,step:10,
    label:imperial?"Checkpoint elevation in feet":"Checkpoint elevation in meters",
    numberWidth:"5.5rem"});
  control.number.step="any";
  control.number.value=display;
  return {...control,getMeters:()=>control.number.value.trim()===""?null:
    Number(control.number.value)/factor};
}

/** Marker size is always a slider with a live pixel readout in every editor. */
export function createCheckpointMarkerSize(value){
  const element=document.createElement("div");
  element.style.cssText="display:flex;align-items:center;gap:.6rem;flex:1;";
  const slider=createSettingsInput("range",value,{min:12,max:64,step:1,
    ariaLabel:"Checkpoint marker size in pixels"});
  slider.style.width="11rem";
  const output=document.createElement("output");
  output.textContent=slider.value+" px";
  slider.addEventListener("input",()=>{output.textContent=slider.value+" px";});
  element.append(slider,output);
  return {element,input:slider,output};
}

export function createCheckpointColor(value,{label}={}){
  const control=createSettingsInput("color",value,{ariaLabel:label});
  control.style.cssText="width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
  return control;
}

export function createCheckpointCheckbox(checked,{label}={}){
  return createSettingsInput("checkbox",checked,{ariaLabel:label});
}
