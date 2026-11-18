import assert from "node:assert/strict";
import test from "node:test";
import {compactNavigationDirectionRows,navigationRouteMarkers}
  from "../scripts/navigation-direction-summary.js";

test("repeated terrain-split Road to Dirwest instructions compress to one meaningful direction",()=>{
  const rows=[
    {kind:"direction",direction:"northeast",instruction:"Continue northeast on Road to Dirwest",
      distanceValue:1,hoursValue:1,info:"1 mi · 1h",surface:"Dirt Road"},
    {kind:"direction",direction:"northeast",instruction:"Continue northeast on Road to Dirwest",
      distanceValue:2,hoursValue:2,info:"2 mi · 2h",surface:"Stone Road"}
  ];
  const original=structuredClone(rows);
  const compact=compactNavigationDirectionRows(rows,{
    formatDistance:d=>d+" mi",formatHours:h=>h+"h"});
  assert.equal(compact.length,1);
  assert.equal(compact[0].info,"3 mi · 3h");
  assert.equal(compact[0].segments.length,2);
  assert.deepEqual(rows,original);
});

test("intermediate authored Checkpoint creates a milestone without altering route graph",()=>{
  const atlas={nodes:[{id:"a",x:0,y:0},{id:"bridge",x:10,y:0},
      {id:"b",x:20,y:-15}],
    checkpoints:[{id:"south-bridge",nodeId:"bridge",name:"Dirwest Southern Bridge"}]};
  const route={status:"ok",legs:[
    {kind:"road",roadId:"a",distance:10,points:[{x:0,y:0},{x:10,y:0}]},
    {kind:"road",roadId:"b",distance:18,points:[{x:10,y:0},{x:20,y:-15}]}]};
  const before=structuredClone({atlas,route});
  const markers=navigationRouteMarkers(route,atlas,{destinationLabel:"Road to Dirwest"});
  assert.ok(markers.some(m=>m.label==="Reach Dirwest Southern Bridge"));
  assert.ok(markers.every(m=>m.atDistance===10));
  assert.deepEqual({atlas,route},before);
});

test("no matching authored checkpoint, gentle curves and off-road departures do not invent landmarks",()=>{
  const route={status:"ok",legs:[
    {kind:"road",roadId:"road",distance:10,points:[{x:0,y:0},{x:10,y:0}]},
    {kind:"road",roadId:"road",distance:10,points:[{x:10,y:0},{x:20,y:5}]}]};
  assert.deepEqual(navigationRouteMarkers(route,{checkpoints:[],nodes:[]}),[]);
});

test("actual large change of Roads emits the correct turn direction",()=>{
  const route={status:"ok",legs:[
    {kind:"road",roadId:"a",distance:10,points:[{x:0,y:0},{x:10,y:0}]},
    {kind:"road",roadId:"b",distance:10,points:[{x:10,y:0},{x:10,y:-10}]}]};
  const markers=navigationRouteMarkers(route,{checkpoints:[],nodes:[]},{
    destinationLabel:"Road to Dirwest"});
  assert.deepEqual(markers.map(m=>m.label),["Turn left toward Dirwest"]);
});
