/** Pure, versioned GM presentation preferences. Never authoritative Scene data. */
export const ATLAS_LAYERS_SETTING = "atlasLayerPreferences";
export const ATLAS_LAYERS_VERSION = 1;
export const ROAD_LAYER_MODES = Object.freeze({
  roads:"Road View", terrain:"Terrain View", corridors:"Corridor View"
});
export const REGION_LAYER_MODES = Object.freeze({
  off:"Hidden", continents:"Continents", settlements:"Settlements", combined:"All Regions"
});

export const DEFAULT_ATLAS_LAYERS = Object.freeze({
  schemaVersion:ATLAS_LAYERS_VERSION,
  roadMode:"roads",regionMode:"off",showRegionNames:false,
  continentFillOpacity:.22,settlementFillOpacity:.12
});

export function validateAtlasLayers(value) {
  if (value === null || value === undefined) return {...DEFAULT_ATLAS_LAYERS};
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.schemaVersion !== ATLAS_LAYERS_VERSION ||
      Object.keys(value).some(key=>!Object.hasOwn(DEFAULT_ATLAS_LAYERS,key)) ||
      !Object.hasOwn(ROAD_LAYER_MODES,value.roadMode) ||
      !Object.hasOwn(REGION_LAYER_MODES,value.regionMode) ||
      typeof value.showRegionNames!=="boolean" ||
      ![value.continentFillOpacity,value.settlementFillOpacity].every(n=>
        typeof n==="number" && Number.isFinite(n) && n>=0 && n<=.5))
    throw Error("Unknown Atlas Layers preference version. Display settings were not changed.");
  return {...value};
}

export function updateAtlasLayers(current,change) {
  if (!change || typeof change!=="object" || Array.isArray(change) ||
      Object.keys(change).some(k=>!Object.hasOwn(DEFAULT_ATLAS_LAYERS,k) ||
        k==="schemaVersion"))
    throw Error("Invalid Atlas Layers display change.");
  return validateAtlasLayers({...validateAtlasLayers(current),...change});
}
