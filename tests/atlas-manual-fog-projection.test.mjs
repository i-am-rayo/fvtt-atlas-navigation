import assert from "node:assert/strict";
import test from "node:test";
import { coveredManualFogCells } from "../scripts/atlas-manual-fog-projection.js";

test("manual Fog coverage is pure, independent of Scene origin and hides override checkpoint reveals",()=>{
  const cells=[{x:50,y:50,polygon:[{x:0,y:0}]},
    {x:150,y:50,polygon:[{x:100,y:0}]},
    {x:250,y:50,polygon:[{x:200,y:0}]}];
  const state={schemaVersion:1,enabled:true,
    revealed:[{x:50,y:50}],hidden:[{x:150,y:50}]};
  const keys=new Set(["150,50"]);
  const covered=coveredManualFogCells(cells,state,keys);
  assert.deepEqual(covered.map(c=>[c.x,c.y]),[[150,50],[250,50]]);
  assert.equal(cells.length,3,"the native cells are unchanged");
  assert.deepEqual(state.hidden,[{x:150,y:50}]);
  assert.throws(()=>coveredManualFogCells(cells,{...state,hidden:state.revealed},keys),
    /duplicate/);
});
