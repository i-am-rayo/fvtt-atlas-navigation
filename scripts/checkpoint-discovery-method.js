import { MODULE_ID } from "./atlas-storage.js";

export const CHECKPOINT_METHOD_FLAG = "checkpointDiscoveryMethods";
export const CHECKPOINT_DISCOVERY_METHODS = Object.freeze(["automatic", "gm", "lore"]);

/** Missing records and old Scenes default to the established proximity behavior. */
export function validateCheckpointDiscoveryMethods(value) {
  if (value == null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length > 20000) {
    throw new Error("Invalid Atlas checkpoint discovery methods.");
  }
  const entries = Object.entries(value);
  if (entries.some(([id, method]) =>
    !id || id.length > 160 || !CHECKPOINT_DISCOVERY_METHODS.includes(method))) {
    throw new Error("Invalid Atlas checkpoint discovery method.");
  }
  return Object.fromEntries(entries);
}
export function readCheckpointDiscoveryMethods(scene) {
  return validateCheckpointDiscoveryMethods(scene?.getFlag?.(MODULE_ID, CHECKPOINT_METHOD_FLAG));
}
export function checkpointDiscoveryMethod(methods, checkpointId) {
  return validateCheckpointDiscoveryMethods(methods)[checkpointId] ?? "automatic";
}
export function withCheckpointDiscoveryMethod(methods, checkpointId, method) {
  if (typeof checkpointId !== "string" || !checkpointId || checkpointId.length > 160 ||
      !CHECKPOINT_DISCOVERY_METHODS.includes(method)) {
    throw new Error("Invalid checkpoint discovery method.");
  }
  const next = { ...validateCheckpointDiscoveryMethods(methods) };
  // A missing key explicitly means Automatic; avoid filling every legacy Scene.
  if (method === "automatic") delete next[checkpointId];
  else next[checkpointId] = method;
  return validateCheckpointDiscoveryMethods(next);
}
