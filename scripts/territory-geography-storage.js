/** Native Region Atlas geography metadata, separate from Shapes and Behaviors. */
import { MODULE_ID, readAtlas } from "./atlas-storage.js";
import { readRegionAtlasLink } from "./region-atlas.js";
import { listGeneratedRegions } from "./region-native-read.js";
import { validateGeographyFlag, validateGeographyHierarchy }
  from "./territory-geography-model.js";

export const GEOGRAPHY_FLAG = "territoryGeography";

export function readRegionGeography(region) {
  return validateGeographyFlag(region?.getFlag?.(MODULE_ID, GEOGRAPHY_FLAG));
}

/** Observes manual native Regions only. Invalid flags are never rewritten on read. */
export function listSceneGeography(scene) {
  const generatedIds = new Set(listGeneratedRegions(scene).map(entry => entry.id));
  return Array.from(scene?.regions?.values?.() ?? []).filter(region =>
    !generatedIds.has(region.id)).map(region => {
    let geography = null, invalid = false, linked = false;
    try { linked = readRegionAtlasLink(region) !== null; }
    catch { invalid = true; }
    try { geography = readRegionGeography(region); }
    catch { invalid = true; }
    return {id:region.id,name:region.name??"Unnamed Region",hidden:region.hidden===true,
      linked,invalid,geography,shapes:region.shapes??[]};
  }).sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Exact-snapshot GM write; does not touch native Region properties. */
export async function saveRegionGeography(scene, regionId, {
  next, expected, expectedName, expectedHidden
}) {
  const user = globalThis.game?.user;
  if (!user?.isGM || !scene?.canUserModify?.(user,"update"))
    throw Error("Only a Scene-authorized GM can edit geographic territory metadata.");
  const region = scene.regions?.get?.(regionId);
  if (!region || region.parent?.id !== scene.id ||
      !region.canUserModify?.(user,"update"))
    throw Error("This native Region is unavailable or not editable. Refresh Atlas.");
  if (!readRegionAtlasLink(region))
    throw Error("Link this native Region to Atlas before classifying its geography.");
  if (typeof expectedName !== "string" || typeof expectedHidden !== "boolean" ||
      expected === undefined)
    throw Error("Reopen the territory geography editor to save safely.");
  const prior = readRegionGeography(region);
  if (JSON.stringify(prior) !== JSON.stringify(validateGeographyFlag(expected)) ||
      region.name !== expectedName || (region.hidden===true) !== expectedHidden)
    throw Error("This Region changed since you opened it. Review and retry.");
  const target = validateGeographyFlag(next);
  const entries = listSceneGeography(scene);
  const lookup = new Map(entries.map(entry => [entry.id, entry]));
  const current = lookup.get(regionId);
  if (!current || !current.linked || current.invalid)
    throw Error("The native Region association changed. Refresh Atlas.");
  lookup.set(regionId,{...current,geography:target});
  validateGeographyHierarchy(regionId, target, lookup);
  // A parent cannot be removed/retyped while children still depend on it.
  // Validate direct children against the proposed state, not the stale flags.
  for (const child of entries.filter(entry => entry.geography?.parentRegionId===regionId))
    validateGeographyHierarchy(child.id,child.geography,lookup);
  if (target) {
    const validRoadIds = new Set(readAtlas(scene).roads?.map(road=>road.id) ?? []);
    for (const id of Object.keys(target.roadOverrides)) {
      if (!validRoadIds.has(id) && !Object.hasOwn(prior?.roadOverrides ?? {}, id))
        throw Error("Road membership references an unknown Road. Refresh the editor.");
    }
  }
  if (JSON.stringify(prior) === JSON.stringify(target)) return false;
  if (target) await region.setFlag(MODULE_ID,GEOGRAPHY_FLAG,target);
  else await region.unsetFlag(MODULE_ID,GEOGRAPHY_FLAG);
  return true;
}
