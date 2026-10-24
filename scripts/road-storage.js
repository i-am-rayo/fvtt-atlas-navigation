import { addRoadCheckpoint, editRoadCheckpoint, removeRoadCheckpoint,
  editCheckpointAppearance } from "./checkpoint-model.js";
import { addRoad, removeRoad, renameRoad, reshapeRoad, mergeRoadGroups, applyRoadGeometryEdit } from "./road-model.js";
import { anchorLegacyAtlas, upgradeAtlasRoadGroups, upgradeAtlasTravelPresets,
  upgradeAtlasRoadTextAppearance, validateAtlas } from "./atlas-model.js";
import { validateRoadAppearance } from "./road-appearance.js";
import { TRAVEL_PRESET_SETTING, validateTravelPresets, validateTravelPresetId } from "./travel-preset-model.js";
import { ATLAS_FLAG, MODULE_ID, readAtlas } from "./atlas-storage.js";

/**
 * Scene flag writes are revision-checked, but not atomic compare-and-swap.
 * Only one GM editing a given Scene at a time is supported at this stage.
 */
async function saveChange(scene, expectedRevision, update) {
  if (!globalThis.game?.user?.isGM || !scene?.canUserModify?.(game.user, "update")) {
    throw new Error("Only a GM with Scene update permission may edit roads.");
  }
  const previous = readAtlas(scene);
  if (previous.revision !== expectedRevision) {
    throw new Error("The atlas changed since you started editing. Reopen the Scene Atlas tab and try again.");
  }
  if (previous.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Atlas revision exceeded the safe limit.");
  }
  const updated = update(previous);
  const next = validateAtlas({ ...updated, revision: previous.revision + 1 });
  await scene.setFlag(MODULE_ID, ATLAS_FLAG, next);
  return next;
}

export function saveNewRoad(scene, { points, name, expectedRevision, idFactory, snapEndpoints,
  presetId = null, appearance = null }) {
  const style = appearance === null ? null : validateRoadAppearance(appearance);
  if (presetId !== null) {
    validateTravelPresetId(presetId);
    const settings = validateTravelPresets(
      game.settings.get(MODULE_ID, TRAVEL_PRESET_SETTING));
    if (!settings.presets.some(preset => preset.id === presetId)) {
      throw new Error("Choose an existing world travel preset for the new road.");
    }
  }
  return saveChange(scene, expectedRevision, previous => {
    if (previous.schemaVersion === 1 && (previous.nodes.length || previous.segments.length)) {
      throw new Error("Anchor legacy roads before adding new ones.");
    }
    const local = previous.schemaVersion === 1 && !previous.nodes.length && !previous.segments.length
      ? anchorLegacyAtlas(previous, { x: 0, y: 0 }) : previous;
    const modern = local.schemaVersion === 2 && !local.nodes.length && !local.segments.length
      ? upgradeAtlasRoadGroups(local) : local;
    const created = addRoad(modern, { points, name, idFactory, snapEndpoints });
    if (presetId === null && style === null) return created;
    const upgraded = style !== null
      ? upgradeAtlasRoadTextAppearance(created)
      : upgradeAtlasTravelPresets(created);
    const newId = upgraded.roads.at(-1)?.id;
    return { ...upgraded, roads: upgraded.roads.map(road => road.id === newId
      ? { ...road,
        ...(presetId !== null ? { travelPresetId: presetId } : {}),
        ...(style !== null ? { appearance: style } : {}) }
      : road) };
  });
}

export function saveReshapedRoad(scene, { segmentId, via, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    reshapeRoad(previous, { segmentId, via }));
}

export function saveRenamedRoad(scene, { roadId, segmentId, name, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    renameRoad(previous, { roadId, segmentId, name }));
}

export function saveRemovedRoad(scene, { roadId, segmentId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    removeRoad(previous, { roadId, segmentId }));
}

/**
 * Migrate only with a GM-confirmed current canvas origin while roads are
 * aligned to the background image. Never guess the original padding.
 */
export function saveAnchoredLegacyRoads(scene, { origin, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    anchorLegacyAtlas(previous, origin));
}

/** Explicit, lossless organizational migration; does not merge same-name roads. */
export function saveOrganizedRoads(scene, { expectedRevision }) {
  return saveChange(scene, expectedRevision, previous => upgradeAtlasRoadGroups(previous));
}

export function saveMergedRoads(scene, { keepRoadId, mergeRoadId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    mergeRoadGroups(previous, { keepRoadId, mergeRoadId }));
}

/** Apply only a reviewed sequence of geometry operations to one road. */
export function savePointEdits(scene, { roadId, operations, expectedRevision }) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 5000) {
    throw new Error("No valid point edits to save.");
  }
  return saveChange(scene, expectedRevision, previous =>
    operations.reduce((atlas, operation) =>
      applyRoadGeometryEdit(atlas, { roadId, operation }), previous));
}

/** One atomic versioned Scene flag write can add a checkpoint AND split an edge. */
export function saveNewCheckpoint(scene, { roadId, candidate, name, elevationMeters, expectedRevision, idFactory }) {
  return saveChange(scene, expectedRevision, previous =>
    addRoadCheckpoint(previous, { roadId, candidate, name, elevationMeters, idFactory }));
}

export function saveEditedCheckpoint(scene, { checkpointId, name, elevationMeters, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    editRoadCheckpoint(previous, { checkpointId, name, elevationMeters }));
}

export function saveCheckpointAppearance(scene, { checkpointId, appearance, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    editCheckpointAppearance(previous, { checkpointId, appearance }));
}

export function saveRemovedCheckpoint(scene, { checkpointId, expectedRevision }) {
  return saveChange(scene, expectedRevision, previous =>
    removeRoadCheckpoint(previous, { checkpointId }));
}

/**
 * First assignment explicitly upgrades a v3/v4 atlas to v5. Preset IDs are
 * stable world references; deleting/renaming a preset never rewrites roads.
 */
export async function saveRoadTravelPreset(scene, { roadId, presetId = null, expectedRevision }) {
  if (presetId !== null) {
    validateTravelPresetId(presetId);
    const settings = validateTravelPresets(
      game.settings.get(MODULE_ID, TRAVEL_PRESET_SETTING));
    if (!settings.presets.some(p => p.id === presetId)) {
      throw new Error("Choose an existing world travel preset.");
    }
  }
  return saveChange(scene, expectedRevision, previous => {
    const current = upgradeAtlasTravelPresets(previous);
    if (!current.roads.some(road => road.id === roadId)) {
      throw new Error("The named road no longer exists.");
    }
    return {
      ...current,
      roads: current.roads.map(road => road.id === roadId
        ? { ...road, travelPresetId: presetId } : road)
    };
  });
}

/** Only this single GM request may migrate the Scene flag to v6. */
export function saveRoadAppearance(scene, { roadId, appearance, expectedRevision }) {
  const value = appearance === null ? null : validateRoadAppearance(appearance);
  return saveChange(scene, expectedRevision, previous => {
    if (!previous.roads?.some(road => road.id === roadId)) {
      throw new Error("The named road no longer exists.");
    }
    // A reset on an older Scene is already a no-op; preserve its schema.
    if (value === null && previous.schemaVersion < 6) return previous;
    const current = upgradeAtlasRoadTextAppearance(previous);
    return { ...current, roads: current.roads.map(road =>
      road.id === roadId ? { ...road, appearance: value } : road) };
  });
}
