import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));

test("release and development manifests target the intended branch",()=>{
  const pkg=read("../package.json");
  const manifest=read("../module.json");
  assert.equal(pkg.version,manifest.version);
  assert.equal(manifest.id,"fvtt-atlas-navigation");
  if(!manifest.version.includes("-")){
    assert.equal(manifest.manifest,
      "https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/main/module.json");
    assert.equal(manifest.download,
      "https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/main.zip");
  }else{
    const base="https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/";
    assert.ok(manifest.manifest.startsWith(base));
    const suffix=manifest.manifest.slice(base.length);
    assert.ok(suffix.endsWith("/module.json"));
    const branch=suffix.slice(0,-"/module.json".length);
    assert.ok(branch&&branch!=="main",
      "an unreleased development build must not point to main");
    assert.equal(manifest.download,
      "https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/"+branch+".zip");
  }
});
