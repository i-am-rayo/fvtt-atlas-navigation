/** Shared World catalog in the native Terrain Region generator. */
import { createTravelPresetSelect } from "./settings-controls.js";

/**
 * Only updates the generator's in-memory draft. Native movement-cost previews
 * need explicit re-confirmation after a different surface is chosen.
 */
export function createTerrainRegionTravelPresetControl(selected,{noneLabel,onChange}={}){
  const picker=createTravelPresetSelect({selectedId:selected.presetId,
    name:"",noneLabel});
  picker.addEventListener("change",()=>{
    selected.presetId=picker.value||null;
    selected.presetEdited=true;
    selected.applyNativeCost=false;
    selected.movementAction="";
    onChange?.();
  });
  return picker;
}
