import test from "node:test";
import assert from "node:assert/strict";
import {validateBoundaryNodes,polygonShapeFromNodes,boundaryFromBlankWalls,
  validateGridOffsets,paintGridCells,gridCellConflicts}
  from "../scripts/territory-authoring-model.js";

const ring=[{id:"a",x:0,y:0},{id:"b",x:15,y:0},
  {id:"c",x:15,y:15},{id:"d",x:0,y:15}];
const blank=(id,c)=>({id,c,move:0,sight:0,light:0,sound:0,door:0});

test("Atlas control nodes produce one valid native polygon with stable IDs",()=>{
  assert.equal(validateBoundaryNodes(ring),225);
  assert.deepEqual(polygonShapeFromNodes(ring),{type:"polygon",
    origin:{x:0,y:0},points:[0,0,15,0,15,15,0,15],hole:false,gridBased:false});
  assert.equal(ring[0].id,"a");
  const translated=ring.map(p=>({...p,x:p.x+3100,y:p.y+1450}));
  assert.deepEqual(polygonShapeFromNodes(translated),{type:"polygon",
    origin:{x:3100,y:1450},
    points:[3100,1450,3115,1450,3115,1465,3100,1465],
    hole:false,gridBased:false},
  "Foundry v14 polygon vertices are already canvas-space, independent of their anchor origin");
  assert.throws(()=>validateBoundaryNodes([{id:"a",x:0,y:0},
    {id:"b",x:10,y:10},{id:"c",x:0,y:10},{id:"d",x:10,y:0}]),/crosses itself|too small/);
  assert.throws(()=>validateBoundaryNodes(ring.map(p=>({...p,id:"same"}))),/duplicate node/);
});

test("selected Blank Walls must form a single nonblocking closed loop",()=>{
  const walls=[blank("w1",[0,0,15,0]),blank("w2",[15,15,0,15]),
    blank("w3",[15,0,15,15]),blank("w4",[0,15,0,0])];
  const result=boundaryFromBlankWalls(walls);
  assert.deepEqual(result.wallIds,["w1","w2","w3","w4"]);
  assert.equal(result.nodes.length,4);
  assert.equal(validateBoundaryNodes(result.nodes),225);
  assert.throws(()=>boundaryFromBlankWalls(walls.slice(0,3)),/open|branched/);
  assert.throws(()=>boundaryFromBlankWalls([...walls.slice(0,3),
    {...walls[3],move:1}]),/non-blocking/);
  assert.throws(()=>boundaryFromBlankWalls([...walls,blank("w5",[5,0,15,3])]),
    /open|branched|duplicate/);
});

test("native grid offsets are deduplicated on painting and never silently shared",()=>{
  assert.deepEqual(paintGridCells([],[{i:1,j:2},{i:1,j:2}]),[{i:1,j:2}]);
  let draft=paintGridCells([],[{i:0,j:0},{i:0,j:1},{i:1,j:1}]);
  draft=paintGridCells(draft,[{i:0,j:0}],true);
  assert.deepEqual(draft,[{i:0,j:1},{i:1,j:1}]);
  assert.throws(()=>validateGridOffsets([{i:0,j:0},{i:0,j:0}]),/duplicate/);
  assert.deepEqual(gridCellConflicts(draft,[
    {regionId:"millstone",offsets:[{i:1,j:1}]},
    {regionId:"other",offsets:[{i:9,j:9}]}]),
  [{regionId:"millstone",count:1}]);
});
