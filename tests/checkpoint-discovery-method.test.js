import test from "node:test";
import assert from "node:assert/strict";
import { validateCheckpointDiscoveryMethods, checkpointDiscoveryMethod,
  withCheckpointDiscoveryMethod } from "../scripts/checkpoint-discovery-method.js";

test("legacy checkpoints default to automatic discovery without persisting entries",()=>{
  assert.deepEqual(validateCheckpointDiscoveryMethods(null),{});
  assert.equal(checkpointDiscoveryMethod({},"checkpoint-one"),"automatic");
  assert.deepEqual(withCheckpointDiscoveryMethod({},"checkpoint-one","automatic"),{});
});
test("GM Only and Lore Only persist independently and may return to Automatic",()=>{
  let methods=withCheckpointDiscoveryMethod({},"secret","gm");
  methods=withCheckpointDiscoveryMethod(methods,"ancient-library","lore");
  assert.equal(checkpointDiscoveryMethod(methods,"secret"),"gm");
  assert.equal(checkpointDiscoveryMethod(methods,"ancient-library"),"lore");
  assert.equal(checkpointDiscoveryMethod(methods,"not-configured"),"automatic");
  assert.deepEqual(withCheckpointDiscoveryMethod(methods,"secret","automatic"),
    {"ancient-library":"lore"});
});
test("checkpoint discovery method whitelist prevents unknown entries",()=>{
  assert.throws(()=>validateCheckpointDiscoveryMethods({"secret":"maybe"}));
  assert.throws(()=>withCheckpointDiscoveryMethod({},"secret","unknown"));
});
