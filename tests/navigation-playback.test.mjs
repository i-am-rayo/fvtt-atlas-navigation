import assert from "node:assert/strict";
import test from "node:test";
import { calculateGuidedPlayback,formatPlaybackDuration,navigationVisualDistance,
  validatePlaybackSetting,readGuidedPlaybackSetting,NAVIGATION_PLAYBACK_DEFAULT,
  MAX_PLAYBACK_SECONDS } from "../scripts/navigation-playback.js";
import { NAVIGATION_RULES_PROFILES,validateNavigationRulesProfile }
  from "../scripts/navigation-rules-profile.js";

const paths=[{kind:"road",points:[{x:0,y:0},{x:300,y:400},{x:800,y:400}]}];
const route={distance:100,cost:120,terrainAware:true};

test("visual speed scales with party travel hours and actual drawn curves",()=>{
  const playback=calculateGuidedPlayback({route,travel:{speed:6},paths,
    gridSize:100,secondsPerHour:2});
  assert.equal(playback.travelHours,20);
  assert.equal(playback.durationSeconds,40);
  assert.equal(playback.visualDistance,1000);
  assert.equal(playback.movementSpeed,0.25,
    "1000 displayed pixels / 100px per grid / 40 real seconds");
  assert.equal(formatPlaybackDuration(playback.durationSeconds),"40s");
  const slow=calculateGuidedPlayback({route,travel:{speed:6},paths,
    gridSize:100,secondsPerHour:4});
  assert.equal(slow.durationSeconds,80);
  assert.equal(slow.movementSpeed,0.125);
  const fastParty=calculateGuidedPlayback({route,travel:{speed:12},paths,
    gridSize:100,secondsPerHour:2});
  assert.equal(fastParty.durationSeconds,20);
  assert.equal(fastParty.movementSpeed,0.5);
});

test("neutral roads use measured distance; visual compression has safe bounds",()=>{
  const neutral=calculateGuidedPlayback({route:{...route,terrainAware:false},
    travel:{speed:5},paths,gridSize:100,secondsPerHour:2});
  assert.equal(neutral.travelHours,20);
  assert.equal(neutral.durationSeconds,40);
  assert.equal(calculateGuidedPlayback({route:{distance:0.1,cost:0.1,terrainAware:false},
    travel:{speed:5},paths,gridSize:100,secondsPerHour:0.5}).durationSeconds,2);
  assert.equal(calculateGuidedPlayback({route:{distance:10000,cost:10000,terrainAware:false},
    travel:{speed:5},paths,gridSize:100,secondsPerHour:8}).durationSeconds,
  MAX_PLAYBACK_SECONDS);
  assert.equal(formatPlaybackDuration(125),"2m 5s");
});

test("playback settings default safely and never accept invalid or unbounded speeds",()=>{
  assert.equal(readGuidedPlaybackSetting(null),NAVIGATION_PLAYBACK_DEFAULT);
  assert.equal(readGuidedPlaybackSetting({get:()=>1.5}),1.5);
  assert.equal(readGuidedPlaybackSetting({get:()=>30}),30);
  assert.equal(readGuidedPlaybackSetting({get:()=>100}),NAVIGATION_PLAYBACK_DEFAULT);
  assert.equal(readGuidedPlaybackSetting({get:()=>{throw Error("not registered");}}),
    NAVIGATION_PLAYBACK_DEFAULT);
  for(const invalid of [0,-1,NaN,Infinity,30.1])
    assert.throws(()=>validatePlaybackSetting(invalid));
  assert.throws(()=>calculateGuidedPlayback({route,travel:{speed:5},paths,
    gridSize:0,secondsPerHour:2}),/Grid/);
  assert.throws(()=>navigationVisualDistance([{points:[{x:1,y:1},{x:NaN,y:0}]}]),
    /invalid coordinates/);
});

test("travel-rule profiles are explicit, validated, and do not silently rewrite rules",()=>{
  assert.deepEqual(Object.keys(NAVIGATION_RULES_PROFILES),[
    "system","dnd5e2014","dnd5e2024","custom"]);
  for(const key of Object.keys(NAVIGATION_RULES_PROFILES))
    assert.equal(validateNavigationRulesProfile(key),key);
  assert.throws(()=>validateNavigationRulesProfile("unknown"),/Unknown/);
});
