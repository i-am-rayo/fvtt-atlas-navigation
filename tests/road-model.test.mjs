import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { addRoad, renameRoad, removeRoad, reshapeRoad, findRoadSnap, suggestRoadName, mergeRoadGroups, getRoadMergeCandidates, applyRoadGeometryEdit, findJunctionAttachment, attachmentRoadNames, listRoadJunctions } from "../scripts/road-model.js";

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

test("detaching a selected road from a shared junction preserves the other roads", () => {
  let i = 0;
  const idFactory = () => "detach" + ++i;
  const main = addRoad(createEmptyAtlas(), {
    points: [{x:0,y:0},{x:100,y:0}],name:"Millstone Road",idFactory
  });
  const joined = addRoad(main, {
    points: [{x:50,y:0},{x:50,y:80}],name:"Road 2",idFactory
  });
  const mainId = joined.roads[0].id;
  const branchId = joined.roads[1].id;
  const attachedNodeId = joined.segments.find(s=>s.roadId===branchId).from;
  const detachedId = idFactory();
  const separated = applyRoadGeometryEdit(joined, {roadId:branchId,operation:{
    kind:"detach-node",nodeId:attachedNodeId,newNodeId:detachedId,x:50,y:0
  }});
  assert.deepEqual(separated.roads,joined.roads,"road groups and names stay unchanged");
  assert.equal(separated.nodes.length, joined.nodes.length+1);
  assert.deepEqual(separated.nodes.find(n=>n.id===detachedId), {id:detachedId,x:50,y:0});
  assert.ok(separated.segments.filter(s=>s.roadId===mainId).every(s=>
    s.from!==detachedId&&s.to!==detachedId));
  assert.ok(separated.segments.filter(s=>s.roadId===branchId).some(s=>
    s.from===detachedId||s.to===detachedId));
  assert.ok(separated.segments.filter(s=>s.roadId===mainId).some(s=>
    s.from===attachedNodeId||s.to===attachedNodeId),
    "main road stays at the original junction");
  const moved = applyRoadGeometryEdit(separated, {roadId:branchId,operation:{
    kind:"move-node",nodeId:detachedId,x:65,y:35
  }});
  assert.deepEqual(moved.nodes.find(n=>n.id===attachedNodeId),
    joined.nodes.find(n=>n.id===attachedNodeId));
  assert.deepEqual(moved.nodes.find(n=>n.id===detachedId),{id:detachedId,x:65,y:35});
  assert.deepEqual(joined.nodes.find(n=>n.id===attachedNodeId),
    {id:attachedNodeId,x:50,y:0},"original graph is not mutated");
  assert.throws(()=>applyRoadGeometryEdit(joined,{roadId:branchId,operation:{
    kind:"detach-node",nodeId:attachedNodeId,newNodeId:attachedNodeId,x:50,y:0
  }}),/unique/);
});

test("detaching one of three meeting roads leaves the remaining two connected",()=>{
  let i=0;const idFactory=()=>"three"+ ++i;
  const first=addRoad(createEmptyAtlas(),{name:"Main",points:[{x:0,y:0},{x:100,y:0}],idFactory});
  const second=addRoad(first,{name:"Path",points:[{x:0,y:0},{x:0,y:70}],idFactory});
  const third=addRoad(second,{name:"Shortcut",points:[{x:0,y:0},{x:40,y:75}],idFactory});
  const shared=third.segments[0].from;
  const extra=idFactory();
  const separated=applyRoadGeometryEdit(third,{roadId:third.roads[1].id,operation:{
    kind:"detach-node",nodeId:shared,newNodeId:extra,x:0,y:0
  }});
  assert.equal(separated.roads.length,3);
  assert.equal(separated.segments.filter(s=>s.from===shared||s.to===shared).length,2,
    "main and third named roads still share original junction");
  assert.equal(separated.segments.filter(s=>s.from===extra||s.to===extra).length,1,
    "only the selected logical road moves to the new junction");
  assert.throws(()=>applyRoadGeometryEdit(separated,{roadId:third.roads[1].id,operation:{
    kind:"detach-node",nodeId:extra,newNodeId:idFactory(),x:0,y:0
  }}),/not shared/);
});

test("explicit junction promotion splits a bend without renaming or joining a crossing road", () => {
  let i = 0;
  const ids = () => "promote" + ++i;
  const a = addRoad(createEmptyAtlas(), {
    name: "North-South", points: [{x: 50,y: 0}, {x:50,y:50}, {x:50,y:100}], idFactory: ids
  });
  const crossing = addRoad(a, {
    name: "Millstone", points: [{x:0,y:50},{x:100,y:50}], idFactory: ids,
    snapEndpoints: [false, false]
  });
  assert.equal(crossing.segments.length, 2, "the crossing remains disconnected");
  const originalId = crossing.segments[0].id;
  const roadId = a.roads[0].id;
  const promoted = applyRoadGeometryEdit(crossing, { roadId, operation: {
    kind: "create-junction", segmentId: originalId, edgeIndex: 1,
    atVertex: true, x: 50, y: 50, newNodeId: ids(), newSegmentId: ids()
  }});
  assert.deepEqual(promoted.roads, crossing.roads);
  assert.equal(promoted.nodes.length, crossing.nodes.length + 1);
  assert.equal(promoted.segments.length, 3);
  const parts = promoted.segments.filter(s => s.roadId === roadId);
  assert.equal(parts[0].id, originalId);
  assert.equal(parts[0].to, parts[1].from);
  assert.deepEqual(parts.map(s => s.via), [[],[]], "promoted bend is not duplicated");
  assert.ok(promoted.segments.filter(s => s.roadId === crossing.roads[1].id)
    .every(s => s.from !== parts[0].to && s.to !== parts[0].to),
    "a geometric crossing alone never becomes an attached junction");
  const candidate = findJunctionAttachment(promoted, parts[0].to, {x:50,y:50});
  assert.equal(candidate.kind, "edge");
  const attached = applyRoadGeometryEdit(promoted, { roadId, operation: {
    kind: "connect-node", nodeId: parts[0].to, target: candidate,
    x: candidate.x, y: candidate.y, newSegmentId: ids()
  }});
  assert.deepEqual(attached.roads, crossing.roads);
  assert.equal(attached.segments.length, 4);
  assert.equal(attached.segments.filter(s => s.roadId === crossing.roads[1].id).length, 2);
  assert.equal(crossing.segments.length, 2, "original Scene graph is untouched");
});

test("Junctions [+] inserts a junction on an interior edge and validates all IDs and locations", () => {
  let i = 0; const ids = () => "wp" + ++i;
  const road = addRoad(createEmptyAtlas(), {
    name: "Millstone", points: [{x:0,y:0},{x:100,y:0}], idFactory:ids
  });
  const roadId = road.roads[0].id, segmentId = road.segments[0].id;
  const input = {kind:"create-junction",segmentId,edgeIndex:0,atVertex:false,
    x:40,y:0,newNodeId:ids(),newSegmentId:ids()};
  const updated = applyRoadGeometryEdit(road, { roadId, operation:input });
  assert.equal(updated.nodes.length,3);
  assert.equal(updated.segments.length,2);
  assert.deepEqual(updated.roads,road.roads);
  assert.deepEqual(updated.nodes.find(n=>n.id===input.newNodeId),
    {id:input.newNodeId,x:40,y:0});
  assert.throws(()=>applyRoadGeometryEdit(road,{roadId,operation:{
    ...input,newNodeId:road.nodes[0].id
  }}),/unique/);
  assert.throws(()=>applyRoadGeometryEdit(road,{roadId,operation:{
    ...input,segmentId:"missing"
  }}),/no longer exists/);
  assert.throws(()=>applyRoadGeometryEdit(road,{roadId,operation:{
    ...input,x:40,y:30
  }}),/within a road/);
  assert.throws(()=>applyRoadGeometryEdit(road,{roadId,operation:{
    ...input,x:0,y:0
  }}),/away from/);
  assert.throws(()=>applyRoadGeometryEdit(road,{roadId,operation:{
    ...input,edgeIndex:99
  }}),/index/);
});


test("demoting an unshared two-section junction restores the exact road shape", () => {
  let id = 0; const ids = () => "revert" + ++id;
  const original = addRoad(createEmptyAtlas(), {
    name: "North Road", idFactory: ids,
    points: [{ x: 0, y: 0 }, { x: 20, y: 25 }, { x: 100, y: 0 }]
  });
  const firstId = original.segments[0].id;
  const promoted = applyRoadGeometryEdit(original, {roadId: original.roads[0].id,
    operation: {kind:"create-junction", segmentId:firstId,
      edgeIndex:1, atVertex:true, x:20,y:25,
      newNodeId:ids(), newSegmentId:ids()}
  });
  const reverted = applyRoadGeometryEdit(promoted, {roadId:original.roads[0].id,
    operation:{kind:"demote-junction",nodeId:promoted.nodes.at(-1).id}
  });
  assert.deepEqual(reverted.roads, original.roads);
  assert.deepEqual(reverted.segments, original.segments, "the same polyline and first edge ID survive");
  assert.deepEqual(reverted.nodes, original.nodes, "no orphan graph node is left");
  assert.deepEqual(promoted.segments.length, 2, "the input is not mutated");
});

test("demotion handles reversed bidirectional sections without changing path geometry", () => {
  const data = { ...createEmptyAtlas(), enabled:true,
    nodes:[{id:"a",x:0,y:0},{id:"mid",x:50,y:0},{id:"b",x:100,y:0}],
    roads:[{id:"main",name:"Main"}],
    segments:[
      {id:"s1",roadId:"main",from:"mid",to:"a",via:[{x:25,y:10}],bidirectional:true},
      {id:"s2",roadId:"main",from:"b",to:"mid",via:[{x:75,y:-10}],bidirectional:true}
    ]
  };
  const result = applyRoadGeometryEdit(data,{roadId:"main",
    operation:{kind:"demote-junction",nodeId:"mid"}});
  assert.equal(result.segments.length,1);
  assert.deepEqual(result.segments[0],{id:"s1",roadId:"main",from:"a",to:"b",
    via:[{x:25,y:10},{x:50,y:0},{x:75,y:-10}],bidirectional:true});
  assert.ok(!result.nodes.some(n=>n.id==="mid"));
});

test("demotion rejects shared junctions, branch junctions, endpoints and closed loops", () => {
  let id=0; const ids=()=>"safety" + ++id;
  const main=addRoad(createEmptyAtlas(),{
    idFactory:ids,points:[{x:0,y:0},{x:100,y:0}],name:"Main"
  });
  assert.throws(()=>applyRoadGeometryEdit(main,{roadId:main.roads[0].id,
    operation:{kind:"demote-junction",nodeId:main.nodes[0].id}}),/pass-through/);
  const split=applyRoadGeometryEdit(main,{roadId:main.roads[0].id,
    operation:{kind:"create-junction",segmentId:main.segments[0].id,
      edgeIndex:0,x:50,y:0,newNodeId:ids(),newSegmentId:ids()}
  });
  const connecting=addRoad(split,{idFactory:ids,name:"Spur",
    points:[{x:50,y:0},{x:50,y:80}]});
  const middle=split.nodes.at(-1).id;
  assert.throws(()=>applyRoadGeometryEdit(connecting,{roadId:main.roads[0].id,
    operation:{kind:"demote-junction",nodeId:middle}}),/Detach shared/);
  const sameRoad=mergeRoadGroups(connecting,{keepRoadId:main.roads[0].id,
    mergeRoadId:connecting.roads[1].id});
  assert.throws(()=>applyRoadGeometryEdit(sameRoad,{roadId:main.roads[0].id,
    operation:{kind:"demote-junction",nodeId:middle}}),/two-section/);
  const loop={...createEmptyAtlas(),enabled:true,
    roads:[{id:"main",name:"Loop"}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:50,y:40}],
    segments:[
      {id:"ab",roadId:"main",from:"a",to:"b",via:[],bidirectional:true},
      {id:"ba",roadId:"main",from:"b",to:"a",via:[{x:25,y:70}],bidirectional:true}
    ]};
  assert.throws(()=>applyRoadGeometryEdit(loop,{roadId:"main",
    operation:{kind:"demote-junction",nodeId:"b"}}),/loop/);
});

test("junction inspector excludes endpoints and same-road pass-through nodes, and filters one hop", () => {
  const graph={...createEmptyAtlas(),enabled:true,
    roads:[{id:"main",name:"Main"},{id:"branch",name:"Branch"},
      {id:"other",name:"Other"},{id:"remote",name:"Remote"}],
    nodes:[{id:"a",x:0,y:0},{id:"b",x:50,y:0},{id:"c",x:100,y:0},
      {id:"d",x:50,y:60},{id:"e",x:100,y:60},
      {id:"r1",x:200,y:0},{id:"r2",x:230,y:0},{id:"r3",x:260,y:0},
      {id:"r4",x:230,y:40},{id:"unused",x:300,y:300}],
    segments:[
      {id:"m1",roadId:"main",from:"a",to:"b",via:[],bidirectional:true},
      {id:"m2",roadId:"main",from:"b",to:"c",via:[],bidirectional:true},
      {id:"br",roadId:"branch",from:"b",to:"d",via:[],bidirectional:true},
      {id:"ot",roadId:"other",from:"d",to:"e",via:[],bidirectional:true},
      {id:"r1s",roadId:"remote",from:"r1",to:"r2",via:[],bidirectional:true},
      {id:"r2s",roadId:"remote",from:"r2",to:"r3",via:[],bidirectional:true},
      {id:"r3s",roadId:"remote",from:"r2",to:"r4",via:[],bidirectional:true}
    ]};
  const ids=(opts)=>listRoadJunctions(graph,opts).map(j=>j.id);
  assert.deepEqual(ids(),["b","d","r2"]);
  assert.deepEqual(ids({roadId:"main",scope:"selected"}),["b"]);
  assert.deepEqual(ids({roadId:"main",scope:"connected"}),["b","d"]);
  assert.deepEqual(ids({roadId:"remote",scope:"selected"}),["r2"]);
  assert.deepEqual(ids({roadId:"missing",scope:"selected"}),[]);
  assert.throws(()=>ids({scope:"all"}),/Unknown/);
});
