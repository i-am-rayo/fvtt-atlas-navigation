import assert from "node:assert/strict";
import test from "node:test";
import { ATLAS_DEBUG_CATEGORIES,ATLAS_DEBUG_LEVEL_SETTING,ATLAS_DEBUG_LEVELS,
  registerAtlasDebugSettings,atlasDebugEnabled,atlasDebug,atlasWarn }
  from "../scripts/atlas-debug.js";

test("one browser-local logging dropdown replaces all redundant World checkboxes",()=>{
  const registered=new Map();
  registerAtlasDebugSettings({settings:{register(namespace,key,options){
    assert.equal(namespace,"fvtt-atlas-navigation");
    assert.equal(registered.has(key),false);
    registered.set(key,options);
  }}});
  assert.equal(registered.size,1,"no category checkboxes should be registered");
  const only=registered.get(ATLAS_DEBUG_LEVEL_SETTING);
  assert.ok(only);
  assert.deepEqual(only.choices,ATLAS_DEBUG_LEVELS);
  assert.deepEqual(Object.keys(only.choices),["off","standard","verbose","trace"]);
  assert.equal(only.default,"off");
  assert.equal(only.type,String);
  assert.equal(only.scope,"client","console logging must not trigger a World Setting write");
  assert.equal(only.config,true);
  assert.match(only.hint,/browser only/);
  assert.equal(Object.keys(ATLAS_DEBUG_CATEGORIES).length,5);
  let level="off";
  const settings={get(_namespace,key){
    if(key===ATLAS_DEBUG_LEVEL_SETTING)return level;
    throw Error("Retired category settings must never be read");
  }};
  const gm={isGM:true};
  assert.equal(atlasDebugEnabled("journey",{settings,user:gm}),false);
  level="standard";
  assert.equal(atlasDebugEnabled("journey",{settings,user:gm}),true);
  assert.equal(atlasDebugEnabled("fog",{settings,user:gm,level:"verbose"}),false);
  assert.equal(atlasDebugEnabled("movement",{settings,user:gm}),true);
  assert.equal(atlasDebugEnabled("journey",{settings,user:{isGM:false}}),false);
  level="verbose";
  assert.equal(atlasDebugEnabled("fog",{settings,user:gm,level:"verbose"}),true);
  assert.equal(atlasDebugEnabled("fog",{settings,user:gm,level:"trace"}),false);
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
      return key===ATLAS_DEBUG_LEVEL_SETTING?level:false;
    }}};
    atlasDebug("journey","started",{sceneId:"example"});
    assert.equal(debug.length,0);
    level="standard";
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
