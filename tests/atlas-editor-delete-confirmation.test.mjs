import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Atlas map destruction dialogs default to Cancel rather than Delete",()=>{
  const source=read("scripts/main.js");
  const marker=source.slice(source.indexOf("async deleteCheckpointWithDependents("));
  const road=source.slice(source.indexOf("async remove(scene, road, refresh)"));
  for(const [section,label] of [[marker,"Delete Confirmed Items"],[road,"Delete Road and Confirmed Items"]]){
    const start=section.indexOf("const result=await DialogV2.input");
    assert.ok(start>=0);
    const block=section.slice(start,section.indexOf("if(!result)",start));
    assert.ok(block.includes(label));
    assert.match(block,/ok:\{label:[^}]+,default:false\}/);
    assert.match(block,/action:"cancel",label:"Cancel",default:true,callback:\(\)=>null/);
  }
  const region=source.slice(source.indexOf('window:{title:"Delete Terrain Region?'),source.indexOf("if(!approved)return false;",source.indexOf('window:{title:"Delete Terrain Region?')));
  assert.match(region,/yes:\{label:"Delete Region",default:false\}/);
  assert.match(region,/no:\{label:"Cancel",default:true\}/);
});

test("Atlas preset deletion confirmations explicitly focus Cancel",()=>{
  for(const [path,start] of [["scripts/checkpoint-preset-settings.js","async _delete(preset)"],["scripts/navigation-transport-settings.js","async _delete(preset)"],["scripts/travel-preset-settings.js","async _deletePreset(preset)"]]){
    const source=read(path),section=source.slice(source.indexOf(start));
    assert.match(section,/yes:\{label:"Delete [^"]+",default:false\}/);
    assert.match(section,/no:\{label:"Cancel",default:true\}/);
  }
});
