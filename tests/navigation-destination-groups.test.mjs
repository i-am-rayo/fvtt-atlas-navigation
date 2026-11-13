import assert from "node:assert/strict";
import test from "node:test";
import {checkpointDestinationGroups,checkpointGeographyGroups}
  from "../scripts/navigation-destination-groups.js";

const atlas={checkpoints:[
  {id:"dirwest",name:"Dirwest"},
  {id:"millstone",name:"Millstone"},
  {id:"bridge1",name:"Bridge"},
  {id:"bridge2",name:"Bridge"},
  {id:"dock",name:"Hearth's Heart Dock"},
  {id:"unknown",name:"Mysterious Ruins"}
]};
const geography=new Map([
  ["dirwest",{level:0,name:"Dirwest"}],
  ["bridge1",{level:0,name:"Dirwest"}],
  ["millstone",{level:0,name:"Millstone"}],
  ["bridge2",{level:1,name:"Valecor"}],
  ["dock",{level:1,name:"Valecor"}]
]);

test("Checkpoint directory groups by City > Continent > Uncategorized without roads",()=>{
  const input=structuredClone(atlas);
  const groups=checkpointDestinationGroups(atlas,{geography});
  assert.deepEqual(groups.map(g=>g.label),[
    "City: Dirwest","City: Millstone","Continent: Valecor","Uncategorized"
  ]);
  assert.deepEqual(groups[0].entries.map(e=>e.id),["bridge1","dirwest"]);
  assert.deepEqual(groups[2].entries.map(e=>e.id),["bridge2","dock"]);
  assert.equal(groups.at(-1).entries[0].id,"unknown");
  assert.deepEqual(atlas,input);
  assert.equal(groups.flatMap(g=>g.entries).length,atlas.checkpoints.length);
});

test("duplicate Checkpoint display names remain distinguished by stable IDs",()=>{
  const all=checkpointDestinationGroups(atlas,{geography}).flatMap(g=>g.entries);
  assert.ok(all.filter(x=>x.label.startsWith("Bridge")).every(x=>x.label.includes(" · ")));
  assert.deepEqual(all.filter(x=>x.label.startsWith("Bridge")).map(x=>x.id),
    ["bridge1","bridge2"]);
});

test("native geography chooses a unique containing City before continent; falls back if City ambiguous",()=>{
  const territories=[
    {id:"c1",linked:true,invalid:false,name:"Dirwest",geography:{kind:"city"}},
    {id:"c2",linked:true,invalid:false,name:"Millstone",geography:{kind:"city"}},
    {id:"continent",linked:true,invalid:false,name:"Valecor",geography:{kind:"continent"}},
    {id:"other",linked:false,invalid:false,name:"Unlinked",geography:{kind:"city"}}
  ];
  const matches=[
    {checkpointId:"a",regionId:"c1",contains:true},
    {checkpointId:"a",regionId:"continent",contains:true},
    {checkpointId:"b",regionId:"c1",contains:true},
    {checkpointId:"b",regionId:"c2",contains:true},
    {checkpointId:"b",regionId:"continent",contains:true},
    {checkpointId:"c",regionId:"other",contains:true},
    {checkpointId:"d",regionId:"c1",contains:true,ambiguous:true},
    {checkpointId:"d",regionId:"continent",contains:true}
  ];
  const found=checkpointGeographyGroups(territories,matches);
  assert.deepEqual(found.get("a"),{level:0,name:"Dirwest"});
  assert.deepEqual(found.get("b"),{level:1,name:"Valecor"});
  assert.equal(found.has("c"),false);
  assert.deepEqual(found.get("d"),{level:1,name:"Valecor"});
});

test("explicit native link resolves a Checkpoint without canvas matching",()=>{
  const territories=[{id:"city",linked:true,invalid:false,
    name:"Port Barthos",geography:{kind:"city"}}];
  const found=checkpointGeographyGroups(territories,[],[
    {regionId:"city",link:{checkpointId:"port"}}
  ]);
  assert.deepEqual(found.get("port"),{level:0,name:"Port Barthos"});
});
