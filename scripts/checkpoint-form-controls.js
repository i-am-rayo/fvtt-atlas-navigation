import { CHECKPOINT_REGION_RADIUS } from "./checkpoint-field-definitions.js";
import { createSettingsSelect } from "./settings-select.js";
import { createSettingsInput } from "./settings-input.js";
import { createSettingsNumberRange } from "./settings-number-range.js";

/** Presentation-only checkpoint controls. Persistence belongs to the editor. */
export function createCheckpointChoice(choices, selected, {label}={}) {
  return createSettingsSelect(choices,{selectedId:selected,ariaLabel:label});
}

export function createCheckpointNumber(value,{min,max,step="any",label,empty=false}={}) {
  return createSettingsInput("number",empty&&value==null?"":value,
    {min,max,step,ariaLabel:label});
}

/** Shared range/number pairing; invalid drafts cannot fall back to an old
 * slider value when the form is explicitly saved. */
export function createCheckpointRange(value,{min,max,step=1,label,
  numberWidth="5rem",numberStep=step,onInput=null,onInvalid=null}={}){
  const pair=createSettingsNumberRange(value,{min,max,step,numberStep,
    label:label??"Checkpoint setting",width:numberWidth,onInput,onInvalid});
  return pair;
}

export function createCheckpointRegionRadius(value,{label="Checkpoint Region radius in grid cells"}={}) {
  return createCheckpointNumber(value,{...CHECKPOINT_REGION_RADIUS,label});
}

/** Same geometry slider in generator and World preset editor. */
export function createCheckpointRegionWidth(value,{
  label="Region radius or width in grid cells",onChange,onInvalid}={}){
  const output=document.createElement("output");
  output.hidden=true;output.textContent=String(value)+" cells";
  const pair=createSettingsNumberRange(value,{...CHECKPOINT_REGION_RADIUS,
    label,width:"4.5rem",unit:"cells",
    onInput:amount=>{output.textContent=amount+" cells";onChange?.(amount);},
    onInvalid});
  pair.element.appendChild(output);
  return {...pair,input:pair.slider,output};
}

/** Optional elevation: an empty numeric input remains an unspecified elevation. */
export function createCheckpointElevation(value,{imperial=false}={}){
  const factor=imperial?3.280839895:1;
  const display=value==null?"":String(Math.round(value*factor*100)/100);
  const control=createCheckpointRange(display===""?0:display,{
    min:-1000,max:10000,step:10,numberStep:"any",
    label:imperial?"Checkpoint elevation in feet":"Checkpoint elevation in meters",
    numberWidth:"5.5rem"});
  control.number.step="any";
  control.number.value=display;
  return {...control,getMeters:()=>control.number.value.trim()===""?null:
    Number(control.number.value)/factor};
}

/** Marker size combines the authored integer slider with direct entry.
 * getValue() is required at Save; a stale valid slider cannot mask bad text. */
export function createCheckpointMarkerSize(value){
  const output=document.createElement("output");
  output.hidden=true;output.textContent=String(value)+" px";
  const pair=createSettingsNumberRange(value,{min:12,max:64,step:1,
    label:"Checkpoint marker size in pixels",width:"4.5rem",unit:"px",
    onInput:amount=>{output.textContent=amount+" px";}});
  pair.element.appendChild(output);
  return {...pair,input:pair.slider,output};
}

export function createCheckpointColor(value,{label}={}){
  const control=createSettingsInput("color",value,{ariaLabel:label});
  control.style.cssText="width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
  return control;
}

export function createCheckpointCheckbox(checked,{label}={}){
  return createSettingsInput("checkbox",checked,{ariaLabel:label});
}
