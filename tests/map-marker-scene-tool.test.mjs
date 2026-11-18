import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("quick Add Map Marker tool stays GM-only and reuses Workspace authoring",()=>{
  const source=readFileSync(new URL("../scripts/main.js",import.meta.url),"utf8");
  const hook=source.slice(source.indexOf('Hooks.on("getSceneControlButtons"'));
  const playerExit=hook.indexOf("      return;");
  const tool=hook.indexOf("atlasAddMapMarker:{");
  assert.ok(playerExit>=0 && tool>playerExit,
    "the marker tool is registered only after non-GM controls exit");
  assert.match(hook.slice(tool,tool+550),
    /roadActions\.beginCheckpoint\(scene,\(\)=>refreshAtlasWorkspaceFromAuthoring\(scene\)\)/);
  assert.match(hook.slice(tool,tool+550),/icon:"fa-solid fa-location-dot",order:1/);
});
