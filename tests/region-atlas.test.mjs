import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID } from "../scripts/atlas-storage.js";
import {
  REGION_ATLAS_FLAG, REGION_ATLAS_SCHEMA_VERSION,
  validateRegionAtlasLink, readRegionAtlasLink,
  summarizeRegionBehaviors, listSceneRegions, linkAtlasRegion, unlinkAtlasRegion
} from "../scripts/region-atlas.js";

function mockRegion(id, options = {}) {
  const flags = new Map();
  if (Object.hasOwn(options, "flag")) flags.set(REGION_ATLAS_FLAG, options.flag);
  const writes = [];
  const region = {
    id,
    name: options.name ?? id,
    parent: { id: options.sceneId ?? "scene-a" },
    hidden: options.hidden ?? false,
    shapes: options.shapes ?? [{ id: "shape-1", type: "polygon" }],
    elevation: options.elevation ?? { bottom: 10, top: 20 },
    behaviors: options.behaviors ?? [],
    canUserModify: () => options.editable ?? true,
    getFlag(scope, key) {
      assert.equal(scope, MODULE_ID);
      return flags.get(key);
    },
    async setFlag(scope, key, value) {
      assert.equal(scope, MODULE_ID);
      writes.push({ method: "set", key, value });
      flags.set(key, structuredClone(value));
    },
    async unsetFlag(scope, key) {
      assert.equal(scope, MODULE_ID);
      writes.push({ method: "unset", key });
      flags.delete(key);
    }
  };
  return { region, flags, writes };
}

function mockScene(regions = [], editable = true) {
  const items = new Map(regions.map(region => [region.id, region]));
  return {
    id: "scene-a",
    regions: {
      get: id => items.get(id),
      [Symbol.iterator]: function* () { yield* items.values(); }
    },
    canUserModify: () => editable
  };
}

function gm(value = true) {
  globalThis.game = { user: { isGM: value } };
}

test("Region association schema accepts exactly one versioned opt-in marker", () => {
  assert.equal(REGION_ATLAS_FLAG, "atlas");
  assert.equal(REGION_ATLAS_SCHEMA_VERSION, 1);
  assert.equal(validateRegionAtlasLink(undefined), null);
  assert.deepEqual(validateRegionAtlasLink({ schemaVersion: 1, linked: true }),
    { schemaVersion: 1, linked: true });
  for (const malformed of [
    {}, [], true, "linked", { schemaVersion: 2, linked: true },
    { schemaVersion: 1, linked: false },
    { schemaVersion: 1, linked: true, speedMultiplier: 0.5 }
  ]) {
    assert.throws(() => validateRegionAtlasLink(malformed), /Unsupported Atlas Region/);
  }
});

test("Region listing uses native names/Behavior active state and isolates unsupported flags", () => {
  const active = mockRegion("r1", {
    name: "Marsh", flag: { schemaVersion: 1, linked: true },
    behaviors: [{ id: "b1", name: "Difficult Terrain", type: "system.difficult", active: true },
      { id: "b2", type: "modifyMovementCost", active: false }]
  }).region;
  const hidden = mockRegion("r2", { name: "Old Cave", hidden: true }).region;
  const invalid = mockRegion("r3", {
    name: "Future Version", flag: { schemaVersion: 99, linked: true }
  }).region;
  const otherScene = mockRegion("r4", { name: "Unrelated Scene" }).region;
  const listed = listSceneRegions(mockScene([hidden, invalid, active]));
  assert.equal(listed.length, 3);
  assert.equal(listed.find(item => item.id === "r1").linked, true);
  assert.deepEqual(listed.find(item => item.id === "r1").behaviors.map(item => item.active),
    [true, false]);
  assert.equal(listed.find(item => item.id === "r2").hidden, true);
  assert.equal(listed.find(item => item.id === "r3").invalidLink, true);
  assert.equal(listed.some(item => item.id === otherScene.id), false);
  assert.equal(summarizeRegionBehaviors(active)[1].name, "modifyMovementCost");
});

test("Link and unlink touch only the Region namespaced flag, never native data or Scene Atlas", async () => {
  gm();
  const entry = mockRegion("r1");
  const region = entry.region;
  const scene = mockScene([region]);
  const shape = region.shapes;
  const behaviors = region.behaviors;
  const level = region.elevation;
  const snapshot = { name: region.name, hidden: region.hidden };
  await linkAtlasRegion(scene, region.id);
  assert.deepEqual(readRegionAtlasLink(region), { schemaVersion: 1, linked: true });
  assert.deepEqual(entry.writes, [{
    method: "set", key: REGION_ATLAS_FLAG,
    value: { schemaVersion: 1, linked: true }
  }]);
  assert.equal(region.shapes, shape);
  assert.equal(region.behaviors, behaviors);
  assert.equal(region.elevation, level);
  assert.equal(region.name, snapshot.name);
  assert.equal(region.hidden, snapshot.hidden);
  assert.equal(Object.hasOwn(scene, "flags"), false);
  await unlinkAtlasRegion(scene, region.id);
  assert.equal(readRegionAtlasLink(region), null);
  assert.deepEqual(entry.writes[1], { method: "unset", key: REGION_ATLAS_FLAG });
  assert.equal(region.shapes, shape);
  assert.equal(region.behaviors, behaviors);
  assert.equal(region.elevation, level);
});

test("Association commands refuse non-GM, read-only Scene and read-only Region", async () => {
  const region = mockRegion("r1").region;
  const scene = mockScene([region]);
  gm(false);
  await assert.rejects(linkAtlasRegion(scene, "r1"), /Only a GM/);
  gm(true);
  await assert.rejects(linkAtlasRegion(mockScene([region], false), "r1"), /Only a GM/);
  const restricted = mockRegion("r2", { editable: false }).region;
  await assert.rejects(linkAtlasRegion(mockScene([restricted]), "r2"), /permission/);
});

test("Stale, foreign, and invalid Region IDs cannot link or unlink", async () => {
  gm();
  const foreign = mockRegion("foreign", { sceneId: "another-scene" }).region;
  const scene = mockScene([foreign]);
  await assert.rejects(linkAtlasRegion(scene, "missing"), /no longer belongs/);
  await assert.rejects(linkAtlasRegion(scene, "foreign"), /no longer belongs/);
  await assert.rejects(linkAtlasRegion(scene, ""), /valid Region/);
  await assert.rejects(unlinkAtlasRegion(scene, "foreign"), /no longer belongs/);
});

test("Existing, missing and future-schema link flags are never silently overwritten", async () => {
  gm();
  const linked = mockRegion("linked", { flag: { schemaVersion: 1, linked: true } });
  const unknown = mockRegion("future", { flag: { schemaVersion: 2, linked: true } });
  const free = mockRegion("free");
  const scene = mockScene([linked.region, unknown.region, free.region]);
  await assert.rejects(linkAtlasRegion(scene, "linked"), /already linked/);
  await assert.rejects(unlinkAtlasRegion(scene, "free"), /no longer linked/);
  await assert.rejects(linkAtlasRegion(scene, "future"), /Unsupported/);
  await assert.rejects(unlinkAtlasRegion(scene, "future"), /Unsupported/);
  assert.equal(linked.writes.length, 0);
  assert.equal(unknown.writes.length, 0);
  assert.equal(free.writes.length, 0);
});
