import { readAtlas } from "./atlas-storage.js";
import { saveNewRoad } from "./road-storage.js";
import { suggestRoadName } from "./road-model.js";

function drawLine(graphics, points, color, width = 4, alpha = 0.9) {
  if (points.length < 2) return;
  if (typeof graphics.moveTo === "function" && typeof graphics.stroke === "function") {
    graphics.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.stroke({ color, width, alpha });
  } else if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(width, color, alpha);
    graphics.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  }
}

function drawDot(graphics, point, color) {
  if (typeof graphics.circle === "function" && typeof graphics.fill === "function") {
    graphics.circle(point.x, point.y, 5).fill({ color, alpha: 0.95 });
  } else if (typeof graphics.drawCircle === "function") {
    graphics.beginFill?.(color, 0.95);
    graphics.drawCircle(point.x, point.y, 5);
    graphics.endFill?.();
  }
}

/** GM-only, disposable Scene overlay and click-to-place authoring session. */
export class RoadCanvasController {
  constructor({
    canvasProvider = () => globalThis.canvas,
    doc = () => globalThis.document,
    idFactory = () => foundry.utils.randomID(),
    notify = () => globalThis.ui?.notifications
  } = {}) {
    this.canvasProvider = canvasProvider;
    this.doc = doc;
    this.idFactory = idFactory;
    this.notify = notify;
    this.graphics = null;
    this.graphicsCanvas = null;
    this.draft = null;
    this.selectedRoadId = null;
    this.saving = false;
  }

  getDraft(scene) {
    if (!scene || this.draft?.sceneId !== scene.id) return null;
    return { points: this.draft.points.length, saving: this.saving };
  }

  #changed() {
    try { this.draft?.onChange?.(); }
    catch (error) { console.warn("[fvtt-atlas-navigation] Atlas tab refresh failed", error); }
  }

  #detach() {
    const draft = this.draft;
    if (!draft) return;
    draft.element.removeEventListener("pointerdown", draft.onPointer, true);
    this.doc()?.removeEventListener?.("keydown", draft.onKeydown, true);
  }

  cancel() {
    if (!this.draft || this.saving) return;
    const changed = this.draft.onChange;
    this.#detach();
    this.draft = null;
    this.refresh();
    try { changed?.(); } catch (error) { console.warn("[fvtt-atlas-navigation] Atlas tab refresh failed", error); }
  }

  start(scene, onChange) {
    if (!globalThis.game?.user?.isGM ||
        !scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may draw Atlas roads.");
    }
    if (this.saving || this.draft) {
      throw new Error("Finish or cancel the current road before starting another.");
    }
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene.id) {
      throw new Error("View this Scene on the canvas before adding a road.");
    }
    const element = canvas.app?.canvas ?? canvas.app?.view;
    if (!element?.addEventListener || typeof canvas.canvasCoordinatesFromClient !== "function") {
      throw new Error("The Foundry canvas is not ready to accept road points.");
    }
    const atlas = readAtlas(scene);
    const draft = {
      scene, sceneId: scene.id, expectedRevision: atlas.revision,
      points: [], element, onChange,
      onPointer: null, onKeydown: null
    };
    draft.onPointer = event => {
      if (event.button !== 0 || this.saving) return;
      if (this.canvasProvider()?.scene?.id !== draft.sceneId) {
        this.cancel();
        return;
      }
      const position = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
      if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
      // Avoid authoring road points in the padded canvas area outside the Scene.
      const sceneRect = canvas.dimensions?.sceneRect;
      if (typeof sceneRect?.contains === "function" && !sceneRect.contains(position.x, position.y)) return;
      const point = { x: Math.round(position.x * 100) / 100, y: Math.round(position.y * 100) / 100 };
      const last = draft.points.at(-1);
      if (last && Math.hypot(last.x - point.x, last.y - point.y) < 1) return;
      if (draft.points.length >= 1002) {
        this.notify()?.warn?.("This road has reached the 1002-point limit.");
        return;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      draft.points.push(point);
      this.refresh();
      this.#changed();
    };
    draft.onKeydown = event => {
      if (event.key === "Escape") {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        this.cancel();
      } else if (event.key === "Enter" && !event.target?.isContentEditable &&
          !event.target?.closest?.("form, [role=dialog]") &&
          !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target?.tagName)) {
        event.preventDefault?.();
        void this.finish();
      } else if (event.key === "Backspace" && !event.target?.isContentEditable &&
          !["INPUT", "TEXTAREA"].includes(event.target?.tagName)) {
        event.preventDefault?.();
        draft.points.pop();
        this.refresh();
        this.#changed();
      }
    };
    this.draft = draft;
    element.addEventListener("pointerdown", draft.onPointer, true);
    this.doc()?.addEventListener?.("keydown", draft.onKeydown, true);
    this.refresh();
    this.#changed();
  }

  async finish() {
    const draft = this.draft;
    if (!draft || this.saving) return false;
    if (draft.points.length < 2) {
      this.notify()?.warn?.("Click at least two map points before finishing the road.");
      return false;
    }
    this.saving = true;
    this.#changed();
    try {
      const atlas = readAtlas(draft.scene);
      // Optimistic revision is checked by saveNewRoad; no silent concurrent edits.
      await saveNewRoad(draft.scene, {
        points: draft.points, name: suggestRoadName(atlas),
        expectedRevision: draft.expectedRevision,
        idFactory: this.idFactory
      });
      const changed = draft.onChange;
      this.#detach();
      this.draft = null;
      this.saving = false;
      this.refresh();
      this.notify()?.info?.("Atlas road saved to this Scene.");
      try { changed?.(); } catch (error) { console.warn("[fvtt-atlas-navigation] Atlas tab refresh failed", error); }
      return true;
    } catch (error) {
      this.notify()?.error?.(error.message);
      this.saving = false;
      this.#changed();
      return false;
    }
  }

  selectRoad(scene, segmentId) {
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene?.id) {
      throw new Error("View this Scene on the canvas to highlight its roads.");
    }
    this.selectedRoadId = this.selectedRoadId === segmentId ? null : segmentId;
    this.refresh();
  }

  refresh() {
    const canvas = this.canvasProvider();
    if (!canvas?.ready || !canvas.scene || !globalThis.game?.user?.isGM) return;
    if (!this.graphics || this.graphicsCanvas !== canvas || this.graphics.destroyed) {
      if (!globalThis.PIXI?.Graphics || !canvas.interface?.addChild) return;
      this.graphics = new PIXI.Graphics();
      this.graphics.eventMode = "none";
      canvas.interface.addChild(this.graphics);
      this.graphicsCanvas = canvas;
    }
    const g = this.graphics;
    g.clear();
    let atlas;
    try { atlas = readAtlas(canvas.scene); }
    catch (error) {
      console.warn("[fvtt-atlas-navigation] Unable to draw Scene roads", error);
      return;
    }
    const nodes = new Map(atlas.nodes.map(n => [n.id, n]));
    for (const segment of atlas.segments) {
      const from = nodes.get(segment.from);
      const to = nodes.get(segment.to);
      if (!from || !to) continue;
      const path = [from, ...segment.via, to];
      const color = this.selectedRoadId === segment.id ? 0xffd166 : 0x35c9ef;
      drawLine(g, path, color, this.selectedRoadId === segment.id ? 6 : 4);
      drawDot(g, from, color);
      drawDot(g, to, color);
    }
    if (this.draft?.sceneId === canvas.scene.id) {
      drawLine(g, this.draft.points, 0xffd166, 4, 0.8);
      for (const point of this.draft.points) drawDot(g, point, 0xffd166);
    }
  }

  tearDown() {
    if (this.draft && !this.saving) this.cancel();
    if (this.graphics && !this.graphics.destroyed) {
      this.graphics.parent?.removeChild?.(this.graphics);
      this.graphics.destroy?.();
    }
    this.graphics = null;
    this.graphicsCanvas = null;
    this.selectedRoadId = null;
  }
}
