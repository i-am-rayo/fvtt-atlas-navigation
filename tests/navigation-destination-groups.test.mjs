import assert from "node:assert/strict";
import test from "node:test";
import {checkpointDestinationGroups}
  from "../scripts/navigation-destination-groups.js";

const atlas={
  roads:[{id:"land",name:"Dirwest–Millstone"},{id:"water",name:"Sea Lane"},
    {id:"air",name:"Skyway"}],
  checkpoints:[
    {id:"millstone",name:"Millstone",roadId:"land"},
    {id:"dirwest-gate",name:"North Gate",roadId:"land"},
    {id:"dirwest",name:"Dirwest",roadId:"land"},
    {id:"port",name:"Port Barthos",roadId:"water"},
    {id:"island",name:"Island Ruins",roadId:null},
    {id:"duplicate1",name:"Bridge",roadId:"land"},
    {id:"duplicate2",name:"Bridge",roadId:"land"},
    {id:"sky",name:"Cloud Keep",roadId:"air"}
  ]
};
const roadModes=new Map([["land","land"],["water","water"],["air","air"]]);

test("destination picker exposes terrain only, then uncategorized, never Road or territory names",()=>{
  const original=structuredClone(atlas);
  const groups=checkpointDestinationGroups(atlas,{roadModes});
  assert.deepEqual(groups.map(x=>x.label),["Land","Water","Air","Uncategorized"]);
  assert.deepEqual(groups.find(x=>x.label==="Land").entries.map(x=>x.id),
    ["duplicate1","duplicate2","dirwest","millstone","dirwest-gate"]);
  assert.equal(groups.find(x=>x.label==="Water").entries[0].id,"port");
  assert.equal(groups.find(x=>x.label==="Uncategorized").entries[0].id,"island");
  assert.ok(groups.every(g=>!g.label.includes("Dirwest")&&!g.label.includes("Road")));
  assert.equal(groups.flatMap(g=>g.entries).length,atlas.checkpoints.length);
  assert.deepEqual(atlas,original);
});

test("duplicate names remain individually selectable by stable ID",()=>{
  const groups=checkpointDestinationGroups(atlas,{roadModes});
  const duplicate=groups.flatMap(g=>g.entries).filter(x=>x.label.startsWith("Bridge"));
  assert.deepEqual(duplicate.map(x=>x.id),["duplicate1","duplicate2"]);
  assert.ok(duplicate.every(x=>x.label.includes(" · ")));
});

test("missing Road links, malformed names and unknown travel modes fail to uncategorized",()=>{
  const groups=checkpointDestinationGroups({
    roads:[{id:"known"},{id:"unknown"}],
    checkpoints:[
      {id:"n",name:"No Road",roadId:"missing"},
      {id:"u",name:"Unknown mode",roadId:"unknown"},
      {id:"v",name:"Walk",roadId:"known"},
      {id:"blank",name:"   ",roadId:"known"}
    ]
  },{roadModes:new Map([["known","land"],["unknown","teleport"]])});
  assert.deepEqual(groups.map(g=>g.label),["Land","Uncategorized"]);
  assert.deepEqual(groups[0].entries.map(e=>e.id),["v"]);
  assert.deepEqual(groups[1].entries.map(e=>e.id),["n","u"]);
});
