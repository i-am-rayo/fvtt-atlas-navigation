import assert from "node:assert/strict";
import test from "node:test";
import { ATLAS_DEBUG_CATEGORIES,ATLAS_DEBUG_LEVEL_SETTING,ATLAS_DEBUG_LEVELS,
  registerAtlasDebugSettings,atlasDebugEnabled,atlasDebug,atlasWarn }
  from "../scripts/atlas-debug.js";

test("GM can independently choose diagnostic categories and verbosity",()=>{
  const registered=new Map();
  registerAtlasDebugSettings({settings:{register(namespace,key,options){
    assert.equal(namespace,"fvtt-atlas-navigation");
    assert.equal(registered.has(key),false);
    registered.set(key,options);
  }}});
  assert.equal(registered.size,1+Object.keys(ATLAS_DEBUG_CATEGORIES).length);
  assert.deepEqual(registered.get(ATLAS_DEBUG_LEVEL_SETTING).choices,ATLAS_DEBUG_LEVELS);
  assert.equal(registered.get(ATLAS_DEBUG_LEVEL_SETTING).default,"off");
  for(const {key} of Object.values(ATLAS_DEBUG_CATEGORIES)){
    const setting=registered.get(key);
    assert.equal(setting.type,Boolean);
    assert.equal(setting.default,false);
    assert.equal(setting.scope,"world");
    assert.equal(setting.config,true);
  }
  const enabled=new Set(["debugJourney","debugFog"]);
  let level="off";
  const settings={get(_namespace,key){
    if(key===ATLAS_DEBUG_LEVEL_SETTING)return level;
    return enabled.has(key);
  }};
  const gm={isGM:true};
  assert.equal(atlasDebugEnabled("journey",{settings,user:gm}),false);
  level="info";
  assert.equal(atlasDebugEnabled("journey",{settings,user:gm}),true);
  assert.equal(atlasDebugEnabled("fog",{settings,user:gm,level:"verbose"}),false);
  assert.equal(atlasDebugEnabled("movement",{settings,user:gm}),false);
  assert.equal(atlasDebugEnabled("journey",{settings,user:{isGM:false}}),false);
  level="trace";
  assert.equal(atlasDebugEnabled("fog",{settings,user:gm,level:"trace"}),true);
  assert.equal(atlasDebugEnabled("not-a-category",{settings,user:gm}),false);
  assert.equal(atlasDebugEnabled("fog",{settings:{get(){throw Error("not registered");}},user:gm}),false);
});

test("diagnostic console is quiet by default, but failures always remain visible",()=>{
  const prior={game:globalThis.game,debug:console.debug,warn:console.warn};
  const debug=[],warnings=[];
  try{
    console.debug=(...args)=>debug.push(args);
    console.warn=(...args)=>warnings.push(args);
    let level="off";
    globalThis.game={user:{isGM:true},settings:{get(_namespace,key){
      return key===ATLAS_DEBUG_LEVEL_SETTING?level:key==="debugJourney";
    }}};
    atlasDebug("journey","started",{sceneId:"example"});
    assert.equal(debug.length,0);
    level="info";
    atlasDebug("journey","started",{sceneId:"example"});
    atlasDebug("journey","stretch",undefined,{level:"verbose"});
    assert.equal(debug.length,1);
    assert.match(debug[0][0],/\[journey\] started/);
    atlasWarn("journey","Something stopped");
    assert.equal(warnings.length,1);
    assert.match(warnings[0][0],/Something stopped/);
  }finally{
    globalThis.game=prior.game;console.debug=prior.debug;console.warn=prior.warn;
  }
});
