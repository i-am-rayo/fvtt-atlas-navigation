/** Read-only context titles for Atlas editors. Names come from current documents
 * or staged drafts; computing a title never changes Scene/Region metadata. */
export function atlasSettingsTitle(kind,name,{creating=false}={}){
  const type=String(kind??"").trim().replace(/\s+/gu," ")||"Object";
  const label=creating?`New ${type}`:
    (typeof name==="string"?name.replace(/[\u0000-\u001f\u007f]/gu," ")
      .trim().replace(/\s+/gu," ").slice(0,160):"")||`Unnamed ${type}`;
  return `Atlas — ${label} — ${type} Settings`;
}

/** Foundry v14's RegionConfig exposes a read-only title accessor. A narrowly
 * scoped subclass changes its presentation only, retaining the native sheet,
 * native form logic and all original RegionDocument update boundaries. */
export function atlasTerrainRegionSheetClass(RegionConfig){
  return class AtlasTerrainRegionConfig extends RegionConfig{
    get title(){
      return atlasSettingsTitle("Terrain Region",this.document?.name);
    }
  };
}
