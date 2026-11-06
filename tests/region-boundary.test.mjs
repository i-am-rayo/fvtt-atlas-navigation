import assert from "node:assert/strict";
import test from "node:test";
import {smoothClosedBoundary,planSmoothedNativeRegion}
  from "../scripts/region-boundary-model.js";
import {planNativeRegionSmoothing,saveNativeRegionSmoothing}
  from "../scripts/region-boundary.js";
import {MODULE_ID} from "../scripts/atlas-storage.js";

const square=()=>({type:"polygon",origin:{x:0,y:0},hole:false,
  points:[0,0,100,0,100,100,0,100]});
const sceneFixture=()=>{
  const saved={id:"region",name:"Millstone",parent:{id:"scene"},
    shapes:[square()],hidden:false,behaviors:[{id:"custom",type:"weather"}],
    canUserModify:()=>true,getFlag:()=>null,updates:[],
    async update(change){this.updates.push(change);this.shapes=change.shapes;}};
  return {region:saved,scene:{id:"scene",canUserModify:()=>true,
    regions:{get:id=>id==="region"?saved:null}}};
};

test("closed polygon smoothing preserves orientation and stays inside original corners",()=>{
  const gentle=smoothClosedBoundary(square().points,1);
  assert.equal(gentle.length,16);
  assert.deepEqual(gentle.slice(0,4),[25,0,75,0]);
  const moderate=smoothClosedBoundary(square().points,2);
  assert.equal(moderate.length,32);
  for(const v of moderate)assert.ok(v>=0&&v<=100);
  assert.deepEqual(planSmoothedNativeRegion([square()],1).shapes[0].origin,{x:0,y:0});
});

test("another Gentle pass is allowed on moderately detailed polygons, with a hard 256-vertex ceiling",()=>{
  const circle=Array.from({length:80},(_,i)=>{
    const a=i*2*Math.PI/80;return [200+100*Math.cos(a),200+100*Math.sin(a)];
  }).flat();
  const next=smoothClosedBoundary(circle,1);
  assert.equal(next.length,320,"one additional gentle pass yields 160 vertices");
  assert.throws(()=>smoothClosedBoundary(circle,2),/256 border vertices/);
  assert.throws(()=>smoothClosedBoundary(next,1),/too many border vertices/);
});

test("invalid and complex polygons fail without silently changing holes or multiple shapes",()=>{
  assert.throws(()=>smoothClosedBoundary(square().points,0),/Gentle or Moderate/);
  assert.throws(()=>smoothClosedBoundary([0,0,100,100,0,100,100,0]),/crossed|area/);
  assert.throws(()=>smoothClosedBoundary([0,0,100,0,100,0,0,100]),/duplicate/);
  assert.throws(()=>smoothClosedBoundary([0,0,NaN,0,0,100]),/non-finite/);
  assert.throws(()=>planSmoothedNativeRegion([square(),square()],1),/exactly one/);
  assert.throws(()=>planSmoothedNativeRegion([{...square(),hole:true}],1),/without holes/);
  assert.throws(()=>planSmoothedNativeRegion([{...square(),gridBased:true}],1),/grid-based/);
});

test("GM preview is read-only; confirmed save updates shapes only on the same native ID",async()=>{
  const oldGame=globalThis.game;
  const {scene,region}=sceneFixture();
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    const plan=planNativeRegionSmoothing(scene,"region",2);
    assert.equal(region.updates.length,0);
    assert.equal(plan.resultPoints.length,32);
    assert.equal(await saveNativeRegionSmoothing(scene,plan),"region");
    assert.equal(region.updates.length,1);
    assert.deepEqual(Object.keys(region.updates[0]),["shapes"]);
    assert.equal(region.behaviors[0].id,"custom");
    assert.equal(region.name,"Millstone");
    assert.equal(region.hidden,false);
  }finally{globalThis.game=oldGame;}
});

test("stale, unauthorized, or generated native Region boundaries are protected",async()=>{
  const oldGame=globalThis.game;
  const {scene,region}=sceneFixture();
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    const plan=planNativeRegionSmoothing(scene,"region",1);
    region.shapes[0].points[0]=10;
    await assert.rejects(saveNativeRegionSmoothing(scene,plan),/changed/);
    assert.equal(region.updates.length,0);
    region.shapes=[square()];
    region.getFlag=(namespace,key)=>namespace===MODULE_ID&&key==="generatedRegion"?
      {schemaVersion:1}:null;
    assert.throws(()=>planNativeRegionSmoothing(scene,"region",1),/separate regeneration/);
    region.getFlag=()=>null;
    globalThis.game.user.isGM=false;
    assert.throws(()=>planNativeRegionSmoothing(scene,"region",1),/GM/);
    globalThis.game.user.isGM=true;
    region.canUserModify=()=>false;
    assert.throws(()=>planNativeRegionSmoothing(scene,"region",1),/cannot be edited/);
  }finally{globalThis.game=oldGame;}
});
