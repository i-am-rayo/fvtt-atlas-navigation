import assert from "node:assert/strict";
import test from "node:test";
import {planAtlasNativeLevels,ATLAS_LEVEL_PLANNER_SETTING}
  from "../scripts/navigation-native-level-model.js";
import {registerNavigationWorldSettings} from "../scripts/navigation-world-settings.js";

const requested=(id,bottom,top)=>({id,elevation:{bottom,top}});
test("native Level planning is a pure opt-in proposal in Scene measurement units",()=>{
  const selected=[requested("underground",-200,-10),requested("surface",-10,10),
    requested("aerial",10,400)];
  const planned=planAtlasNativeLevels({requested:selected,existing:[]});
  assert.deepEqual(planned.create,[
    {name:"Underground",elevation:{bottom:-200,top:-10}},
    {name:"Surface",elevation:{bottom:-10,top:10}},
    {name:"Aerial",elevation:{bottom:10,top:400}}
  ]);
  assert.equal(planned.categories.length,3);
  assert.deepEqual(selected[0],requested("underground",-200,-10),
    "planning never mutates the GM's draft");
});

test("native Levels cannot be implicitly overwritten, duplicated or overlapped",()=>{
  const already=[{name:"Shallow Seas",elevation:{bottom:-20,top:0}}];
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("underwater",-30,-10)],
    existing:already}),/overlaps/);
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("surface",0,20)],
    existing:[{name:"SURFACE",elevation:{bottom:100,top:200}}]}),/already exists/);
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("aerial",10,0)],
    existing:[]}),/valid elevation ranges/);
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("surface",0,20),
    requested("aerial",19,40)],existing:[]}),/overlaps/);
  assert.throws(()=>planAtlasNativeLevels({requested:[requested("underwater",NaN,-1)],
    existing:[]}),/valid elevation ranges/);
  assert.deepEqual(already,[{name:"Shallow Seas",elevation:{bottom:-20,top:0}}]);
});

test("native Scene Level setup remains disabled by default and World/GM controlled",()=>{
  const values=new Map();
  registerNavigationWorldSettings({settings:{register:(namespace,key,options)=>{
    values.set(key,options);
  },registerMenu:()=>{}}});
  const option=values.get(ATLAS_LEVEL_PLANNER_SETTING);
  assert.equal(option.scope,"world");
  assert.equal(option.restricted,true);
  assert.equal(option.default,false);
  assert.equal(option.config,true);
});
