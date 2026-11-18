import assert from "node:assert/strict";
import test from "node:test";
import { anchorLegacyAtlas, createEmptyAtlas, polylineLength, validateAtlas, upgradeAtlasRoadGroups } from "../scripts/atlas-model.js";

const fixture = () => ({
  schemaVersion: 1,
  revision: 2,
  enabled: true,
  calibration: { source: "manual", unitsPerPixel: 0.05, unit: "mi" },
  nodes: [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 100, y: 0 },
    { id: "c", x: 50, y: 50 },
    { id: "d", x: 50, y: -50 }
  ],
  segments: [
    { id: "ab", from: "a", to: "b", via: [{ x: 50, y: 10 }], name: "West Road", bidirectional: true },
    { id: "cd", from: "c", to: "d", via: [], name: "", bidirectional: true }
  ]
});

test("new Scenes have an inert atlas without writing flags or a manual scale", () => {
  assert.deepEqual(validateAtlas(undefined), createEmptyAtlas());
  assert.equal(validateAtlas(null).enabled, false);
  assert.equal(validateAtlas(undefined).calibration, null);
});

test("legacy manual data round-trips dormant; pixel geometry validation stays separate", () => {
  const source = fixture();
  assert.deepEqual(validateAtlas(source), source);
  const result = validateAtlas(source);
  result.nodes[0].x = 300;
  assert.equal(source.nodes[0].x, 0, "validation must not mutate its input");
  assert.equal(polylineLength([source.nodes[0], ...source.segments[0].via, source.nodes[1]]) > 100, true);
});

test("visible crossings do not create topological connections", () => {
  const atlas = validateAtlas(fixture());
  assert.equal(atlas.nodes.length, 4);
  assert.equal(atlas.segments.length, 2);
  assert.equal(atlas.segments[0].to, "b");
  assert.equal(atlas.segments[1].from, "c");
});

test("bad schemas, unknown fields, and invalid calibration are rejected", () => {
  const original = fixture();
  assert.throws(() => validateAtlas({ ...original, schemaVersion: 99 }), /unsupported schemaVersion/);
  assert.throws(() => validateAtlas({ ...original, hiddenSecrets: true }), /unsupported field/);
  assert.throws(() => validateAtlas({ ...original, revision: -1 }), /revision/);
  assert.throws(() => validateAtlas({ ...original, calibration: { source: "manual", unitsPerPixel: 0, unit: "mi" } }), /positive/);
  assert.throws(() => validateAtlas({ ...original, calibration: { source: "manual", unitsPerPixel: Infinity, unit: "km" } }), /positive/);
});

test("duplicate or broken nodes and segments cannot be persisted", () => {
  const original = fixture();
  assert.throws(() => validateAtlas({ ...original, nodes: [...original.nodes, original.nodes[0]] }), /duplicate node ID/);
  assert.throws(() => validateAtlas({ ...original, nodes: [{ id: "a", x: NaN, y: 0 }] }), /finite/);
  assert.throws(() => validateAtlas({ ...original, segments: [...original.segments, original.segments[0]] }), /duplicate segment ID/);
  assert.throws(() => validateAtlas({
    ...original,
    segments: [{ ...original.segments[0], to: "missing" }]
  }), /invalid endpoints/);
  assert.throws(() => validateAtlas({
    ...original,
    segments: [{ ...original.segments[0], from: "a", to: "a" }]
  }), /invalid endpoints/);
  assert.throws(() => validateAtlas({
    ...original,
    nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 0, y: 0 }],
    segments: [{ id: "zero", from: "a", to: "b", via: [], name: "", bidirectional: true }]
  }), /zero or invalid length/);
  assert.throws(() => validateAtlas({
    ...original,
    segments: [{ ...original.segments[0], via: [{ x: Infinity, y: 0 }] }]
  }), /finite/);
});

test("legacy canvas coordinates require explicit origin anchoring, and v2 validation is strict", () => {
  const legacy = fixture();
  const converted = anchorLegacyAtlas(legacy, { x: 30, y: 45 });
  assert.equal(converted.schemaVersion, 2);
  assert.equal(converted.coordinateSpace, "image");
  assert.equal(converted.nodes[0].x, -30);
  assert.equal(converted.nodes[0].y, -45);
  assert.deepEqual(converted.segments[0].via[0], { x: 20, y: -35 });
  assert.equal(converted.segments[0].id, legacy.segments[0].id);
  assert.equal(converted.revision, legacy.revision);
  assert.deepEqual(anchorLegacyAtlas(converted, { x: 999, y: 999 }), converted);
  assert.deepEqual(legacy, fixture(), "legacy persisted data is untouched");
  assert.throws(() => anchorLegacyAtlas(legacy, { x: NaN, y: 0 }), /origin/);
  assert.throws(() => validateAtlas({ ...converted, coordinateSpace: "canvas" }), /coordinateSpace/);
});

test("explicit v2→v3 migration preserves IDs, geometry, origin and duplicate names without guessing",()=>{
 const anchored=anchorLegacyAtlas(fixture(),{x:15,y:10});
 anchored.segments[1].name="West Road";
 const migrated=upgradeAtlasRoadGroups(anchored);
 assert.equal(migrated.schemaVersion,3);
 assert.equal(migrated.coordinateSpace,"image");
 assert.equal(migrated.roads.length,2);
 assert.deepEqual(migrated.roads.map(r=>r.name),["West Road","West Road"]);
 assert.deepEqual(migrated.roads.map(r=>r.id),["ab","cd"]);
 assert.deepEqual(migrated.segments.map(s=>s.id),["ab","cd"]);
 assert.deepEqual(migrated.segments[0].via,anchored.segments[0].via);
 assert.deepEqual(migrated.nodes,anchored.nodes);
 assert.equal(migrated.revision,anchored.revision);
 assert.deepEqual(upgradeAtlasRoadGroups(migrated),migrated,"migration is idempotent");
 assert.equal(anchored.schemaVersion,2,"old v2 data is never mutated");
});
test("v3 validator rejects segment/road ownership errors and stray legacy fields",()=>{
 const base=createEmptyAtlas();
 assert.equal(base.schemaVersion,3);
 assert.deepEqual(base.roads,[]);
 assert.throws(()=>validateAtlas({...base,segments:[{
  id:"s",roadId:"missing",from:"a",to:"b",via:[],bidirectional:true
 }]}),/missing road|endpoints/);
 assert.throws(()=>validateAtlas({...base,roads:[{id:"bad",name:""}]}),/invalid name/);
 assert.throws(()=>validateAtlas({...base,roads:[{id:"r",name:"One"},{id:"r",name:"Two"}]}),/duplicate road/);
});
