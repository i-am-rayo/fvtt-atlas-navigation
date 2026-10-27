import test from "node:test";
import assert from "node:assert/strict";
import { tokenTravelPath, surveyTrailCells, discoveredOnPath }
  from "../scripts/atlas-token-survey.js";

test("fast token movement preserves cells along the entire segment",()=>{
  const cells=[];
  for(let x=0;x<=600;x+=50)cells.push({x,y:50,canvasX:x,canvasY:50});
  const path=tokenTravelPath({
    origin:{x:0,y:0,width:1,height:1},
    destination:{x:600,y:0,width:1,height:1}
  },50);
  const covered=surveyTrailCells(cells,path,30);
  assert.ok(covered.some(p=>p.x===300));
  assert.ok(covered.length>=10);
});
test("Foundry passed waypoints preserve corners rather than diagonal shortcuts",()=>{
  const path=tokenTravelPath({
    origin:{x:0,y:0,width:1,height:1},
    passed:{waypoints:[{x:0,y:300,width:1,height:1}]},
    destination:{x:300,y:300,width:1,height:1}
  },50);
  const cells=[{x:25,y:175,canvasX:25,canvasY:175},
    {x:175,y:175,canvasX:175,canvasY:175},
    {x:175,y:325,canvasX:175,canvasY:325}];
  const visible=surveyTrailCells(cells,path,30).map(p=>p.x+","+p.y);
  assert.ok(visible.includes("25,175"));
  assert.ok(visible.includes("175,325"));
  assert.ok(!visible.includes("175,175"));
});
test("checkpoint crossing is discovered even when endpoints are far away",()=>{
  const atlas={schemaVersion:9,nodes:[{id:"node",x:300,y:50}],
    checkpoints:[{id:"cp",nodeId:"node"}]};
  const path=[{x:25,y:50},{x:625,y:50}];
  assert.deepEqual(discoveredOnPath(atlas,path,30,{x:0,y:0}),["cp"]);
  assert.deepEqual(discoveredOnPath(atlas,[{x:25,y:200},{x:625,y:200}],30),[]);
});


test("v0.2.29 exploration proximity visits only checkpoints crossed within survey range",()=>{
  const atlas={schemaVersion:9,nodes:[
    {id:"a",x:200,y:25},{id:"b",x:200,y:125}],checkpoints:[
    {id:"near",nodeId:"a"},{id:"far",nodeId:"b"}]};
  const movement=[{x:25,y:25},{x:425,y:25}];
  assert.deepEqual(discoveredOnPath(atlas,movement,40),["near"]);
});
