import assert from "node:assert/strict";
import test from "node:test";
import {planAtlasNativeLevels,defaultNativeLevelRanges,ATLAS_LEVEL_PLANNER_SETTING}
  from "../scripts/navigation-native-level-model.js";
import {registerNavigationWorldSettings} from "../scripts/navigation-world-settings.js";

const requested=(id,bottom,top)=>({id,elevation:{bottom,top}});
test("native Level planning is a pure opt-in proposal in Scene measurement units",()=>{
  const selected=[requested("underground",-200,-10),requested("surface",-10,10),
    requested("aerial",10,400)];
  const planned=planAtlasNativeLevels({requested:selected,existing:[]});
  assert.deepEqual(planned.create,[
    {name:"Underground",elevation:{bottom:-200,top:-10},
      flags:{"fvtt-atlas-navigation":{environment:"underground"}}},
    {name:"Surface",elevation:{bottom:-10,top:10},
      flags:{"fvtt-atlas-navigation":{environment:"surface"}}},
    {name:"Aerial",elevation:{bottom:10,top:400},
      flags:{"fvtt-atlas-navigation":{environment:"aerial"}}}
  ]);
  assert.equal(planned.categories.length,3);
  assert.deepEqual(selected[0],requested("underground",-200,-10),
    "planning never mutates the GM's draft");
});

test("native overlapping Levels are legal, warned and distinguished by Atlas environment",()=>{
  const already=[{id:"ocean",name:"Shallow Seas",elevation:{bottom:-20,top:0}}];
  const proposed=planAtlasNativeLevels({requested:[requested("underwater",-30,-10),
    requested("underground",-30,-10)],existing:already});
  assert.equal(proposed.create.length,2);
  assert.equal(proposed.warnings.length,3);
  assert.equal(proposed.create[0].flags["fvtt-atlas-navigation"].environment,"underwater");
  assert.equal(proposed.create[1].flags["fvtt-atlas-navigation"].environment,"underground");
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("surface",0,20)],
    existing:[{name:"SURFACE",elevation:{bottom:100,top:200}}]}),/already exists/);
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("aerial",10,0)],
    existing:[]}),/valid elevation ranges/);
  assert.equal(planAtlasNativeLevels({requested:[requested("surface",0,20),
    requested("aerial",19,40)],existing:[]}).warnings.length,1);
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("underwater",NaN,-1)],
    existing:[]}),/valid elevation ranges/);
  assert.deepEqual(already,[{id:"ocean",name:"Shallow Seas",elevation:{bottom:-20,top:0}}]);
});

test("adopting a native default Level updates by ID without deleting it",()=>{
  const result=planAtlasNativeLevels({requested:[{
    ...requested("surface",0,.3),targetLevelId:"core-level"}],
  existing:[{id:"core-level",name:"Level",elevation:{bottom:0,top:20}}]});
  assert.equal(result.create.length,0);
  assert.deepEqual(result.update,[{_id:"core-level",name:"Surface",
    elevation:{bottom:0,top:.3},
    "flags.fvtt-atlas-navigation.environment":"surface"}]);
  assert.throws(()=>planAtlasNativeLevels({requested:[{
    ...requested("surface",0,.3),targetLevelId:"stale-level"}],
  existing:[{id:"core-level",name:"Level",elevation:{bottom:0,top:20}}]}),
  /valid, unique document ID/);
});

test("meter presets convert into native km, ft or mile Scene units",()=>{
  assert.deepEqual(defaultNativeLevelRanges("km"),{
    surface:{bottom:0,top:.3},aerial:{bottom:.3,top:3},
    underwater:{bottom:-.3,top:0},underground:{bottom:-3,top:0}});
  assert.equal(defaultNativeLevelRanges("ft").aerial.bottom.toFixed(2),"984.25");
  assert.equal(defaultNativeLevelRanges("mi").surface.top.toFixed(4),"0.1864");
  assert.equal(defaultNativeLevelRanges("mystery"),null);
});

test("native Scene Level setup is World-enabled but requires per-Scene GM opt-in",()=>{
  const values=new Map();
  registerNavigationWorldSettings({settings:{register:(namespace,key,options)=>{
    values.set(key,options);
  },registerMenu:()=>{}}});
  const option=values.get(ATLAS_LEVEL_PLANNER_SETTING);
  assert.equal(option.scope,"world");
  assert.equal(option.restricted,true);
  assert.equal(option.default,true);
  assert.equal(option.config,true);
});
