import assert from "node:assert/strict";
import test from "node:test";
import {measureAuthoredRoadDistance}
  from "../scripts/road-measured-distance.js";

const metric=path=>({distance:path.slice(1).reduce((sum,p,i)=>
  sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0)});

test("native Grid measures every authored section, including bends, without spline or terrain costs",()=>{
  const original={schemaVersion:10,
    nodes:[{id:"a",x:0,y:0},{id:"b",x:3,y:4},{id:"c",x:6,y:4}],
    segments:[
      {id:"s1",roadId:"chosen",from:"a",to:"b",via:[]},
      {id:"s2",roadId:"chosen",from:"b",to:"c",via:[]},
      {id:"other",roadId:"different",from:"a",to:"c",via:[]}
    ]};
  const snapshot=structuredClone(original),calls=[];
  const value=measureAuthoredRoadDistance({atlas:original,roadId:"chosen"},
    points=>{calls.push(points);return metric(points);});
  assert.equal(value,8);
  assert.equal(calls.length,2,"each authored Road section is measured separately");
  assert.deepEqual(calls[0],[{x:0,y:0},{x:3,y:4}]);
  assert.deepEqual(calls[1],[{x:3,y:4},{x:6,y:4}]);
  assert.deepEqual(original,snapshot,"measuring is read-only");
});

test("new and unsaved Roads measure their actual draft polyline and reflect Undo",()=>{
  const focus={atlas:{schemaVersion:10},points:[
    {x:0,y:0},{x:3,y:4},{x:6,y:4}]};
  assert.equal(measureAuthoredRoadDistance(focus,metric),8);
  const edited={...focus,points:focus.points.slice(0,-1)};
  assert.equal(measureAuthoredRoadDistance(edited,metric),5,
    "the current draft, not an earlier persisted snapshot, is measured");
  assert.equal(measureAuthoredRoadDistance({...focus,points:[focus.points[0]]},metric),null);
  assert.deepEqual(focus.points,[{x:0,y:0},{x:3,y:4},{x:6,y:4}]);
});

test("missing nodes, non-finite coordinates or invalid native measurement never invent a Road distance",()=>{
  const focus={atlas:{schemaVersion:10,nodes:[{id:"a",x:0,y:0}],
    segments:[{roadId:"road",from:"a",to:"missing",via:[]}]},roadId:"road"};
  assert.equal(measureAuthoredRoadDistance(focus,metric),null);
  assert.equal(measureAuthoredRoadDistance({atlas:{schemaVersion:10},
    points:[{x:0,y:0},{x:Infinity,y:3}]},metric),null);
  assert.equal(measureAuthoredRoadDistance({atlas:{schemaVersion:10},
    points:[{x:0,y:0},{x:1,y:1}]},()=>({distance:NaN})),null);
});
