import test from "node:test";
import assert from "node:assert/strict";
import {placeNativePolygonTerritory}
  from "../scripts/native-territory-creation.js";

function setup(){
  const calls=[],user={id:"gm",isGM:true};
  const scene={id:"atlas-scene",grid:{size:100},canUserModify:()=>true};
  const created={id:"native",name:"New Continent",parent:{id:scene.id}};
  let result=created;
  const view={ready:true,scene:{id:scene.id},regions:{
    async placeRegion(...args){calls.push(args);return result;}}};
  return {calls,scene,view,user,created,setResult:value=>{result=value;}};
}

test("native Region [+] uses public Foundry polygon placement and writes no Atlas metadata",async()=>{
  const f=setup();
  assert.equal(await placeNativePolygonTerritory(f.scene,"  New Continent  ",f),f.created);
  assert.equal(f.calls.length,1);
  const [request,options]=f.calls[0];
  assert.equal(request.name,"New Continent");
  assert.deepEqual(request.behaviors,[]);
  assert.equal(Object.hasOwn(request,"flags"),false,
    "native creation must not silently link, classify or publish Atlas Regions");
  assert.deepEqual(request.shapes,[{type:"polygon",origin:{x:0,y:0},
    points:[0,0,100,0,100,100,0,100],hole:false,gridBased:false}]);
  assert.deepEqual(options,{allowRotation:false});
  f.setResult(null);
  assert.equal(await placeNativePolygonTerritory(f.scene,"Cancelled",f),null,
    "a cancelled native placement must not create an Atlas record");
});

test("Region [+] cannot bypass GM, Scene, active canvas, or safe name checks",async()=>{
  const f=setup();
  const rejected=async(message,options=f)=>assert.rejects(
    placeNativePolygonTerritory(f.scene,"Native Polygon",options),message);
  await assert.rejects(placeNativePolygonTerritory(f.scene,"  ",f),/name/);
  await assert.rejects(placeNativePolygonTerritory(f.scene,"A".repeat(121),f),/name/);
  await assert.rejects(placeNativePolygonTerritory(f.scene,"Unsafe\nName",f),/name/);
  await rejected(/GM/,{...f,user:{isGM:false}});
  f.scene.canUserModify=()=>false;
  await rejected(/GM/);
  f.scene.canUserModify=()=>true;
  f.view.ready=false;
  await rejected(/canvas/);
  f.view.ready=true;
  f.view.scene.id="other";
  await rejected(/canvas/);
  f.view.scene.id=f.scene.id;
  f.scene.grid.size=0;
  await rejected(/grid size/);
  assert.equal(f.calls.length,0,"no native placement attempted on rejection");
});
