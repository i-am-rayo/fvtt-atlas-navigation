import assert from "node:assert/strict";
import test from "node:test";
import { readAtlas } from "../scripts/atlas-storage.js";
import { saveNewRoad, saveRenamedRoad, saveRemovedRoad, saveReshapedRoad, saveAnchoredLegacyRoads, saveOrganizedRoads, saveMergedRoads, savePointEdits } from "../scripts/road-storage.js";
import { createEmptyAtlas, validateAtlas } from "../scripts/atlas-model.js";
import { defaultTravelPresets } from "../scripts/travel-preset-model.js";
import { DEFAULT_ROAD_APPEARANCE } from "../scripts/road-appearance.js";

function mockScene(initial) {
  let stored = initial;
  let writes = 0;
  return {
    canUserModify: () => true,
    getFlag(namespace, key) {
      assert.equal(namespace, "fvtt-atlas-navigation");
      assert.equal(key, "atlas");
      return stored;
    },
    async setFlag(namespace, key, value) {
      assert.equal(namespace, "fvtt-atlas-navigation");
      assert.equal(key, "atlas");
      stored = value;
      writes++;
      return this;
    },
    get writes() { return writes; }
  };
}

function ids() { let i = 0; return () => "id" + ++i; }

test("v0.2.22 creates a typed named road with optional appearance in one flagged revision", async () => {
  const previous = globalThis.game;
  const presets = defaultTravelPresets();
  const chosen = presets.presets.find(preset => preset.mode === "water");
  assert.ok(chosen);
  globalThis.game = { user: { isGM: true }, settings: { get: () => presets } };
  try {
    const scene = mockScene(createEmptyAtlas());
    const custom = { ...DEFAULT_ROAD_APPEARANCE, color: "#123456", pattern: "dashed",
      labelVisibility: "always", textColor: "#ffeedd" };
    const saved = await saveNewRoad(scene, {
      points: [{ x: 10, y: 30 }, { x: 100, y: 50 }],
      name: "Silver Estuary", expectedRevision: 0, idFactory: ids(),
      presetId: chosen.id, appearance: custom
    });
    assert.equal(saved.revision, 1);
    assert.equal(saved.schemaVersion, 7);
    assert.equal(saved.roads[0].name, "Silver Estuary");
    assert.equal(saved.roads[0].travelPresetId, chosen.id);
    assert.deepEqual(saved.roads[0].appearance, custom);
    assert.equal(scene.writes, 1);
    assert.deepEqual(validateAtlas(saved), saved);
    assert.throws(() => saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      name: "Bad preset", expectedRevision: 1, idFactory: ids(),
      presetId: "unknown-id"
    }), /existing world travel preset/);
    assert.equal(scene.writes, 1);
  } finally { globalThis.game = previous; }
});

test("GM can create, rename and delete a Scene road without changing old calibration", async () => {
  const prior = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  const manual = { source: "manual", unitsPerPixel: 0.05, unit: "km" };
  const scene = mockScene({
    schemaVersion: 1, revision: 6, enabled: false, calibration: manual,
    nodes: [], segments: []
  });
  try {
    const added = await saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      expectedRevision: 6, idFactory: ids()
    });
    assert.equal(added.revision, 7);
    assert.equal(added.enabled, true);
    assert.deepEqual(added.calibration, manual);
    assert.equal(scene.writes, 1);
    const roadId = added.roads[0].id;

    const renamed = await saveRenamedRoad(scene, {
      roadId, name: "Harbor Road", expectedRevision: 7
    });
    assert.equal(renamed.revision, 8);
    assert.equal(renamed.roads[0].name, "Harbor Road");
    assert.equal(scene.writes, 2);

    const removed = await saveRemovedRoad(scene, { roadId, expectedRevision: 8 });
    assert.equal(removed.revision, 9);
    assert.equal(removed.enabled, false);
    assert.equal(removed.segments.length, 0);
    assert.deepEqual(readAtlas(scene).calibration, manual);
    assert.equal(scene.writes, 3);
  } finally { globalThis.game = prior; }
});

test("stale saves and non-GM saves do not write", async () => {
  const prior = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  const scene = mockScene();
  try {
    await assert.rejects(saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      expectedRevision: 7, idFactory: ids()
    }), /changed since/);
    assert.equal(scene.writes, 0);
    globalThis.game.user.isGM = false;
    await assert.rejects(saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      expectedRevision: 0, idFactory: ids()
    }), /Only a GM/);
    assert.equal(scene.writes, 0);
  } finally { globalThis.game = prior; }
});

test("populated v1 roads cannot be newly drawn over until a GM anchors them", async () => {
  const prior = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  const old = {
    schemaVersion: 1, revision: 2, enabled: true, calibration: null,
    nodes: [{ id: "a", x: 80, y: 50 }, { id: "b", x: 180, y: 50 }],
    segments: [{ id: "s", from: "a", to: "b", via: [], name: "Road", bidirectional: true }]
  };
  const scene = mockScene(old);
  try {
    await assert.rejects(saveNewRoad(scene, {
      points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
      expectedRevision: 2, idFactory: ids()
    }), /Anchor/);
    assert.equal(scene.writes, 0);
    const anchored = await saveAnchoredLegacyRoads(scene, {
      origin: { x: 60, y: 20 }, expectedRevision: 2
    });
    assert.equal(anchored.revision, 3);
    assert.equal(anchored.schemaVersion, 2);
    assert.deepEqual(anchored.nodes[0], { id: "a", x: 20, y: 30 });
    await assert.rejects(saveNewRoad(scene, {
      points: [{x:0,y:0},{x:100,y:0}],expectedRevision:3,idFactory:ids()
    }),/Organize/);
    const organized = await saveOrganizedRoads(scene,{expectedRevision:3});
    assert.equal(organized.schemaVersion,3);
    assert.equal(organized.segments[0].id,"s");
    assert.equal(organized.segments[0].roadId,"s");
    assert.equal(organized.roads[0].name,"Road");
    const reshaped = await saveReshapedRoad(scene, {
      segmentId: "s", via: [{ x: 60, y: 45 }], expectedRevision: 4
    });
    assert.deepEqual(reshaped.segments[0].via, [{ x: 60, y: 45 }]);
    assert.equal(reshaped.revision, 5);
  } finally { globalThis.game = prior; }
});

test("save point edits is transactional, checks revision, and does not mutate other scenes",async()=>{
 const previous=globalThis.game;
 globalThis.game={user:{isGM:true}};
 try {
  const one=mockScene(), two=mockScene();
  const newRoad=await saveNewRoad(one,{points:[{x:0,y:0},{x:100,y:0}],expectedRevision:0,idFactory:ids()});
  const seg=newRoad.segments[0],road=newRoad.roads[0];
  const changed=await savePointEdits(one,{roadId:road.id,expectedRevision:1,operations:[
   {kind:"insert-bend",segmentId:seg.id,edgeIndex:0,x:20,y:5},
   {kind:"move-bend",segmentId:seg.id,viaIndex:0,x:20,y:10}
  ]});
  assert.deepEqual(changed.segments[0].via,[{x:20,y:10}]);
  assert.equal(changed.revision,2);
  assert.equal(readAtlas(two).segments.length,0);
  await assert.rejects(savePointEdits(one,{roadId:road.id,expectedRevision:1,operations:[
   {kind:"remove-bend",segmentId:seg.id,viaIndex:0}
  ]}),/changed since/);
  const before=one.writes;
  await assert.rejects(savePointEdits(one,{roadId:road.id,expectedRevision:2,operations:[
   {kind:"remove-bend",segmentId:seg.id,viaIndex:900}
  ]}),/index/);
  assert.equal(one.writes,before);
 } finally {globalThis.game=previous;}
});
