import test from "node:test";
import assert from "node:assert/strict";
import { sceneRoadSurfaces, roadSurfaceSpans } from "../scripts/road-surface-overlay.js";

function region(id,presetId,x,width,priority=0){
  const flags={travelPreset:{presetId},routingPriority:priority};
  return {id,name:id,shapes:[{type:"polygon",points:[x,0,x+width,0,x+width,12,x,12]}],
    getFlag(_module,key){return flags[key];}};
}
test("surface color follows top-ranked overlapping Region on a curved road",()=>{
  const scene={regions:{contents:[region("dirt","dirt",0,100),region("bridge","stone",30,30)]},
    getFlag(_module,key){return key==="routingRegionOrder"?["bridge","dirt"]:null;}};
  const presets=[{id:"dirt",name:"Dirt",color:"#AD7955"},
    {id:"stone",name:"Stone",color:"#9CA3AF"}];
  const surfaces=sceneRoadSurfaces(scene,presets);
  const path=[{x:0,y:6},{x:40,y:5},{x:100,y:6}];
  const runs=roadSurfaceSpans(path,surfaces,"#FFFFFF",10);
  assert.deepEqual(runs.map(run=>run.color),["#AD7955","#9CA3AF","#AD7955"]);
  assert.deepEqual(path,[{x:0,y:6},{x:40,y:5},{x:100,y:6}]);
});

test("unannotated, unsupported Regions do not override authored road styles",()=>{
  const scene={regions:{contents:[region("unknown","not-a-preset",0,100)]}};
  assert.deepEqual(sceneRoadSurfaces(scene,[]),[]);
  assert.deepEqual(roadSurfaceSpans([{x:0,y:0},{x:10,y:0}],[],"#123456",10),
    [{color:"#123456",points:[{x:0,y:0},{x:10,y:0}]}]);
});

test("long paths safely fall back to authored style instead of hanging",()=>{
  const path=[{x:0,y:6},{x:10000,y:6}];
  const regions=[{id:"a",rank:0,color:"#888888",shapes:[]}];
  assert.deepEqual(roadSurfaceSpans(path,regions,"#FFFFFF",10,10),
    [{points:path,color:"#FFFFFF"}]);
});
