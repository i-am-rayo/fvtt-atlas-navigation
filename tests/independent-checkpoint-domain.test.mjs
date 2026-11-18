import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, validateAtlas, upgradeAtlasIndependentCheckpoints,
  upgradeAtlasPlayerVisibility } from "../scripts/atlas-model.js";
import { addIndependentCheckpoint, relocateIndependentCheckpoint, detachCheckpointRoadHint,
  editRoadCheckpoint, listRoadCheckpoints } from "../scripts/checkpoint-model.js";

const source = () => upgradeAtlasPlayerVisibility({ ...createEmptyAtlas(), revision: 23,
  enabled: true, nodes: [{ id: "a", x: 10, y: 20 }, { id: "b", x: 30, y: 40 }],
  roads: [{ id: "road", name: "Existing Road" }],
  segments: [{ id: "ab", roadId: "road", from: "a", to: "b", via: [], bidirectional: true }] });

const generated = () => {
  let count = 0;
  return () => `id${++count}`;
};

test("v9 remains readable without changing its schema or revision", () => {
  const old = source();
  assert.equal(old.schemaVersion, 9);
  assert.deepEqual(validateAtlas(old), old);
  const upgraded = upgradeAtlasIndependentCheckpoints(old);
  assert.equal(upgraded.schemaVersion, 10);
  assert.equal(upgraded.revision, 23);
  assert.deepEqual(upgraded.segments, old.segments);
  assert.deepEqual(validateAtlas(upgraded), upgraded);
});

test("independent checkpoint creates a durable Node and no fake Road", () => {
  const original = source();
  const next = addIndependentCheckpoint(original, { at: { x: 90, y: 110 },
    name: "  Waystation  ", elevationMeters: 12, idFactory: generated() });
  assert.equal(next.schemaVersion, 10);
  assert.equal(next.roads.length, 1);
  assert.deepEqual(next.segments, original.segments);
  assert.equal(next.checkpoints.length, 1);
  assert.equal(next.checkpoints[0].roadId, null);
  assert.equal(next.checkpoints[0].name, "Waystation");
  assert.equal(next.checkpoints[0].playerVisible, false);
  assert.deepEqual(next.nodes.at(-1), { id: next.checkpoints[0].nodeId, x: 90, y: 110 });
  assert.equal(listRoadCheckpoints(next).length, 1);
  assert.equal(listRoadCheckpoints(next)[0].roadName, "Independent checkpoint");
  assert.equal(listRoadCheckpoints(next, { roadId: "road", scope: "selected" }).length, 0);
  const edited = editRoadCheckpoint(next, { checkpointId: next.checkpoints[0].id,
    name: "New name", elevationMeters: null });
  assert.equal(edited.checkpoints[0].nodeId, next.checkpoints[0].nodeId);
  assert.deepEqual(original, source(), "the original v9 model was not mutated");
});

test("v10 rejects missing Nodes and duplicate Checkpoints on one Node", () => {
  const next = addIndependentCheckpoint(source(), { at: { x: 90, y: 110 },
    name: "Waystation", idFactory: generated() });
  assert.throws(() => validateAtlas({ ...next, checkpoints: [
    { ...next.checkpoints[0], nodeId: "missing" }] }), /must attach/);
  assert.throws(() => validateAtlas({ ...next, checkpoints: [
    ...next.checkpoints, { ...next.checkpoints[0], id: "other" }] }), /duplicate checkpoint/);
  assert.throws(() => addIndependentCheckpoint(next, { at: { x: NaN, y: 10 },
    name: "Invalid", idFactory: generated() }), /finite point/);
});

test("legacy Road association is explicitly detachable without altering graph topology", () => {
  const old = source();
  const checkpoint = { id: "checkpoint", roadId: "road", nodeId: "a", name: "Old",
    elevationMeters: null, appearance: null, playerVisible: true };
  const populated = validateAtlas({ ...old, checkpoints: [checkpoint] });
  const detached = detachCheckpointRoadHint(populated, { checkpointId: "checkpoint" });
  assert.equal(detached.schemaVersion, 10);
  assert.equal(detached.checkpoints[0].roadId, null);
  assert.equal(detached.checkpoints[0].playerVisible, true);
  assert.equal(detached.checkpoints[0].id, "checkpoint");
  assert.deepEqual(detached.segments, populated.segments);
  assert.deepEqual(detached.nodes, populated.nodes);
  assert.equal(populated.checkpoints[0].roadId, "road");
});

test("duplicate legacy Road-bound Checkpoints sharing a Node block migration", () => {
  const old = source();
  const twoRoads = { ...old, roads: [...old.roads,
    { ...old.roads[0], id: "second", name: "Other Road" }],
  segments: [...old.segments, { id: "secondSegment", roadId: "second", from: "a",
    to: "b", via: [], bidirectional: true }],
  checkpoints: [
    { id: "first", roadId: "road", nodeId: "a", name: "First", elevationMeters: null,
      appearance: null, playerVisible: false },
    { id: "secondCp", roadId: "second", nodeId: "a", name: "Second", elevationMeters: null,
      appearance: null, playerVisible: false }
  ] };
  assert.equal(validateAtlas(twoRoads).schemaVersion, 9);
  assert.throws(() => upgradeAtlasIndependentCheckpoints(twoRoads), /sharing a graph node/);
});

test("isolated Checkpoint relocation preserves its Node ID, metadata and Roads",()=>{
  const initial=addIndependentCheckpoint(source(),{
    at:{x:90,y:110},name:"Waystation",idFactory:generated()
  });
  const cp=initial.checkpoints[0];
  const relocated=relocateIndependentCheckpoint(initial,{
    checkpointId:cp.id,at:{x:125,y:150}
  });
  assert.equal(relocated.schemaVersion,10);
  assert.deepEqual(relocated.checkpoints,initial.checkpoints);
  assert.deepEqual(relocated.roads,initial.roads);
  assert.deepEqual(relocated.segments,initial.segments);
  assert.equal(relocated.nodes.find(n=>n.id===cp.nodeId).x,125);
  assert.equal(relocated.nodes.find(n=>n.id===cp.nodeId).y,150);
  assert.equal(initial.nodes.find(n=>n.id===cp.nodeId).x,90);
  assert.throws(()=>relocateIndependentCheckpoint(initial,{
    checkpointId:cp.id,at:{x:90,y:110}
  }),/already at/);
  assert.throws(()=>relocateIndependentCheckpoint(initial,{
    checkpointId:cp.id,at:{x:Infinity,y:0}
  }),/finite map point/);
});

test("relocation refuses Road-connected or unknown Checkpoint Nodes",()=>{
  const old=source();
  const connected=validateAtlas({...old,checkpoints:[{
    id:"oldCp",roadId:"road",nodeId:"a",name:"Road",
    elevationMeters:null,appearance:null,playerVisible:false
  }]});
  assert.throws(()=>relocateIndependentCheckpoint(connected,{
    checkpointId:"oldCp",at:{x:100,y:200}
  }),/Connected Checkpoint/);
  assert.throws(()=>relocateIndependentCheckpoint(connected,{
    checkpointId:"missing",at:{x:100,y:200}
  }),/no longer exists/);
});
