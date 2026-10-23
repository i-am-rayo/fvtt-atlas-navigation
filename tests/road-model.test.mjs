import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { addRoad, renameRoad, removeRoad, reshapeRoad, findRoadSnap, suggestRoadName, mergeRoadGroups, getRoadMergeCandidates, applyRoadGeometryEdit, findJunctionAttachment, attachmentRoadNames } from "../scripts/road-model.js";

function makeIds() {
  let i = 0;
  return () => `id${++i}`;
}

test("new roads form named Scene-space polylines with stable junctions", () => {
  const source = createEmptyAtlas();
  const first = addRoad(source, {
    points: [{ x: 5, y: 5 }, { x: 20, y: 40 }, { x: 80, y: 60 }],
    idFactory: makeIds()
  });
  assert.equal(first.segments.length, 1);
  assert.equal(first.nodes.length, 2);
  assert.equal(first.enabled, true);
  assert.equal(first.roads[0].name, "Road 1");
  assert.deepEqual(first.segments[0].via, [{ x: 20, y: 40 }]);
  assert.equal(source.segments.length, 0, "road operations do not mutate original state");
});

test("new roads join existing junctions only when endpoints are nearby", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], idFactory: makeIds()
  });
  const second = addRoad(first, {
    points: [{ x: 7, y: 5 }, { x: 60, y: 50 }, { x: 100, y: 100 }],
    idFactory: makeIds()
  });
  assert.equal(second.nodes.length, 3, "start was snapped to first road's junction");
  assert.equal(second.segments[0].from, second.segments[1].from);
  assert.notEqual(second.segments[0].to, second.segments[1].to);
  assert.equal(second.roads[1].name, "Road 2");
});

test("crossing road geometry does not create graph topology", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], idFactory: makeIds()
  });
  const second = addRoad(first, {
    points: [{ x: 0, y: 100 }, { x: 100, y: 0 }], idFactory: makeIds()
  });
  assert.equal(second.nodes.length, 4);
  assert.notEqual(second.segments[0].from, second.segments[1].from);
  assert.notEqual(second.segments[0].to, second.segments[1].to);
});

test("rename and delete preserve all unrelated roads and junction data", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], idFactory: makeIds()
  });
  const renamed = renameRoad(first, { roadId: first.roads[0].id, name: " Northern Pass " });
  assert.equal(renamed.roads[0].name, "Northern Pass");
  assert.equal(first.roads[0].name, "Road 1");
  const removed = removeRoad(renamed, { roadId: renamed.roads[0].id });
  assert.equal(removed.enabled, false);
  assert.equal(removed.segments.length, 0);
  assert.equal(removed.nodes.length, 2, "deletion must not cascade into junction data");
  assert.equal(suggestRoadName(removed), "Road 1");
});

test("invalid input or stale Road IDs cannot silently write an invalid graph", () => {
  const empty = createEmptyAtlas();
  assert.throws(() => addRoad(empty, { points: [{ x: 0, y: 0 }], idFactory: makeIds() }), /at least two/);
  assert.throws(() => addRoad(empty, {
    points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], idFactory: makeIds()
  }), /at least 1/);
  assert.throws(() => addRoad(empty, {
    points: [{ x: Infinity, y: 0 }, { x: 50, y: 0 }], idFactory: makeIds()
  }), /finite/);
  assert.throws(() => renameRoad(empty, { roadId: "missing", name: "No" }), /no longer exists/);
  assert.throws(() => removeRoad(empty, { roadId: "missing" }), /no longer exists/);
  assert.throws(() => addRoad(empty, {
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], idFactory: () => "same"
  }), /unique/);
});

test("joining the middle of a road splits the existing edge into shared junction segments", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 100, y: 0 }],
    name: "Old Road", idFactory: makeIds()
  });
  const originalId = first.segments[0].id;
  const joined = addRoad(first, {
    points: [{ x: 49, y: 5 }, { x: 50, y: 60 }],
    name: "Trail", idFactory: (() => { let i = 100; return () => "id" + ++i; })()
  });
  assert.equal(joined.segments.length, 3, "split old road and append new spur");
  assert.equal(joined.nodes.length, 4);
  const [oldLeft, oldRight, trail] = joined.segments;
  assert.equal(oldLeft.id, originalId, "first half retains old ID");
  assert.equal(oldLeft.to, oldRight.from);
  assert.equal(oldRight.from, trail.from, "new road shares real junction ID");
  assert.equal(oldLeft.roadId, first.roads[0].id);
  assert.equal(oldRight.roadId, first.roads[0].id);
  assert.deepEqual(joined.nodes.find(n => n.id === trail.from), { id: trail.from, x: 49, y: 0 });
  assert.equal(first.segments.length, 1, "source graph not mutated");
  assert.deepEqual(oldLeft.via, [{ x: 40, y: 0 }]);
});

test("Alt-disconnected endpoints skip snapping and crossings stay unconnected", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], idFactory: makeIds()
  });
  const detached = addRoad(first, {
    points: [{ x: 50, y: 3 }, { x: 50, y: 80 }],
    idFactory: (() => { let i = 50; return () => "id" + ++i; })(),
    snapEndpoints: [false, true]
  });
  assert.equal(detached.segments.length, 2);
  assert.equal(detached.nodes.length, 4);
  assert.equal(findRoadSnap(first, { x: 50, y: 4 }).kind, "edge");
});

test("redrawing bends preserves segment identity and junctions", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 100, y: 0 }],
    idFactory: makeIds()
  });
  const road = first.segments[0];
  const updated = reshapeRoad(first, { segmentId: road.id, via: [{ x: 50, y: 60 }] });
  assert.equal(updated.segments[0].id, road.id);
  assert.equal(updated.segments[0].from, road.from);
  assert.equal(updated.segments[0].to, road.to);
  assert.deepEqual(updated.segments[0].via, [{ x: 50, y: 60 }]);
  assert.deepEqual(first.segments[0].via, [{ x: 30, y: 40 }]);
  assert.throws(() => reshapeRoad(first, { segmentId: "missing", via: [] }), /no longer exists/);
});

test("joining exactly at an existing bend creates a real junction without duplicate bends", () => {
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 0 }],
    idFactory: makeIds()
  });
  const joined = addRoad(first, {
    points: [{ x: 50, y: 20 }, { x: 50, y: 90 }],
    idFactory: (() => { let i = 200; return () => "id" + ++i; })()
  });
  assert.equal(joined.segments.length, 3);
  assert.equal(joined.segments[0].to, joined.segments[1].from);
  assert.equal(joined.segments[1].from, joined.segments[2].from);
  assert.deepEqual(joined.segments[0].via, []);
  assert.deepEqual(joined.segments[1].via, []);
});

test("a spur splits geometry but retains one named parent road", () => {
  const base = addRoad(createEmptyAtlas(), {
    points: [{x:0,y:0}, {x:100,y:0}], name:"Main Road", idFactory:makeIds()
  });
  const joined = addRoad(base, {
    points:[{x:50,y:3}, {x:50,y:100}], name:"Spur",
    idFactory:(() => { let n=100; return () => "id"+ ++n; })()
  });
  assert.equal(joined.roads.length, 2);
  assert.deepEqual(joined.roads.map(r=>r.name), ["Main Road","Spur"]);
  assert.equal(joined.segments.filter(s=>s.roadId===joined.roads[0].id).length,2);
  const keep = joined.roads[0].id, merge = joined.roads[1].id;
  assert.deepEqual(getRoadMergeCandidates(joined,keep).map(r=>r.id),[merge]);
  const combined = mergeRoadGroups(joined,{keepRoadId:keep,mergeRoadId:merge});
  assert.equal(combined.roads.length,1);
  assert.equal(combined.segments.length,3);
  assert.ok(combined.segments.every(s=>s.roadId===keep));
  assert.deepEqual(joined.roads.map(r=>r.name),["Main Road","Spur"]);
});

test("point operations move junctions for all joined segments without losing topology", () => {
  const base = addRoad(createEmptyAtlas(), {
    points:[{x:0,y:0},{x:50,y:20},{x:100,y:0}], name:"Main", idFactory:makeIds()
  });
  const joined = addRoad(base, {
    points:[{x:50,y:20},{x:50,y:80}],name:"Branch",
    idFactory:(() => { let n=200; return () => "id"+ ++n; })()
  });
  const roadId=joined.roads[0].id;
  const junction=joined.segments[0].to;
  const moved=applyRoadGeometryEdit(joined,{roadId,operation:{kind:"move-node",nodeId:junction,x:60,y:30}});
  assert.deepEqual(moved.nodes.find(n=>n.id===junction),{id:junction,x:60,y:30});
  assert.equal(moved.segments[0].to,moved.segments[1].from);
  assert.equal(moved.segments[1].from,moved.segments[2].from);
  assert.notDeepEqual(moved.nodes,joined.nodes);
  assert.throws(()=>applyRoadGeometryEdit(moved,{roadId,operation:{kind:"move-node",nodeId:junction,x:NaN,y:4}}),/finite/);
});

test("point insertion, dragging and removal are controlled and reversible",()=>{
 const base=addRoad(createEmptyAtlas(),{points:[{x:0,y:0},{x:100,y:0}],idFactory:makeIds()});
 const roadId=base.roads[0].id, segmentId=base.segments[0].id;
 const inserted=applyRoadGeometryEdit(base,{roadId,operation:{kind:"insert-bend",segmentId,edgeIndex:0,x:50,y:0}});
 assert.deepEqual(inserted.segments[0].via,[{x:50,y:0}]);
 const moved=applyRoadGeometryEdit(inserted,{roadId,operation:{kind:"move-bend",segmentId,viaIndex:0,x:50,y:25}});
 assert.deepEqual(moved.segments[0].via,[{x:50,y:25}]);
 const removed=applyRoadGeometryEdit(moved,{roadId,operation:{kind:"remove-bend",segmentId,viaIndex:0}});
 assert.deepEqual(removed.segments[0].via,[]);
 assert.deepEqual(base.segments[0].via,[]);
 assert.throws(()=>applyRoadGeometryEdit(base,{roadId,operation:{kind:"remove-bend",segmentId,viaIndex:0}}),/index/);
});

test("GM-reviewed junction attachment splits target without merging named roads", () => {
  let next = 0;
  const idFactory = () => "join" + ++next;
  const main = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], name: "Main Road", idFactory
  });
  const separate = addRoad(main, {
    points: [{ x: 80, y: 60 }, { x: 120, y: 120 }], name: "Secret Shortcut",
    idFactory, snapEndpoints: [false, false]
  });
  const roadId = separate.roads[1].id;
  const sourceNodeId = separate.segments[1].from;
  const suggestion = findJunctionAttachment(separate, sourceNodeId, { x: 40, y: 1 });
  assert.equal(suggestion.kind, "edge");
  assert.deepEqual(attachmentRoadNames(separate, suggestion), ["Main Road"]);
  const connected = applyRoadGeometryEdit(separate, { roadId, operation: {
    kind: "connect-node", nodeId: sourceNodeId, target: suggestion,
    x: suggestion.x, y: suggestion.y, newSegmentId: idFactory()
  } });
  assert.deepEqual(connected.roads.map(r => r.name), ["Main Road", "Secret Shortcut"]);
  assert.equal(connected.segments.length, 3);
  assert.equal(connected.segments.filter(s => s.roadId === main.roads[0].id).length, 2);
  assert.ok(connected.segments.some(s => s.roadId === roadId && s.from === sourceNodeId));
  assert.deepEqual(connected.nodes.find(n => n.id === sourceNodeId), {
    id: sourceNodeId, x: 40, y: 0
  });
  assert.deepEqual(separate.nodes.find(n => n.id === sourceNodeId), {
    id: sourceNodeId, x: 80, y: 60
  }, "original atlas is unchanged until Save Points");
});

test("moving a shared junction to another junction preserves connected named roads", () => {
  let i = 0;
  const idFactory = () => "connect" + ++i;
  const a = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], name: "West", idFactory
  });
  const b = addRoad(a, {
    points: [{ x: 100, y: 0 }, { x: 100, y: 100 }], name: "South", idFactory
  });
  const c = addRoad(b, {
    points: [{ x: 300, y: 0 }, { x: 400, y: 0 }], name: "East",
    idFactory, snapEndpoints: [false, false]
  });
  const sourceNodeId = b.segments[0].to;
  const target = findJunctionAttachment(c, sourceNodeId, { x: 300, y: 0 });
  assert.equal(target.kind, "node");
  assert.deepEqual(attachmentRoadNames(c, target), ["East"]);
  const joined = applyRoadGeometryEdit(c, { roadId: a.roads[0].id, operation: {
    kind: "connect-node", nodeId: sourceNodeId, target, x: target.x, y: target.y
  } });
  assert.deepEqual(joined.roads.map(r => r.name), ["West", "South", "East"]);
  assert.equal(joined.nodes.some(n => n.id === sourceNodeId), false,
    "merged graph node leaves no phantom snap target");
  assert.ok(joined.segments.filter(s => s.from === target.nodeId || s.to === target.nodeId).length >= 3,
    "both roads at the moved shared node retain their topology");
  assert.equal(findJunctionAttachment(joined, target.nodeId, { x: 301, y: 1 }), null,
    "do not snap a junction onto its own incident edges or adjacent nodes");
});

test("shortcuts and same-road cycles are valid; degenerate attachments are rejected", () => {
  let i = 0;
  const idFactory = () => "cycle" + ++i;
  const base = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
    name: "High Road", idFactory
  });
  const spur = addRoad(base, {
    points: [{ x: 50, y: 0 }, { x: 60, y: 80 }], name: "Forest Spur", idFactory
  });
  const sourceNodeId = spur.segments.at(-1).to;
  const target = findJunctionAttachment(spur, sourceNodeId, { x: 100, y: 0 });
  assert.equal(target.kind, "node");
  const cycle = applyRoadGeometryEdit(spur, { roadId: spur.roads[1].id, operation: {
    kind: "connect-node", nodeId: sourceNodeId, target, x: target.x, y: target.y
  } });
  assert.deepEqual(cycle.roads.map(r => r.name), ["High Road", "Forest Spur"]);
  assert.equal(cycle.segments.length, spur.segments.length);
  const adjacent = spur.segments.at(-1).from;
  assert.throws(() => applyRoadGeometryEdit(spur, { roadId: spur.roads[1].id, operation: {
    kind: "connect-node", nodeId: sourceNodeId, target: {kind:"node",nodeId:adjacent},
    x:50,y:0
  } }), /collapse/);
  assert.throws(() => applyRoadGeometryEdit(spur, { roadId: spur.roads[1].id, operation: {
    kind: "connect-node", nodeId: sourceNodeId,
    target: {kind:"edge",segmentId:"missing",edgeIndex:0},
    x:0,y:0,newSegmentId:idFactory()
  } }), /own road sections|Cannot attach/);
});

test("deleted roads leave no invisible snapping junctions", () => {
  let index = 0;
  const idFactory = () => "orphan" + ++index;
  const first = addRoad(createEmptyAtlas(), {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], name: "Deleted Road", idFactory
  });
  const removed = removeRoad(first, { roadId: first.roads[0].id });
  assert.equal(removed.nodes.length, 2, "archived node data remains for compatibility");
  assert.equal(findRoadSnap(removed, { x: 0, y: 0 }), null);
});
