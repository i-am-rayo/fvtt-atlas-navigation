/**
 * Read-only Scene fog flag boundaries. The readers contain no canvas lifecycle,
 * GM permissions, migrations, or writes; all rendering and editing stay in
 * their existing controllers. Kept separate to avoid cyclical storage imports.
 */
import { MODULE_ID } from "./atlas-storage.js";
import { MANUAL_FOG_FLAG, validateManualFog } from "./atlas-manual-fog-model.js";
import { ATLAS_MAP_FOG_FLAG, validateAtlasMapFog } from "./atlas-map-fog-model.js";

export function readManualFog(scene) {
  if(!scene?.getFlag)throw new Error("Select an Atlas Scene.");
  const saved = scene.getFlag(MODULE_ID,MANUAL_FOG_FLAG);
  if (saved == null && scene.getFlag(MODULE_ID,"mapFog")?.enabled === true) {
    // Preserve historical protection when opening legacy experimental fog:
    // the Scene must not become completely visible before an explicit import.
    return {...validateManualFog(null),enabled:true};
  }
  return validateManualFog(saved);
}

export function readAtlasMapFog(scene) {
  if (!scene?.getFlag) throw new Error("Select an Atlas Scene.");
  return validateAtlasMapFog(scene.getFlag(MODULE_ID, ATLAS_MAP_FOG_FLAG));
}
