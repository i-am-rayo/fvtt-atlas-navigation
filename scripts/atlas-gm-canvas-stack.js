/**
 * Atlas-owned GM presentation order in Foundry's InterfaceCanvasGroup.
 *
 * Each feature mounts its disposable graphics in one stable slot, so a later
 * Road refresh cannot paint over a Territory name and a later Territory sync
 * cannot paint over hovered Checkpoint details. This never runs for players:
 * player Territory geometry belongs in Primary, below native/Atlas Fog.
 */
const stacks = new WeakMap();
const SLOT_ORDER = ["terrain", "roads", "territoryNames", "roadLabels", "hover"];

export function getGmAtlasCanvasLayers(view) {
  const parent = view?.interface;
  const Container = globalThis.PIXI?.Container;
  if (globalThis.game?.user?.isGM !== true || !view?.ready ||
      !parent?.addChild || typeof Container !== "function") return null;
  const prior = stacks.get(parent);
  if (prior?.root?.parent === parent && !prior.root.destroyed)
    return prior.slots;

  const root = new Container();
  root.name = "Atlas GM presentation";
  root.eventMode = "none";
  const slots = {};
  for (const name of SLOT_ORDER) {
    const layer = new Container();
    layer.name = `Atlas ${name}`;
    layer.eventMode = "none";
    root.addChild(layer);
    slots[name] = layer;
  }
  parent.addChild(root);
  stacks.set(parent, {root, slots});
  return slots;
}

/** Release the shared root only after every Atlas renderer has unmounted. */
export function clearUnusedGmAtlasCanvasLayers(view) {
  const parent = view?.interface;
  const entry = parent && stacks.get(parent);
  if (!entry) return;
  if (entry.root.parent !== parent) { stacks.delete(parent); return; }
  if (Object.values(entry.slots).some(layer => layer.children?.length)) return;
  parent.removeChild?.(entry.root);
  entry.root.destroy?.({children: true});
  stacks.delete(parent);
}
