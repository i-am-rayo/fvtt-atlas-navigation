import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CHECKPOINT_TYPE_GROUPS,CHECKPOINT_TYPE_FLAG} from "../scripts/checkpoint-types.js";

test("Map Marker terminology preserves internal checkpoint keys and literal categories",()=>{
  const language=JSON.parse(readFileSync(new URL("../lang/en.json",import.meta.url),"utf8"));
  assert.equal(language["FVTTATLAS.Checkpoints.Title"],"Map Markers");
  assert.match(language["FVTTATLAS.Checkpoints.Add"],/Map Marker/);
  assert.equal(CHECKPOINT_TYPE_FLAG,"checkpointCategories");
  const categories=CHECKPOINT_TYPE_GROUPS.flatMap(([,options])=>options);
  assert.equal(categories.find(([id])=>id==="security")[1],"Security Checkpoint");
});
