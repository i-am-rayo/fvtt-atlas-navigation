import test from "node:test";
import assert from "node:assert/strict";
import { buildGeneratedRegionPlan, shapeSignature, validateGeneratedRegionFlag,
  MAX_CORRIDOR_EDGES } from "../scripts/generated-region-model.js";

function fixture() {
  return {
    schemaVersion: 4, coordinateSpace: "image", revision: 7,
    enabled: true, calibration: null,
    roads: [{id:"road",name:"Millstone Road"},{id:"other",name:"Other Road"}],
    nodes: [{id:"a",x:0,y:0},{id:"b",x:100,y:0},
      {id:"c",x:100,y:100},{id:"d",x:300,y:0}],
    segments: [
      {id:"s1",roadId:"road",from:"a",to:"b",via:[{x:50,y:20}],bidirectional:true},
      {id:"s2",roadId:"road",from:"b",to:"c",via:[],bidirectional:true},
      {id:"s3",roadId:"other",from:"b",to:"d",via:[],bidirectional:true}
    ],
    checkpoints: [
      {id:"p1",roadId:"road",nodeId:"a",name:"Gate",elevationMeters:10},
      {id:"p2",roadId:"road",nodeId:"c",name:"Fort",elevationMeters:50},
      {id:"p3",roadId:"other",nodeId:"b",name:"Crossroad",elevationMeters:null}
    ]
  };
}
const settings={roadId:"road", checkpointId:"p1", endCheckpointId:"p2",
  widthCells:0.5, gridSize:100,origin:{x:10,y:20}};
test("checkpoint yields one native ellipse with image origin and no behavior",()=>{
 const plan=buildGeneratedRegionPlan(fixture(),{...settings,kind:"checkpoint"});
 assert.equal(plan.shapes.length,1);
 assert.deepEqual([plan.shapes[0].x,plan.shapes[0].y],[10,20]);
 assert.equal(plan.shapes[0].radiusX,50);
 assert.equal(plan.generatedRegion.kind,"checkpoint");
 assert.equal(plan.name,"Millstone Road — Gate");
});
test("corridor follows both graph sections AND shaping bends in image coordinates",()=>{
 const plan=buildGeneratedRegionPlan(fixture(),{...settings,kind:"corridor"});
 assert.deepEqual(plan.points,[{x:10,y:20},{x:60,y:40},{x:110,y:20},{x:110,y:120}]);
 assert.equal(plan.shapes.length,7); // 3 edge polygons and 4 end-cap/join ellipses
 assert.equal(plan.shapes[0].points.length,8);
 assert.equal(plan.generatedRegion.checkpointIds.join(","),"p1,p2");
 assert.equal(plan.generatedRegion.shapeSignature,shapeSignature(plan.shapes));
});
test("reverse traversal keeps its bends in reverse order",()=>{
 const plan=buildGeneratedRegionPlan(fixture(),{...settings,
   kind:"corridor",checkpointId:"p2",endCheckpointId:"p1"});
 assert.deepEqual(plan.points[0],{x:110,y:120});
 assert.deepEqual(plan.points.at(-1),{x:10,y:20});
});
test("refuses disconnected or cross-road pairs",()=>{
 const atlas=fixture();
 assert.throws(()=>buildGeneratedRegionPlan(atlas,{...settings,kind:"corridor",
   endCheckpointId:"p3"}),/belonging/);
 atlas.nodes.push({id:"e",x:180,y:100});
 atlas.segments[1] = {...atlas.segments[1],from:"c",to:"e"};
 assert.throws(()=>buildGeneratedRegionPlan(atlas,{...settings,kind:"corridor"}),/disconnected/);
});
test("loop chooses the shortest geometric corridor and explicitly marks alternatives",()=>{
 const atlas=fixture();
 atlas.segments.push({id:"loop",roadId:"road",from:"a",to:"c",via:[],bidirectional:true});
 const plan=buildGeneratedRegionPlan(atlas,{...settings,kind:"corridor"});
 assert.equal(plan.routeSelection.alternatives,true);
 assert.deepEqual(plan.routeSelection.segmentIds,["loop"]);
 assert.deepEqual(plan.points,[{x:10,y:20},{x:110,y:120}]);
 assert.equal(plan.shapes.length,3);
 const repeat=buildGeneratedRegionPlan(atlas,{...settings,kind:"corridor"});
 assert.equal(repeat.generatedRegion.shapeSignature,plan.generatedRegion.shapeSignature);
});
test("same-road alternate paths consider shaping bends, not just segment count",()=>{
 const atlas=fixture();
 atlas.segments.push({id:"direct-but-long",roadId:"road",from:"a",to:"c",
   via:[{x:-250,y:50}],bidirectional:true});
 const plan=buildGeneratedRegionPlan(atlas,{...settings,kind:"corridor"});
 assert.equal(plan.routeSelection.alternatives,true);
 assert.deepEqual(plan.routeSelection.segmentIds,["s1","s2"]);
 assert.equal(plan.points.length,4);
});
test("equal-length choices use deterministic section IDs for stable preview signatures",()=>{
 const atlas=fixture();
 atlas.segments=[...atlas.segments.filter(s=>s.roadId!=="road"),
   {id:"b-path",roadId:"road",from:"a",to:"c",via:[],bidirectional:true},
   {id:"a-path",roadId:"road",from:"a",to:"c",via:[],bidirectional:true}];
 const plan=buildGeneratedRegionPlan(atlas,{...settings,kind:"corridor"});
 assert.deepEqual(plan.routeSelection.segmentIds,["a-path"]);
 assert.equal(plan.routeSelection.alternatives,true);
});
test("allows other roads to cross without connecting automatically",()=>{
 const atlas=fixture();
 atlas.nodes.push({id:"e",x:50,y:-20},{id:"f",x:50,y:40});
 atlas.segments.push({id:"cross",roadId:"other",from:"e",to:"f",via:[],bidirectional:true});
 const plan=buildGeneratedRegionPlan(atlas,{...settings,kind:"corridor"});
 assert.equal(plan.points.length,4);
});
test("width limits, origin validation, unsupported metadata",()=>{
 assert.throws(()=>buildGeneratedRegionPlan(fixture(),{...settings,kind:"checkpoint",widthCells:0}),/half-width/);
 assert.throws(()=>buildGeneratedRegionPlan(fixture(),{...settings,kind:"checkpoint",origin:{x:Infinity,y:0}}),/finite/);
 const plan=buildGeneratedRegionPlan(fixture(),{...settings,kind:"checkpoint"});
 assert.deepEqual(validateGeneratedRegionFlag(plan.generatedRegion),plan.generatedRegion);
 assert.throws(()=>validateGeneratedRegionFlag({...plan.generatedRegion, other:"bad"}),/Unsupported/);
});
test("shape edits alter geometry signature independently of names or behaviors",()=>{
 const plan=buildGeneratedRegionPlan(fixture(),{...settings,kind:"checkpoint"});
 const moved=JSON.parse(JSON.stringify(plan.shapes));
 moved[0].x+=1;
 assert.notEqual(shapeSignature(moved),shapeSignature(plan.shapes));
 assert.equal(MAX_CORRIDOR_EDGES,100);
});
