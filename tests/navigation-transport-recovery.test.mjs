import assert from "node:assert/strict";
import test from "node:test";
import {hasUnfinishedApprovedTransport} from "../scripts/navigation-transport-recovery.js";

test("a completed checkpoint does not make the next land route an approved ship leg",()=>{
  const completed={status:"paused",legs:[{
    completedPercent:100,
    transport:{methodId:"ship-passage",arrivalCheckpointId:"dock"}
  }]};
  assert.equal(hasUnfinishedApprovedTransport(completed),false);
  assert.equal(hasUnfinishedApprovedTransport({...completed,status:"interrupted"}),false);
  const unfinished={...completed,status:"interrupted",legs:[{
    ...completed.legs[0],completedPercent:29
  }]};
  assert.equal(hasUnfinishedApprovedTransport(unfinished),true);
  assert.equal(hasUnfinishedApprovedTransport({status:"interrupted",legs:[{
    completedPercent:45,travelMethod:{id:"riding-horse"}
  }]}),false);
});
