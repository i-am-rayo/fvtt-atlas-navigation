import assert from "node:assert/strict";
import test from "node:test";
import { partyTokenCanvasCenter } from "../scripts/navigation-party-origin.js";

test("party departure uses the center of the actual placed token for any token size",()=>{
  assert.deepEqual(partyTokenCanvasCenter({x:120,y:230,width:1,height:1},100),{x:170,y:280});
  assert.deepEqual(partyTokenCanvasCenter({x:120,y:230,width:2,height:3},100),{x:220,y:380});
  assert.deepEqual(partyTokenCanvasCenter({x:50,y:100,width:0.5,height:0.5},200),{x:100,y:150});
});

test("party departure refuses an unassigned or invalid token",()=>{
  assert.throws(()=>partyTokenCanvasCenter(null,100),/Assign a valid placed/);
  assert.throws(()=>partyTokenCanvasCenter({x:0,y:0,width:1,height:1},0),/Assign a valid placed/);
  assert.throws(()=>partyTokenCanvasCenter({x:NaN,y:0,width:1,height:1},100),/Assign a valid placed/);
});
