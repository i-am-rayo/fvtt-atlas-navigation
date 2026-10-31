import { readAtlas } from "./atlas-storage.js";
import { toAtlasPoint, toCanvasPoint } from "./road-coordinates.js";
import { calculateSceneRoadRoute } from "./navigation-foundry.js";
import { roadStrokeSpans, smoothRoadPath, readRoadCurvePreset,
  roadCurveNeighbors } from "./road-appearance.js";
import { drawNavigationLine, drawNavigationMarker } from "./navigation-graphics.js";
import { clipNavigationSpline } from "./navigation-curvature.js";
import { NAVIGATION_SPEED_SETTING, DEFAULT_NAVIGATION_SPEED,
  navigationHours, formatNavigationDuration }
  from "./navigation-time.js";
import { buildNavigationSteps } from "./navigation-instructions.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { resolveNavigationTravelSpeed } from "./navigation-party-speed.js";

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
    position: { width: 420, height: 320, left: 100, top: 170 }
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
    if (this.result?.status === "ok") {
      const viewport = globalThis.window;
      this.setPosition?.({
        width: Math.min(640, Math.max(380, (viewport?.innerWidth ?? 1000) - 64)),
        height: Math.min(790, Math.max(350, (viewport?.innerHeight ?? 900) - 90))
      });
    }
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
    root.style.cssText="display:flex;flex-direction:column;gap:.85rem;padding:1rem;overflow-y:auto;max-height:100%;";
    const status=!this.start ? "Click the map to select Point A." :
      !this.end ? "Point A selected. Click the map to select Point B." :
      this.result?.status==="ok" ? "Route calculated." :
      (this.result?.reason ?? "No connected road route available.");
    const statusLabel=el("p",status);
    statusLabel.style.cssText="margin:0;font-weight:600;";
    root.appendChild(statusLabel);
    const sceneUnit=this.scene?.grid?.units?.trim() || "Scene units";
    const configured=Number(game.settings.get("fvtt-atlas-navigation",NAVIGATION_SPEED_SETTING)
      ?? DEFAULT_NAVIGATION_SPEED);
    const assignment=this.scene ? readPartyExploration(this.scene) : null;
    const assignedToken=assignment?.enabled ? this.scene?.tokens?.get?.(assignment.tokenId) : null;
    let travel;
    try {
      travel=resolveNavigationTravelSpeed({ token:assignedToken,sceneUnits:sceneUnit,
        systemId:game.system?.id,worldSpeed:configured });
    } catch {
      travel=resolveNavigationTravelSpeed({ token:null,sceneUnits:sceneUnit,
        systemId:null,worldSpeed:DEFAULT_NAVIGATION_SPEED });
    }
    const speed=travel.speed;
    const travelSource=travel.source==="party" ?
      `${travel.actorName} · ${travel.pace} pace · ${speed.toLocaleString(undefined,{maximumFractionDigits:2})} ${sceneUnit}/hour` :
      `Atlas default · ${speed.toLocaleString(undefined,{maximumFractionDigits:2})} ${sceneUnit}/hour`;
    if (this.result?.status === "ok") {
      const unit=this.scene?.grid?.units?.trim() || "units";
      const summary=el("div");
      summary.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;";
      const metric=(label,value)=>{
        const card=el("div");card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:8px;padding:.75rem;min-width:0;";
        const small=el("div",label);small.style.cssText="font-size:.8em;opacity:.75;margin-bottom:.25rem;";
        const big=el("strong",value);big.style.cssText="font-size:1.15em;";
        card.append(small,big);summary.appendChild(card);
      };
      metric("Distance",`${this.result.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`);
      try{
        const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
        metric("Travel time",formatNavigationDuration(navigationHours(weighted,speed)));
      }catch(error){metric("Travel time","Unavailable");}
      root.appendChild(summary);
      const sourceLabel=el("p",`Speed: ${travelSource}`);
      sourceLabel.style.cssText="margin:0;font-size:.85em;opacity:.85;";
      root.appendChild(sourceLabel);
      if (this.result.terrainAware) {
        const cost=el("p",`Terrain-weighted distance: ${this.result.cost.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}-equivalent`);
        cost.style.cssText="margin:0;font-size:.85em;";root.appendChild(cost);
      }
      if (this.result.terrainWarning || !this.result.terrainAware) {
        const details=el("details");
        const summaryText=el("summary","Terrain calculation notes");
        details.append(summaryText,el("p",this.result.terrainWarning ||
          "Estimated times use distance only until native movement costs can be resolved safely."));
        root.appendChild(details);
      }
      const heading=el("h3","Directions");heading.style.cssText="margin:.2rem 0 0;";root.appendChild(heading);
      const list=el("div");list.style.cssText="display:flex;flex-direction:column;gap:.4rem;";
      const roads=new Map(readAtlas(this.scene).roads.map(r=>[r.id,r.name]));
      const steps=buildNavigationSteps(this.result.legs,id=>roads.get(id)??"Road");
      for (const [index,step] of steps.entries()) {
        const item=el("div");item.style.cssText="display:flex;align-items:flex-start;gap:.8rem;padding:.8rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:8px;";
        const marker=el("span",String(index+1));
        marker.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;background:var(--color-cool-4,#333);font-weight:bold;";
        const text=el("div");text.style.minWidth="0";
        const instruction=el("strong",step.instruction);instruction.style.display="block";
        const info=el("div",`${step.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit} · `+
          `${formatNavigationDuration(navigationHours(this.result.terrainAware?step.cost:step.distance,speed))}`+
          (step.terrain ? ` · ${step.terrain}` : ""));
        info.style.cssText="opacity:.75;font-size:.85em;margin-top:.3rem;";
        text.append(instruction,info);item.append(marker,text);list.appendChild(item);
      }
      root.appendChild(list);
    } else {
      const hint=el("p",`Travel estimates will use ${travelSource}.`);
      hint.style.cssText="margin:0;opacity:.8;font-size:.9em;";root.appendChild(hint);
    }
    const row=el("div");
    row.style.cssText="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.25rem;";
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
