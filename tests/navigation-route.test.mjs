import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { calculateRoadRoute } from "../scripts/navigation-route.js";

const point = (x,y) => ({x,y});
const base = (nodes, segments, roads = [{id:"main",name:"Main"}]) => ({
  ...createEmptyAtlas(), enabled:true, nodes, segments, roads
});
const native = points => points.slice(1).reduce((sum,p,i) =>
  sum + Math.hypot(p.x - points[i].x,p.y - points[i].y),0);
const road = (id,from,to,roadId="main",via=[]) =>
  ({id,from,to,roadId,via,bidirectional:true});

test("arbitrary map clicks connect to road interiors without modifying scene data",()=>{
  const atlas=base([ {id:"a",x:0,y:0},{id:"b",x:100,y:0} ],
    [road("ab","a","b")]);
  const original=JSON.stringify(atlas);
  const result=calculateRoadRoute(atlas,point(20,10),point(80,10),{measurePath:native});
  assert.equal(result.status,"ok");
  assert.equal(result.distance,80);
  assert.deepEqual(result.legs.map(l=>l.kind),["off-road","road","off-road"]);
  assert.deepEqual(result.legs[1].points,[point(20,0),point(80,0)]);
  assert.equal(JSON.stringify(atlas),original);
});

test("shortest network route beats an apparently direct but longer loop",()=>{
  const atlas=base([
    {id:"a",x:0,y:0},{id:"b",x:100,y:0},{id:"c",x:100,y:100},{id:"d",x:0,y:100}
  ],[
    road("ab","a","b"),road("bc","b","c"),road("cd","c","d"),
    road("detour","a","d","main",[point(-200,50)])
  ]);
  const result=calculateRoadRoute(atlas,point(0,0),point(0,100),{measurePath:native,candidateLimit:1});
  assert.equal(result.status,"ok");
  assert.ok(result.legs.some(l=>l.segmentId==="ab"));
  assert.ok(result.legs.some(l=>l.segmentId==="bc"));
  assert.ok(result.legs.some(l=>l.segmentId==="cd"));
  assert.ok(!result.legs.some(l=>l.segmentId==="detour"));
});

test("visual road intersections never imply a junction",()=>{
  const atlas=base([
    {id:"left",x:0,y:50},{id:"right",x:100,y:50},
    {id:"up",x:50,y:0},{id:"down",x:50,y:100}
  ],[
    road("horizontal","left","right"),
    road("vertical","up","down","other")
  ],[{id:"main",name:"Horizontal"},{id:"other",name:"Vertical"}]);
  // Deliberately limit choices to the closest road for each map point.
  const result=calculateRoadRoute(atlas,point(0,50),point(50,100),
    {measurePath:native,candidateLimit:1});
  assert.equal(result.status,"no-route");
});

test("disconnected components return no route, not a fabricated straight line",()=>{
  const atlas=base([
    {id:"a",x:0,y:0},{id:"b",x:100,y:0},
    {id:"c",x:1000,y:0},{id:"d",x:1100,y:0}
  ],[road("ab","a","b"),road("cd","c","d")]);
  const result=calculateRoadRoute(atlas,point(10,0),point(1090,0),
    {measurePath:native,candidateLimit:1});
  assert.equal(result.status,"no-route");
  assert.match(result.reason,/connected/);
});

test("native measurement is the authoritative source for all legs",()=>{
  const atlas=base([{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    [road("ab","a","b")]);
  let calls=0;
  const measurePath=points=>{calls++;return native(points)*2;};
  const result=calculateRoadRoute(atlas,point(20,10),point(80,10),{measurePath});
  assert.equal(result.distance,160);
  assert.ok(calls>=3);
});

test("invalid input and unavailable Grid measurement fail closed",()=>{
  const atlas=base([{id:"a",x:0,y:0},{id:"b",x:100,y:0}],
    [road("ab","a","b")]);
  assert.throws(()=>calculateRoadRoute(atlas,point(NaN,0),point(10,0),{measurePath:native}),/valid/);
  assert.throws(()=>calculateRoadRoute(atlas,point(0,0),point(10,0)),/required/);
  assert.throws(()=>calculateRoadRoute(atlas,point(0,0),point(10,0),
    {measurePath:()=>NaN}),/unavailable/);
});

test("distant candidate roads are not used as off-road shortcuts",()=>{
  const atlas=base([
    {id:"a",x:0,y:0},{id:"b",x:100,y:0},
    {id:"c",x:0,y:300},{id:"d",x:100,y:300}
  ],[road("ab","a","b"),road("cd","c","d")]);
  const result=calculateRoadRoute(atlas,point(10,2),point(90,298),
    {measurePath:native,candidateLimit:8,attachmentTolerancePixels:40});
  assert.equal(result.status,"no-route");
});
