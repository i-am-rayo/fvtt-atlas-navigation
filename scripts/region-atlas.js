/**
 * Atlas ↔ native Foundry RegionDocument association (Phase 2d).
 *
 * Region shapes, visibility, elevation and Behaviors remain native Foundry
 * data. Atlas owns only the optional versioned association flag.
 */
import { MODULE_ID } from "./atlas-storage.js";

export const REGION_ATLAS_FLAG = "atlas";
export const REGION_ATLAS_SCHEMA_VERSION = 1;

export function validateRegionAtlasLink(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value) ||
      value.schemaVersion !== REGION_ATLAS_SCHEMA_VERSION ||
      value.linked !== true ||
      Object.keys(value).some(key => !["schemaVersion", "linked"].includes(key))) {
    throw new Error("Unsupported Atlas Region association. Nothing was changed; inspect the Region flag before editing.");
  }
  return { schemaVersion: REGION_ATLAS_SCHEMA_VERSION, linked: true };
}

export function readRegionAtlasLink(region) {
  return validateRegionAtlasLink(region.getFlag(MODULE_ID, REGION_ATLAS_FLAG));
}

/** Native Behavior objects are inspected, never copied to Atlas flags. */
export function summarizeRegionBehaviors(region) {
  return Array.from(region.behaviors ?? [], behavior => ({
    id: behavior.id,
    name: behavior.name || behavior.type || "Unnamed Behavior",
    type: behavior.type || "",
    active: behavior.active === true
  }));
}

export function listSceneRegions(scene) {
  const regions = Array.from(scene?.regions ?? [], region => {
    let linked = false;
    let invalidLink = false;
    try { linked = readRegionAtlasLink(region) !== null; }
    catch { invalidLink = true; }
    return {
      id: region.id,
      name: region.name || "Unnamed Region",
      hidden: region.hidden === true,
      linked,
      invalidLink,
      behaviors: summarizeRegionBehaviors(region)
    };
  });
  return regions.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function editableRegion(scene, regionId) {
  const user = globalThis.game?.user;
  if (!user?.isGM || !scene?.canUserModify?.(user, "update")) {
    throw new Error("Only a GM with Scene editing permission can change Atlas Region links.");
  }
  if (typeof regionId !== "string" || !regionId) {
    throw new Error("Select a valid Region.");
  }
  const region = scene.regions?.get(regionId);
  if (!region || region.parent?.id !== scene.id) {
    throw new Error("That Region no longer belongs to this Scene. Refresh the Atlas list.");
  }
  if (!region.canUserModify?.(user, "update")) {
    throw new Error("You do not have permission to edit that Region.");
  }
  return region;
}

/** Link a Region without changing geometry, Behaviors, or Scene road flags. */
export async function linkAtlasRegion(scene, regionId) {
  const region = editableRegion(scene, regionId);
  const current = readRegionAtlasLink(region); // Unknown/newer flags are never overwritten.
  if (current) throw new Error("This Region is already linked to Atlas.");
  await region.setFlag(MODULE_ID, REGION_ATLAS_FLAG, {
    schemaVersion: REGION_ATLAS_SCHEMA_VERSION,
    linked: true
  });
}

/** Unlink is not deletion. Native movement Behaviors remain operational. */
export async function unlinkAtlasRegion(scene, regionId) {
  const region = editableRegion(scene, regionId);
  const current = readRegionAtlasLink(region);
  if (!current) throw new Error("This Region is no longer linked to Atlas.");
  await region.unsetFlag(MODULE_ID, REGION_ATLAS_FLAG);
}
