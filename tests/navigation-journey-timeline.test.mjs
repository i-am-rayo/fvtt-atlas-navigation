import assert from "node:assert/strict";
import test from "node:test";
import { annotateJourneyDirections,projectJourneyTiming }
  from "../scripts/navigation-journey-timeline.js";

const steps=[
  {kind:"road",roadId:"r",direction:"east",instruction:"Head east to Main Road",
    distance:6,cost:6,terrain:"Dirt Road"},
  {kind:"road",roadId:"r",direction:"northeast",instruction:"Continue northeast on Main Road",
    distance:6,cost:6,terrain:"Dirt Road"}
];

test("recorded rests divide actual direction cards without modifying the itinerary",()=>{
  const source=structuredClone(steps);
  const result=annotateJourneyDirections(steps,[
    {action:"short",atHours:4,hours:1},
    {action:"continue",atHours:4,hours:0},
    {action:"long",atHours:9,hours:8}
  ],{travelHours:12,speed:1});
  assert.deepEqual(result.map(step=>step.kind),[
    "road","journey-event","journey-event","road","road", "journey-event","road"
  ]);
  assert.deepEqual(result.filter(step=>step.kind==="journey-event").map(step=>step.label),
    ["Short Rest","Continue March","Long Rest"]);
  assert.deepEqual(result.filter(step=>step.kind==="road").map(step=>step.distance),
    [4,2,3,3]);
  assert.equal(result[3].instruction,"Continue east on Main Road");
  assert.deepEqual(steps,source,"live directions must never mutate the saved itinerary");
});

test("elapsed travel time includes completed rest, while ETA includes future breaks",()=>{
  const result=projectJourneyTiming({travelHours:19.7,percent:40,totalHours:51.7,
    breakHours:0});
  assert.ok(Math.abs(result.movingHours-7.88)<1e-8);
  assert.ok(Math.abs(result.etaHours-43.82)<1e-8);
  const rested=projectJourneyTiming({travelHours:19.7,percent:80,totalHours:44.7,
    breakHours:9});
  assert.ok(Math.abs(rested.elapsedHours-24.76)<1e-8);
  assert.ok(Math.abs(rested.etaHours-19.94)<1e-8);
  assert.throws(()=>annotateJourneyDirections(steps,[{atHours:-2,hours:1}],
    {travelHours:12,speed:1}),/Journey event/);
});
