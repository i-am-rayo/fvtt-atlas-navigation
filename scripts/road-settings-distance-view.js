/** Read-only Road Settings measurement. Scene flags and native Grid remain authoritative. */
import {toCanvasPoint} from "./road-coordinates.js";
import {measureAuthoredRoadDistance} from "./road-measured-distance.js";
import {createSettingsFieldRow} from "./settings-layout.js";

export function createRoadMeasuredDistanceRow({scene,roadId,atlasProvider,
  canvasProvider=()=>globalThis.canvas}){
  const output=document.createElement("output");
  output.className="atlas-road-measured-distance-value";
  output.setAttribute("aria-live","polite");
  const row=createSettingsFieldRow("Authored Road distance",output,
    {variant:"native-div"});
  const hint=document.createElement("small");
  hint.className="atlas-road-preset-hint";
  hint.textContent="Native Scene Grid length along the saved Road's points; "+
    "excludes visual curves and terrain costs. Read-only, not a Journey estimate.";
  const refresh=()=>{
    let display=null;
    const view=canvasProvider();
    if(view?.ready&&view.scene?.id===scene?.id&&
        typeof view.grid?.measurePath==="function"){
      try{
        const atlas=atlasProvider();
        const length=measureAuthoredRoadDistance({atlas,roadId},
          points=>view.grid.measurePath(points.map(p=>toCanvasPoint(view,atlas,p))));
        if(length!==null){
          const units=String(scene.grid?.units??"Scene units").trim()||"Scene units";
          display=length.toFixed(2)+" "+units;
        }
      }catch{/* Read-only measurement fails closed if native Grid or Scene changes. */}
    }
    output.textContent=display??"Unavailable — open this Scene on the canvas.";
    return display;
  };
  refresh();
  return {row,hint,output,refresh};
}
