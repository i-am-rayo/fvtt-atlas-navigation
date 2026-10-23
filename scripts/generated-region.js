/**
 * Foundry v14 adapter: opt-in native Region creation and conservative
 * regeneration. Never mutates road flags or existing Region Behaviors.
 */
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { sceneImageOrigin } from "./road-coordinates.js";
import { buildGeneratedRegionPlan, GENERATED_REGION_FLAG, shapeSignature,
  validateGeneratedRegionFlag } from "./generated-region-model.js";

function checkScene(scene) {
  const user = globalThis.game?.user;
  if (!user?.isGM || !scene?.canUserModify?.(user, "update")) {
    throw new Error("Only a GM with Scene editing access can generate native Regions.");
  }
  const view = globalThis.canvas;
  if (!view?.ready || view.scene?.id !== scene.id) {
    throw new Error("Open the chosen Scene on the canvas before generating Regions.");
  }
  if (!Number.isFinite(scene?.grid?.size) || !(scene.grid.size > 0)) {
    throw new Error("This Scene has no valid grid pixel size for Region width.");
  }
  return view;
}

export function planSceneGeneratedRegion(scene, settings) {
  const view = checkScene(scene);
  return buildGeneratedRegionPlan(readAtlas(scene), {
    ...settings, gridSize: scene.grid.size,
    origin: sceneImageOrigin(view)
  });
}

export function listGeneratedRegions(scene) {
  return Array.from(scene?.regions?.values?.() ?? [], region => {
    let metadata = null, invalid = false;
    try { metadata = validateGeneratedRegionFlag(region.getFlag(MODULE_ID, GENERATED_REGION_FLAG)); }
    catch { invalid = true; }
    return { id: region.id, name: region.name, metadata, invalid,
      modified: !!metadata && shapeSignature(region.shapes ?? []) !== metadata.shapeSignature };
  }).filter(region => region.metadata || region.invalid);
}

function matchingRegion(scene, flag) {
  const matching = listGeneratedRegions(scene);
  if (matching.some(r => r.invalid)) {
    throw new Error("A native Region contains unsupported generated-Region metadata. Resolve it before generating more.");
  }
  return matching.filter(r => r.metadata.roadId === flag.roadId &&
    r.metadata.kind === flag.kind &&
    r.metadata.checkpointIds.join("|") === flag.checkpointIds.join("|"));
}

/** Called only after an explicit preview/confirmation in the GM UI. */
export async function saveGeneratedNativeRegion(scene, plan, { regenerate = false } = {}) {
  checkScene(scene);
  // Rebuild against current image origin, grid and graph to reject stale dialogs.
  const checkpointId = plan.startCheckpointId;
  const endCheckpointId = plan.endCheckpointId;
  const fresh = planSceneGeneratedRegion(scene, {
    kind: plan.kind, roadId: plan.roadId, checkpointId, endCheckpointId,
    widthCells: plan.generatedRegion.widthCells
  });
  if (fresh.expectedRevision !== plan.expectedRevision ||
      fresh.generatedRegion.shapeSignature !== plan.generatedRegion.shapeSignature) {
    throw new Error("Road, grid or Scene padding changed since preview. Reopen the generator.");
  }
  const matches = matchingRegion(scene, plan.generatedRegion);
  if (matches.length > 1) {
    throw new Error("Multiple generated native Regions already represent this checkpoint interval. Resolve duplicates manually.");
  }
  if (regenerate) {
    if (!matches.length) throw new Error("No generated native Region exists to regenerate.");
    const entry = matches[0];
    if (entry.modified) {
      throw new Error("This native Region's geometry was edited by the GM. Regeneration is blocked to preserve it.");
    }
    const region = scene.regions?.get(entry.id);
    if (!region?.canUserModify?.(game.user, "update")) {
      throw new Error("You cannot update that native Region.");
    }
    // Only shapes and module-owned generation metadata are touched.
    // Preserve the GM's native name, Levels, visibility and Behaviors.
    await region.update({
      shapes: fresh.shapes,
      ["flags." + MODULE_ID + "." + GENERATED_REGION_FLAG]: fresh.generatedRegion
    });
    return { id: region.id, created: false };
  }
  if (matches.length) {
    throw new Error("A generated Region already exists for this checkpoint or corridor. Choose Regenerate to update unchanged geometry.");
  }
  const [created] = await scene.createEmbeddedDocuments("Region", [{
    name: fresh.name,
    shapes: fresh.shapes,
    behaviors: [],
    flags: {
      [MODULE_ID]: {
        atlas: { schemaVersion: 1, linked: true },
        [GENERATED_REGION_FLAG]: fresh.generatedRegion
      }
    }
  }]);
  if (!created) throw new Error("Foundry did not create the native Region.");
  return { id: created.id, created: true };
}
