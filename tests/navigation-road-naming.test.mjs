import assert from "node:assert/strict";
import test from "node:test";
import {contextualDestinationRoadName} from "../scripts/navigation-road-naming.js";
import {createNavigationItinerary} from "../scripts/navigation-itinerary.js";
import {buildNavigationSteps} from "../scripts/navigation-instructions.js";

const point=(x,y)=>({x,y});
const atlas={
  nodes:[{id:"d",x:0,y:0},{id:"m",x:10,y:0},{id:"e",x:20,y:0}],
  roads:[{id:"dm",name:"Dirwest-Millstone"},{id:"me",name:"Millstone-The Eyrie"}],
  checkpoints:[
    {id:"dirwest",nodeId:"d",name:"Dirwest",playerVisible:true},
    {id:"millstone",nodeId:"m",name:"Millstone",playerVisible:true},
    {id:"eyrie",nodeId:"e",name:"The Eyrie",playerVisible:true}
  ]
};
const route=(reverse=false)=>({
  status:"ok",start:reverse?point(20,0):point(0,0),
  end:reverse?point(0,0):point(20,0),distance:20,cost:20,
  legs:(reverse?[
    {kind:"road",roadId:"me",segmentId:"s2",points:[point(20,0),point(10,0)]},
    {kind:"road",roadId:"dm",segmentId:"s1",points:[point(10,0),point(0,0)]}
  ]:[
    {kind:"road",roadId:"dm",segmentId:"s1",points:[point(0,0),point(10,0)]},
    {kind:"road",roadId:"me",segmentId:"s2",points:[point(10,0),point(20,0)]}
  ]).map(leg=>({...leg,distance:10,cost:10,terrainSlices:[
    {terrain:"Land",regionName:"Valecor",distance:10,multiplier:1}]}))
});
const explored={schemaVersion:2,enabled:true,tokenId:null,radius:10,
  defaultRevealRadiusCells:2,checkpointRevealRadiusCells:{},
  discoveredCheckpointIds:["dirwest","millstone"],loreKnownCheckpointIds:["eyrie"]};

test("the route to The Eyrie has one destination label across both named roads",()=>{
  const planned=route();
  const name=contextualDestinationRoadName({atlas,route:planned,exploration:explored});
  assert.equal(name,"Road to The Eyrie");
  const itinerary=createNavigationItinerary({
    sceneId:"test-scene",route:planned,roadName:id=>atlas.roads.find(r=>r.id===id).name,
    directionRoadName:()=>name,preferRoadName:true
  });
  assert.deepEqual(itinerary.legs.map(leg=>leg.roadName),
    ["Dirwest-Millstone","Millstone-The Eyrie"],
    "saved leg identities retain their permanent authored names");
  assert.equal(itinerary.directions.length,2);
  assert.ok(itinerary.directions.every(d=>d.instruction.includes("Road to The Eyrie")),
    "the regional terrain name must not hide a contextual road direction");
  assert.deepEqual(atlas.roads.map(r=>r.name),
    ["Dirwest-Millstone","Millstone-The Eyrie"]);
});

test("the same road reverses its contextual destination from The Eyrie to Dirwest",()=>{
  assert.equal(contextualDestinationRoadName({
    atlas,route:route(true),exploration:explored
  }),"Road to Dirwest");
});

test("unknown checkpoint names never enter contextual directions",()=>{
  const hidden={...explored,loreKnownCheckpointIds:[]};
  assert.equal(contextualDestinationRoadName({atlas,route:route(),exploration:hidden}),null);
  const names=id=>atlas.roads.find(r=>r.id===id).name;
  const itinerary=createNavigationItinerary({
    sceneId:"test-scene",route:route(),roadName:names
  });
  assert.equal(itinerary.directions[0].instruction,"Head east to Valecor",
    "existing canonical/terrain fallback is preserved without an eligible destination");
});

test("legacy visibility requires an explicit public destination checkpoint",()=>{
  assert.equal(contextualDestinationRoadName({atlas,route:route()}),"Road to The Eyrie");
  const hidden={...atlas,checkpoints:atlas.checkpoints.map(cp=>
    cp.id==="eyrie"?{...cp,playerVisible:false}:cp)};
  assert.equal(contextualDestinationRoadName({atlas:hidden,route:route()}),null);
});

test("ambiguous, remote, unnamed and off-road destinations do not invent a name",()=>{
  const ambiguous={...atlas,checkpoints:[...atlas.checkpoints,
    {id:"secret",nodeId:"e",name:"Secret",playerVisible:false}]};
  assert.equal(contextualDestinationRoadName({
    atlas:ambiguous,route:route(),exploration:explored
  }),null);
  assert.equal(contextualDestinationRoadName({
    atlas,route:route(),destination:point(100,50),tolerancePixels:8,
    exploration:explored
  }),null);
  assert.equal(contextualDestinationRoadName({
    atlas:{...atlas,checkpoints:atlas.checkpoints.map(cp=>
      cp.id==="eyrie"?{...cp,name:"  "}:cp)},route:route(),exploration:explored
  }),null);
  assert.equal(contextualDestinationRoadName({
    atlas,route:{...route(),legs:[{kind:"off-road"}]},exploration:explored
  }),null);
});

test("contextual priorities are opt-in and keep existing public instruction behavior",()=>{
  const steps=buildNavigationSteps(route().legs,()=> "Road to The Eyrie");
  assert.equal(steps[0].instruction,"Head east to Valecor");
  const contextual=buildNavigationSteps(route().legs,()=> "Road to The Eyrie",
    {preferRoadName:true});
  assert.equal(contextual[0].instruction,"Head east to Road to The Eyrie");
  assert.equal(contextual[1].instruction,"Continue east on Road to The Eyrie");
});
