import assert from "node:assert/strict";
import test from "node:test";
import {checkpointDestinationGroups,checkpointSettlementNames}
  from "../scripts/navigation-destination-groups.js";

const atlas={
  roads:[{id:"land",name:"Dirwest–Millstone"},{id:"water",name:"Sea Lane"}],
  checkpoints:[
    {id:"millstone",name:"Millstone",roadId:"land"},
    {id:"dirwest-gate",name:"North Gate",roadId:"land"},
    {id:"dirwest",name:"Dirwest",roadId:"land"},
    {id:"port",name:"Port Barthos",roadId:"water"},
    {id:"island",name:"Island Ruins",roadId:null},
    {id:"duplicate1",name:"Bridge",roadId:"land"},
    {id:"duplicate2",name:"Bridge",roadId:"land"}
  ]
};
const roadModes=new Map([["land","land"],["water","water"]]);
const settlements=new Map([
  ["dirwest-gate","Dirwest"],["dirwest","Dirwest"],
  ["millstone","Millstone"],["duplicate1","Dirwest"],["duplicate2","Dirwest"],
  ["port","Port Barthos"]
]);

test("destination catalog groups by terrain, settlement then road without changing stored names",()=>{
  const original=JSON.stringify(atlas);
  const groups=checkpointDestinationGroups(atlas,{roadModes,settlements});
  assert.ok(groups[0].label.startsWith("Land › Dirwest › Dirwest–Millstone"));
  assert.ok(groups.some(group=>group.label==="Water › Port Barthos › Sea Lane"));
  assert.ok(groups.some(group=>group.label===
    "Unclassified terrain › Other locations › No linked road"));
  const ids=groups.flatMap(group=>group.entries.map(x=>x.id));
  assert.equal(ids.length,atlas.checkpoints.length);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(JSON.stringify(atlas),original,"catalog is read-only");
});

test("duplicate names remain selectable by distinct stable checkpoint IDs",()=>{
  const groups=checkpointDestinationGroups(atlas,{roadModes,settlements});
  const duplicates=groups.flatMap(g=>g.entries).filter(x=>x.label.startsWith("Bridge"));
  assert.deepEqual(duplicates.map(x=>x.id),["duplicate1","duplicate2"]);
  assert.ok(duplicates.every(x=>x.label.includes(" · ")));
});

test("explicit Region links and native containment resolve one most specific settlement",()=>{
  const territories=[
    {id:"continent",linked:true,name:"Valecor",geography:{kind:"continent"}},
    {id:"area",linked:true,name:"Eastern Marches",geography:{kind:"area"}},
    {id:"city",linked:true,name:"Dirwest",geography:{kind:"city"}},
    {id:"invalid",linked:true,invalid:true,name:"Wrong City",geography:{kind:"city"}}
  ];
  const found=checkpointSettlementNames(territories,[
    {checkpointId:"dirwest",regionId:"continent",contains:true},
    {checkpointId:"dirwest",regionId:"area",contains:true},
    {checkpointId:"dirwest",regionId:"city",contains:true},
    {checkpointId:"port",regionId:"area",contains:true}
  ],[{regionId:"city",link:{checkpointId:"dirwest-gate"}},
     {regionId:"invalid",link:{checkpointId:"port"}}]);
  assert.equal(found.get("dirwest"),"Dirwest");
  assert.equal(found.get("dirwest-gate"),"Dirwest");
  assert.equal(found.get("port"),"Eastern Marches");
});

test("overlapping peer territories and invalid records cannot be silently resolved",()=>{
  const entries=[
    {id:"a",linked:true,name:"City A",geography:{kind:"city"}},
    {id:"b",linked:true,name:"City B",geography:{kind:"town"}},
    {id:"c",linked:false,name:"City C",geography:{kind:"city"}}
  ];
  const names=checkpointSettlementNames(entries,[
    {checkpointId:"junction",regionId:"a",contains:true},
    {checkpointId:"junction",regionId:"b",contains:true},
    {checkpointId:"outside",regionId:"c",contains:true}
  ],[]);
  assert.equal(names.has("junction"),false);
  assert.equal(names.has("outside"),false);
});

test("unknown or incomplete taxonomy always retains a functional name-only picker",()=>{
  const groups=checkpointDestinationGroups({checkpoints:[
    {id:"a",name:"The Eyrie"},{id:"b",name:"Bridge",roadId:"missing"}
  ]});
  assert.deepEqual(groups.flatMap(g=>g.entries.map(e=>e.id)),["b","a"],
    "fallback options are alphabetically ordered");
});
