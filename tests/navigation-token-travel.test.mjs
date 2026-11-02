import assert from "node:assert/strict";
import test from "node:test";
import { createGuidedTokenWaypoints } from "../scripts/navigation-token-travel.js";

const point=(x,y)=>({x,y});
const token={x:50,y:50,width:1,height:1};

test("guided travel maps visible curve centers to native token origins and deduplicates joins",()=>{
  const waypoints=createGuidedTokenWaypoints([
    {kind:"road",points:[point(100,100),point(150,130),point(200,100)]},
    {kind:"road",points:[point(200,100),point(250,80),point(300,100)]}
  ],token,100);
  assert.deepEqual(waypoints[0],point(50,50));
  assert.deepEqual(waypoints.at(-1),point(250,50));
  assert.ok(waypoints.some(p=>p.y>50),"the road's visible curve is preserved");
  assert.ok(waypoints.some(p=>p.y<50),"the second road bend is preserved");
  assert.equal(waypoints.filter(p=>p.x===150&&p.y===50).length,1);
});

test("guided movement fails closed for missing token, unrelated departure, and complex paths",()=>{
  const legPaths=[{kind:"road",points:[point(100,100),point(200,100)]}];
  assert.throws(()=>createGuidedTokenWaypoints(legPaths,null,100),/eligible token/);
  assert.throws(()=>createGuidedTokenWaypoints(legPaths,{...token,x:500},100),
    /Place Point A/);
  const jagged=[point(100,100)];
  for(let i=1;i<=25;i++)jagged.push(point(100+i*10,100+(i%2?20:-20)));
  assert.throws(()=>createGuidedTokenWaypoints([{kind:"road",points:jagged}],token,100,
    {maxWaypoints:5}),/too detailed/);
  assert.throws(()=>createGuidedTokenWaypoints([{kind:"road",points:[point(100,100),point(Infinity,10)]}],token,100),
    /invalid travel position/);
});
