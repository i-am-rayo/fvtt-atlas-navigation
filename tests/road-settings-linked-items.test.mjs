import test from "node:test";
import assert from "node:assert/strict";
import {roadCheckpointsAlphabetical} from "../scripts/road-settings-linked-items.js";

test("Road Checkpoints sort A–Z in a display copy with deterministic ID ties",()=>{
  const input=[
    {id:"b",roadId:"r",name:"éyrie"},
    {id:"z",roadId:"r",name:"Dirwest"},
    {id:"a",roadId:"r",name:"Eyrie"},
    {id:"n",roadId:"other",name:"Aardvark"},
    {id:"c",roadId:"r",name:"Eyrie"}
  ];
  const before=structuredClone(input);
  assert.deepEqual(roadCheckpointsAlphabetical(input,"r").map(x=>x.id),
    ["z","a","c","b"],"locale-aware names and stable IDs order displayed Checkpoints");
  assert.deepEqual(input,before,"Road graph and persisted Checkpoint order remain unchanged");
});
