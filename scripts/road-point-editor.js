import { readAtlas } from "./atlas-storage.js";
import { savePointEdits } from "./road-storage.js";
import { applyRoadGeometryEdit, attachmentRoadNames, findJunctionAttachment } from "./road-model.js";
import { nearestRoadEdge, nearestRoadHandle, roadHandles } from "./road-hit.js";
import { toAtlasPoint } from "./road-coordinates.js";

/**
 * Draggable, reversible GM-only Atlas vertex editor. Geometry changes stay
 * temporary until the GM presses Save Points; Esc/Cancel restores the Scene.
 */
export class RoadPointEditor {
  constructor({ canvasProvider, doc, notify, refresh, confirmAttach, confirmDetach, idFactory }) {
    this.canvasProvider = canvasProvider;
    this.doc = doc;
    this.notify = notify;
    this.refresh = refresh;
    this.confirmAttach = confirmAttach;
    this.confirmDetach = confirmDetach;
    this.idFactory = idFactory;
    this.session = null;
    this.saving = false;
  }

  getState(scene) {
    const s = this.session;
    if (!s || !scene || scene.id !== s.sceneId) return null;
    return {
      mode: "points",
      source: s.source,
      points: roadHandles(s.working, s.roadId).length,
      dirty: s.operations.length > 0,
      canUndo: s.operations.length > 0,
      saving: this.saving
    };
  }

  #notifyChange(callback) {
    this.refresh();
    try { callback?.(); }
    catch (error) { console.warn("[fvtt-atlas-navigation] Atlas point editor refresh failed", error); }
  }

  #localPoint(event) {
    const canvas = this.canvasProvider();
    if (!canvas?.ready) return null;
    const position = canvas.canvasCoordinatesFromClient?.({ x: event.clientX, y: event.clientY });
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return null;
    const rect = canvas.dimensions?.sceneRect;
    if (typeof rect?.contains === "function" && !rect.contains(position.x, position.y)) return null;
    return toAtlasPoint(canvas, this.session.working, position);
  }

  #tolerance() {
    const scale = this.canvasProvider()?.stage?.scale?.x;
    return 12 / (Number.isFinite(scale) && scale > 0 ? scale : 1);
  }

  #consume(event) {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }

  #operation(handle, point) {
    if (handle.kind === "node") {
      return { kind: "move-node", nodeId: handle.nodeId, x: point.x, y: point.y };
    }
    return {
      kind: "move-bend", segmentId: handle.segmentId, viaIndex: handle.viaIndex,
      x: point.x, y: point.y
    };
  }

  #perform(operation) {
    const s = this.session;
    const working = applyRoadGeometryEdit(s.working, { roadId: s.roadId, operation });
    s.operations.push(operation);
    s.history.push(working);
    s.working = working;
    this.#notifyChange(s.onChange);
  }

  /**
   * Stage an explicit split as a new gold junction. Nothing is saved until
   * Save Points; the existing road ID/name and the first segment ID remain.
   */
  insertJunction(candidate) {
    const s = this.session;
    if (!s || this.saving || s.confirming || candidate?.kind !== "edge") {
      throw new Error("Start editing a road before adding a junction.");
    }
    const nodeId = this.idFactory();
    this.#perform({
      kind: "create-junction", segmentId: candidate.segmentId,
      edgeIndex: candidate.edgeIndex, atVertex: candidate.atVertex === true,
      x: candidate.x, y: candidate.y, newNodeId: nodeId,
      newSegmentId: this.idFactory()
    });
    s.selectedHandle = { kind: "node", nodeId, x: candidate.x, y: candidate.y };
    return nodeId;
  }

  start(scene, roadId, onChange, { source = "road" } = {}) {
    if (!globalThis.game?.user?.isGM ||
        !scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may edit Atlas road points.");
    }
    if (this.session || this.saving) throw new Error("Finish or cancel the point editor first.");
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene.id) {
      throw new Error("Open this Scene on the canvas to edit its road points.");
    }
    const atlas = readAtlas(scene);
    if (atlas.schemaVersion !== 3) throw new Error("Organize roads before editing their control points.");
    if (!atlas.roads.some(r => r.id === roadId)) throw new Error("This road no longer exists.");
    const element = canvas.app?.canvas ?? canvas.app?.view;
    if (!element?.addEventListener || typeof canvas.canvasCoordinatesFromClient !== "function") {
      throw new Error("The Foundry canvas is not ready for point editing.");
    }
    const s = {
      scene, sceneId: scene.id, roadId, expectedRevision: atlas.revision,
      working: atlas, history: [atlas], operations: [], element, onChange, source,
      drag: null, confirming: false, selectedHandle: null, onDown: null, onMove: null,
      onUp: null, onDoubleClick: null, onKeydown: null
    };
    s.onDown = async event => {
      if (event.button !== 0 || this.saving || s.confirming) return;
      if (this.canvasProvider()?.scene?.id !== s.sceneId) return this.cancel();
      const point = this.#localPoint(event);
      if (!point) return;
      const handle = nearestRoadHandle(s.working, roadId, point, this.#tolerance());
      if (handle) {
        this.#consume(event);
        if (event.altKey && handle.kind === "bend") {
          try {
            this.#perform({ kind: "remove-bend", segmentId: handle.segmentId,
              viaIndex: handle.viaIndex });
            s.selectedHandle = null;
          } catch (error) { this.notify()?.error?.(error.message); }
          return;
        }
        if (event.shiftKey && !event.altKey && handle.kind === "bend") {
          try {
            this.insertJunction({
              kind: "edge", segmentId: handle.segmentId,
              edgeIndex: handle.viaIndex + 1, atVertex: true,
              x: handle.x, y: handle.y
            });
            this.notify()?.info?.(game.i18n.localize("FVTTATLAS.Junctions.PromotedNotice"));
          } catch (error) { this.notify()?.error?.(error.message); }
          return;
        }
        if (event.shiftKey && !event.altKey && handle.kind === "node") {
          try {
            this.#perform({ kind: "demote-junction", nodeId: handle.nodeId });
            s.selectedHandle = null;
            this.notify()?.info?.(game.i18n.localize("FVTTATLAS.Junctions.DemotedNotice"));
          } catch (error) { this.notify()?.warn?.(error.message); }
          return;
        }
        if (event.altKey && handle.kind === "node") {
          const affected = s.working.segments.filter(segment =>
            segment.from === handle.nodeId || segment.to === handle.nodeId);
          const otherIds = new Set(affected.filter(segment => segment.roadId !== roadId)
            .map(segment => segment.roadId));
          if (!otherIds.size) {
            this.notify()?.warn?.(game.i18n.localize("FVTTATLAS.Roads.NotShared"));
            return;
          }
          const roadName = s.working.roads.find(road => road.id === roadId)?.name;
          const otherNames = s.working.roads.filter(road => otherIds.has(road.id))
            .map(road => road.name);
          s.confirming = true;
          s.selectedHandle = null;
          this.refresh();
          try {
            const approved = await this.confirmDetach({ roadName, otherNames });
            if (this.session !== s || !approved) return;
            this.#perform({
              kind: "detach-node", nodeId: handle.nodeId,
              newNodeId: this.idFactory(), x: handle.x, y: handle.y
            });
            this.notify()?.info?.(game.i18n.localize("FVTTATLAS.Roads.DetachedNotice"));
          } catch (error) { this.notify()?.error?.(error.message); }
          finally {
            s.confirming = false;
            if (this.session === s) this.refresh();
          }
          return;
        }
        s.selectedHandle = handle;
        s.drag = { handle, preview: null, operation: null };
        try { if (event.pointerId != null) element.setPointerCapture?.(event.pointerId); }
        catch (_) { /* Pointer capture may already belong to core. */ }
        this.refresh();
        return;
      }
    };
    // pointerdown.detail is unreliable in Foundry canvas input; native dblclick
    // is the stable event for insertion between existing bend handles.
    s.onDoubleClick = event => {
      if (event.button !== 0 || this.saving || s.confirming || this.session !== s) return;
      const point = this.#localPoint(event);
      if (!point) return;
      const edge = nearestRoadEdge(s.working, roadId, point, this.#tolerance());
      if (!edge) return;
      this.#consume(event);
      try {
        this.#perform(edge);
        s.selectedHandle = { kind: "bend", segmentId: edge.segmentId,
          viaIndex: edge.edgeIndex };
      } catch (error) { this.notify()?.error?.(error.message); }
    };
    s.onMove = event => {
      if (!s.drag || this.saving || s.confirming) return;
      const point = this.#localPoint(event);
      if (!point) return;
      const operation = this.#operation(s.drag.handle, {
        x: Math.round(point.x * 100) / 100,
        y: Math.round(point.y * 100) / 100
      });
      try {
        s.drag.preview = applyRoadGeometryEdit(s.working, { roadId, operation });
        s.drag.operation = operation;
        this.refresh();
      } catch (_) {
        // Ignore temporary invalid/degenerate geometry until the cursor recovers.
      }
      this.#consume(event);
    };
    s.onUp = async event => {
      if (!s.drag || this.saving || s.confirming) return;
      this.#consume(event);
      const operation = event.type === "pointercancel" ? null : s.drag.operation;
      s.drag = null;
      try { if (event.pointerId != null) element.releasePointerCapture?.(event.pointerId); }
      catch (_) { /* May have been released by the browser already. */ }
      if (!operation) { this.refresh(); return; }
      try {
        const candidate = operation.kind === "move-node"
          ? findJunctionAttachment(s.working, operation.nodeId,
              { x: operation.x, y: operation.y }, this.#tolerance()) : null;
        if (!candidate) {
          this.#perform(operation);
          return;
        }
        const incidentIds = new Set(s.working.segments.filter(segment =>
          segment.from === operation.nodeId || segment.to === operation.nodeId)
          .map(segment => segment.roadId));
        const sourceNames = s.working.roads.filter(road => incidentIds.has(road.id))
          .map(road => road.name);
        const targetNames = attachmentRoadNames(s.working, candidate);
        s.confirming = true;
        this.refresh();
        const approved = await this.confirmAttach({ kind: "move", sourceNames, targetNames });
        if (this.session !== s || !approved) return;
        this.#perform({
          kind: "connect-node", nodeId: operation.nodeId,
          target: candidate, x: candidate.x, y: candidate.y,
          ...(candidate.kind === "edge" ? { newSegmentId: this.idFactory() } : {})
        });
      } catch (error) { this.notify()?.error?.(error.message); }
      finally {
        s.confirming = false;
        if (this.session === s) this.refresh();
      }
    };
    s.onKeydown = event => {
      if (s.confirming) return;
      if (event.key === "Escape") {
        event.preventDefault?.();
        this.cancel();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault?.();
        this.undo();
      } else if ((event.key === "Delete" || event.key === "Backspace") &&
          !event.target?.isContentEditable &&
          !["INPUT", "TEXTAREA"].includes(event.target?.tagName) &&
          s.selectedHandle?.kind === "bend") {
        event.preventDefault?.();
        const handle = s.selectedHandle;
        try {
          this.#perform({ kind: "remove-bend", segmentId: handle.segmentId,
            viaIndex: handle.viaIndex });
          s.selectedHandle = null;
        } catch (error) { this.notify()?.error?.(error.message); }
      }
    };
    this.session = s;
    element.addEventListener("pointerdown", s.onDown, true);
    element.addEventListener("dblclick", s.onDoubleClick, true);
    element.addEventListener("pointermove", s.onMove, true);
    element.addEventListener("pointerup", s.onUp, true);
    element.addEventListener("pointercancel", s.onUp, true);
    this.doc()?.addEventListener?.("keydown", s.onKeydown, true);
    this.#notifyChange(onChange);
  }

  #detach() {
    const s = this.session;
    if (!s) return;
    s.element.removeEventListener("pointerdown", s.onDown, true);
    s.element.removeEventListener("dblclick", s.onDoubleClick, true);
    s.element.removeEventListener("pointermove", s.onMove, true);
    s.element.removeEventListener("pointerup", s.onUp, true);
    s.element.removeEventListener("pointercancel", s.onUp, true);
    this.doc()?.removeEventListener?.("keydown", s.onKeydown, true);
  }

  undo() {
    const s = this.session;
    if (!s || this.saving || s.confirming || !s.operations.length) return;
    s.operations.pop();
    s.history.pop();
    s.working = s.history.at(-1);
    s.drag = null;
    s.selectedHandle = null;
    this.#notifyChange(s.onChange);
  }

  cancel() {
    if (!this.session || this.saving) return;
    const callback = this.session.onChange;
    this.#detach();
    this.session = null;
    this.#notifyChange(callback);
  }

  async finish() {
    const s = this.session;
    if (!s || this.saving || s.confirming) return false;
    if (!s.operations.length) { this.cancel(); return true; }
    this.saving = true;
    this.#notifyChange(s.onChange);
    try {
      await savePointEdits(s.scene, {
        roadId: s.roadId, operations: s.operations,
        expectedRevision: s.expectedRevision
      });
      this.#detach();
      this.session = null;
      this.saving = false;
      this.#notifyChange(s.onChange);
      this.notify()?.info?.("Atlas road points saved.");
      return true;
    } catch (error) {
      this.saving = false;
      this.notify()?.error?.(error.message);
      this.#notifyChange(s.onChange);
      return false;
    }
  }
}
