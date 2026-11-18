import test from "node:test";
import assert from "node:assert/strict";
import { resolveManualBrushMode } from "../scripts/atlas-manual-fog-shortcuts.js";
const settings={reveal:"alt",hide:"shift"};
test("Shortcut only active when palette is open",()=>{
 assert.equal(resolveManualBrushMode(null,{altKey:true},settings,false),null);
 assert.equal(resolveManualBrushMode(null,{altKey:true},settings,true),"reveal");
 assert.equal(resolveManualBrushMode(null,{shiftKey:true},settings,true),"hide");
});
test("Modifier overrides selected brush temporarily",()=>{
 assert.equal(resolveManualBrushMode("clear",{shiftKey:true},settings,true),"hide");
 assert.equal(resolveManualBrushMode("hide",{altKey:true},settings,true),"reveal");
 assert.equal(resolveManualBrushMode("clear",{},settings,true),"clear");
});
test("Custom modifiers and collisions are deterministic",()=>{
 assert.equal(resolveManualBrushMode(null,{ctrlKey:true},{reveal:"ctrl",hide:"meta"},true),"reveal");
 assert.equal(resolveManualBrushMode(null,{metaKey:true},{reveal:"ctrl",hide:"meta"},true),"hide");
 assert.equal(resolveManualBrushMode(null,{altKey:true},{reveal:"alt",hide:"alt"},true),null);
 assert.equal(resolveManualBrushMode(null,{altKey:true},{reveal:"off",hide:"off"},true),null);
});
