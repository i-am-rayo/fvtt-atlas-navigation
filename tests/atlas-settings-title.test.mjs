import test from "node:test";
import assert from "node:assert/strict";
import {atlasSettingsTitle,atlasTerrainRegionSheetClass}
  from "../scripts/atlas-settings-title.js";

test("Atlas object settings titles retain the selected object identity across tabs",()=>{
  assert.equal(atlasSettingsTitle("Checkpoint","Hearth's Heart"),
    "Atlas — Hearth's Heart — Checkpoint Settings");
  assert.equal(atlasSettingsTitle("Road","The King's Road"),
    "Atlas — The King's Road — Road Settings");
  assert.equal(atlasSettingsTitle("Geographic Territory","Dirwest"),
    "Atlas — Dirwest — Geographic Territory Settings");
  assert.equal(atlasSettingsTitle("Road",null,{creating:true}),
    "Atlas — New Road — Road Settings");
  assert.equal(atlasSettingsTitle("Checkpoint",null,{creating:true}),
    "Atlas — New Checkpoint — Checkpoint Settings");
  assert.equal(atlasSettingsTitle("Terrain Region"," \n  The Eyrie   "),
    "Atlas — The Eyrie — Terrain Region Settings");
  assert.equal(atlasSettingsTitle("Checkpoint",null),
    "Atlas — Unnamed Checkpoint — Checkpoint Settings");
});

test("native RegionConfig keeps its own render and update behavior while Atlas supplies a title",async()=>{
  const touched=[];
  class NativeRegionConfig{
    constructor({document}){this.document=document;}
    get title(){return "Native Region";}
    async render(options){touched.push(options);return this;}
    bringToFront(){touched.push("front");}
  }
  const RegionSheet=atlasTerrainRegionSheetClass(NativeRegionConfig);
  const region={name:"Dirwest"};
  const sheet=new RegionSheet({document:region});
  assert.equal(sheet instanceof NativeRegionConfig,true);
  assert.equal(sheet.title,"Atlas — Dirwest — Terrain Region Settings");
  await sheet.render({force:true});sheet.bringToFront();
  assert.deepEqual(touched,[{force:true},"front"]);
  region.name="Dirwest East";
  assert.equal(sheet.title,"Atlas — Dirwest East — Terrain Region Settings",
    "a renamed native Region is reflected without overwriting the Region name");
  assert.equal(Object.hasOwn(region,"title"),false);
});
