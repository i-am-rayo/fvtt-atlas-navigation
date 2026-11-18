import assert from "node:assert/strict";
import test from "node:test";
import { registerNavigationWorldSettings } from "../scripts/navigation-world-settings.js";
import { NAVIGATION_PLAYBACK_SETTING } from "../scripts/navigation-playback.js";
import { GROUP_TRANSPORT_SETTING } from "../scripts/navigation-group-transport.js";
import { NAVIGATION_RULES_PROFILE_SETTING } from "../scripts/navigation-rules-profile.js";
import { CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
  CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING }
  from "../scripts/navigation-rules-profile.js";
import { NAVIGATION_WORLD_CLOCK_SETTING } from "../scripts/navigation-world-clock.js";
import { NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING }
  from "../scripts/navigation-travel-method.js";
import {ATLAS_LEVEL_PLANNER_SETTING} from "../scripts/navigation-native-level-model.js";

test("navigation World Settings register once in a reusable module with bounded slider",()=>{
  const catalog=new Map(),menus=new Map();
  const settings={registerMenu(namespace,name,options){
    assert.equal(namespace,"fvtt-atlas-navigation");menus.set(name,options);
  },register(namespace,name,options){
    assert.equal(namespace,"fvtt-atlas-navigation");
    assert.equal(catalog.has(name),false,`duplicate ${name}`);
    catalog.set(name,options);
  }};
  let updates=0;
  registerNavigationWorldSettings({settings,onPlaybackChange:()=>updates++});
  assert.equal(catalog.size,13,"includes the new opt-in native Level planner");
  const levels=catalog.get(ATLAS_LEVEL_PLANNER_SETTING);
  assert.equal(levels.config,true);
  assert.equal(levels.default,true);
  assert.equal(levels.restricted,true);
  assert.equal(menus.get("atlasTransportationPresetsMenu").restricted,true);
  assert.equal(catalog.get("guidedTransportationCatalog").config,false);
  const groupConfig=catalog.get(GROUP_TRANSPORT_SETTING);
  assert.equal(groupConfig.scope,"world");
  assert.equal(groupConfig.config,false);
  assert.deepEqual(groupConfig.default,{version:4,groups:{}});

  assert.ok(typeof menus.get("atlasTransportationPresetsMenu").type==="function");
  assert.equal(catalog.get(NAVIGATION_MOUNTED_SPEED_SETTING).default,3);
  assert.equal(catalog.get(NAVIGATION_SAILING_SPEED_SETTING).default,2);
  for(const key of [NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING]){
    assert.equal(catalog.get(key).scope,"world");
    assert.match(catalog.get(key).hint,/planning only/);
  }
  const slider=catalog.get(NAVIGATION_PLAYBACK_SETTING);
  assert.deepEqual(slider.range,{min:0.5,max:30,step:0.5});
  assert.equal(slider.default,2);
  assert.equal(slider.scope,"world");
  assert.equal(slider.config,false);
  slider.onChange(4);
  assert.equal(updates,1);
  const rules=catalog.get(NAVIGATION_RULES_PROFILE_SETTING);
  assert.equal(rules.config,false);
  assert.deepEqual(Object.keys(rules.choices),["system","dnd5e2014","dnd5e2024","custom"]);
  assert.equal(rules.default,"system");
  assert.match(rules.hint,/GM-confirmed rests/);
  for(const key of [CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
    CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING]){
    const option=catalog.get(key);
    assert.equal(option.scope,"world");
    assert.ok(option.range.min<=option.default&&option.default<=option.range.max);
  }
  const worldClock=catalog.get(NAVIGATION_WORLD_CLOCK_SETTING);
  assert.equal(worldClock.default,false,"World time advancement is off for existing Worlds");
  assert.equal(worldClock.scope,"world");
  assert.equal(worldClock.config,false);
  assert.equal(worldClock.type,Boolean);
  assert.match(worldClock.hint,/active GM advances Foundry World time/);
  assert.match(worldClock.hint,/confirmed token movement/);
  assert.match(worldClock.hint,/explicitly selected short rest/);
});
