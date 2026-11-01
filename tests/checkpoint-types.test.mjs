import test from "node:test";
import assert from "node:assert/strict";
import {CHECKPOINT_TYPES,validateCheckpointCategories} from "../scripts/checkpoint-types.js";

test("checkpoint categories are informational, whitelisted and backward compatible",()=>{
  assert.equal(CHECKPOINT_TYPES[0][0],"generic");
  assert.deepEqual(validateCheckpointCategories(null),{});
  assert.deepEqual(validateCheckpointCategories({c1:"bridge",c2:"event"}),
    {c1:"bridge",c2:"event"});
  assert.throws(()=>validateCheckpointCategories({c1:"teleporter"}),/Invalid/);
  assert.throws(()=>validateCheckpointCategories({"bad id":"bridge"}),/Invalid/);
});
