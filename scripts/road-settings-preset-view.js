/** Road Settings only: read-only World catalog display plus draft selector.
 * The existing Road Settings save/stage path remains the sole Scene writer. */
import {createTravelPresetSelect} from "./settings-controls.js";
import {createSettingsFieldRow} from "./settings-layout.js";
import {readWorldTravelPresets} from "./travel-preset-settings.js";

export function createRoadTravelPresetRow(initialId){
  const presets=readWorldTravelPresets().presets;
  const select=createTravelPresetSelect({selectedId:initialId,
    name:"atlasRoadPresetId",noneLabel:"None (Land fallback)"});
  // A native form-group div avoids nesting an icon button inside a label.
  select.setAttribute("aria-label","Select Road travel preset");
  const controls=document.createElement("div");
  controls.className="atlas-road-preset-controls";
  const current=document.createElement("span");
  current.className="atlas-road-preset-name";
  current.setAttribute("aria-live","polite");
  const change=document.createElement("button");
  change.type="button";
  change.textContent="Change preset…";
  change.title="Change travel preset";
  const missing=Boolean(initialId&&!presets.some(p=>p.id===initialId));
  const update=()=>{
    const preset=presets.find(p=>p.id===select.value);
    current.textContent=preset?.name??(select.value?"Unavailable travel preset":
      "None (Land fallback)");
    current.hidden=!select.value;
    select.hidden=!!preset;
    change.hidden=!preset;
  };
  update();
  if(missing){
    current.textContent="Unavailable travel preset — choose another";
    current.hidden=false;
    select.hidden=false;
    change.hidden=true;
  }
  change.addEventListener("click",()=>{
    current.hidden=true;
    select.hidden=false;
    change.hidden=true;
    select.focus();
  });
  select.addEventListener("change",()=>{
    update();
    if(select.hidden)change.focus();
  });
  controls.append(current,select,change);
  const row=createSettingsFieldRow("Travel preset",controls,{variant:"native-div"});
  row.className+=" atlas-road-preset-row";
  const hint=document.createElement("small");
  hint.className="atlas-road-preset-hint";
  hint.textContent="Applies to this Road when saved. World presets and native Region Behaviors are unchanged.";
  return {row,hint,select};
}
