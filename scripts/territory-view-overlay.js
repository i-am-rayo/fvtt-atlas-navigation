/**
 * Disposable GM-only, noninteractive Territory outlines and optional labels.
 * Native RegionDocument polygons are the geometry source of truth. This preview
 * never changes native Shapes, Highlight Mode, selection, or Behaviors.
 */
import {projectTerritoryView, territoryTier} from "./territory-view-model.js";
import {nativeRegionColorNumber} from "./native-region-color.js";
import {readTerritoryCheckpointLink} from "./territory-checkpoint-link.js";
import {territoryDisplayName} from "./territory-checkpoint-presentation.js";
import {readAtlasJournalLinks,journalUuidFor,openAtlasJournal} from "./atlas-journal-links.js";

const MAX_REGIONS = 80;
const MAX_VERTICES = 20000;
const MAX_LABELS = 45;
const MAX_FILL_TRIANGLES = 5000;

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

/** Uses native clipped triangulation, so grid islands and holes stay exact. */
export function readNativeTerritoryTriangles(region,{maxTriangles=MAX_FILL_TRIANGLES}={}) {
  let data;
  try { data=region?.triangulation; } catch { return null; }
  const indices=data?.indices,vertices=data?.vertices;
  if (!indices || !vertices || !Number.isSafeInteger(maxTriangles) || maxTriangles<1 ||
      indices.length<3 || indices.length%3 || indices.length/3>maxTriangles ||
      vertices.length<6 || vertices.length%2 ||
      !Array.from(vertices).every(Number.isFinite) ||
      !Array.from(indices).every(i=>Number.isSafeInteger(i)&&i>=0&&i*2+1<vertices.length))
    return null;
  const result=[];
  for(let j=0;j<indices.length;j+=3){
    const triangle=[];
    for(let k=j;k<j+3;k++)triangle.push(vertices[indices[k]*2],vertices[indices[k]*2+1]);
    result.push(triangle);
  }
  return result;
}

function fillTriangle(graphics,points,color,alpha) {
  if (typeof graphics.poly==="function" && typeof graphics.fill==="function")
    graphics.poly(points).fill({color,alpha});
  else if(typeof graphics.beginFill==="function" &&
      typeof graphics.drawPolygon==="function" && typeof graphics.endFill==="function") {
    graphics.beginFill(color,alpha);graphics.drawPolygon(points);graphics.endFill();
  }
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
  constructor() { this.layer = null; this.view = null; this.labels = [];
    this.labelCheckpointIds=new Set();this.hitLabels=[];
    this.journalCanvasElement=null;this.journalDoubleClickHandler=null; }

  clear() {
    this.journalCanvasElement?.removeEventListener?.("dblclick",this.journalDoubleClickHandler,true);
    this.journalCanvasElement=null;this.journalDoubleClickHandler=null;
    const layer = this.layer;
    this.layer = null;
    this.view = null;
    this.labels = [];
    this.labelCheckpointIds=new Set();this.hitLabels=[];
    if (!layer) return;
    layer.parent?.removeChild?.(layer);
    layer.destroy?.({children:true});
  }

  sync(scene, entries, {mode="combined", showNames=false,
    continentFillOpacity=0,settlementFillOpacity=0,checkpointsById=new Map()} = {}) {
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
    // A filled triangle's GraphicsContext must never share a stroke path with
    // the Region outline. Isolating the contexts prevents any fill path from
    // inheriting an outline style (the likely source of the reported fans).
    const fills = new pixi.Graphics();
    const borders = new pixi.Graphics();
    fills.eventMode = "none";
    borders.eventMode = "none";
    layer.addChild(fills);
    layer.addChild(borders);
    let shown = 0, skipped = 0, vertices = 0;
    let fillTriangles=0;
    const labels = [],hitLabels=[],labelCheckpointIds=new Set();
    try {
      for (const entry of projected) {
        if (shown >= MAX_REGIONS) { skipped++; continue; }
        const region = scene.regions?.get?.(entry.id);
        const paths = readNativeTerritoryPaths(region,
          {vertexBudget:MAX_VERTICES-vertices});
        if (!paths) { skipped++; continue; }
        const count = paths.reduce((n,p)=>n+p.length/2,0);
        const broad = territoryTier(entry)==="continent";
        const color = nativeRegionColorNumber(region.color);
        // No misleading amber substitute for an unavailable native color.
        // A missing/unsupported color is observable as a skipped Region.
        if (color === null) {
          console.warn("Atlas Territory preview skipped unavailable native Region color",{
            regionId:entry.id,colorType:typeof region.color});
          skipped++;continue;
        }
        vertices += count;
        const fillOpacity=broad?continentFillOpacity:settlementFillOpacity;
        if(Number.isFinite(fillOpacity) && fillOpacity>0 && fillOpacity<=.5){
          const triangles=readNativeTerritoryTriangles(region,
            {maxTriangles:MAX_FILL_TRIANGLES-fillTriangles});
          if(triangles){
            for(const triangle of triangles)fillTriangle(fills,triangle,color,fillOpacity);
            fillTriangles+=triangles.length;
          }
        }
        for (const path of paths) {
          outline(borders,path,broad?7:9,0x0e1524,broad?.55:.85);
          outline(borders,path,broad?3:4,color,broad?.67:1);
        }
        shown++;
        if (showNames && labels.length < MAX_LABELS && pixi.Text) {
          const at = location(region,paths);
          if (at && [at.x,at.y].every(Number.isFinite)) {
            let linkedCheckpoint=null;
            try{
              const link=readTerritoryCheckpointLink(region);
              linkedCheckpoint=link?checkpointsById.get(link.checkpointId)??null:null;
            }catch{/* Malformed association cannot publish a new label or Journal action. */}
            const labelName=String(territoryDisplayName(entry.name??"Unnamed Region",
              linkedCheckpoint)).slice(0,64);
            // Foundry v14's PIXI.Text expects (text, style). Passing a single
            // options object is rendered literally as "[object Object]".
            const label = new pixi.Text(labelName,
              {fontFamily:"Signika, sans-serif",fontSize:broad?17:20,
                fontWeight:"bold",fill:broad?"#f4e0b4":"#ffffff",
                stroke:"#121827",strokeThickness:5});
            label.eventMode = "none";
            label.anchor?.set?.(.5,.5);
            label.position?.set?.(at.x,at.y);
            layer.addChild(label);
            labels.push(label);
            if(linkedCheckpoint){
              labelCheckpointIds.add(linkedCheckpoint.id);
              hitLabels.push({at,checkpointId:linkedCheckpoint.id,regionId:region.id,
                name:labelName,fontSize:broad?17:20});
            }
          }
        }
      }
      view.interface.addChild(layer);
      this.layer = layer;
      this.view = view;
      this.labels = labels;
      this.hitLabels=hitLabels;
      this.labelCheckpointIds=labelCheckpointIds;
      this.updateLabelScale();
      this.#trackJournalDoubleClick(scene);
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

  #trackJournalDoubleClick(scene){
    const view=this.view;
    const element=view?.app?.canvas??view?.app?.view;
    if(!this.hitLabels.length||!element?.addEventListener)return;
    this.journalCanvasElement=element;
    this.journalDoubleClickHandler=event=>{
      if(event.button!==0||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||
          !globalThis.game?.user?.isGM||this.view!==globalThis.canvas||
          view.scene?.id!==scene.id)return;
      const point=view.canvasCoordinatesFromClient?.({x:event.clientX,y:event.clientY});
      if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;
      const zoom=Math.max(.2,Number(view.stage?.scale?.x)||1);
      // Only a double-click on the visible text opens its Checkpoint Journal.
      for(const hit of [...this.hitLabels].reverse()){
        const halfWidth=(Math.max(30,hit.name.length*hit.fontSize*.65)+16)/(2*zoom);
        const halfHeight=(hit.fontSize+12)/(2*zoom);
        if(Math.abs(point.x-hit.at.x)>halfWidth||Math.abs(point.y-hit.at.y)>halfHeight)
          continue;
        try{
          const current=scene.regions?.get?.(hit.regionId);
          if(readTerritoryCheckpointLink(current)?.checkpointId!==hit.checkpointId)continue;
          const uuid=journalUuidFor(readAtlasJournalLinks(scene),"checkpoint",hit.checkpointId);
          if(!uuid)continue;
          event.preventDefault?.();event.stopImmediatePropagation?.();
          void openAtlasJournal(uuid).catch(error=>
            globalThis.ui?.notifications?.warn?.(error.message??String(error)));
          return;
        }catch{/* Invalid or stale Journal association: leave native canvas alone. */}
      }
    };
    element.addEventListener("dblclick",this.journalDoubleClickHandler,true);
  }
}
