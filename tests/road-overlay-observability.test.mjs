import assert from "node:assert/strict";
import test from "node:test";
import { RoadOverlayObservability } from "../scripts/road-overlay-observability.js";

test("overlay diagnostics measure redraws without persisting or retaining unbounded events",()=>{
  let time=100;
  const metrics=new RoadOverlayObservability({now:()=>time});
  let mark=metrics.beginRefresh();
  time+=3.5;
  metrics.finishRefresh(mark,{sceneId:"scene-a",active:true,
    roadPaths:50,checkpointHits:12,labels:2});
  metrics.notePan();metrics.notePan();metrics.noteFog();
  metrics.noteGraphicsCreated();
  mark=metrics.beginRefresh();
  time+=8.5;
  metrics.finishRefresh(mark,{sceneId:"scene-b",active:false});
  metrics.noteGraphicsDestroyed();metrics.noteTeardown();

  const snapshot=metrics.snapshot();
  assert.deepEqual({refreshes:snapshot.refreshes,pan:snapshot.panRequests,
    fog:snapshot.fogRequests,teardown:snapshot.teardowns},
    {refreshes:2,pan:2,fog:1,teardown:1});
  assert.equal(snapshot.averageMs,6);
  assert.equal(snapshot.maxMs,8.5);
  assert.deepEqual(snapshot.last,{sceneId:"scene-b",active:false,
    roadPaths:0,checkpointHits:0,labels:0,durationMs:8.5});
  snapshot.last.sceneId="modified-locally";
  assert.equal(metrics.snapshot().last.sceneId,"scene-b");
  assert.equal(metrics.graphicsCreated,metrics.graphicsDestroyed);
  assert.equal(Object.hasOwn(metrics,"history"),false);
});
