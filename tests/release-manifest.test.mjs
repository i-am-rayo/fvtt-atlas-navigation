import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));

test("release package and Foundry manifest agree and install from main",()=>{
  const pkg=read("../package.json");
  const manifest=read("../module.json");
  assert.equal(pkg.version,manifest.version);
  assert.equal(manifest.id,"fvtt-atlas-navigation");
  if(!manifest.version.includes("-")){
    assert.equal(manifest.manifest,
      "https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/main/module.json");
    assert.equal(manifest.download,
      "https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/main.zip");
  }
});
