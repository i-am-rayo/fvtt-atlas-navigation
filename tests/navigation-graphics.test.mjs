import test from "node:test";
import assert from "node:assert/strict";
import { drawNavigationLine, drawNavigationMarker } from "../scripts/navigation-graphics.js";

const span = [[{x:1,y:2},{x:5,y:6}]];
test("Foundry legacy Pixi graphics draws navigation strokes and endpoint rings",()=>{
  const calls=[];
  const graphics={
    lineStyle:(...args)=>calls.push(["style",...args]),
    moveTo:(...args)=>calls.push(["move",...args]),
    lineTo:(...args)=>calls.push(["line",...args]),
    beginFill:(...args)=>calls.push(["fillStart",...args]),
    drawCircle:(...args)=>calls.push(["circle",...args]),
    endFill:()=>calls.push(["fillEnd"])
  };
  drawNavigationLine(graphics,span,{width:3.5});
  drawNavigationMarker(graphics,{x:10,y:20},0x16b9a1);
  assert.deepEqual(calls[0],["style",3.5,0xffa51f,0.95]);
  assert.deepEqual(calls[1],["move",1,2]);
  assert.deepEqual(calls[2],["line",5,6]);
  assert.equal(calls.filter(call=>call[0]==="circle").length,2);
  assert.deepEqual(calls.find(call=>call[0]==="circle"),["circle",10,20,10]);
});
test("modern Pixi stroke and circle paths still work",()=>{
  const calls=[];
  const graphics={
    moveTo:(...args)=>calls.push(["move",...args]),
    lineTo:(...args)=>calls.push(["line",...args]),
    stroke:style=>calls.push(["stroke",style]),
    circle:(...args)=>{calls.push(["circle",...args]);return graphics;},
    fill:style=>{calls.push(["fill",style]);return graphics;}
  };
  drawNavigationLine(graphics,span);
  drawNavigationMarker(graphics,{x:0,y:0},0xf34c4c);
  assert.equal(calls.filter(call=>call[0]==="stroke").length,1);
  assert.equal(calls.filter(call=>call[0]==="fill").length,2);
});
test("unavailable graphics APIs fail explicitly",()=>{
  assert.throws(()=>drawNavigationLine({},span),/unavailable/);
  assert.throws(()=>drawNavigationMarker({}, {x:0,y:0},0),/unavailable/);
});
