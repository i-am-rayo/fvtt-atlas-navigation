import test from "node:test";
import assert from "node:assert/strict";
import { defaultCheckpointPresets } from "../scripts/checkpoint-preset-model.js";
import { inspectRepository } from "../tools/architecture-graph.mjs";

test("checkpoint catalog reads the same World setting without loading an editor",async()=>{
  const previous=globalThis.game;
  const saved=defaultCheckpointPresets();
  const requests=[];
  try{
    globalThis.game={settings:{get:(module,key)=>{
      requests.push([module,key]);
      return saved;
    }}};
    const {readWorldCheckpointPresets}=await import("../scripts/checkpoint-preset-store.js");
    const result=readWorldCheckpointPresets();
    assert.deepEqual(requests,[["fvtt-atlas-navigation","checkpointPresets"]]);
    assert.deepEqual(result.presets.map(item=>item.id),saved.presets.map(item=>item.id));
  }finally{globalThis.game=previous;}
});

test("GM settings window and preset editor no longer form an import cycle",async()=>{
  const graph=await inspectRepository();
  assert.ok(graph.edges.get("scripts/checkpoint-preset-editor.js")
    .includes("scripts/checkpoint-preset-store.js"));
  assert.ok(graph.edges.get("scripts/checkpoint-preset-settings.js")
    .includes("scripts/checkpoint-preset-store.js"));
  assert.ok(!graph.cycles.some(group=>group.includes("scripts/checkpoint-preset-settings.js")
    &&group.includes("scripts/checkpoint-preset-editor.js")));
});
