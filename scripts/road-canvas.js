import { readAtlas } from "./atlas-storage.js";
import { readAtlasJournalLinks, journalUuidFor, saveAtlasJournalLink, canOpenAtlasJournal, openAtlasJournal } from "./atlas-journal-links.js";
import { saveNewRoad, saveNewCheckpoint } from "./road-storage.js";
import { RoadPointEditor } from "./road-point-editor.js";
import { roadHandles } from "./road-hit.js";
import { attachmentRoadNames, findRoadSnap, suggestRoadName } from "./road-model.js";
import { toAtlasPoint, toCanvasPoint } from "./road-coordinates.js";
import { atlasShortcutTarget } from "./atlas-canvas-hit.js";
import { groupCheckpointMarkers, checkpointQuickInfo,
  clusterQuickInfo } from "./checkpoint-clusters.js";
import { playerAtlasOverlay } from "./player-visibility.js";
import { readManualFog } from "./atlas-manual-fog-storage.js";
import { cellKey } from "./atlas-manual-fog-model.js";
import { readPartyExploration, saveCheckpointKnowledge } from "./party-exploration-storage.js";
import { nativeFogCells } from "./atlas-manual-fog-geometry.js";
import { checkpointRevealKeys } from "./checkpoint-exploration.js";
import { readCheckpointDiscoveryMethods } from "./checkpoint-discovery-method.js";
import { checkpointKnowledge } from "./party-exploration-model.js";
import { exploredRoadSpans, atlasPointExplored } from "./road-fog.js";
import { readWorldRoadAppearance, resolveRoadAppearance,
  roadStrokeSpans, roadLabelPoint, roadAppearanceMode, readRoadCurvePreset,
  smoothRoadPath, roadCurveNeighbors } from "./road-appearance.js";
import { defaultTravelPresets, validateTravelPresets,
  TRAVEL_PRESET_SETTING } from "./travel-preset-model.js";
import { validateRoadAppearance } from "./road-appearance.js";
import { checkpointIconPath, checkpointFontIcon, checkpointMarkerPosition,
  checkpointCanvasSize,
  resolveCheckpointAppearance }
  from "./checkpoint-appearance.js";

/** Pixi canvas-backed text needs more texels than its on-screen font size at zoom. */
function sharpenText(label, zoom = 1) {
  if (!label || !("resolution" in label)) return;
  const ratio = globalThis.window?.devicePixelRatio ?? 1;
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  label.resolution = Math.min(4, Math.max(2, ratio, Math.ceil(scale * 2)));
}

function drawLine(graphics, points, color, width = 4, alpha = 0.9, pattern = "solid", patternWidth = width) {
  if (points.length < 2) return;
  const spans = roadStrokeSpans(points, pattern, patternWidth);
  if (typeof graphics.moveTo === "function" && typeof graphics.stroke === "function") {
    for (const span of spans) {
      graphics.moveTo(span[0].x, span[0].y);
      for (const point of span.slice(1)) graphics.lineTo(point.x, point.y);
    }
    graphics.stroke({ color, width, alpha, cap: "round", join: "round" });
  } else if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(width, color, alpha);
    for (const span of spans) {
      graphics.moveTo(span[0].x, span[0].y);
      for (const point of span.slice(1)) graphics.lineTo(point.x, point.y);
    }
  }
}

/** GM-only visual hatching; it never mutates the road's geometry or visibility. */
/** High-contrast complementary pulse; never changes the authored road/marker color. */
function focusContrast(sourceColor) {
  const color = typeof sourceColor === "string"
    ? Number.parseInt(sourceColor.replace("#",""),16) : Number(sourceColor);
  return 0xffffff ^ (Number.isFinite(color) ? color : 0x9c7bf0);
}
function focusPulse(focus) {
  if (!focus || Date.now() >= focus.until) return 0;
  const elapsed=3500-(focus.until-Date.now());
  const fade=Math.min(1,(focus.until-Date.now())/650);
  return (0.42+0.42*Math.abs(Math.sin(elapsed/240)))*fade;
}
function contrastingHatch(sourceColor) {
  const color = typeof sourceColor === "string"
    ? Number.parseInt(sourceColor.replace("#", ""),16) : sourceColor;
  const source = Number.isFinite(color) ? color : 0x9c7bf0;
  const red = 0xd44855;
  const distance = Math.hypot(((source >> 16) & 255) - 212,
    ((source >> 8) & 255) - 72,(source & 255) - 85);
  return distance < 250 ? 0xffd98b : red;
}
function drawHiddenHatching(graphics, marks, width = 2, color = 0xd44855) {
  if (!marks.length) return;
  if (typeof graphics.stroke === "function") {
    for (const [a, b] of marks) {
      graphics.moveTo(a.x, a.y);
      graphics.lineTo(b.x, b.y);
    }
    graphics.stroke({ color, width, alpha: 0.95, cap: "round" });
  } else if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(width, color, 0.95);
    for (const [a, b] of marks) {
      graphics.moveTo(a.x, a.y);
      graphics.lineTo(b.x, b.y);
    }
  }
}
function roadHiddenMarks(path, lineWidth, zoom) {
  const marks = [], interval = 18 / zoom, extent = Math.max(lineWidth + 3 / zoom, 9 / zoom);
  let offset = interval / 2;
  for (let i = 1; i < path.length && marks.length < 800; i++) {
    const a = path[i - 1], b = path[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    while (offset <= length && marks.length < 800) {
      const center = { x: a.x + direction.x * offset, y: a.y + direction.y * offset };
      const d = extent / (2 * Math.SQRT2);
      marks.push([{ x: center.x - d, y: center.y - d },
        { x: center.x + d, y: center.y + d }]);
      offset += interval;
    }
    offset -= length;
  }
  return marks;
}
function drawCheckpointBorder(graphics, marker, radius, color, zoom) {
  const width = 2 / zoom;
  if (typeof graphics.circle === "function" && typeof graphics.stroke === "function") {
    graphics.circle(marker.x, marker.y, radius)
      .stroke({ color, width, alpha: 1 });
  } else if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(width, color, 1);
    graphics.drawCircle(marker.x, marker.y, radius);
  }
}
function drawHiddenCheckpoint(graphics, marker, radius, zoom, sourceColor = 0x9c7bf0) {
  // A translucent round tint and diagonal chords form the same red hatch language
  // used along hidden road sections, without obscuring the checkpoint glyph.
  if (typeof graphics.circle === "function" && typeof graphics.fill === "function") {
    graphics.circle(marker.x, marker.y, radius)
      .fill({ color: 0x8c2637, alpha: 0.24 });
  } else if (typeof graphics.beginFill === "function") {
    graphics.beginFill(0x8c2637, 0.24);
    graphics.drawCircle(marker.x, marker.y, radius);
    graphics.endFill();
  }
  const marks=[], step=7/zoom;
  for(let offset=-radius+step/2;offset<radius;offset+=step) {
    const half=Math.sqrt(Math.max(0,radius*radius-offset*offset));
    const dx=half/Math.SQRT2,dy=half/Math.SQRT2;
    const ox=-offset/Math.SQRT2,oy=offset/Math.SQRT2;
    marks.push([{x:marker.x+ox-dx,y:marker.y+oy-dy},
      {x:marker.x+ox+dx,y:marker.y+oy+dy}]);
  }
  drawHiddenHatching(graphics,marks,2.5/zoom,contrastingHatch(sourceColor));
}

/** Clip hidden hatching to the actual checkpoint texture/text alpha, not a disk. */
function overlayHiddenCheckpoint(parent, marker, radius, zoom, sourceColor, labels, shape=null) {
  if (!globalThis.PIXI?.Graphics || typeof parent.addChild !== "function") {
    drawHiddenCheckpoint(parent,marker,radius,zoom,sourceColor);
    return;
  }
  const layer = new PIXI.Graphics();
  layer.eventMode = "none";
  let mask = null;
  if (shape?.texture && globalThis.PIXI?.Sprite) {
    mask = new PIXI.Sprite(shape.texture);
    mask.anchor?.set?.(0.5);
    mask.position?.set?.(marker.x,marker.y);
    mask.width = shape.size;
    mask.height = shape.size;
  } else if (shape?.font && globalThis.PIXI?.Text) {
    const font = shape.font;
    mask = new PIXI.Text(font.glyph, {
      fontFamily: font.family, fontWeight: font.weight,
      fontSize: shape.size, fill: 0xffffff, align: "center"
    });
    mask.anchor?.set?.(0.5);
    mask.position?.set?.(marker.x,marker.y);
  }
  if (mask) {
    // Pixi v8 Sprite/Text masks use their alpha as the exact icon silhouette.
    mask.eventMode = "none";
    parent.addChild(mask);
    labels.push(mask);
    const bounds=shape.size/2+3/zoom;
    const color=contrastingHatch(sourceColor);
    if (typeof layer.rect === "function" && typeof layer.fill === "function") {
      layer.rect(marker.x-bounds,marker.y-bounds,bounds*2,bounds*2)
        .fill({color:0x862337,alpha:0.26});
    } else if (typeof layer.beginFill === "function") {
      layer.beginFill(0x862337,0.26);
      layer.drawRect(marker.x-bounds,marker.y-bounds,bounds*2,bounds*2);
      layer.endFill();
    }
    const marks=[];
    for (let x=-bounds*2;x<bounds*2;x+=6/zoom) {
      marks.push([
        {x:marker.x+x,y:marker.y-bounds},
        {x:marker.x+x+2*bounds,y:marker.y+bounds}
      ]);
    }
    drawHiddenHatching(layer,marks,2.5/zoom,color);
    layer.mask=mask;
  } else {
    // The basic dot and a grouped-marker badge genuinely are circular.
    drawHiddenCheckpoint(layer,marker,radius,zoom,sourceColor);
  }
  parent.addChild(layer);
  labels.push(layer);
}

function nearestRoadPoint(position, path, tolerance) {
  let nearest = null, distance = tolerance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const squared = dx * dx + dy * dy;
    if (!squared) continue;
    const t = Math.max(0, Math.min(1,
      ((position.x - a.x) * dx + (position.y - a.y) * dy) / squared));
    const point = { x: a.x + dx * t, y: a.y + dy * t };
    const candidate = Math.hypot(position.x - point.x, position.y - point.y);
    if (candidate <= distance) { nearest = point; distance = candidate; }
  }
  return nearest;
}
function nearRoadLine(position, path, tolerance) {
  return nearestRoadPoint(position, path, tolerance) !== null;
}
/** A label for Always mode stays inside the current camera viewport. */
function visibleRoadLabelPoint(canvas, paths) {
  const rect = (canvas.app?.canvas ?? canvas.app?.view)?.getBoundingClientRect?.();
  if (!rect || !canvas.canvasCoordinatesFromClient) return null;
  const a = canvas.canvasCoordinatesFromClient({ x: rect.left, y: rect.top });
  const b = canvas.canvasCoordinatesFromClient({ x: rect.right, y: rect.bottom });
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  let chosen = null, best = Infinity;
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i], dx = q.x - p.x, dy = q.y - p.y;
    let lo = 0, hi = 1;
    for (const [n, d] of [[-dx, p.x - minX], [dx, maxX - p.x],
      [-dy, p.y - minY], [dy, maxY - p.y]]) {
      if (!n) { if (d < 0) { lo = 1; hi = 0; break; } }
      else if (n < 0) lo = Math.max(lo, d / n);
      else hi = Math.min(hi, d / n);
    }
    if (lo > hi) continue;
    const t = Math.max(lo, Math.min(hi,
      (dx * (center.x - p.x) + dy * (center.y - p.y)) / (dx * dx + dy * dy || 1)));
    const point = { x: p.x + t * dx, y: p.y + t * dy };
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    if (distance < best) { chosen = point; best = distance; }
  }
  return chosen;
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
/** Fade road titles close to checkpoint markers so the checkpoint name remains readable. */
export function roadLabelOpacityNearCheckpoints(point, checkpointPositions, zoom = 1, mode = "hover") {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const exclusionRadius = 85 / scale;
  if (!point || !checkpointPositions.some(checkpoint =>
    Math.hypot(point.x - checkpoint.x, point.y - checkpoint.y) < exclusionRadius)) return 1;
  return mode === "always" ? 0.2 : 0;
}

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
    this.labels = [];
    this.hoveredRoadId = null;
    this.hoveredRoadPoint = null;
    this.hoveredCheckpointId = null;
    this.hoveredClusterId = null;
    this.checkpointHoverGeometry = [];
    this.clusterHoverGeometry = [];
    this.textureCache = new Map();
    this.fontStatus = new Map();
    this.lastZoom = null;
    this.zoomRefreshTimer = null;
    this.fogRefreshTimer = null;
    this.hoverCanvasElement = null;
    this.hoverHandler = null;
    this.hoverExitHandler = null;
    this.shortcutHandler = null;
    this.shortcutPointerHandler = null;
    this.hoverGeometry = [];
    this.lastHoverAt = 0;
    this.playerHoveredRoadId = null;
    this.playerHoveredRoadPoint = null;
    this.playerHoveredCheckpointId = null;
    this.playerHoverGeometry = [];
    this.playerCheckpointHoverGeometry = [];
    this.playerHoverCanvasElement = null;
    this.playerMoveHandler = null;
    this.playerExitHandler = null;
    this.journalDoubleClickHandler = null;
    this.playerJournalDoubleClickHandler = null;
    this.journalAccessCache = new Map();
    this.draft = null;
    this.selectedRoadId = null;
    this.selectedJunctionId = null;
    this.selectedCheckpointId = null;
    this.saving = false;
    this.regionPreview = null;
    this.focusTarget = null;
    this.focusTimer = null;
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

  getNewRoadOptions(scene) {
    return this.draft?.sceneId === scene?.id && this.draft.mode === "new"
      ? { ...this.draft.options } : null;
  }

  setNewRoadOptions(scene, updates) {
    const draft = this.draft;
    if (!draft || draft.sceneId !== scene?.id || draft.mode !== "new" ||
        this.saving || draft.confirming) throw new Error("No active new road to configure.");
    const options = { ...draft.options, ...updates };
    if (typeof options.name !== "string" ||
        options.name.length > 120) throw new Error("Road name must be 1–120 characters.");
    if (options.presetId !== null &&
        (typeof options.presetId !== "string" || options.presetId.length > 120)) {
      throw new Error("Invalid road travel preset.");
    }
    if (options.appearance !== null) options.appearance = validateRoadAppearance(options.appearance);
    draft.options = options;
    this.refresh();
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
    this.regionPreview = null;
    this.refresh();
  }

  /** Preview is disposable GM-only canvas graphics, never a native Region. */
  showRegionPreview(scene, plan) {
    const view = this.canvasProvider();
    if (!globalThis.game?.user?.isGM || !view?.ready || view.scene?.id !== scene.id) {
      throw new Error("View this Scene as GM to preview generated Regions.");
    }
    if (this.getDraft(scene)) throw new Error("Finish or cancel road editing first.");
    this.regionPreview = { sceneId: scene.id, plan, points: plan.points, radius: plan.radius };
    this.refresh();
  }

  isRegionPreviewActive(scene, plan) {
    return this.regionPreview?.sceneId === scene?.id &&
      this.regionPreview.plan === plan && this.canvasProvider()?.scene?.id === scene.id;
  }

  clearRegionPreview() {
    this.regionPreview = null;
    this.refresh();
  }

  start(scene, onChange, options = null) {
    this.#startDrawing(scene, onChange, options);
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
        const newId = saved.checkpoints.at(-1).id;
        // Metadata and appearance are committed together above. The separate
        // discovery and Journal stores are written only after creation succeeds.
        try {
          if (config.knowledge !== null && config.knowledge !== undefined) {
            await saveCheckpointKnowledge(scene, {
              checkpointId: newId, knowledge: config.knowledge,
              revealRadiusCells: config.revealRadiusCells ?? 3,
              expected: readPartyExploration(scene),
              method: config.discoveryMethod ?? "automatic",
              expectedMethods: readCheckpointDiscoveryMethods(scene)
            });
          }
          if (config.journalUuid) {
            await saveAtlasJournalLink(scene, {
              kind: "checkpoint", id: newId, uuid: config.journalUuid,
              expected: readAtlasJournalLinks(scene)
            });
          }
        } catch (metadataError) {
          this.notify()?.warn?.("Checkpoint created, but some discovery or Journal settings could not be saved: " +
            (metadataError.message ?? String(metadataError)));
        }
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

  #startDrawing(scene, onChange, initialOptions = null) {
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
      options: { name: suggestRoadName(atlas), presetId: null, appearance: null, playerVisible: false, journalUuid: null, ...initialOptions },
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
    if (!draft.options.name.trim()) {
      this.notify()?.warn?.("Enter a road name before finishing.");
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
          kind: "new", sourceNames: [draft.options.name.trim()],
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
      const savedRoad = await saveNewRoad(draft.scene, {
        points: draft.points, name: draft.options.name.trim(),
        presetId: draft.options.presetId, appearance: draft.options.appearance,
        playerVisible: draft.options.playerVisible === true,
        expectedRevision: draft.expectedRevision,
        snapEndpoints: [draft.snap[0], draft.snap.at(-1)],
        idFactory: this.idFactory
      });
      if (draft.options.journalUuid) {
        try {
          const newId = savedRoad.roads.at(-1)?.id;
          if (newId) await saveAtlasJournalLink(draft.scene, {
            kind: "road", id: newId, uuid: draft.options.journalUuid,
            expected: readAtlasJournalLinks(draft.scene)
          });
        } catch (linkError) {
          this.notify()?.warn?.("Road created, but its Journal link was not saved: " +
            (linkError.message ?? String(linkError)));
        }
      }
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

  focusOn(scene, kind, id) {
    const view=this.canvasProvider();
    if (!view?.ready || view.scene?.id !== scene?.id)
      throw Error("Open this Scene on the map to find it.");
    if (!["road","checkpoint"].includes(kind)) return;
    this.focusTarget = {sceneId:scene.id,kind,id,until:Date.now()+3500};
    if (this.focusTimer) clearInterval(this.focusTimer);
    this.focusTimer = setInterval(()=>{
      if (!this.focusTarget || Date.now() >= this.focusTarget.until ||
          this.canvasProvider()?.scene?.id !== scene.id) {
        clearInterval(this.focusTimer);
        this.focusTimer=null;
        this.focusTarget=null;
      }
      this.refresh();
    },65);
    this.refresh();
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

  #clearLabels() {
    for (const label of this.labels) {
      label.parent?.removeChild?.(label);
      label.destroy?.();
    }
    this.labels = [];
  }

  /** Installed by the Scene Atlas authoring bootstrap, never player-facing. */
  setShortcutHandler(callback) {
    this.shortcutHandler = callback;
    this.#stopHover(); // Rebind pointerdown if a shortcut was installed after canvasReady.
    this.refresh();
  }

  #stopHover() {
    this.hoverCanvasElement?.removeEventListener?.("pointermove", this.hoverHandler);
    this.hoverCanvasElement?.removeEventListener?.("pointerleave", this.hoverExitHandler);
    this.hoverCanvasElement?.removeEventListener?.("pointerdown", this.shortcutPointerHandler, true);
    this.hoverCanvasElement?.removeEventListener?.("dblclick", this.journalDoubleClickHandler, true);
    this.hoverCanvasElement = null;
    this.hoverHandler = null;
    this.hoverExitHandler = null;
    this.shortcutPointerHandler = null;
    this.journalDoubleClickHandler = null;
    this.hoveredRoadId = null;
    this.hoveredCheckpointId = null;
    this.hoveredClusterId = null;
    this.hoverGeometry = [];
    this.checkpointHoverGeometry = [];
    this.clusterHoverGeometry = [];
  }

  #trackHover(canvas) {
    if (!this.hoverGeometry.length && !this.checkpointHoverGeometry.length &&
        !this.clusterHoverGeometry.length &&
        !this.shortcutHandler) {
      if (this.hoverCanvasElement) this.#stopHover();
      return;
    }
    const element = canvas.app?.canvas ?? canvas.app?.view;
    if (this.hoverCanvasElement === element) return;
    const geometry = this.hoverGeometry;
    const checkpoints = this.checkpointHoverGeometry;
    const clusters = this.clusterHoverGeometry;
    this.#stopHover();
    this.hoverGeometry = geometry;
    this.checkpointHoverGeometry = checkpoints;
    this.clusterHoverGeometry = clusters;
    if (!element?.addEventListener) return;
    this.hoverCanvasElement = element;
    this.hoverHandler = event => {
      if (this.draft || this.pointEditor.session ||
          this.canvasProvider()?.scene?.id !== canvas.scene?.id) return;
      if (Date.now() - this.lastHoverAt < 65) return;
      this.lastHoverAt = Date.now();
      const point = canvas.canvasCoordinatesFromClient?.({ x: event.clientX, y: event.clientY });
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
      let nextCheckpoint = null;
      let nextCluster = null;
      for (const candidate of this.clusterHoverGeometry) {
        if (Math.hypot(point.x - candidate.x, point.y - candidate.y) <= candidate.radius) {
          nextCluster = candidate.id;
          break;
        }
      }
      for (const candidate of this.checkpointHoverGeometry) {
        if (Math.hypot(point.x - candidate.x, point.y - candidate.y) <= candidate.radius) {
          nextCheckpoint = candidate.id;
          break;
        }
      }
      let next = null, nextPoint = null;
      for (const candidate of this.hoverGeometry) {
        const hit = nearestRoadPoint(point, candidate.path, candidate.tolerance);
        if (hit) { next = candidate.roadId; nextPoint = hit; break; }
      }
      const moved = nextPoint && (!this.hoveredRoadPoint ||
        Math.hypot(nextPoint.x - this.hoveredRoadPoint.x,
          nextPoint.y - this.hoveredRoadPoint.y) > 12 / (canvas.stage?.scale?.x || 1));
      if (next !== this.hoveredRoadId || moved ||
          nextCheckpoint !== this.hoveredCheckpointId || nextCluster !== this.hoveredClusterId) {
        this.hoveredRoadId = next;
        this.hoveredRoadPoint = nextPoint;
        this.hoveredCheckpointId = nextCheckpoint;
        this.hoveredClusterId = nextCluster;
        this.refresh();
      }
    };
    this.hoverExitHandler = () => {
      if (this.hoveredRoadId !== null || this.hoveredCheckpointId !== null ||
          this.hoveredClusterId !== null) {
        this.hoveredRoadId = null;
        this.hoveredRoadPoint = null;
        this.hoveredCheckpointId = null;
        this.hoveredClusterId = null;
        this.refresh();
      }
    };
    this.shortcutPointerHandler = event => {
      if (event.button !== 0 || !event.shiftKey || event.altKey ||
          event.ctrlKey || event.metaKey || !this.shortcutHandler ||
          this.draft || this.pointEditor.session || this.saving ||
          this.canvasProvider()?.scene?.id !== canvas.scene?.id) return;
      const position = canvas.canvasCoordinatesFromClient?.({
        x: event.clientX, y: event.clientY
      });
      if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
      if (this.clusterHoverGeometry.some(item =>
        Math.hypot(position.x - item.x, position.y - item.y) <= item.radius)) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        this.notify()?.info?.("Zoom in to select an individual Atlas checkpoint.");
        return;
      }
      const atlas = readAtlas(canvas.scene);
      const target = atlasShortcutTarget(atlas, position,
        point => toCanvasPoint(canvas, atlas, point), canvas.stage?.scale?.x ?? 1,
        readRoadCurvePreset());
      if (!target) return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      Promise.resolve().then(() => this.shortcutHandler(canvas.scene, target))
        .catch(error => this.notify()?.error?.(error.message || String(error)));
    };
    this.journalDoubleClickHandler=event=>this.#openAtlasJournalOnDoubleClick(canvas,event,
      this.checkpointHoverGeometry,this.hoverGeometry);
    element.addEventListener("pointermove", this.hoverHandler);
    element.addEventListener("pointerleave", this.hoverExitHandler);
    element.addEventListener("dblclick", this.journalDoubleClickHandler, true);
    if (this.shortcutHandler) element.addEventListener("pointerdown", this.shortcutPointerHandler, true);
  }

  #addLabel(graphics, name, point, textColor, anchorX = 0.5, zoom = 1, opacity = 1) {
    if (!globalThis.PIXI?.Text || !graphics.addChild) return;
    const major = Number.parseInt(PIXI.VERSION ?? "7", 10);
    const color = Number.parseInt(textColor.slice(1), 16);
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const fontSize = Math.max(12, Math.min(22, 16 * Math.sqrt(scale))) / scale;
    const common = { fontFamily: "Arial", fontSize,
      fill: color, align: "center" };
    // Pixi v7 and v8 both accept a positional string; the v8 options-object
    // signature can become '[object Object]' on Foundry's older Text runtime.
    // Use the cross-version text-first form until v14 runtime capability is verified.
    const style = major >= 8
      ? { ...common, stroke: { color: 0x000000, width: 2 / scale } }
      : { ...common, stroke: 0x000000, strokeThickness: 2 / scale };
    const label = new PIXI.Text(String(name), style);
    sharpenText(label, zoom);
    label.anchor?.set?.(anchorX, 0.5);
    label.position?.set?.(point.x, point.y);
    label.eventMode = "none";
    label.alpha = opacity;
    graphics.addChild(label);
    this.labels.push(label);
  }

  #addCheckpointLabels(graphics, checkpointName, roadName, appearance, point, zoom) {
    if (!globalThis.PIXI?.Text || !graphics.addChild) return;
    const major = Number.parseInt(PIXI.VERSION ?? "7", 10);
    const fill = Number.parseInt(appearance.textColor.slice(1), 16);
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const size = checkpointCanvasSize(appearance.size, scale);
    const nameScreenSize = Math.max(12, Math.min(22, 16 * Math.sqrt(scale)));
    const roadScreenSize = Math.max(10, Math.min(18, 12 * Math.sqrt(scale)));
    const textScale = 1 / scale;
    const add = (content, y, fontSize, fontWeight, fontStyle) => {
      const style = { fontFamily: "Arial", fontSize, fontWeight, fontStyle,
        fill, align: "left",
        ...(major >= 8 ? { stroke: { color: 0x000000, width: 2 / scale } }
          : { stroke: 0x000000, strokeThickness: 2 / scale }) };
      const label = new PIXI.Text(String(content), style);
      sharpenText(label, zoom);
      label.anchor?.set?.(0, 0.5);
      label.position?.set?.(point.x + size / 2 + 12 / scale, y);
      label.eventMode = "none";
      graphics.addChild(label);
      this.labels.push(label);
    };
    const secondLine = Boolean(appearance.showRoadName && roadName);
    add(checkpointName, point.y - (secondLine ? 9 * textScale : 0),
      nameScreenSize * textScale, "bold", "normal");
    if (secondLine) add(roadName, point.y + 10 * textScale,
      roadScreenSize * textScale, "normal", "italic");
  }

  #addQuickInfo(graphics, content, point, zoom, { xOffset = 24, yOffset = 8 } = {}) {
    if (!globalThis.PIXI?.Text || !graphics.addChild) return;
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const major = Number.parseInt(PIXI.VERSION ?? "7", 10);
    const style = { fontFamily: "Arial", fontSize: 13 / scale, fill: 0xfff2c8,
      align: "left", lineHeight: 17 / scale,
      ...(major >= 8 ? { stroke: { color: 0x101828, width: 4 / scale } }
        : { stroke: 0x101828, strokeThickness: 4 / scale }) };
    const label = new PIXI.Text(String(content), style);
    sharpenText(label, zoom);
    label.anchor?.set?.(0, 0);
    label.position?.set?.(point.x + xOffset / scale, point.y + yOffset / scale);
    label.eventMode = "none";
    graphics.addChild(label);
    this.labels.push(label);
  }

  #drawCheckpointCluster(graphics, group, zoom) {
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const highlighted = group.members.some(item => item.id === this.selectedCheckpointId);
    const radius = 17 / scale;
    drawDot(graphics, group, highlighted ? 0x8ef6c5 : 0x4d70b5, radius);
    drawDot(graphics, group, 0x1a2545, radius * 0.7);
    if (!globalThis.PIXI?.Text || !graphics.addChild) return;
    const count = new PIXI.Text(group.members.length > 99 ? "99+" :
      String(group.members.length), {
      fontFamily: "Arial", fontSize: (group.members.length > 99 ? 12 : 15) / scale,
      fontWeight: "bold", fill: 0xffffff, align: "center"
    });
    sharpenText(count, zoom);
    count.anchor?.set?.(0.5);
    count.position?.set?.(group.x, group.y);
    count.eventMode = "none";
    graphics.addChild(count);
    this.labels.push(count);
  }

  #fontReady(font) {
    const key = font.family + ":" + font.weight;
    const state = this.fontStatus.get(key);
    if (state) return state === "ready";
    const fontSet = globalThis.document?.fonts;
    if (!fontSet?.load) return true; // No FontFaceSet in deterministic Node mocks.
    this.fontStatus.set(key, "loading");
    const descriptor = font.weight + ' 24px "' + font.family + '"';
    Promise.resolve().then(() => fontSet.load(descriptor)).then(faces => {
      if (!faces?.length) throw new Error("Font Awesome face was not registered");
      this.fontStatus.set(key, "ready");
      this.refresh();
    }).catch(error => {
      this.fontStatus.set(key, "error");
      console.warn("[fvtt-atlas-navigation] Checkpoint icon font unavailable:", error);
    });
    return false;
  }

  #iconTexture(src) {
    if (!src || !globalThis.foundry?.canvas?.loadTexture) return null;
    if (this.textureCache.has(src)) return this.textureCache.get(src);
    this.textureCache.set(src, null);
    Promise.resolve().then(() => foundry.canvas.loadTexture(src)).then(texture => {
      if (!texture) throw new Error("No usable texture returned");
      this.textureCache.set(src, texture);
      this.refresh();
    }).catch(error => {
      // Keep a null cache entry rather than retrying every canvas refresh.
      console.warn("[fvtt-atlas-navigation] Checkpoint icon could not load:", src, error);
    });
    return null;
  }

  #drawCheckpoint(graphics, position, checkpoint, appearance, zoom) {
    const selected = checkpoint.id === this.selectedCheckpointId;
    const color = selected ? 0x8ef6c5 : Number.parseInt(appearance.color.slice(1), 16);
    const marker = checkpointMarkerPosition(position, appearance, zoom);
    const size = appearance.type === "dot"
      ? appearance.size : checkpointCanvasSize(appearance.size, zoom);
    const src = checkpointIconPath(appearance);
    const texture = this.#iconTexture(src);
    const font = appearance.type === "fa" ? checkpointFontIcon(appearance.icon) : null;
    if (appearance.type !== "dot") drawDot(graphics, position, color, 3);
    if (selected) drawDot(graphics, marker, 0x8ef6c5, size / 2 + 4 / zoom);
    if (texture && globalThis.PIXI?.Sprite && graphics.addChild) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor?.set?.(0.5);
      sprite.position?.set?.(marker.x, marker.y);
      sprite.width = size;
      sprite.height = size;
      sprite.eventMode = "none";
      if (appearance.type === "fa") sprite.tint = color;
      // Silhouette outline follows the actual asset shape instead of a circle.
      const outline = Number.parseInt(appearance.borderColor.slice(1),16);
      const shift = 3 / zoom;
      for (const [dx,dy] of [[-shift,0],[shift,0],[0,-shift],[0,shift],
        [-shift,-shift],[shift,-shift],[-shift,shift],[shift,shift]]) {
        const shadow = new PIXI.Sprite(texture);
        shadow.anchor?.set?.(0.5);
        shadow.position?.set?.(marker.x+dx,marker.y+dy);
        shadow.width = size; shadow.height = size;
        shadow.tint = outline; shadow.eventMode = "none";
        graphics.addChild(shadow); this.labels.push(shadow);
      }
      graphics.addChild(sprite);
      this.labels.push(sprite);
    } else if (font && globalThis.PIXI?.Text && graphics.addChild && this.#fontReady(font)) {
      const glyph = new PIXI.Text(font.glyph, {
        fontFamily: font.family, fontWeight: font.weight,
        fontSize: size, fill: color, align: "center",
        ...(Number(PIXI.VERSION?.split(".")[0]) >= 8
          ? { stroke: { fill: Number.parseInt(appearance.borderColor.slice(1),16), width: 3 / zoom } }
          : { stroke: Number.parseInt(appearance.borderColor.slice(1),16),
            strokeThickness: 3 / zoom })
      });
      glyph.anchor?.set?.(0.5);
      glyph.position?.set?.(marker.x, marker.y);
      glyph.eventMode = "none";
      graphics.addChild(glyph);
      this.labels.push(glyph);
    } else {
      const radius = selected ? 10 : 6;
      drawDot(graphics, marker, color, radius);
      drawCheckpointBorder(graphics, marker, radius,
        Number.parseInt(appearance.borderColor.slice(1),16), zoom);
    }
  }

  /** Player projection includes only explicitly revealed road and checkpoint names. */
  #drawPlayerOverlay(canvas, graphics, atlas, zoom) {
    const exploration = readPartyExploration(canvas.scene);
    const fog = readManualFog(canvas.scene);
    const manualFog = fog.enabled;
    const visible = playerAtlasOverlay(atlas, exploration);
    const nodes = new Map(visible.nodes.map(node => [node.id, node]));
    const roads = new Map(visible.roads.map(road => [road.id, road]));
    const worldDefaults = readWorldRoadAppearance();
    const curvature = readRoadCurvePreset();
    const adjacent = roadCurveNeighbors(visible);
    const labelAnchors = new Map();
    const hoverPaths = [];
    const journals = readAtlasJournalLinks(canvas.scene);
    const shownCells = new Set(fog.revealed.map(cellKey));
    const hiddenCells = new Set(fog.hidden.map(cellKey));
    const checkpointCells = manualFog
      ? checkpointRevealKeys(nativeFogCells(canvas),atlas,exploration,
        Number(canvas.scene.grid?.size),
        {x:canvas.dimensions.sceneX,y:canvas.dimensions.sceneY})
      : new Set();
    const explored = manualFog
      ? point => {
        const offset = canvas.grid?.getOffset?.(point);
        if (!offset) return false;
        const center = canvas.grid.getCenterPoint(offset);
        const key = cellKey({x:center.x-canvas.dimensions.sceneX,
          y:center.y-canvas.dimensions.sceneY});
        return (shownCells.has(key)||checkpointCells.has(key)) && !hiddenCells.has(key);
      }
      : point => atlasPointExplored(canvas, point);
    const presets = validateTravelPresets(
      globalThis.game?.settings?.get?.("fvtt-atlas-navigation", TRAVEL_PRESET_SETTING) ??
      defaultTravelPresets()).presets;
    for (const segment of visible.segments) {
      const from = nodes.get(segment.from), to = nodes.get(segment.to);
      if (!from || !to) continue;
      const road = roads.get(segment.roadId);
      if (!road) continue;
      const style = resolveRoadAppearance(road, worldDefaults,
        roadAppearanceMode(road, presets));
      const neighbors = adjacent.get(segment.id);
      const path = smoothRoadPath([from, ...segment.via, to]
        .map(point => toCanvasPoint(canvas, atlas, point)), curvature, {
          before: neighbors?.before ? toCanvasPoint(canvas, atlas, neighbors.before) : null,
          after: neighbors?.after ? toCanvasPoint(canvas, atlas, neighbors.after) : null
        });
      for (const span of (manualFog || (canvas.scene?.tokenVision === true &&
        canvas.scene?.fogExploration !== false) ? exploredRoadSpans(path, explored) : [path])) {
        if (style.borderEnabled) drawLine(graphics, span,
          Number.parseInt(style.borderColor.slice(1),16),
          style.width + 2 / zoom, style.opacity, style.pattern, style.width);
        drawLine(graphics, span, Number.parseInt(style.color.slice(1), 16),
          style.width, style.opacity, style.pattern);
        hoverPaths.push({ roadId: road.id, path: span,
          tolerance: Math.max(style.width + 2, 8 / zoom) });
        if (style.labelVisibility !== "off") {
          const item = labelAnchors.get(road.id) ?? { road, style, paths: [] };
          item.paths.push(span);
          labelAnchors.set(road.id, item);
        }
      }
    }
    const checkpointPositions = visible.checkpoints
      .map(checkpoint => nodes.get(checkpoint.nodeId))
      .filter(Boolean).map(node => toCanvasPoint(canvas, atlas, node));
    for (const [roadId, item] of labelAnchors) {
      if (item.style.labelVisibility === "always" ||
          (item.style.labelVisibility === "hover" && this.playerHoveredRoadId === roadId)) {
        const point = item.style.labelVisibility === "hover" && this.playerHoveredRoadPoint
            ? this.playerHoveredRoadPoint : visibleRoadLabelPoint(canvas, item.paths);
          const opacity = roadLabelOpacityNearCheckpoints(point, checkpointPositions,
              zoom, item.style.labelVisibility);
          if (point && opacity > 0) this.#addLabel(graphics, item.road.name +
            (this.#journalCanView(journalUuidFor(journals,"road",roadId)) ? " 📖" : ""),
            { x: point.x, y: point.y - 18 / zoom }, item.style.textColor, 0.5, zoom, opacity);
      }
    }
    const markers = visible.checkpoints.flatMap(checkpoint => {
      const node = nodes.get(checkpoint.nodeId);
      if (!node) return [];
      const position = toCanvasPoint(canvas, atlas, node);
      if (!explored(position) && checkpoint.discoveryMode === "legacy") return [];
      const appearance = resolveCheckpointAppearance(checkpoint.appearance);
      const marker = checkpointMarkerPosition(position, appearance, zoom);
      return [{ id: checkpoint.id, x: marker.x, y: marker.y,
        checkpoint, position, appearance }];
    });
    const hoverCheckpoints = [];
    for (const group of groupCheckpointMarkers(markers, zoom)) {
      if (group.members.length > 1) this.#drawCheckpointCluster(graphics, group, zoom);
      else {
        const { checkpoint, position, appearance } = group.members[0];
        this.#drawCheckpoint(graphics, position, checkpoint, appearance, zoom);
        hoverCheckpoints.push({ id: checkpoint.id, x: position.x, y: position.y,
          radius: 10 / zoom });
        if (appearance.type !== "dot") hoverCheckpoints.push({
          id: checkpoint.id, x: group.x, y: group.y,
          radius: Math.max(10 / zoom,
            checkpointCanvasSize(appearance.size, zoom) / 2 + 5 / zoom)
        });
        if (appearance.labelMode === "always" ||
            this.playerHoveredCheckpointId === checkpoint.id) {
          const roadName = roads.get(checkpoint.roadId)?.name;
          this.#addCheckpointLabels(graphics, checkpoint.name +
            (this.#journalCanView(journalUuidFor(journals,"checkpoint",checkpoint.id)) ? " 📖" : ""), roadName,
            appearance, group, zoom);
        }
      }
    }
    this.#trackPlayerHover(canvas, hoverPaths, hoverCheckpoints);
  }

  /** Player mouse listeners can only identify items in the filtered projection. */
  #trackPlayerHover(canvas, roads, checkpoints) {
    const element = canvas.app?.canvas ?? canvas.app?.view;
    if (!element?.addEventListener || (!roads.length && !checkpoints.length)) {
      this.#stopPlayerHover();
      return;
    }
    this.playerHoverGeometry = roads;
    this.playerCheckpointHoverGeometry = checkpoints;
    if (this.playerHoverCanvasElement === element) return;
    this.#stopPlayerHover();
    this.playerHoverGeometry = roads;
    this.playerCheckpointHoverGeometry = checkpoints;
    this.playerHoverCanvasElement = element;
    this.playerMoveHandler = event => {
      if (this.canvasProvider()?.scene?.id !== canvas.scene?.id) return;
      if (Date.now() - this.lastHoverAt < 65) return;
      this.lastHoverAt = Date.now();
      const point = canvas.canvasCoordinatesFromClient?.({ x: event.clientX, y: event.clientY });
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
      const checkpoint = this.playerCheckpointHoverGeometry.find(candidate =>
        Math.hypot(point.x - candidate.x, point.y - candidate.y) <= candidate.radius);
      let roadId = null, roadPoint = null;
      if (!checkpoint) {
        for (const candidate of this.playerHoverGeometry) {
          const hit = nearestRoadPoint(point, candidate.path, candidate.tolerance);
          if (hit) { roadId = candidate.roadId; roadPoint = hit; break; }
        }
      }
      const checkpointId = checkpoint?.id ?? null;
      const moved = roadPoint && (!this.playerHoveredRoadPoint ||
        Math.hypot(roadPoint.x - this.playerHoveredRoadPoint.x,
          roadPoint.y - this.playerHoveredRoadPoint.y) > 12 / (canvas.stage?.scale?.x || 1));
      if (roadId !== this.playerHoveredRoadId || moved ||
          checkpointId !== this.playerHoveredCheckpointId) {
        this.playerHoveredRoadId = roadId;
        this.playerHoveredRoadPoint = roadPoint;
        this.playerHoveredCheckpointId = checkpointId;
        this.refresh();
      }
    };
    this.playerExitHandler = () => {
      if (this.playerHoveredRoadId !== null || this.playerHoveredCheckpointId !== null) {
        this.playerHoveredRoadId = null;
        this.playerHoveredRoadPoint = null;
        this.playerHoveredCheckpointId = null;
        this.refresh();
      }
    };
    this.playerJournalDoubleClickHandler=event=>this.#openAtlasJournalOnDoubleClick(canvas,event,
      this.playerCheckpointHoverGeometry,this.playerHoverGeometry);
    element.addEventListener("pointermove", this.playerMoveHandler);
    element.addEventListener("pointerleave", this.playerExitHandler);
    element.addEventListener("dblclick", this.playerJournalDoubleClickHandler, true);
  }

  #stopPlayerHover() {
    this.playerHoverCanvasElement?.removeEventListener?.("pointermove", this.playerMoveHandler);
    this.playerHoverCanvasElement?.removeEventListener?.("pointerleave", this.playerExitHandler);
    this.playerHoverCanvasElement?.removeEventListener?.("dblclick", this.playerJournalDoubleClickHandler, true);
    this.playerHoverCanvasElement = null;
    this.playerMoveHandler = null;
    this.playerExitHandler = null;
    this.playerJournalDoubleClickHandler = null;
    this.playerHoveredRoadId = null;
    this.playerHoveredCheckpointId = null;
    this.playerHoverGeometry = [];
    this.playerCheckpointHoverGeometry = [];
  }

  /** Render only links a player can actually open; never treat Scene metadata as permission. */
  #journalCanView(uuid) {
    if(!uuid)return false;
    if(game.user?.isGM)return true;
    const key=game.user?.id+":"+uuid;
    if(!this.journalAccessCache.has(key)) {
      this.journalAccessCache.set(key,null);
      void canOpenAtlasJournal(uuid).then(allowed=>{
        this.journalAccessCache.set(key,allowed);
        this.refresh();
      }).catch(()=>this.journalAccessCache.set(key,false));
    }
    return this.journalAccessCache.get(key)===true;
  }

  #openAtlasJournalOnDoubleClick(canvas,event,checkpoints,roads) {
    if(event.button!==0||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||
      this.draft||this.pointEditor.session||this.saving||
      this.canvasProvider()?.scene?.id!==canvas.scene?.id)return;
    const point=canvas.canvasCoordinatesFromClient?.({x:event.clientX,y:event.clientY});
    if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;
    const checkpoint=checkpoints.find(item=>
      Math.hypot(point.x-item.x,point.y-item.y)<=item.radius);
    // A checkpoint takes precedence when its marker overlaps a road.
    const road=checkpoint?null:roads.find(item=>
      nearRoadLine(point,item.path,item.tolerance));
    if(!checkpoint&&!road)return;
    let uuid;
    try {
      const links=readAtlasJournalLinks(canvas.scene);
      uuid=checkpoint?journalUuidFor(links,"checkpoint",checkpoint.id):
        journalUuidFor(links,"road",road.roadId);
    } catch { return; }
    if(!uuid)return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    // Foundry checks document permission on open, including first-time clicks.
    void openAtlasJournal(uuid).catch(error=>
      this.notify()?.warn?.(error.message||String(error)));
  }

  #clearPlayerOverlay() {
    this.#stopHover();
    this.#stopPlayerHover();
    this.#clearLabels();
    if (!this.graphics) return;
    this.graphics.parent?.removeChild?.(this.graphics);
    this.graphics.destroy?.();
    this.graphics = null;
    this.graphicsCanvas = null;
  }

  refresh() {
    const canvas = this.canvasProvider();
    if (!canvas?.ready || !canvas.scene || !globalThis.game?.user) return;
    if (!game.user.isGM) {
      let revealed;
      try { revealed = playerAtlasOverlay(readAtlas(canvas.scene),
        readPartyExploration(canvas.scene)); }
      catch (error) {
        console.warn("[fvtt-atlas-navigation] Player overlay unavailable", error);
        this.#clearPlayerOverlay();
        return;
      }
      const atlasMapMode = readManualFog(canvas.scene).enabled;
      if (!revealed.segments.length && !revealed.checkpoints.length && !atlasMapMode) {
        this.#clearPlayerOverlay();
        return;
      }
    }
    if (!this.graphics || this.graphicsCanvas !== canvas || this.graphics.destroyed) {
      if (!globalThis.PIXI?.Graphics || !canvas.interface?.addChild) return;
      this.graphics = new PIXI.Graphics();
      this.graphics.eventMode = "none";
      canvas.interface.addChild(this.graphics);
      this.graphicsCanvas = canvas;
    }
    const g = this.graphics;
    const zoom = Number.isFinite(canvas.stage?.scale?.x) && canvas.stage.scale.x > 0
      ? canvas.stage.scale.x : 1;
    this.lastZoom = zoom;
    this.#clearLabels();
    g.clear();
    let atlas;
    try { atlas = readAtlas(canvas.scene); }
    catch (error) {
      console.warn("[fvtt-atlas-navigation] Unable to draw Scene roads", error);
      return;
    }
    if (!game.user.isGM) {
      this.#stopHover();
      this.#drawPlayerOverlay(canvas, g, atlas, zoom);
      return;
    }
    this.#stopPlayerHover();
    const editing = this.pointEditor.session;
    if (editing && editing.sceneId === canvas.scene.id) {
      atlas = editing.drag?.preview ?? editing.working;
    }
    if (this.regionPreview?.sceneId === canvas.scene.id) {
      const preview = this.regionPreview;
      if (preview.points.length > 1) {
        drawLine(g, preview.points, 0x7bdb9c, preview.radius * 2, 0.38);
      }
      if (typeof g.circle === "function" && typeof g.fill === "function") {
        for (const point of preview.points) g.circle(point.x, point.y, preview.radius)
          .fill({ color: 0x7bdb9c, alpha: 0.22 });
      }
    }
    const nodes = new Map(atlas.nodes.map(n => [n.id, n]));
    const roads = new Map((atlas.roads ?? []).map(r => [r.id, r]));
    const worldDefaults = readWorldRoadAppearance();
    const curvature = readRoadCurvePreset();
    const adjacent = roadCurveNeighbors(atlas);
    const travelPresets = validateTravelPresets(
      globalThis.game?.settings?.get?.("fvtt-atlas-navigation", TRAVEL_PRESET_SETTING) ??
      defaultTravelPresets()).presets;
    const labelAnchors = new Map();
    const hatchHidden = game.settings?.get?.("fvtt-atlas-navigation", "hiddenOverlayHatching") !== false;
    const exploration = readPartyExploration(canvas.scene);
    const gmJournals = readAtlasJournalLinks(canvas.scene);
    this.hoverGeometry = [];
    this.checkpointHoverGeometry = [];
    this.clusterHoverGeometry = [];
    for (const segment of atlas.segments) {
      const from = nodes.get(segment.from);
      const to = nodes.get(segment.to);
      if (!from || !to) continue;
      const neighbors = adjacent.get(segment.id);
      const path = smoothRoadPath([from, ...segment.via, to]
        .map(p => toCanvasPoint(canvas, atlas, p)), curvature, {
          before: neighbors?.before ? toCanvasPoint(canvas, atlas, neighbors.before) : null,
          after: neighbors?.after ? toCanvasPoint(canvas, atlas, neighbors.after) : null
        });
      const highlighted = this.selectedRoadId === (atlas.schemaVersion >= 3 ? segment.roadId : segment.id);
      const road = roads.get(segment.roadId) ?? segment;
      const style = resolveRoadAppearance(road, worldDefaults,
        roadAppearanceMode(road, travelPresets));
      const color = highlighted ? 0xffd166 : Number.parseInt(style.color.slice(1), 16);
      if (style.borderEnabled) drawLine(g, path,
        Number.parseInt(style.borderColor.slice(1),16),
        style.width + 2 / zoom + (highlighted ? 2 : 0),
        highlighted ? 1 : style.opacity, style.pattern, style.width);
      drawLine(g, path, color, style.width + (highlighted ? 2 : 0),
        highlighted ? 1 : style.opacity, style.pattern);
      if (hatchHidden && road.playerVisible !== true) {
        drawLine(g, path, 0x922e43, style.width + 5 / zoom, 0.30, "solid");
        drawHiddenHatching(g, roadHiddenMarks(path, style.width, zoom),
          2 / zoom,contrastingHatch(style.color));
      }
      if (this.focusTarget?.sceneId === canvas.scene.id &&
          this.focusTarget.kind === "road" && this.focusTarget.id === road.id) {
        const alpha=focusPulse(this.focusTarget);
        if (alpha > 0) drawLine(g,path,focusContrast(style.color),
          style.width+7/zoom,alpha,"solid");
      }
      drawDot(g, path[0], color);
      drawDot(g, path.at(-1), color);
      this.hoverGeometry.push({
        roadId: road.id, path, tolerance: Math.max(8, style.width + 4)
      });
      if (style.labelVisibility !== "off") {
        const length = path.slice(1).reduce((sum, p, i) =>
          sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
        // Keep every section of a named road for viewport anchoring, even when
        // a later checkpoint-split section is longer than the earlier one.
        const item = labelAnchors.get(road.id) ??
          { road, style, length: -1, point: null, paths: [] };
        if (length > item.length) {
          item.length = length;
          item.point = roadLabelPoint(path);
        }
        item.paths.push(path);
        labelAnchors.set(road.id, item);
      }
    }
    // One readable label per named road, never per internal topological section.
    const checkpointPositions = (atlas.checkpoints ?? [])
      .map(checkpoint => nodes.get(checkpoint.nodeId))
      .filter(Boolean).map(node => toCanvasPoint(canvas, atlas, node));
    for (const [roadId, item] of labelAnchors) {
      if (item.style.labelVisibility === "always" ||
          (item.style.labelVisibility === "hover" && this.hoveredRoadId === roadId)) {
        const point = item.style.labelVisibility === "hover" && this.hoveredRoadPoint
          ? this.hoveredRoadPoint : visibleRoadLabelPoint(canvas, item.paths) ?? item.point;
        const opacity = roadLabelOpacityNearCheckpoints(point, checkpointPositions,
            zoom, item.style.labelVisibility);
        if (opacity > 0) this.#addLabel(g, item.road.name +
          (journalUuidFor(gmJournals,"road",roadId) ? " 📖" : ""),
          { x: point.x, y: point.y - 18 / zoom }, item.style.textColor, 0.5, zoom, opacity);
      }
    }
    const checkpointMarkers = [];
    for (const checkpoint of atlas.checkpoints ?? []) {
      const point = nodes.get(checkpoint.nodeId);
      if (!point) continue;
      const position = toCanvasPoint(canvas, atlas, point);
      const appearance = resolveCheckpointAppearance(checkpoint.appearance);
      const marker = checkpointMarkerPosition(position, appearance, zoom);
      checkpointMarkers.push({ id: checkpoint.id, x: marker.x, y: marker.y,
        checkpoint, position, appearance });
    }
    const groups = groupCheckpointMarkers(checkpointMarkers,
      editing || this.draft ? Math.max(zoom, 1.5) : zoom);
    for (const group of groups) {
      if (group.members.length > 1) {
        this.#drawCheckpointCluster(g, group, zoom);
        if (hatchHidden && group.members.some(item => exploration.enabled
          ? checkpointKnowledge(exploration, item.checkpoint.id) === "unknown"
          : item.checkpoint.playerVisible !== true)) {
          overlayHiddenCheckpoint(g, { x: group.x, y: group.y },
            17 / zoom, zoom, 0x4d70b5, this.labels);
        }
        this.clusterHoverGeometry.push({ id: group.id, x: group.x, y: group.y,
          radius: 20 / zoom });
        if (this.hoveredClusterId === group.id) {
          this.#addQuickInfo(g, clusterQuickInfo(group.members), group, zoom);
        }
        continue;
      }
      const item = group.members[0];
      const { checkpoint, position, appearance } = item;
      this.#drawCheckpoint(g, position, checkpoint, appearance, zoom);
      const hidden = exploration.enabled
        ? checkpointKnowledge(exploration, checkpoint.id) === "unknown"
        : checkpoint.playerVisible !== true;
      if (hatchHidden && hidden) {
        const marker = checkpointMarkerPosition(position, appearance, zoom);
        const radius = Math.max((appearance.type === "dot" ? appearance.size :
          checkpointCanvasSize(appearance.size, zoom)) / 2 + 2 / zoom, 8 / zoom);
        const texture = this.#iconTexture(checkpointIconPath(appearance));
        const font = appearance.type === "fa" ? checkpointFontIcon(appearance.icon) : null;
        const shape = appearance.type === "dot" ? null :
          texture ? {texture,size:checkpointCanvasSize(appearance.size,zoom)} :
          font && this.#fontReady(font) ? {font,size:checkpointCanvasSize(appearance.size,zoom)} : null;
        overlayHiddenCheckpoint(g, marker, radius, zoom,
          appearance.color, this.labels, shape);
      }
      if (this.focusTarget?.sceneId === canvas.scene.id &&
          this.focusTarget.kind === "checkpoint" && this.focusTarget.id === checkpoint.id) {
        const marker=checkpointMarkerPosition(position,appearance,zoom);
        const radius=Math.max(appearance.type === "dot" ? appearance.size/2 :
          checkpointCanvasSize(appearance.size,zoom)/2,9/zoom)+8/zoom;
        const alpha=focusPulse(this.focusTarget);
        if (alpha>0) {
          const pulse=new PIXI.Graphics();
          pulse.eventMode="none";
          const tint=focusContrast(appearance.color);
          if (pulse.circle && pulse.stroke) pulse.circle(marker.x,marker.y,radius)
            .stroke({color:tint,width:5/zoom,alpha});
          else if (pulse.lineStyle) {
            pulse.lineStyle(5/zoom,tint,alpha);
            pulse.drawCircle(marker.x,marker.y,radius);
          }
          g.addChild(pulse);
          this.labels.push(pulse);
        }
      }
      this.checkpointHoverGeometry.push({ id: checkpoint.id, x: position.x,
        y: position.y, radius: 10 / zoom });
      if (appearance.type !== "dot") this.checkpointHoverGeometry.push({
        id: checkpoint.id, x: group.x, y: group.y,
        radius: Math.max(10 / zoom, checkpointCanvasSize(appearance.size, zoom) / 2 + 5 / zoom)
      });
      const roadName = roads.get(checkpoint.roadId)?.name;
      const hovered = this.hoveredCheckpointId === checkpoint.id;
      if (appearance.labelMode === "always" || (appearance.labelMode === "hover" && hovered)) {
        this.#addCheckpointLabels(g, checkpoint.name +
          (journalUuidFor(gmJournals,"checkpoint",checkpoint.id) ? " 📖" : ""),
          roadName, appearance, group, zoom);
      }
      if (hovered) {
        const full = checkpointQuickInfo(checkpoint, roads.get(checkpoint.roadId)) +
          (journalUuidFor(gmJournals,"checkpoint",checkpoint.id) ? "\n📖 Journal linked" : "");
        const preview = appearance.labelMode === "off" ? full : full.split("\n")
          .filter(line => line.startsWith("Elevation:") ||
            (!appearance.showRoadName && line.startsWith("Road:"))).join("\n");
        if (preview) this.#addQuickInfo(g, preview, group, zoom, {
          xOffset: checkpointCanvasSize(appearance.size, zoom) * zoom / 2 + 12,
          yOffset: appearance.labelMode === "off" ? 13 :
            appearance.showRoadName && roadName ? 27 : 21
        });
      }
    }
    this.#trackHover(canvas);
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
      const previewMode = travelPresets.find(preset =>
        preset.id === draft.options?.presetId)?.mode ?? "land";
      const previewStyle = draft.mode === "new"
        ? resolveRoadAppearance({ appearance: draft.options.appearance },
            worldDefaults, previewMode)
        : null;
      drawLine(g, smoothRoadPath(canvasPoints, curvature),
        previewStyle ? Number.parseInt(previewStyle.color.slice(1), 16) : 0xffd166,
        previewStyle?.width ?? 4, previewStyle?.opacity ?? 0.85,
        previewStyle?.pattern ?? "solid");
      for (const point of canvasPoints) drawDot(g, point, 0xffd166);
    }
    if (editing && editing.sceneId === canvas.scene.id) {
      for (const handle of roadHandles(atlas, editing.roadId)) {
        drawDot(g, toCanvasPoint(canvas, atlas, handle), handle.kind === "node" ? 0xf4b65a : 0xffffff);
      }
    }
  }

  /** Redraw the player overlay as Foundry saves or expands explored fog. */
  onFogRefresh() {
    if (globalThis.game?.user?.isGM || this.fogRefreshTimer !== null) return;
    this.fogRefreshTimer = setTimeout(() => {
      this.fogRefreshTimer = null;
      if (this.canvasProvider()?.ready) this.refresh();
    }, 120);
  }

  /** Foundry v14 canvasPan hook: re-anchor labels while panning or zooming. */
  onCanvasPan(view) {
    if (view !== this.canvasProvider() || !view?.ready || !globalThis.game?.user) return;
    const zoom = view.stage?.scale?.x;
    if (!Number.isFinite(zoom)) return;
    if (this.zoomRefreshTimer !== null) clearTimeout(this.zoomRefreshTimer);
    this.zoomRefreshTimer = setTimeout(() => {
      this.zoomRefreshTimer = null;
      if (view === this.canvasProvider() && view.ready) this.refresh();
    }, 60);
  }

  tearDown() {
    if (this.fogRefreshTimer !== null) clearTimeout(this.fogRefreshTimer);
    this.fogRefreshTimer = null;
    if (this.zoomRefreshTimer !== null) clearTimeout(this.zoomRefreshTimer);
    this.zoomRefreshTimer = null;
    this.lastZoom = null;
    this.#stopHover();
    this.#stopPlayerHover();
    this.#clearLabels();
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
    this.regionPreview = null;
    this.hoveredClusterId = null;
  }
}
