/** Atlas manual exploration v3. No token movement, native fog, or road dependency. */
export const MANUAL_FOG_FLAG = "manualFog";
export const MANUAL_FOG_SCHEMA = 1;
export const MAX_MANUAL_CELLS = 40000;
export const defaultManualFog = () => ({ schemaVersion: MANUAL_FOG_SCHEMA, enabled: false, revealed: [], hidden: [] });
const validPoint = p => p && typeof p === "object" && !Array.isArray(p) &&
  Object.keys(p).length === 2 && Number.isFinite(p.x) && Number.isFinite(p.y) &&
  Math.abs(p.x) <= 1e7 && Math.abs(p.y) <= 1e7;
export const cellKey = p => p.x + "," + p.y;
export function validateManualFog(input) {
  if (input == null) return defaultManualFog();
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(k => !["schemaVersion","enabled","revealed","hidden"].includes(k)) ||
      input.schemaVersion !== MANUAL_FOG_SCHEMA || typeof input.enabled !== "boolean" ||
      !Array.isArray(input.revealed) || !Array.isArray(input.hidden) ||
      input.revealed.length + input.hidden.length > MAX_MANUAL_CELLS) {
    throw new Error("Invalid Atlas manual exploration state.");
  }
  const seen = new Set();
  const normalize = array => array.map(p => {
    if (!validPoint(p) || seen.has(cellKey(p))) throw new Error("Invalid or duplicate Atlas exploration cell.");
    seen.add(cellKey(p));
    return {x:p.x,y:p.y};
  });
  return {schemaVersion:1,enabled:input.enabled,revealed:normalize(input.revealed),hidden:normalize(input.hidden)};
}
/** Reveal, Hide, Clear are exact reversible overrides. Clear deletes the override. */
export function paintManualFog(state, cells, mode) {
  const fog = validateManualFog(state);
  if (!["reveal","hide","clear"].includes(mode) || !Array.isArray(cells) ||
      cells.length > MAX_MANUAL_CELLS || cells.some(p => !validPoint(p))) {
    throw new Error("Invalid Atlas exploration brush stroke.");
  }
  const revealed = new Map(fog.revealed.map(p => [cellKey(p),p]));
  const hidden = new Map(fog.hidden.map(p => [cellKey(p),p]));
  for (const p of cells) {
    const key=cellKey(p);
    revealed.delete(key); hidden.delete(key);
    if (mode==="reveal") revealed.set(key,{x:p.x,y:p.y});
    if (mode==="hide") hidden.set(key,{x:p.x,y:p.y});
  }
  return validateManualFog({...fog,revealed:[...revealed.values()],hidden:[...hidden.values()]});
}
export function manualCellVisible(state, cell) {
  const fog=validateManualFog(state);
  const key=cellKey(cell);
  return fog.revealed.some(p=>cellKey(p)===key) &&
    !fog.hidden.some(p=>cellKey(p)===key);
}
