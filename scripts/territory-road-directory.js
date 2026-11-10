/** Foundry read adapter for the GM-only geographic Road directory. */
import { listSceneGeography } from "./territory-geography-storage.js";
import { regionContainsPoint } from "./navigation-terrain.js";
import { sampleAtlasRoads,buildTerritoryRoadDirectory } from "./territory-geography-model.js";
import {withInferredContinentParents} from "./territory-parent-inference.js";

export function readTerritoryRoadDirectory(scene, atlas, view=globalThis.canvas) {
  const classified = withInferredContinentParents(scene,listSceneGeography(scene),
    {log:false}).filter(entry =>entry.linked && entry.geography && !entry.invalid);
  const dimensions=view?.dimensions;
  const active=Boolean(view?.ready && view.scene?.id===scene.id &&
    Number.isFinite(dimensions?.sceneX) && Number.isFinite(dimensions?.sceneY) &&
    Number.isFinite(dimensions?.size) && dimensions.size>0);
  const origin = atlas.schemaVersion>=2 && active ?
    {x:dimensions.sceneX,y:dimensions.sceneY}:{x:0,y:0};
  const sampled=active ? sampleAtlasRoads(atlas,{origin,
    step:Math.max(8,dimensions.size/4)}) :
    {samples:new Map(),truncated:new Set()};
  const directory=buildTerritoryRoadDirectory({territories:classified,
    roads:atlas.roads??[],roadSamples:sampled.samples,
    contains:(territory,point)=>{
      const region=scene.regions?.get?.(territory.id);
      // v14's native geometry understands grid, polygon and ellipse Shapes.
      // Do not silently treat an unsupported native Shape as empty geography.
      if(typeof region?.testPoint==="function")return region.testPoint(point);
      return regionContainsPoint(territory.shapes,point);
    },
    geometryAvailable:active});
  return {...directory,geometryAvailable:active,
    truncatedRoadIds:[...sampled.truncated],classifiedCount:classified.length};
}
