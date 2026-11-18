import { toCanvasPoint } from "./road-coordinates.js";

/**
 * Read-only camera projection shared by saved-road Locate and active road edit.
 * Atlas geometry is image-relative; only the returned canvas pan target has
 * Scene padding added. This never writes road data or changes edit sessions.
 */
export function roadFocusCamera(view,atlas,points,{zoomIntoRoad=false}={}) {
  if(!Array.isArray(points)||!points.length)throw Error("No road points to locate.");
  const projected=points.map(point=>toCanvasPoint(view,atlas,point));
  if(projected.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
    throw Error("Road coordinates are invalid.");
  const xs=projected.map(p=>p.x),ys=projected.map(p=>p.y);
  const width=Math.max(1,Math.max(...xs)-Math.min(...xs));
  const height=Math.max(1,Math.max(...ys)-Math.min(...ys));
  const viewport=view.app?.renderer?.screen??view.app?.screen;
  const currentZoom=Number.isFinite(view.stage?.scale?.x) && view.stage.scale.x>0
    ?view.stage.scale.x:1;
  const canFit=Number.isFinite(viewport?.width)&&Number.isFinite(viewport?.height);
  const fit=canFit?Math.max(.1,Math.min(
    Math.max(1,viewport.width-120)/width,
    Math.max(1,viewport.height-120)/height)):currentZoom;
  return {
    x:(Math.min(...xs)+Math.max(...xs))/2,
    y:(Math.min(...ys)+Math.max(...ys))/2,
    // Existing Locate never zooms in unexpectedly. Editing deliberately can,
    // but caps magnification so a tiny road does not fill the whole screen.
    scale:zoomIntoRoad?Math.min(2.2,fit):Math.min(currentZoom,fit)
  };
}
