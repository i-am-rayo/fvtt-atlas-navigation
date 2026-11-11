import test from "node:test";
import assert from "node:assert/strict";
import {competingTerritories,boundsNear,nearestPolygonBorderDistance,
  validateBorderTrim} from "../scripts/territory-border-model.js";
import {analyzeSceneTerritoryBorders,planNativeTerritoryTrim,
  saveNativeTerritoryTrim} from "../scripts/territory-border-reconciliation.js";

const rect=(x1,y1,x2,y2)=>[x1,y1,x2,y1,x2,y2,x1,y2];
function nativeRegion(id,name,kind,points,{origin={x:0,y:0}}={}){
  const area=Math.abs((points[2]-points[0])*(points[5]-points[1]));
  const shape={type:"polygon",origin,hole:false,points:points.map((p,i)=>p-(i%2?origin.y:origin.x))};
  const box={x:points[0],y:points[1],width:points[2]-points[0],height:points[5]-points[1]};
  return {id,name,parent:{id:"scene"},hidden:false,area,bounds:box,
    isSingleShape:true,polygons:[{points}],shapes:[shape],updates:[],behaviors:[{id:"native"}],
    kind,canUserModify:()=>true,
    getFlag:(_namespace,key)=>key==="atlas"?{schemaVersion:1,linked:true}:
      key==="territoryGeography"?{schemaVersion:1,kind,parentRegionId:null,roadOverrides:{}}:null,
    async update(data){this.updates.push(data);this.shapes=data.shapes;}};
}
function fixture(){
  const a=nativeRegion("dirwest","Dirwest","city",rect(0,0,100,100));
  const b=nativeRegion("millstone","Millstone","village",rect(80,0,120,100));
  const continent=nativeRegion("valecor","Valecor","continent",rect(0,0,200,200));
  const diff={area:8000,children:[{isHole:false,children:[]}],
    polygons:[{points:rect(0,0,80,100)}]};
  a.polygonTree={intersectPolygon:(_poly,options)=>options?.clipType===2?diff:{area:2000}};
  b.polygonTree={intersectPolygon:()=>({area:2000})};
  continent.polygonTree={intersectPolygon:()=>({area:10000})};
  const regions=[a,b,continent];
  const scene={id:"scene",grid:{size:100},canUserModify:()=>true,
    regions:{get:id=>regions.find(region=>region.id===id),values:function*(){yield* regions;}}};
  return {scene,a,b,continent};
}

test("only peer territories compete; native nested Continents and settlements can overlap",()=>{
  const a={geography:{kind:"continent"}},b={geography:{kind:"town"}};
  assert.equal(competingTerritories(a,b),false);
  assert.equal(competingTerritories(b,{geography:{kind:"city"}}),true);
  assert.equal(competingTerritories(b,{geography:{kind:"settlement"}}),true);
  assert.equal(competingTerritories(a,{geography:{kind:"continent"}}),true);
  assert.equal(boundsNear({x:0,y:0,width:10,height:10},
    {x:12,y:0,width:10,height:10},2),true);
  assert.equal(nearestPolygonBorderDistance(rect(0,0,10,10),rect(12,0,20,10)),2);
});

test("Settlement Regions are included in the same-tier native overlap analysis",()=>{
  const oldGame=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    const {scene,a,b}=fixture();
    b.getFlag=(_namespace,key)=>key==="atlas"?{schemaVersion:1,linked:true}:
      key==="territoryGeography"?{schemaVersion:1,kind:"settlement",
        parentRegionId:null,roadOverrides:{}}:null;
    const result=analyzeSceneTerritoryBorders(scene);
    assert.equal(result.overlaps.length,1);
    assert.deepEqual([result.overlaps[0].firstId,result.overlaps[0].secondId].sort(),
      [a.id,b.id].sort());
    assert.equal(a.updates.length+b.updates.length,0);
  }finally{globalThis.game=oldGame;}
});

test("invalid, hole, split and high-loss native differences fail closed",()=>{
  assert.throws(()=>validateBorderTrim({sourceArea:100,resultArea:20,overlapArea:80,
    resultingPolygonCount:1,hasHoles:false,vertexCount:4}),/too much/);
  assert.throws(()=>validateBorderTrim({sourceArea:100,resultArea:80,overlapArea:20,
    resultingPolygonCount:2,hasHoles:false,vertexCount:4}),/one safe boundary/);
  assert.throws(()=>validateBorderTrim({sourceArea:100,resultArea:80,overlapArea:20,
    resultingPolygonCount:1,hasHoles:true,vertexCount:4}),/one safe boundary/);
});

test("analysis reports sibling overlap, excludes nested containment, and performs no writes",()=>{
  const oldGame=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    const {scene,a,b,continent}=fixture();
    const result=analyzeSceneTerritoryBorders(scene);
    assert.equal(result.overlaps.length,1);
    assert.deepEqual([result.overlaps[0].firstId,result.overlaps[0].secondId].sort(),
      [a.id,b.id].sort());
    assert.equal(result.overlaps[0].smallerCoveragePercent,50);
    assert.equal(result.comparedPairs,1,"continent-to-settlement comparisons excluded");
    assert.equal(a.updates.length+b.updates.length+continent.updates.length,0);
  }finally{globalThis.game=oldGame;}
});

test("native grid Territories are counted as overlaps but not offered polygon trim",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    const {scene,a,b}=fixture();
    a.shapes=[{type:"grid",offsets:[{i:2,j:3},{i:2,j:4}],hole:false}];
    b.shapes=[{type:"grid",offsets:[{i:2,j:3},{i:3,j:3}],hole:false}];
    a.area=b.area=200;
    a.bounds=b.bounds={x:0,y:0,width:100,height:100};
    const result=analyzeSceneTerritoryBorders(scene);
    assert.equal(result.overlaps.length,1);
    assert.equal(result.overlaps[0].area,100);
    assert.equal(result.overlaps[0].canTrim,false);
    assert.equal(a.updates.length+b.updates.length,0);
    assert.throws(()=>planNativeTerritoryTrim(scene,a.id,b.id),/polygon|Shape/);
  }finally{globalThis.game=previous;}
});

test("small separation produces a non-authoritative gap hint without altering native shapes",()=>{
  const previous=globalThis.game;
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    const {scene,a,b}=fixture();
    b.polygons[0].points=rect(108,0,148,100);
    b.bounds={x:108,y:0,width:40,height:100};
    a.polygonTree.intersectPolygon=()=>({area:0});
    const result=analyzeSceneTerritoryBorders(scene,{nearPixels:10});
    assert.equal(result.overlaps.length,0);
    assert.equal(result.nearby.length,1);
    assert.equal(result.nearby[0].distancePixels,8);
    assert.equal(a.updates.length+b.updates.length,0);
  }finally{globalThis.game=previous;}
});

test("GM chooses protected side; preview cannot write and confirmed trim updates only losing shapes",async()=>{
  const previous={game:globalThis.game,clipper:globalThis.ClipperLib};
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    globalThis.ClipperLib={ClipType:{ctDifference:2}};
    const {scene,a,b}=fixture();
    const plan=planNativeTerritoryTrim(scene,a.id,b.id);
    assert.equal(plan.removedPercent,20);
    assert.deepEqual(plan.resultPoints,rect(0,0,80,100));
    assert.equal(a.updates.length+b.updates.length,0);
    assert.equal(await saveNativeTerritoryTrim(scene,plan),a.id);
    assert.equal(a.updates.length,1);
    assert.deepEqual(Object.keys(a.updates[0]),["shapes"]);
    assert.equal(b.updates.length,0);
    assert.deepEqual(a.behaviors,[{id:"native"}]);
  }finally{globalThis.game=previous.game;globalThis.ClipperLib=previous.clipper;}
});

test("native global polygon coordinates return to the original local shape origin",()=>{
  const previous={game:globalThis.game,clipper:globalThis.ClipperLib};
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    globalThis.ClipperLib={ClipType:{ctDifference:2}};
    const {scene,a,b}=fixture();
    a.shapes[0].origin={x:15,y:30};
    a.shapes[0].points=rect(0,0,100,100).map((point,i)=>point-(i%2?30:15));
    const plan=planNativeTerritoryTrim(scene,a.id,b.id);
    assert.deepEqual(plan.shapes[0].origin,{x:15,y:30});
    assert.deepEqual(plan.shapes[0].points,
      rect(0,0,80,100).map((point,i)=>point-(i%2?30:15)));
  }finally{globalThis.game=previous.game;globalThis.ClipperLib=previous.clipper;}
});

test("stale protected geometry, generated Region, missing difference API and non-GM are rejected",async()=>{
  const previous={game:globalThis.game,clipper:globalThis.ClipperLib};
  try{
    globalThis.game={user:{id:"gm",isGM:true}};
    globalThis.ClipperLib={ClipType:{ctDifference:2}};
    const {scene,a,b}=fixture();
    const plan=planNativeTerritoryTrim(scene,a.id,b.id);
    b.shapes[0].points[0]=79;
    await assert.rejects(saveNativeTerritoryTrim(scene,plan),/changed/);
    assert.equal(a.updates.length,0);
    b.shapes[0].points[0]=80;
    b.getFlag=(_namespace,key)=>key==="generatedRegion"?{}:
      key==="atlas"?{schemaVersion:1,linked:true}:
        key==="territoryGeography"?{schemaVersion:1,kind:"village"}:null;
    assert.throws(()=>planNativeTerritoryTrim(scene,a.id,b.id),/corridor/);
    b.getFlag=(_namespace,key)=>key==="atlas"?{schemaVersion:1,linked:true}:
      key==="territoryGeography"?{schemaVersion:1,kind:"village"}:null;
    globalThis.ClipperLib=null;
    assert.throws(()=>planNativeTerritoryTrim(scene,a.id,b.id),/unavailable/);
    globalThis.game.user.isGM=false;
    assert.throws(()=>analyzeSceneTerritoryBorders(scene),/Scene-authorized GM/);
    assert.equal(a.updates.length,0);
  }finally{globalThis.game=previous.game;globalThis.ClipperLib=previous.clipper;}
});
