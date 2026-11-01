import { CHECKPOINT_REGION_RADIUS } from "./checkpoint-field-definitions.js";

/** Presentation-only checkpoint controls. Persistence belongs to the editor. */
export function createCheckpointChoice(choices, selected, {label}={}) {
  const control=document.createElement("select");
  if(label)control.setAttribute("aria-label",label);
  for(const [id,title] of choices){
    const option=document.createElement("option");
    option.value=id;option.textContent=title;control.appendChild(option);
  }
  control.value=selected;
  return control;
}

export function createCheckpointNumber(value,{min,max,step="any",label,empty=false}={}) {
  const control=document.createElement("input");
  control.type="number";
  control.value=empty&&value==null?"":String(value??"");
  if(min!==undefined)control.min=String(min);
  if(max!==undefined)control.max=String(max);
  control.step=String(step);
  if(label)control.setAttribute("aria-label",label);
  return control;
}

/** Linked range/number fields are kept in sync without touching persisted data. */
export function createCheckpointRange(value,{min,max,step=1,label,numberWidth="5rem"}) {
  const container=document.createElement("div");
  container.style.cssText="display:flex;align-items:center;gap:.35rem;";
  const slider=document.createElement("input");
  slider.type="range";slider.min=String(min);slider.max=String(max);
  slider.step=String(step);slider.value=String(value);
  if(label)slider.setAttribute("aria-label",label+" slider");
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
  const slider=document.createElement("input");
  slider.type="range";
  slider.min=String(CHECKPOINT_REGION_RADIUS.min);
  slider.max=String(CHECKPOINT_REGION_RADIUS.max);
  slider.step=String(CHECKPOINT_REGION_RADIUS.step);
  slider.value=String(value);
  slider.style.cssText="flex:1;min-width:8rem;";
  slider.setAttribute("aria-label",label);
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
  const slider=document.createElement("input");
  slider.type="range";slider.min="12";slider.max="64";slider.step="1";
  slider.value=String(value);slider.style.width="11rem";
  slider.setAttribute("aria-label","Checkpoint marker size in pixels");
  const output=document.createElement("output");
  output.textContent=slider.value+" px";
  slider.addEventListener("input",()=>{output.textContent=slider.value+" px";});
  element.append(slider,output);
  return {element,input:slider,output};
}

export function createCheckpointColor(value,{label}={}){
  const control=document.createElement("input");
  control.type="color";control.value=value;
  control.style.cssText="width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
  if(label)control.setAttribute("aria-label",label);
  return control;
}

export function createCheckpointCheckbox(checked,{label}={}){
  const control=document.createElement("input");
  control.type="checkbox";control.checked=Boolean(checked);
  if(label)control.setAttribute("aria-label",label);
  return control;
}
