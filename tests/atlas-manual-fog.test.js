import test from "node:test";
import assert from "node:assert/strict";
import { defaultManualFog, validateManualFog, paintManualFog, manualCellVisible } from "../scripts/atlas-manual-fog-model.js";
import { nativeFogCells, brushCells } from "../scripts/atlas-manual-fog-geometry.js";
const view=(originX=100,originY=200)=>({
 ready:true,
 scene:{grid:{type:1,size:100},dimensions:{rows:2,columns:2}},
 dimensions:{sceneX:originX,sceneY:originY},
 grid:{
  isGridless:false,
  getShape:()=>[{x:-50,y:-50},{x:50,y:-50},{x:50,y:50},{x:-50,y:50}],
  getCenterPoint:({i,j})=>({x:originX+50+j*100,y:originY+50+i*100})
 }
});
test("Reveal / Hide / Clear are persistent independent cell overrides",()=>{
 const a={x:50,y:50};
 const revealed=paintManualFog(defaultManualFog(),[a],"reveal");
 assert.equal(manualCellVisible(revealed,a),true);
 const hidden=paintManualFog(revealed,[a],"hide");
 assert.equal(manualCellVisible(hidden,a),false);
 assert.equal(hidden.hidden.length,1);
 assert.equal(hidden.revealed.length,0);
 const cleared=paintManualFog(hidden,[a],"clear");
 assert.deepEqual(cleared,defaultManualFog());
});
test("Scene padding alters canvas centers without altering saved image-local centers",()=>{
 const first=nativeFogCells(view(100,200));
 const second=nativeFogCells(view(400,600));
 assert.deepEqual(first.map(c=>({x:c.x,y:c.y})),second.map(c=>({x:c.x,y:c.y})));
 assert.equal(first[0].canvasX+300,second[0].canvasX);
});
test("Brush radius zero paints exactly one native square cell",()=>{
 const cells=nativeFogCells(view());
 assert.deepEqual(brushCells(cells,{x:150,y:250},0,100),[{x:50,y:50}]);
 assert.equal(brushCells(cells,{x:150,y:250},1,100).length,3);
});
test("Reject duplicate or contradictory saved overrides",()=>{
 assert.throws(()=>validateManualFog({schemaVersion:1,enabled:true,
  revealed:[{x:0,y:0}],hidden:[{x:0,y:0}]}));
 assert.throws(()=>nativeFogCells({...view(),grid:{isGridless:true}}));
});
