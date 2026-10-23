import { readAtlas } from "./atlas-storage.js";
import { saveNewRoad, saveNewCheckpoint } from "./road-storage.js";
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

function drawDot(graphics, point, color, radius = 5) {
  if (typeof graphics.circle === "function" && typeof graphics.fill === "function") {
    graphics.circle(point.x, point.y, radius).fill({ color, alpha: 0.95 });
  } else if (typeof graphics.drawCircle === "function") {
    graphics.beginFill?.(color, 0.95);
    graphics.drawCircle(point.x, point.y, radius);
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


/** Separating one named road from a shared graph junction never removes roads. */
async function confirmRoadDetachment({ roadName, otherNames }) {
  const content = document.createElement("div");
  const explanation = document.createElement("p");
  explanation.textContent = game.i18n.localize("FVTTATLAS.Roads.DetachWarning");
  content.appendChild(explanation);
  const details = document.createElement("p");
  details.textContent = game.i18n.format("FVTTATLAS.Roads.DetachDetails", {
    road: roadName, others: otherNames.join(", ")
  });
  content.appendChild(details);
  return foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("FVTTATLAS.Roads.DetachTitle") },
    content,
    yes: { label: game.i18n.localize("FVTTATLAS.Roads.DetachConfirm") },
    rejectClose: false, modal: true
  });
}

/**
 * A same-name branch cannot be collapsed into a bend without losing a road arm.
 * Require the GM to choose which incident graph section to disconnect.
 */
async function chooseRoadBranch({ roadName, junction, sections }) {
  const content = document.createElement("div");
  const hint = document.createElement("p");
  hint.textContent = game.i18n.localize("FVTTATLAS.Roads.DetachBranchWarning");
  content.appendChild(hint);
  const name = document.createElement("p");
  name.textContent = roadName;
  name.style.fontWeight = "bold";
  content.appendChild(name);
  const field = document.createElement("div");
  field.className = "form-group";
  const label = document.createElement("label");
  label.textContent = game.i18n.localize("FVTTATLAS.Roads.DetachBranchSelect");
  const select = document.createElement("select");
  select.name = "sectionId";
  select.style.width = "100%";
  const nodes = new Map(junction.nodes.map(n => [n.id, n]));
  const directions = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  sections.forEach((segment, index) => {
    const outbound = segment.from === junction.id
      ? (segment.via[0] ?? nodes.get(segment.to))
      : (segment.via.at(-1) ?? nodes.get(segment.from));
    const dx = outbound.x - junction.x;
    const dy = outbound.y - junction.y;
    const angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
    const option = document.createElement("option");
    option.value = segment.id;
    option.textContent = game.i18n.format("FVTTATLAS.Roads.DetachBranchOption", {
      number: index + 1, direction: dx || dy ? directions[angle] : "?",
      section: segment.id.slice(-6)
    });
    select.appendChild(option);
  });
  field.appendChild(label);
  field.appendChild(select);
  content.appendChild(field);
  const reminder = document.createElement("p");
  reminder.textContent = game.i18n.localize("FVTTATLAS.Roads.DetachBranchAfter");
  content.appendChild(reminder);
  const response = await foundry.applications.api.DialogV2.input({
    window: { title: game.i18n.localize("FVTTATLAS.Roads.DetachBranchTitle") },
    content,
    ok: { label: game.i18n.localize("FVTTATLAS.Roads.DetachBranchConfirm") },
    rejectClose: false, modal: true
  });
  return sections.some(section => section.id === response?.sectionId)
    ? response.sectionId : null;
}

/** Checkpoint metadata is GM-only; native Regions and Journals are unaffected. */
async function promptRoadCheckpoint({ roads, defaultName }) {
  const content = document.createElement("div");
  const nameLabel = document.createElement("label");
  nameLabel.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.Name");
  const name = document.createElement("input");
  name.type = "text";
  name.name = "checkpointName";
  name.maxLength = 120;
  name.required = true;
  name.value = defaultName;
  content.appendChild(nameLabel);
  content.appendChild(name);
  const roadLabel = document.createElement("label");
  roadLabel.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.Road");
  const road = document.createElement("select");
  road.name = "checkpointRoadId";
  for (const item of roads) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    road.appendChild(option);
  }
  content.appendChild(roadLabel);
  content.appendChild(road);
  const elevationLabel = document.createElement("label");
  elevationLabel.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.Elevation");
  const elevation = document.createElement("input");
  elevation.type = "number";
  elevation.name = "checkpointElevation";
  elevation.step = "any";
  elevation.placeholder = game.i18n.localize("FVTTATLAS.Checkpoints.Unknown");
  content.appendChild(elevationLabel);
  content.appendChild(elevation);
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.ElevationHint");
  content.appendChild(hint);
  const response = await foundry.applications.api.DialogV2.input({
    window: { title: game.i18n.localize("FVTTATLAS.Checkpoints.Add") },
    content,
    ok: { label: game.i18n.localize("FVTTATLAS.Checkpoints.Save") },
    rejectClose: false
  });
  if (!response) return null;
  const roadId = String(response.checkpointRoadId ?? "");
  if (!roads.some(item => item.id === roadId)) {
    throw new Error("Select a road that owns the checkpoint position.");
  }
  const raw = String(response.checkpointElevation ?? "").trim();
  const elevationMeters = raw === "" ? null : Number(raw);
  if (raw !== "" && (!Number.isFinite(elevationMeters) || Math.abs(elevationMeters) > 10000000)) {
    throw new Error("Elevation must be a finite number of meters.");
  }
  return { roadId, name: String(response.checkpointName ?? ""), elevationMeters };
}

/** GM-only disposable Scene overlay; does not intercept ordinary player play. */
export class RoadCanvasController {
  constructor({
    canvasProvider = () => globalThis.canvas,
    doc = () => globalThis.document,
    idFactory = () => foundry.utils.randomID(),
    notify = () => globalThis.ui?.notifications,
    confirmAttach = confirmRoadAttachment,
    confirmDetach = confirmRoadDetachment,
    chooseBranch = chooseRoadBranch,
    promptCheckpoint = promptRoadCheckpoint
  } = {}) {
    this.canvasProvider = canvasProvider;
    this.doc = doc;
    this.idFactory = idFactory;
    this.notify = notify;
    this.confirmAttach = confirmAttach;
    this.promptCheckpoint = promptCheckpoint;
    this.graphics = null;
    this.graphicsCanvas = null;
    this.draft = null;
    this.selectedRoadId = null;
    this.selectedJunctionId = null;
    this.selectedCheckpointId = null;
    this.saving = false;
    this.pointEditor = new RoadPointEditor({ canvasProvider, doc, notify,
      confirmAttach, confirmDetach, chooseBranch, idFactory, refresh: () => this.refresh() });
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
    if (this.pointEditor.session) {
      this.pointEditor.cancel();
      this.selectedJunctionId = null;
      this.refresh();
      return;
    }
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
    this.selectedJunctionId = null;
    this.selectedCheckpointId = null;
    this.refresh();
  }

  start(scene, onChange) {
    this.#startDrawing(scene, onChange);
  }

  startPointEdit(scene, roadId, onChange) {
    if (this.draft || this.saving) throw new Error("Finish or cancel drawing first.");
    this.pointEditor.start(scene, roadId, onChange);
    this.selectedRoadId = roadId;
    this.selectedJunctionId = null;
    this.selectedCheckpointId = null;
    this.refresh();
  }

  undo() {
    this.pointEditor.undo();
  }

  /**
   * Junctions [+] is an explicit canvas picker, never an automatic crossing
   * detector. The GM clicks a road interior; the new junction is staged in the
   * existing reversible point editor and requires Save Points.
   */
  startJunction(scene, onChange) {
    if (!globalThis.game?.user?.isGM ||
        !scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may create Atlas junctions.");
    }
    if (this.saving || this.draft || this.pointEditor.session) {
      throw new Error("Save or cancel the current edits before placing a junction.");
    }
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene.id) {
      throw new Error("Open this Scene on the canvas before adding a junction.");
    }
    const atlas = readAtlas(scene);
    if (atlas.schemaVersion < 3 || !atlas.segments.length) {
      throw new Error("Create and organize roads before placing junctions.");
    }
    const element = canvas.app?.canvas ?? canvas.app?.view;
    if (!element?.addEventListener || typeof canvas.canvasCoordinatesFromClient !== "function") {
      throw new Error("The Foundry canvas is not ready for junction placement.");
    }
    const draft = {
      scene, sceneId: scene.id, mode: "junction", points: [], element, onChange,
      expectedRevision: atlas.revision, onPointer: null, onKeydown: null
    };
    draft.onPointer = event => {
      if (event.button !== 0 || this.saving || this.draft !== draft) return;
      if (this.canvasProvider()?.scene?.id !== draft.sceneId) { this.cancel(); return; }
      const location = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
      if (!Number.isFinite(location?.x) || !Number.isFinite(location?.y)) return;
      const sceneRect = canvas.dimensions?.sceneRect;
      if (typeof sceneRect?.contains === "function" &&
          !sceneRect.contains(location.x, location.y)) return;
      const current = readAtlas(scene);
      if (current.revision !== draft.expectedRevision) {
        this.cancel();
        this.notify()?.error?.("Atlas roads changed. Reopen Junctions [+] and try again.");
        return;
      }
      const localPoint = toAtlasPoint(canvas, current, location);
      const target = findRoadSnap(current, localPoint);
      if (!target) {
        this.notify()?.warn?.(game.i18n.localize("FVTTATLAS.Junctions.ClickRoad"));
        return;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      if (target.kind === "node") {
        this.notify()?.info?.(game.i18n.localize("FVTTATLAS.Junctions.AlreadyJunction"));
        return;
      }
      const owner = current.segments.find(s => s.id === target.segmentId);
      if (!owner) return;
      const changed = draft.onChange;
      this.#detach();
      this.draft = null;
      try {
        this.pointEditor.start(scene, owner.roadId, changed, { source: "junction" });
        const nodeId = this.pointEditor.insertJunction(target);
        this.selectedRoadId = owner.roadId;
        this.selectedJunctionId = nodeId;
        this.refresh();
        changed?.();
        this.notify()?.info?.(game.i18n.localize("FVTTATLAS.Junctions.StagedNotice"));
      } catch (error) {
        if (this.pointEditor.session) this.pointEditor.cancel();
        this.selectedJunctionId = null;
        this.refresh();
        this.notify()?.error?.(error.message);
      }
    };
    draft.onKeydown = event => {
      if (event.key === "Escape") {
        event.preventDefault?.();
        this.cancel();
      }
    };
    this.draft = draft;
    this.selectedJunctionId = null;
    this.selectedRoadId = null;
    this.selectedJunctionId = null;
    this.selectedCheckpointId = null;
    element.addEventListener("pointerdown", draft.onPointer, true);
    this.doc()?.addEventListener?.("keydown", draft.onKeydown, true);
    this.refresh();
    this.#changed();
  }

  /**
   * Checkpoints [+] uses the same bounded Scene hit-testing as Junctions [+].
   * An interior click inserts one stable graph node and checkpoint together
   * in ONE revision-checked Scene flag update, never as separate writes.
   */
  startCheckpoint(scene, onChange) {
    if (!globalThis.game?.user?.isGM ||
        !scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may place Atlas checkpoints.");
    }
    if (this.saving || this.draft || this.pointEditor.session) {
      throw new Error("Finish or cancel the current road edits first.");
    }
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene.id) {
      throw new Error("View this Scene on the canvas before adding a checkpoint.");
    }
    const atlas = readAtlas(scene);
    if (atlas.schemaVersion < 3 || !atlas.segments.length) {
      throw new Error("Create and organize named roads before adding checkpoints.");
    }
    const element = canvas.app?.canvas ?? canvas.app?.view;
    if (!element?.addEventListener || typeof canvas.canvasCoordinatesFromClient !== "function") {
      throw new Error("The Foundry canvas is not ready for checkpoint placement.");
    }
    const draft = {
      scene, sceneId: scene.id, mode: "checkpoint", points: [], element,
      onChange, expectedRevision: atlas.revision, confirming: false,
      onPointer: null, onKeydown: null
    };
    draft.onPointer = async event => {
      if (event.button !== 0 || this.saving || draft.confirming || this.draft !== draft) return;
      if (this.canvasProvider()?.scene?.id !== draft.sceneId) { this.cancel(); return; }
      const position = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
      if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
      const rect = canvas.dimensions?.sceneRect;
      if (typeof rect?.contains === "function" && !rect.contains(position.x, position.y)) return;
      const current = readAtlas(scene);
      if (current.revision !== draft.expectedRevision) {
        this.cancel();
        this.notify()?.error?.("The road network changed. Reopen Checkpoints [+].");
        return;
      }
      const local = toAtlasPoint(canvas, current, position);
      const candidate = findRoadSnap(current, local);
      if (!candidate) {
        this.notify()?.warn?.(game.i18n.localize("FVTTATLAS.Checkpoints.ClickRoad"));
        return;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      const roadIds = candidate.kind === "node"
        ? new Set(current.segments.filter(s => s.from === candidate.nodeId ||
            s.to === candidate.nodeId).map(s => s.roadId))
        : new Set(current.segments.filter(s => s.id === candidate.segmentId).map(s => s.roadId));
      const roads = current.roads.filter(road => roadIds.has(road.id));
      if (!roads.length) return;
      draft.confirming = true;
      try {
        const config = await this.promptCheckpoint({
          roads,
          defaultName: "Checkpoint " + ((current.checkpoints?.length ?? 0) + 1)
        });
        if (this.draft !== draft || !config) return;
        this.saving = true;
        const saved = await saveNewCheckpoint(scene, {
          ...config, candidate, expectedRevision: draft.expectedRevision,
          idFactory: this.idFactory
        });
        if (this.draft !== draft) return;
        const callback = draft.onChange;
        this.#detach();
        this.draft = null;
        this.selectedRoadId = null;
        this.selectedJunctionId = null;
        this.selectedCheckpointId = saved.checkpoints.at(-1).id;
        this.notify()?.info?.(game.i18n.localize("FVTTATLAS.Checkpoints.Saved"));
        this.refresh();
        callback?.(config.roadId);
      } catch (error) {
        this.notify()?.error?.(error.message);
      } finally {
        this.saving = false;
        draft.confirming = false;
        if (this.draft === draft) this.#changed();
      }
    };
    draft.onKeydown = event => {
      if (event.key === "Escape" && !draft.confirming) {
        event.preventDefault?.();
        this.cancel();
      }
    };
    this.draft = draft;
    this.selectedCheckpointId = null;
    element.addEventListener("pointerdown", draft.onPointer, true);
    this.doc()?.addEventListener?.("keydown", draft.onKeydown, true);
    this.refresh();
    this.#changed();
  }

  selectCheckpoint(scene, checkpointId) {
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene?.id) {
      throw new Error("View this Scene on the canvas to highlight a checkpoint.");
    }
    const checkpoint = readAtlas(scene).checkpoints?.find(c => c.id === checkpointId);
    if (!checkpoint) throw new Error("That checkpoint no longer exists.");
    this.selectedCheckpointId = this.selectedCheckpointId === checkpointId ? null : checkpointId;
    this.selectedRoadId = null;
    this.selectedJunctionId = null;
    this.refresh();
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
    if (atlas.schemaVersion < 3 && (atlas.nodes.length || atlas.segments.length)) {
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
      const activeAtlas = storedAtlas.schemaVersion >= 3 ? storedAtlas :
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
      if (saved) {
        this.selectedRoadId = null;
        this.selectedJunctionId = null;
        this.refresh();
      }
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
      if (atlas.schemaVersion >= 3) {
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
    this.selectedJunctionId = null;
    this.selectedCheckpointId = null;
    this.refresh();
  }

  selectJunction(scene, nodeId) {
    const canvas = this.canvasProvider();
    if (!canvas?.ready || canvas.scene?.id !== scene?.id) {
      throw new Error("View this Scene on the canvas to highlight a junction.");
    }
    const data = readAtlas(scene);
    if (!data.nodes.some(n => n.id === nodeId) ||
        !data.segments.some(s => s.from === nodeId || s.to === nodeId)) {
      throw new Error("That junction is no longer attached to an Atlas road.");
    }
    this.selectedJunctionId = this.selectedJunctionId === nodeId ? null : nodeId;
    this.selectedRoadId = null;
    this.selectedCheckpointId = null;
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
      const highlighted = this.selectedRoadId === (atlas.schemaVersion >= 3 ? segment.roadId : segment.id);
      const color = highlighted ? 0xffd166 : 0x35c9ef;
      drawLine(g, path, color, highlighted ? 6 : 4);
      drawDot(g, path[0], color);
      drawDot(g, path.at(-1), color);
    }
    for (const checkpoint of atlas.checkpoints ?? []) {
      const point = nodes.get(checkpoint.nodeId);
      if (!point) continue;
      drawDot(g, toCanvasPoint(canvas, atlas, point),
        checkpoint.id === this.selectedCheckpointId ? 0x8ef6c5 : 0x9c7bf0,
        checkpoint.id === this.selectedCheckpointId ? 10 : 6);
    }
    if (this.selectedJunctionId) {
      const selected = nodes.get(this.selectedJunctionId);
      if (selected && atlas.segments.some(s =>
        s.from === selected.id || s.to === selected.id)) {
        drawDot(g, toCanvasPoint(canvas, atlas, selected), 0xf4b65a, 10);
      }
    }
    if (this.draft?.sceneId === canvas.scene.id) {
      const draft = this.draft;
      const visualAtlas = atlas.schemaVersion >= 3 ? atlas :
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
    this.selectedJunctionId = null;
    this.selectedCheckpointId = null;
  }
}
