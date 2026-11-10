import test from "node:test";
import assert from "node:assert/strict";
import {routeTerritoryBatchAfterStage} from "../scripts/territory-batch-workflow.js";

function flow({reviewResult=false,reviewError=null}={}){
  const batch={targetIds:["dirwest","millstone","neo"],drafts:new Map()};
  const calls=[];
  let current=batch;
  return {batch,calls,setCurrent:value=>{current=value;},
    args:{batch,regionId:"millstone",nextUnstaged:"neo",getBatch:()=>current,
      openEditor:async id=>{calls.push(`paint:${id}`);},
      reviewAndApply:async()=>{
        calls.push("review");
        if(reviewError)throw reviewError;
        return reviewResult;
      },
      restoreWorkspace:async()=>{calls.push("workspace");}}};
}

test("Stage & Next opens another selected Territory directly",async()=>{
  const f=flow();
  assert.equal(await routeTerritoryBatchAfterStage({...f.args,
    decision:{advance:true}}),"advanced");
  assert.deepEqual(f.calls,["paint:neo"]);
});

test("Stage & Switch permits only selected peers, even already staged ones",async()=>{
  const f=flow();
  assert.equal(await routeTerritoryBatchAfterStage({...f.args,
    decision:{targetId:"dirwest"}}),"switched");
  assert.deepEqual(f.calls,["paint:dirwest"]);
  await assert.rejects(routeTerritoryBatchAfterStage({...f.args,
    decision:{targetId:"outside"}}),/selected destination/);
  assert.deepEqual(f.calls,["paint:dirwest"]);
});

test("declining final approval reopens Paint with all staged drafts intact",async()=>{
  const f=flow();f.batch.drafts.set("dirwest",{offsets:[{i:1,j:1}]});
  assert.equal(await routeTerritoryBatchAfterStage({...f.args,
    decision:{review:true}}),"review-cancelled");
  assert.deepEqual(f.calls,["review","paint:millstone"]);
  assert.deepEqual(f.batch.drafts.get("dirwest").offsets,[{i:1,j:1}]);
});

test("approved final batch restores Workspace after one guarded commit",async()=>{
  const f=flow({reviewResult:true});
  assert.equal(await routeTerritoryBatchAfterStage({...f.args,
    decision:{review:true}}),"committed");
  assert.deepEqual(f.calls,["review","workspace"]);
});

test("a failed review exposes native recovery Workspace rather than reopening Paint",async()=>{
  const error=Error("Recover the interrupted native batch");
  const f=flow({reviewError:error});
  await assert.rejects(routeTerritoryBatchAfterStage({...f.args,
    decision:{review:true}}),error);
  assert.deepEqual(f.calls,["review","workspace"]);
});

test("stale batch selections do not navigate or commit",async()=>{
  const f=flow();f.setCurrent(null);
  assert.equal(await routeTerritoryBatchAfterStage({...f.args,
    decision:{review:true}}),"stale");
  assert.deepEqual(f.calls,[]);
});
