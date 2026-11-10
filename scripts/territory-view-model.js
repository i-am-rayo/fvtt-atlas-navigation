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

/** Pure directory hierarchy. Geography's explicit or inferred parent is the
 * only grouping input; native Region documents and ordering are never edited.
 * Invalid/missing/cyclic parents remain accessible under Uncategorized. */
export function groupTerritoryEntries(entries) {
  const byId=new Map(entries.map(entry=>[entry.id,{entry,children:[]}]));
  const roots=[],uncategorized=[];
  const sort=(a,b)=>String(a.entry.name??"").localeCompare(String(b.entry.name??""))||
    String(a.entry.id).localeCompare(String(b.entry.id));
  const invalidParent=entry=>{
    const seen=new Set([entry.id]);
    let parent=entry.geography?.parentRegionId;
    if(!parent)return true;
    while(parent){
      if(seen.has(parent)||!byId.has(parent))return true;
      seen.add(parent);parent=byId.get(parent).entry.geography?.parentRegionId;
    }
    return false;
  };
  for(const item of byId.values()){
    const entry=item.entry,parent=entry.geography?.parentRegionId;
    if(entry.geography?.kind==="continent")roots.push(item);
    else if(parent&&!invalidParent(entry))byId.get(parent).children.push(item);
    else uncategorized.push(item);
  }
  const sortTree=nodes=>{nodes.sort(sort);for(const node of nodes)sortTree(node.children);};
  sortTree(roots);sortTree(uncategorized);
  return {continents:roots,uncategorized};
}
