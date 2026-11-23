import assert from "node:assert/strict";
import test from "node:test";
import {hasUnfinishedApprovedTransport,approvedTransportRecoverySelection,
  restoreApprovedTransportPlan}
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

test("interrupted approved land overtime survives recovery without rebooking",()=>{
  const end={x:30,y:0};
  const route={status:"ok",start:{x:10,y:0},end,distance:20,cost:20,
    legs:[{kind:"road",points:[{x:10,y:0},end],distance:20,cost:20}]};
  const projected={hasTransitions:false,validTransfers:true,legs:[{
    index:0,firstRouteLeg:0,lastRouteLeg:0,surface:"land",start:route.start,end,
    distance:20,weightedDistance:20,roadIds:["road"],roadNames:["Coast road"],
    departureCheckpoint:null,arrivalCheckpoint:{id:"arrival",name:"Dirwest"},
    transferValid:true
  }]};
  const approved={status:"interrupted",legs:[{
    completedPercent:40,destination:end,distance:50,speedPerHour:3,
    terrainAware:false,transport:{
      methodId:"carriage",methodName:"Carriage",kind:"vehicle",
      surface:"land",arrangement:"hire",operation:"overtime",
      arrivalCheckpointId:"arrival",arrivalCheckpointName:"Dirwest"
    }
  }]};
  const catalog=[{id:"carriage",name:"Carriage",kind:"vehicle",surface:"land",
    speedMph:3,capacity:4,hireEnabled:true,hireCostCp:400,hireBasis:"day",
    hireApplies:"unit",overtimeEnabled:false,continuousEnabled:false}];
  const recovered=restoreApprovedTransportPlan(route,projected,approved,catalog,
    null,{gridSize:100,gridDistance:5});
  assert.equal(recovered.legs[0].operation,"overtime");
  assert.equal(recovered.legs[0].selectedOption.method.overtimeEnabled,true,
    "a saved approved shift cannot silently downgrade after World preset edits");
  assert.equal(recovered.legs[0].costCp,0,"recovery cannot charge a fare twice");
  assert.equal(recovered.legs[0].recovered,true);
});

test("an interrupted voyage retains its road mismatch refusal and attaches read-only diagnostic",()=>{
  const p=x=>({x,y:0});
  const saved={status:"interrupted",lastConfirmedAnchor:{point:p(50)},
    legs:[{completedPercent:50,distance:100,approvedPath:{schemaVersion:1,legs:[{
      kind:"road",roadId:"road",segmentId:"saved",points:[p(0),p(100)]}]},
      transport:{methodId:"ship",kind:"vehicle",surface:"water",
        arrangement:"hire",arrivalCheckpointId:"dock"}}]};
  const route={status:"ok",start:p(50),end:p(100),distance:50,legs:[{
    kind:"road",roadId:"road",segmentId:"new",points:[p(50),p(100)]}]};
  const before=JSON.stringify(saved);
  assert.throws(()=>restoreApprovedTransportPlan(route,{legs:[]},saved,[],null,
    {gridSize:100,gridDistance:5}),error=>{
    assert.match(error.message,/road-sequence-changed/);
    assert.deepEqual(error.recoveryDiagnostic?.approvedSegmentIds,["saved"]);
    assert.deepEqual(error.recoveryDiagnostic?.proposedSegmentIds,["new"]);
    return true;
  });
  assert.equal(JSON.stringify(saved),before,"diagnostics cannot mutate saved Journey state");
});
