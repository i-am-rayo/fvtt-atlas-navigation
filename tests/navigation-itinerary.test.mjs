import assert from "node:assert/strict";
import test from "node:test";
import { createNavigationItinerary,NAVIGATION_ITINERARY_SCHEMA }
  from "../scripts/navigation-itinerary.js";

const point=(x,y)=>({x,y});
const route=()=>({status:"ok",start:point(0,0),end:point(30,0),
  distance:30,cost:37.5,terrainAware:true,
  legs:[{kind:"road",roadId:"r1",segmentId:"s1",distance:30,cost:37.5,
    points:[point(0,0),point(10,0),point(30,0)],
    terrainSlices:[{regionId:"region-1",regionName:"Old Bridge",terrain:"Stone Road",
      distance:30,multiplier:1.25}]}]});

test("itinerary is a versioned independent snapshot with geometry, metrics and directions",()=>{
  const source=route();
  const item=createNavigationItinerary({sceneId:"scene-1",sceneName:"Paedor",
    sceneUnits:"km",atlasRevision:8,route:source,
    roadName:id=>id==="r1"?"Bridge Road":"Unknown",
    travel:{speed:5,pace:"fast",source:"party",hoursPerDay:8}});
  assert.equal(item.schemaVersion,NAVIGATION_ITINERARY_SCHEMA);
  assert.deepEqual(item.scene,{id:"scene-1",name:"Paedor",units:"km",atlasRevision:8});
  assert.deepEqual(item.endpoints.departure,point(0,0));
  assert.equal(item.legs[0].roadName,"Bridge Road");
  assert.equal(item.legs[0].segmentId,"s1");
  assert.equal(item.legs[0].terrainSlices[0].regionName,"Old Bridge");
  assert.match(item.directions[0].instruction,/Bridge Road|Old Bridge/);
  assert.equal(item.measurements.weightedDistance,37.5);
  assert.equal(item.measurements.travelHours,7.5);
  source.legs[0].points[1].x=999;
  source.legs[0].terrainSlices[0].terrain="Changed";
  assert.equal(item.legs[0].points[1].x,10);
  assert.equal(item.legs[0].terrainSlices[0].terrain,"Stone Road");
  assert.deepEqual(JSON.parse(JSON.stringify(item)),item,
    "future itinerary consumers must receive portable, serializable data");
});

test("itinerary rejects incomplete routes and malformed geometry without external writes",()=>{
  assert.throws(()=>createNavigationItinerary({sceneId:"scene-1",route:{status:"no-route"}}),
    /valid calculated/);
  const broken=route();broken.legs[0].points[0].x=Infinity;
  assert.throws(()=>createNavigationItinerary({sceneId:"scene-1",route:broken}),
    /invalid leg geometry/);
  assert.throws(()=>createNavigationItinerary({sceneId:"",route:route()}),/valid calculated/);
  const invalidSlice=route();invalidSlice.legs[0].terrainSlices[0].multiplier=Infinity;
  assert.throws(()=>createNavigationItinerary({sceneId:"scene-1",route:invalidSlice}),
    /invalid leg geometry/);
});
