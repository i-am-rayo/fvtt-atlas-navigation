/**
 * Disposable GM-only, noninteractive Territory outlines and optional labels.
 * Native RegionDocument polygons are the geometry source of truth. This preview
 * never changes native Shapes, Highlight Mode, selection, or Behaviors.
 */
import {projectTerritoryView, territoryTier} from "./territory-view-model.js";

const MAX_REGIONS = 80;
const MAX_VERTICES = 20000;
const MAX_LABELS = 45;

/** Native PIXI Polygon points use absolute canvas coordinates in Foundry v14. */
export function readNativeTerritoryPaths(region, {vertexBudget = MAX_VERTICES} = {}) {
  if (!Number.isSafeInteger(vertexBudget) || vertexBudget < 3) return null;
  let polygons;
  try { polygons = region?.polygons; } catch { return null; }
  if (!polygons || typeof polygons[Symbol.iterator] !== "function") return null;
  const result = [];
  let remaining = vertexBudget;
  for (const polygon of polygons) {
    const points = polygon?.points;
    if (!Array.isArray(points) && !ArrayBuffer.isView(points)) return null;
    if (points.length < 6 || points.length % 2 || points.length / 2 > remaining ||
        !Array.from(points).every(Number.isFinite)) return null;
    result.push(Array.from(points));
    remaining -= points.length / 2;
  }
  return result.length ? result : null;
}

function nativeColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ?
    Number.parseInt(value.slice(1), 16) : 0xf4bd69;
}

function outline(graphics, points, width, color, alpha) {
  if (typeof graphics.poly === "function" && typeof graphics.stroke === "function") {
    graphics.poly(points).stroke({width, color, alpha, join: "round"});
  } else if (typeof graphics.lineStyle === "function" &&
      typeof graphics.moveTo === "function" && typeof graphics.lineTo === "function") {
    graphics.lineStyle(width, color, alpha);
    graphics.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2)
      graphics.lineTo(points[i], points[i + 1]);
    graphics.lineTo(points[0], points[1]);
  } else throw Error("Atlas Territory preview requires supported Foundry Graphics.");
}

function location(region, paths) {
  // Label the largest native contour, rather than the overall bounds between
  // disconnected islands. There is only one label per Region/archipelago.
  let selected = null;
  for (const path of paths) {
    let twiceArea = 0, weightedX = 0, weightedY = 0;
    for (let i = 0; i < path.length; i += 2) {
      const j = (i + 2) % path.length;
      const cross = path[i]*path[j+1] - path[j]*path[i+1];
      twiceArea += cross;
      weightedX += (path[i]+path[j])*cross;
      weightedY += (path[i+1]+path[j+1])*cross;
    }
    if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < 1e-6) continue;
    const position = {x:weightedX/(3*twiceArea),y:weightedY/(3*twiceArea)};
    if (!selected || Math.abs(twiceArea) > selected.size)
      selected = {size:Math.abs(twiceArea),position};
  }
  if (selected && [selected.position.x,selected.position.y].every(Number.isFinite))
    return selected.position;
  const bounds = region?.bounds;
  if (bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
      bounds.width > 0 && bounds.height > 0)
    return {x:bounds.x+bounds.width/2, y:bounds.y+bounds.height/2};
  return null;
}

export class TerritoryViewOverlay {
  constructor() { this.layer = null; this.view = null; this.labels = []; }

  clear() {
    const layer = this.layer;
    this.layer = null;
    this.view = null;
    this.labels = [];
    if (!layer) return;
    layer.parent?.removeChild?.(layer);
    layer.destroy?.({children:true});
  }

  sync(scene, entries, {mode="combined", showNames=false} = {}) {
    this.clear();
    const view = globalThis.canvas;
    const pixi = globalThis.PIXI;
    if (!globalThis.game?.user?.isGM || !scene?.id || !view?.ready ||
        view.scene?.id !== scene.id || !view.interface?.addChild ||
        !pixi?.Graphics || !pixi?.Container) return {shown:0, skipped:0};

    const projected = projectTerritoryView(entries, mode, {drawOrder:true})
      .filter(entry=>territoryTier(entry)!=="unclassified");
    const layer = new pixi.Container();
    layer.eventMode = "none";
    const graphics = new pixi.Graphics();
    graphics.eventMode = "none";
    layer.addChild(graphics);
    let shown = 0, skipped = 0, vertices = 0;
    const labels = [];
    try {
      for (const entry of projected) {
        if (shown >= MAX_REGIONS) { skipped++; continue; }
        const region = scene.regions?.get?.(entry.id);
        const paths = readNativeTerritoryPaths(region,
          {vertexBudget:MAX_VERTICES-vertices});
        if (!paths) { skipped++; continue; }
        const count = paths.reduce((n,p)=>n+p.length/2,0);
        vertices += count;
        const broad = territoryTier(entry)==="continent";
        const color = nativeColor(region.color);
        for (const path of paths) {
          outline(graphics,path,broad?7:9,0x0e1524,broad?.55:.85);
          outline(graphics,path,broad?3:4,color,broad?.67:1);
        }
        shown++;
        if (showNames && labels.length < MAX_LABELS && pixi.Text) {
          const at = location(region,paths);
          if (at && [at.x,at.y].every(Number.isFinite)) {
            const label = new pixi.Text({text:String(entry.name??"Unnamed Region").slice(0,64),
              style:{fontFamily:"Signika, sans-serif",fontSize:broad?17:20,
                fontWeight:"bold",fill:broad?"#f4e0b4":"#ffffff",
                stroke:{color:"#121827",width:5}}});
            label.eventMode = "none";
            label.anchor?.set?.(.5,.5);
            label.position?.set?.(at.x,at.y);
            layer.addChild(label);
            labels.push(label);
          }
        }
      }
      view.interface.addChild(layer);
      this.layer = layer;
      this.view = view;
      this.labels = labels;
      this.updateLabelScale();
    } catch (error) {
      layer.parent?.removeChild?.(layer);
      layer.destroy?.({children:true});
      throw error;
    }
    return {shown, skipped};
  }

  updateLabelScale() {
    if (!this.layer || this.view !== globalThis.canvas) return;
    const zoom = Math.max(.2, Number(this.view.stage?.scale?.x) || 1);
    for (const label of this.labels) label.scale?.set?.(1/zoom);
  }
}
