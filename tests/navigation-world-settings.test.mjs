import assert from "node:assert/strict";
import test from "node:test";
import { registerNavigationWorldSettings } from "../scripts/navigation-world-settings.js";
import { NAVIGATION_PLAYBACK_SETTING } from "../scripts/navigation-playback.js";
import { NAVIGATION_RULES_PROFILE_SETTING } from "../scripts/navigation-rules-profile.js";

test("navigation World Settings register once in a reusable module with bounded slider",()=>{
  const catalog=new Map();
  const settings={register(namespace,name,options){
    assert.equal(namespace,"fvtt-atlas-navigation");
    assert.equal(catalog.has(name),false,`duplicate ${name}`);
    catalog.set(name,options);
  }};
  let updates=0;
  registerNavigationWorldSettings({settings,onPlaybackChange:()=>updates++});
  assert.equal(catalog.size,3);
  const slider=catalog.get(NAVIGATION_PLAYBACK_SETTING);
  assert.deepEqual(slider.range,{min:0.5,max:8,step:0.5});
  assert.equal(slider.default,2);
  assert.equal(slider.scope,"world");
  assert.equal(slider.config,true);
  slider.onChange(4);
  assert.equal(updates,1);
  const rules=catalog.get(NAVIGATION_RULES_PROFILE_SETTING);
  assert.deepEqual(Object.keys(rules.choices),["system","dnd5e2014","dnd5e2024","custom"]);
  assert.equal(rules.default,"system");
  assert.match(rules.hint,/does not yet apply rest, exhaustion/);
});
