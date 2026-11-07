import test from "node:test";
import assert from "node:assert/strict";
import {chooseDominantContinent,inferSceneContinentParents,
  withInferredContinentParents} from "../scripts/territory-parent-inference.js";

function territory(id,kind,{parentId=null,area=100,overlaps={},
  single=true}={}){
  const polygon={id};
  const region={id,parent:{id:"scene"},isSingleShape:single,area,
    bounds:{x:0,y:0,width:100,height:100},polygons:[polygon],
    polygonTree:{intersectPolygon:target=>({area:overlaps[target.id]??0})}};
  const entry={id,name:id,linked:true,invalid:false,
    geography:{schemaVersion:1,kind,parentRegionId:parentId,roadOverrides:{}}};
  return {region,entry};
}

test("majority and runner-up margin choose a continent without arbitrary ties",()=>{
  assert.deepEqual(chooseDominantContinent([{id:"valecor",fraction:.8},
    {id:"reshara",fraction:.2}]),{parentId:"valecor",coveragePercent:80});
  assert.equal(chooseDominantContinent([{id:"valecor",fraction:.49}]),null);
  assert.equal(chooseDominantContinent([{id:"valecor",fraction:.72},
    {id:"reshara",fraction:.7}]),null);
  assert.equal(chooseDominantContinent([{id:"valecor",fraction:Infinity}]),null);
  assert.equal(chooseDominantContinent([null]),null);
  assert.equal(chooseDominantContinent([{id:"valecor",fraction:.8},
    {id:"valecor",fraction:.2}]),null);
  assert.equal(chooseDominantContinent([]),null);
});

test("native percentage overlap is a read-only inferred parent; explicit parent wins",()=>{
  const valecor=territory("valecor","continent",{
    area:5000,overlaps:{dirwest:80,hearth:95}});
  const resh=territory("reshara","continent",{
    area:5000,overlaps:{dirwest:15,hearth:0}});
  const dirwest=territory("dirwest","city");
  const hearth=territory("hearth","town",{parentId:"reshara"});
  const all=[valecor,resh,dirwest,hearth];
  const byId=new Map(all.map(item=>[item.region.id,item.entry]));
  const scene={id:"scene",regions:{contents:all.map(item=>item.region)}};
  const raw=JSON.stringify([...byId]);
  const inferred=inferSceneContinentParents(scene,byId,{log:false});
  assert.deepEqual(inferred.get("dirwest"),{parentId:"valecor",coveragePercent:80});
  assert.equal(inferred.has("hearth"),false,"manual override never recomputed");
  assert.equal(JSON.stringify([...byId]),raw,"inference cannot write native flags");
  const effective=withInferredContinentParents(scene,[...byId.values()],{log:false});
  assert.equal(effective.find(item=>item.id==="dirwest").geography.parentRegionId,"valecor");
  assert.equal(effective.find(item=>item.id==="hearth").geography.parentRegionId,"reshara");
  assert.equal(dirwest.entry.geography.parentRegionId,null);
});

test("unsupported, ambiguous or unsafe native geometry does not infer a parent",()=>{
  const valecor=territory("valecor","continent",{
    area:1000,overlaps:{dirwest:85}});
  const dirwest=territory("dirwest","village",{single:false});
  const scene={id:"scene",regions:{contents:[valecor.region,dirwest.region]}};
  const entries=new Map([valecor.entry,dirwest.entry].map(e=>[e.id,e]));
  assert.equal(inferSceneContinentParents(scene,entries,{log:false}).size,0);
  dirwest.region.isSingleShape=true;
  valecor.region.polygonTree.intersectPolygon=()=>{throw Error("bad native Region");};
  assert.equal(inferSceneContinentParents(scene,entries,{log:false}).size,0);
  valecor.region.polygonTree.intersectPolygon=()=>({area:120});
  assert.equal(inferSceneContinentParents(scene,entries,{log:false}).size,0,
    "intersection exceeding child area cannot be trusted");
  valecor.region.polygonTree.intersectPolygon=()=>({area:85});
  dirwest.region.parent={id:"other"};
  assert.equal(inferSceneContinentParents(scene,entries,{log:false}).size,0);
});
