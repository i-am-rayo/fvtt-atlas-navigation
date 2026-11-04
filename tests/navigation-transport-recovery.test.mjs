import assert from "node:assert/strict";
import test from "node:test";
import {hasUnfinishedApprovedTransport,approvedTransportRecoverySelection}
  from "../scripts/navigation-transport-recovery.js";

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

test("a checkpoint-bound owned mount restores its saved selection before rerouting",()=>{
  const catalog=[{id:"walking",kind:"foot",surface:"land"},
    {id:"riding-horse",kind:"mount",surface:"land"}];
  const saved={status:"interrupted",legs:[{completedPercent:49,
    transport:{methodId:"riding-horse",kind:"mount",surface:"land",
      arrangement:"owned",operation:"normal"}}]};
  assert.deepEqual(approvedTransportRecoverySelection(saved,catalog),{
    methodId:"riding-horse",arrangement:"owned",operation:"normal"});
  assert.equal(approvedTransportRecoverySelection({...saved,status:"completed"},catalog),null);
  assert.throws(()=>approvedTransportRecoverySelection(saved,[catalog[0]]),
    /no longer compatible/);
  assert.throws(()=>approvedTransportRecoverySelection(saved,[{
    id:"riding-horse",kind:"vehicle",surface:"land"}]),/no longer compatible/);
});

test("approved Journey recovery is surface- and method-neutral",()=>{
  for(const transport of [
    {methodId:"walking",kind:"foot",surface:"land",arrangement:"owned",operation:"normal"},
    {methodId:"riding-horse",kind:"mount",surface:"land",arrangement:"owned",operation:"normal"},
    {methodId:"ship-passage",kind:"vehicle",surface:"water",arrangement:"hire",operation:"continuous"},
    {methodId:"warship",kind:"vehicle",surface:"water",arrangement:"owned",operation:"continuous"},
    {methodId:"airship",kind:"vehicle",surface:"air",arrangement:"hire",operation:"continuous"}
  ]){
    const catalog=[{id:transport.methodId,kind:transport.kind,
      surface:transport.surface}];
    const saved={status:"interrupted",legs:[{completedPercent:25,transport}]};
    assert.deepEqual(approvedTransportRecoverySelection(saved,catalog),{
      methodId:transport.methodId,arrangement:transport.arrangement,
      operation:transport.operation},transport.methodId);
  }
});
