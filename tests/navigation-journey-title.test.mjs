import assert from "node:assert/strict";
import test from "node:test";
import { closestJourneyCheckpoint,nativeJourneyDate,journeyWorldStamp,navigationJourneyTitle }
  from "../scripts/navigation-journey-title.js";

const atlas={
  nodes:[{id:"a",x:0,y:0},{id:"b",x:100,y:0},{id:"c",x:40,y:80}],
  checkpoints:[{id:"cp-a",nodeId:"a",name:"Dirwest"},
    {id:"cp-b",nodeId:"b",name:"Millstone"},
    {id:"cp-c",nodeId:"c",name:"Southern Bridge"}]
};

test("Journal titles use the native campaign start date and nearest Scene checkpoints",()=>{
  const timestamps=[];
  const time={worldTime:86400*136,calendar:{format(value){
    timestamps.push(value);return "14 Marpenoth 1492, 09:45";
  }}};
  const name=navigationJourneyTitle({atlas,departure:{x:2,y:4},
    destination:{x:98,y:0},time});
  assert.equal(name,"14 Marpenoth 1492, 09:45 — Dirwest to Millstone");
  assert.deepEqual(timestamps,[time.worldTime]);
  assert.deepEqual(journeyWorldStamp(time),{seconds:time.worldTime,
    label:"14 Marpenoth 1492, 09:45"});
  assert.equal(closestJourneyCheckpoint(atlas,{x:39,y:79}).name,"Southern Bridge");
});

test("no checkpoint or calendar yields an honest fallback without inventing a real date",()=>{
  assert.equal(nativeJourneyDate({worldTime:0,calendar:{format(){throw Error("Not ready");}}}),null);
  assert.equal(navigationJourneyTitle({atlas:{nodes:[],checkpoints:[]},
    departure:{x:0,y:0},destination:{x:1,y:1},time:null}),
  "Atlas Journey — Map Point A to Map Point B");
  assert.equal(closestJourneyCheckpoint(atlas,{x:NaN,y:0}),null);
  assert.deepEqual(journeyWorldStamp(null),{seconds:null,label:null});
});
