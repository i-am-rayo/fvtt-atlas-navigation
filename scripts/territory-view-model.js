/** Pure, read-only Territory directory and map-projection policy. */
export const TERRITORY_VIEW_MODES = Object.freeze({
  combined: "Combined", continents: "Continents", settlements: "Settlements"
});

const SETTLEMENTS = new Set(["city", "town", "village"]);
const BROAD = new Set(["continent", "area"]);

export function territoryTier(entry) {
  if (!entry?.linked || entry.invalid) return "unclassified";
  const kind = entry.geography?.kind;
  return SETTLEMENTS.has(kind) ? "settlement" :
    BROAD.has(kind) ? "continent" : "unclassified";
}

/**
 * Region management keeps every entry available in Combined view, even if it
 * is native-only or has unsupported Atlas metadata. Map projections omit
 * unclassified entries because Atlas has no trustworthy tier for them.
 * `drawOrder` puts parent geography under settlements without modifying native
 * Shapes, their stacking in Foundry, or their gameplay Behaviors.
 */
export function projectTerritoryView(entries, mode = "combined", {
  drawOrder = false
} = {}) {
  if (!Object.hasOwn(TERRITORY_VIEW_MODES, mode))
    throw Error("Unknown Atlas Territory view; select a supported geographic tier.");
  const rank = drawOrder ? {continent: 0, settlement: 1, unclassified: 2} :
    {settlement: 0, continent: 1, unclassified: 2};
  return entries.filter(entry => {
    const tier = territoryTier(entry);
    return mode === "combined" || (mode === "continents" && tier === "continent") ||
      (mode === "settlements" && tier === "settlement");
  }).sort((a, b) => rank[territoryTier(a)] - rank[territoryTier(b)] ||
    String(a.name ?? "").localeCompare(String(b.name ?? "")) ||
    String(a.id ?? "").localeCompare(String(b.id ?? "")));
}
