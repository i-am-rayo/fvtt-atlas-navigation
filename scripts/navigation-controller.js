import { readAtlas } from "./atlas-storage.js";
import { toAtlasPoint, toCanvasPoint } from "./road-coordinates.js";
import { calculateSceneRoadRoute } from "./navigation-foundry.js";
import { roadStrokeSpans, smoothRoadPath, readRoadCurvePreset,
  roadCurveNeighbors } from "./road-appearance.js";
import { drawNavigationLine, drawNavigationMarker } from "./navigation-graphics.js";
import { clipNavigationSpline } from "./navigation-curvature.js";
import { NAVIGATION_SPEED_SETTING, DEFAULT_NAVIGATION_SPEED,
  validateNavigationSpeed, navigationHours, formatNavigationDuration }
  from "./navigation-time.js";
import { buildNavigationSteps } from "./navigation-instructions.js";

const el = (tag, content) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
};

/** GM-only, transient A/B navigation; never creates a document or moves a token. */
export class AtlasNavigationController extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-navigation-panel",
    window: { title: "Atlas — Navigation", resizable: true },
    position: { width: 365, height: 340, left: 100, top: 170 }
  };

  constructor({ canvasProvider = () => globalThis.canvas } = {}) {
    super();
    this.canvasProvider = canvasProvider;
    this.scene = null;
    this.start = null;
    this.end = null;
    this.result = null;
    this.pointerTarget = null;
    this.overlay = null;
    this.pointerDown = this.onPointerDown.bind(this);
    this.closedByController = false;
    this.speedOverride = null;
  }

  get active() { return Boolean(this.scene); }

  activate() {
    const view = this.canvasProvider();
    if (!game.user?.isGM || !view?.ready || !view.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may navigate an active Atlas Scene.");
    }
    this.stop();
    this.scene = view.scene;
    this.bindPointer();
    void this.render(true);
    this.draw();
  }

  bindPointer() {
    const view = this.canvasProvider();
    const target = view?.app?.canvas ?? view?.app?.view;
    if (!target?.addEventListener || typeof view.canvasCoordinatesFromClient !== "function") {
      throw new Error("Foundry canvas map selection is unavailable.");
    }
    this.pointerTarget = target;
    target.addEventListener("pointerdown", this.pointerDown, true);
  }

  onPointerDown(event) {
    if (!this.scene || event.button !== 0 || event.shiftKey || event.altKey ||
        event.ctrlKey || event.metaKey) return;
    const view = this.canvasProvider();
    if (!game.user?.isGM || !view?.ready || view.scene?.id !== this.scene.id) {
      this.stop();
      return;
    }
    const canvasPoint = view.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
    if (!Number.isFinite(canvasPoint?.x) || !Number.isFinite(canvasPoint?.y)) return;
    const rect = view.dimensions?.sceneRect;
    if (rect?.contains && !rect.contains(canvasPoint.x, canvasPoint.y)) return;
    // Capture only clicks which navigation will handle.
    event.preventDefault();
    event.stopImmediatePropagation();
    const atlas = readAtlas(this.scene);
    const location = toAtlasPoint(view, atlas, canvasPoint);
    if (this.start === null || this.end !== null) {
      this.start = location;
      this.end = null;
      this.result = null;
    } else {
      this.end = location;
      try {
        this.result = calculateSceneRoadRoute(view, this.scene, atlas, this.start, this.end);
      } catch (error) {
        this.result = { status:"error", reason: error.message || String(error) };
        ui.notifications.error(this.result.reason);
      }
    }
    this.draw();
    void this.render(true);
  }

  draw() {
    const view = this.canvasProvider();
    if (!this.scene || view?.scene?.id !== this.scene.id || !view.ready ||
        !globalThis.PIXI?.Graphics || !view.primary?.addChild) return;
    if (!this.overlay || this.overlay.destroyed) {
      this.overlay = new PIXI.Graphics();
      this.overlay.label = "Atlas Navigation Route";
      this.overlay.eventMode = "none";
      const layers = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
      this.overlay.sortLayer = layers.TILES + 1;
      this.overlay.sort = 1e100;
      view.primary.addChild(this.overlay);
    }
    const graphics = this.overlay;
    graphics.clear();
    const atlas = readAtlas(this.scene);
    const canvasPoint = p => toCanvasPoint(view, atlas, p);
    const nodes=new Map(atlas.nodes.map(n=>[n.id,n]));
    const segments=new Map(atlas.segments.map(s=>[s.id,s]));
    const neighbors=roadCurveNeighbors(atlas);
    const curve=readRoadCurvePreset();
    for (const leg of this.result?.legs ?? []) {
      let points=leg.points.map(canvasPoint);
      if(leg.kind==="road"){
        const segment=segments.get(leg.segmentId);
        if(segment){
          const adjacent=neighbors.get(segment.id);
          const full=smoothRoadPath([nodes.get(segment.from),...segment.via,nodes.get(segment.to)]
            .map(canvasPoint),curve,{
              before:adjacent?.before?canvasPoint(adjacent.before):null,
              after:adjacent?.after?canvasPoint(adjacent.after):null
            });
          points=clipNavigationSpline(full,points[0],points.at(-1));
        }
      }
      const spans = leg.kind === "road" ? [points] : roadStrokeSpans(points, "dashed", 4);
      drawNavigationLine(graphics, spans, {
        color:0xffa51f, width:leg.kind==="road"?6:3.5, alpha:0.95
      });
    }
    for (const [point,color] of [[this.start,0x16b9a1],[this.end,0xf34c4c]]) {
      if (!point) continue;
      const p=canvasPoint(point);
      drawNavigationMarker(graphics, p, color);
    }
  }

  clear() {
    this.start = null;
    this.end = null;
    this.result = null;
    this.draw();
    if (this.active) void this.render(true);
  }

  stop() {
    this.pointerTarget?.removeEventListener?.("pointerdown",this.pointerDown,true);
    this.pointerTarget = null;
    this.overlay?.parent?.removeChild?.(this.overlay);
    this.overlay?.destroy?.();
    this.overlay = null;
    this.scene = null;
    this.start = null;
    this.end = null;
    this.result = null;
    this.speedOverride = null;
  }

  tearDown() {
    this.stop();
    if (this.rendered) {
      this.closedByController = true;
      void this.close();
    }
  }

  async _renderHTML() {
    const root=el("section");
    root.style.cssText="display:flex;flex-direction:column;gap:.6rem;padding:.65rem;overflow-y:auto;";
    const status=!this.start ? "Click the map to select Point A." :
      !this.end ? "Point A selected. Click the map to select Point B." :
      this.result?.status==="ok" ? "Route calculated." :
      (this.result?.reason ?? "No connected road route available.");
    root.appendChild(el("p",status));
    const sceneUnit=this.scene?.grid?.units?.trim() || "Scene units";
    const configured=Number(game.settings.get("fvtt-atlas-navigation",NAVIGATION_SPEED_SETTING)
      ?? DEFAULT_NAVIGATION_SPEED);
    let speed=this.speedOverride ?? configured;
    try{validateNavigationSpeed(speed);}catch{speed=DEFAULT_NAVIGATION_SPEED;}
    const fieldRow=el("label");
    fieldRow.style.cssText="display:flex;flex-direction:column;gap:.2rem;";
    fieldRow.appendChild(el("span",`Travel speed (${sceneUnit}/hour)`));
    const speedInput=el("input");speedInput.type="number";
    speedInput.min="0.1";speedInput.max="1000";speedInput.step="0.1";
    speedInput.value=String(speed);
    speedInput.title="Override the world default for this Navigation session only; tokens are not changed.";
    speedInput.addEventListener("change",()=>{
      try{
        const value=validateNavigationSpeed(Number(speedInput.value));
        this.speedOverride=value;
        void this.render(true);
      }catch(error){ui.notifications.warn(error.message);speedInput.value=String(speed);}
    });
    fieldRow.appendChild(speedInput);root.appendChild(fieldRow);
    if (this.result?.status === "ok") {
      const unit=this.scene?.grid?.units?.trim() || "units";
      root.appendChild(el("strong",`Total distance: ${this.result.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`));
      if (this.result.terrainAware) root.appendChild(el("strong",
        `Estimated terrain-weighted cost: ${this.result.cost.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}-equivalent`));
      if (this.result.terrainWarning) root.appendChild(el("p",this.result.terrainWarning));
      try{
        const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
        root.appendChild(el("strong",`Estimated travel time: ${formatNavigationDuration(navigationHours(weighted,speed))}`));
        if(!this.result.terrainAware)root.appendChild(el("p","Travel time is distance-only until native terrain costs are compatible."));
      }catch(error){root.appendChild(el("p",error.message));}
      const list=el("ol");
      const roads=new Map(readAtlas(this.scene).roads.map(r=>[r.id,r.name]));
      for (const step of buildNavigationSteps(this.result.legs,id=>roads.get(id)??"Road")) {
        list.appendChild(el("li",`${step.instruction} — ${step.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}` +
          (this.result.terrainAware ? ` · ${step.terrain}` : "")+
          ` · ${formatNavigationDuration(navigationHours(this.result.terrainAware?step.cost:step.distance,speed))}`));
      }
      root.appendChild(list);
    }
    const row=el("div");
    row.style.cssText="display:flex;gap:.5rem;";
    const clear=el("button", "New Route");
    clear.type="button";
    clear.addEventListener("click",()=>this.clear());
    row.appendChild(clear);
    const close=el("button","Exit Navigation");
    close.type="button";
    close.addEventListener("click",()=>void this.close());
    row.appendChild(close);
    root.appendChild(row);
    return root;
  }

  _replaceHTML(result,content) { content.replaceChildren(result); }

  _onClose(options) {
    super._onClose?.(options);
    this.stop();
    this.closedByController = false;
  }
}
