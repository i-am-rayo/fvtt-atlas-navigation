import test from "node:test";
import assert from "node:assert/strict";
import {validateCheckpointPresetAssignments,checkpointAssignedPresetId,
  saveCheckpointPresetAssignment,CHECKPOINT_PRESET_ASSIGNMENT_FLAG}
  from "../scripts/checkpoint-preset-assignment.js";

test("checkpoint preset identity persists independently of its checkpoint type and appearance",async()=>{
  const oldGame=globalThis.game;
  let stored=null;
  const scene={canUserModify:()=>true,getFlag:(_module,key)=>{
    assert.equal(key,CHECKPOINT_PRESET_ASSIGNMENT_FLAG);return stored;
  },setFlag:async(_module,key,value)=>{
    assert.equal(key,CHECKPOINT_PRESET_ASSIGNMENT_FLAG);stored=structuredClone(value);
  }};
  try{
    globalThis.game={user:{isGM:true}};
    assert.equal(checkpointAssignedPresetId(scene,"west-gate"),null);
    await saveCheckpointPresetAssignment(scene,"west-gate","checkpoint-bridge");
    assert.equal(checkpointAssignedPresetId(scene,"west-gate"),"checkpoint-bridge");
    await saveCheckpointPresetAssignment(scene,"other","checkpoint-toll");
    assert.equal(checkpointAssignedPresetId(scene,"west-gate"),"checkpoint-bridge");
    await saveCheckpointPresetAssignment(scene,"west-gate",null);
    assert.equal(checkpointAssignedPresetId(scene,"west-gate"),null);
    assert.equal(checkpointAssignedPresetId(scene,"other"),"checkpoint-toll");
    assert.throws(()=>validateCheckpointPresetAssignments({schemaVersion:2,assignments:{}}),
      /Unsupported/);
    await assert.rejects(saveCheckpointPresetAssignment(scene,"bad id","checkpoint-toll"),
      /Invalid/);
  }finally{globalThis.game=oldGame;}
});
