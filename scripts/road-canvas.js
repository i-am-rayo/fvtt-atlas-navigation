import { readAtlas } from "./atlas-storage.js";
import { saveNewRoad } from "./road-storage.js";
import { RoadPointEditor } from "./road-point-editor.js";
import { roadHandles } from "./road-hit.js";
import { attachmentRoadNames, findRoadSnap, suggestRoadName } from "./road-model.js";
import { toAtlasPoint, toCanvasPoint } from "./road-coordinates.js";

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


/**
 * Confirmation is mandatory before linking graph topology. This never invokes
 * Merge: logical road names remain independent even at a shared junction.
 */
async function confirmRoadAttachment({ kind, sourceNames, targetNames }) {
  const content = document.createElement("div");
  const explanation = document.createElement("p");
  explanation.textContent = game.i18n.localize(kind === "new"
    ? "FVTTATLAS.Roads.ConnectNewWarning" : "FVTTATLAS.Roads.ConnectExistingWarning");
  content.appendChild(explanation);
  for (const [key, names] of [
    ["FVTTATLAS.Roads.ConnectionFrom", sourceNames],
    ["FVTTATLAS.Roads.ConnectionTo", targetNames]
  ]) {
    const paragraph = document.createElement("p");
    const prefix = document.createElement("strong");
    prefix.textContent = game.i18n.localize(key) + ": ";
    paragraph.appendChild(prefix);
    paragraph.appendChild(document.createTextNode(names.join(", ")));
    content.appendChild(paragraph);
  }
  return foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("FVTTATLAS.Roads.ConnectPromptTitle") },
    content, yes: { label: game.i18n.localize("FVTTATLAS.Roads.ConnectConfirm") },
    rejectClose: false, modal: true
  });
}

/** GM-only disposable Scene overlay; does not intercept ordinary player play. */
export class RoadCanvasController {
  constructor({
    canvasProvider = () => globalThis.canvas,
    doc = () => globalThis.document,
    idFactory = () => foundry.utils.randomID(),
    notify = () => globalThis.ui?.notifications,
    confirmAttach = confirmRoadAttachment
  } = {}) {
    this.canvasProvider = canvasProvider;
    this.doc = doc;
    this.idFactory = idFactory;
    this.notify = notify;
    this.confirmAttach = confirmAttach;
    this.graphics = null;
    this.graphicsCanvas = null;
    this.draft = null;
    this.selectedRoadId = null;
    this.saving = false;
    this.pointEditor = new RoadPointEditor({ canvasProvider, doc, notify,
      confirmAttach, idFactory, refresh: () => this.refresh() });
  }

  getDraft(scene) {
    const editing = this.pointEditor.getState(scene);
    if (editing) return editing;
    if (!scene || this.draft?.sceneId !== scene.id) return null;
    return {
      points: this.draft.points.length,
      saving: this.saving,
      mode: this.draft.mode
    };
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
    if (this.pointEditor.session) { this.pointEditor.cancel(); return; }
    if (!this.draft || this.saving) return;
    const changed = this.draft.onChange;
    this.#detach();
    this.draft = null;
    this.refresh();
    try { changed?.(); } catch (error) { console.warn("[fvtt-atlas-navigation] Atlas tab refresh failed", error); }
  }

  /**
   * Scene Configuration closing must release temporary highlights and input
   * capture. It does not edit any saved Scene data.
   */
  endEditor(scene) {
    if (this.draft && (!scene || this.draft.sceneId === scene.id)) this.cancel();
    if (this.pointEditor.session && (!scene || this.pointEditor.session.sceneId === scene.id)) this.pointEditor.cancel();
    this.selectedRoadId = null;
    this.refresh();
  }

  start(scene, onChange) {
    this.#startDrawing(scene, onChange);
  }

  startPointEdit(scene, roadId, onChange) {
    if (this.draft || this.saving) throw new Error("Finish or cancel drawing first.");
    this.pointEditor.start(scene, roadId, onChange);
    this.selectedRoadId = roadId;
    this.refresh();
  }

  undo() {
    this.pointEditor.undo();
  }

  #startDrawing(scene, onChange) {
    if (!globalThis.game?.user?.isGM ||
        !scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may draw Atlas roads.");
    }
    if (this.saving || this.draft || this.pointEditor.session) {
      throw new Error("Finish or cancel the current road before starting another.");
    }
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene.id) {
      throw new Error("View this Scene on the canvas before editing a road.");
    }
    const element = canvas.app?.canvas ?? canvas.app?.view;
    if (!element?.addEventListener || typeof canvas.canvasCoordinatesFromClient !== "function") {
      throw new Error("The Foundry canvas is not ready to accept road points.");
    }
    const atlas = readAtlas(scene);
    if (atlas.schemaVersion !== 3 && (atlas.nodes.length || atlas.segments.length)) {
      throw new Error(atlas.schemaVersion === 1 ?
        "Anchor legacy roads to the map image first; see the Atlas tab." :
        "Organize existing roads before drawing. See the Atlas tab.");
    }

    const draft = {
      scene, sceneId: scene.id, expectedRevision: atlas.revision,
      mode: "new", confirming: false,
      points: [], snap: [], element, onChange,
      onPointer: null, onKeydown: null
    };
    draft.onPointer = event => {
      if (event.button !== 0 || this.saving || draft.confirming) return;
      if (this.canvasProvider()?.scene?.id !== draft.sceneId) {
        this.cancel();
        return;
      }
      const position = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
      if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
      const sceneRect = canvas.dimensions?.sceneRect;
      if (typeof sceneRect?.contains === "function" &&
          !sceneRect.contains(position.x, position.y)) return;
      const storedAtlas = readAtlas(scene);
      const activeAtlas = storedAtlas.schemaVersion === 3 ? storedAtlas :
        { ...storedAtlas, schemaVersion: 3, coordinateSpace: "image", roads: [] };
      let point = toAtlasPoint(canvas, activeAtlas, position);
      // Endpoint snaps are visible in the preview. Hold Alt on first/last
      // click to leave roads disconnected when they intentionally cross.
      const allowSnap = !event.altKey;
      if (allowSnap && draft.points.length === 0) {
        const candidate = findRoadSnap(activeAtlas, point);
        if (candidate) point = { x: candidate.x, y: candidate.y };
      }
      point = { x: Math.round(point.x * 100) / 100, y: Math.round(point.y * 100) / 100 };
      const last = draft.points.at(-1);
      if (last && Math.hypot(last.x - point.x, last.y - point.y) < 1) return;
      const max = 1002;
      if (draft.points.length >= max) {
        this.notify()?.warn?.("This road has reached its point limit.");
        return;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      draft.points.push(point);
      draft.snap.push(allowSnap);
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
        draft.snap.pop();
        this.refresh();
        this.#changed();
      }
    };
    this.draft = draft;
    this.selectedRoadId = null;
    element.addEventListener("pointerdown", draft.onPointer, true);
    this.doc()?.addEventListener?.("keydown", draft.onKeydown, true);
    this.refresh();
    this.#changed();
  }

  async finish() {
    if (this.pointEditor.session) {
      const saved = await this.pointEditor.finish();
      if (saved) { this.selectedRoadId = null; this.refresh(); }
      return saved;
    }
    const draft = this.draft;
    if (!draft || this.saving || draft.confirming) return false;
    if (draft.points.length < 2) {
      this.notify()?.warn?.("Click at least two map points before finishing the road.");
      return false;
    }
    try {
      const atlas = readAtlas(draft.scene);
      // Only endpoints ever snap; crossings and bends stay independent.
      const connections = [];
      if (atlas.schemaVersion === 3) {
        for (const index of [0, draft.points.length - 1]) {
          if (draft.snap[index] === false) continue;
          const candidate = findRoadSnap(atlas, draft.points[index]);
          if (candidate) connections.push(...attachmentRoadNames(atlas, candidate));
        }
      }
      if (connections.length) {
        draft.confirming = true;
        this.#changed();
        const accepted = await this.confirmAttach({
          kind: "new", sourceNames: [suggestRoadName(atlas)],
          targetNames: [...new Set(connections)]
        });
        if (this.draft !== draft) return false;
        draft.confirming = false;
        if (!accepted) {
          this.notify()?.info?.(game.i18n.localize("FVTTATLAS.Roads.ConnectDeclined"));
          this.#changed();
          return false;
        }
      }
      if (this.draft !== draft) return false;
      this.saving = true;
      this.#changed();
      await saveNewRoad(draft.scene, {
        points: draft.points, name: suggestRoadName(atlas),
        expectedRevision: draft.expectedRevision,
        snapEndpoints: [draft.snap[0], draft.snap.at(-1)],
        idFactory: this.idFactory
      });
      const changed = draft.onChange;
      this.#detach();
      this.draft = null;
      this.selectedRoadId = null;
      this.saving = false;
      this.refresh();
      this.notify()?.info?.("Atlas road saved to this Scene.");
      try { changed?.(); } catch (error) { console.warn("[fvtt-atlas-navigation] Atlas tab refresh failed", error); }
      return true;
    } catch (error) {
      draft.confirming = false;
      this.notify()?.error?.(error.message);
      this.saving = false;
      this.#changed();
      return false;
    }
  }

  selectRoad(scene, roadId) {
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene?.id) {
      throw new Error("View this Scene on the canvas to highlight its roads.");
    }
    this.selectedRoadId = this.selectedRoadId === roadId ? null : roadId;
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
    const editing = this.pointEditor.session;
    if (editing && editing.sceneId === canvas.scene.id) {
      atlas = editing.drag?.preview ?? editing.working;
    }
    const nodes = new Map(atlas.nodes.map(n => [n.id, n]));
    for (const segment of atlas.segments) {
      const from = nodes.get(segment.from);
      const to = nodes.get(segment.to);
      if (!from || !to) continue;
      const path = [from, ...segment.via, to].map(p => toCanvasPoint(canvas, atlas, p));
      const highlighted = this.selectedRoadId === (atlas.schemaVersion === 3 ? segment.roadId : segment.id);
      const color = highlighted ? 0xffd166 : 0x35c9ef;
      drawLine(g, path, color, highlighted ? 6 : 4);
      drawDot(g, path[0], color);
      drawDot(g, path.at(-1), color);
    }
    if (this.draft?.sceneId === canvas.scene.id) {
      const draft = this.draft;
      const visualAtlas = atlas.schemaVersion === 3 ? atlas :
        { ...atlas, schemaVersion: 3, coordinateSpace: "image", roads: [] };
      let points = draft.points;
      if (draft.mode === "new" && points.length > 1 && draft.snap.at(-1)) {
        const hit = findRoadSnap(visualAtlas, points.at(-1));
        if (hit) points = [...points.slice(0, -1), { x: hit.x, y: hit.y }];
      }
      const canvasPoints = points.map(p => toCanvasPoint(canvas, visualAtlas, p));
      drawLine(g, canvasPoints, 0xffd166, 4, 0.85);
      for (const point of canvasPoints) drawDot(g, point, 0xffd166);
    }
    if (editing && editing.sceneId === canvas.scene.id) {
      for (const handle of roadHandles(atlas, editing.roadId)) {
        drawDot(g, toCanvasPoint(canvas, atlas, handle), handle.kind === "node" ? 0xf4b65a : 0xffffff);
      }
    }
  }

  tearDown() {
    if (this.draft && !this.saving) this.cancel();
    if (this.pointEditor.session && !this.pointEditor.saving) this.pointEditor.cancel();
    if (this.graphics && !this.graphics.destroyed) {
      this.graphics.parent?.removeChild?.(this.graphics);
      this.graphics.destroy?.();
    }
    this.graphics = null;
    this.graphicsCanvas = null;
    this.selectedRoadId = null;
  }
}
