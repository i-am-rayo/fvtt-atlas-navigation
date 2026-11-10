import test from "node:test";
import assert from "node:assert/strict";
import {groupTerritoryEntries} from "../scripts/territory-view-model.js";

const region=(id,kind,parentRegionId=null)=>({id,name:id,
  linked:true,geography:kind?{kind,parentRegionId}:null});

test("continent hierarchy nests inferred or explicit children without changing inputs",()=>{
  const entries=[region("Dirwest","town","Valecor"),
    region("Eyrie","city","Reshara"),region("Reshara","continent"),
    region("Millstone","village","Valecor"),region("Valecor","continent")];
  const original=structuredClone(entries);
  const grouped=groupTerritoryEntries(entries);
  assert.deepEqual(grouped.continents.map(node=>node.entry.id),["Reshara","Valecor"]);
  assert.deepEqual(grouped.continents[0].children.map(node=>node.entry.id),["Eyrie"]);
  assert.deepEqual(grouped.continents[1].children.map(node=>node.entry.id),
    ["Dirwest","Millstone"]);
  assert.deepEqual(grouped.uncategorized,[]);
  assert.deepEqual(entries,original,"grouping must be a read-only projection");
});

test("missing, unclassified and cyclic parents appear in Uncategorized",()=>{
  const grouped=groupTerritoryEntries([region("Alone","town"),
    region("Missing","city","absent"),region("CycleA","area","CycleB"),
    region("CycleB","area","CycleA"),region("Native",null)]);
  assert.deepEqual(grouped.continents,[]);
  assert.deepEqual(grouped.uncategorized.map(node=>node.entry.id),
    ["Alone","CycleA","CycleB","Missing","Native"]);
});
