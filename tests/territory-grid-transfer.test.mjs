import test from "node:test";
import assert from "node:assert/strict";
import {readTerritoryDraft} from "../scripts/territory-authoring.js";
import {inspectTerritoryGridOwnership,planTerritoryCellTransfer,commitTerritoryCellTransfer,
  planMultiDestinationTerritoryCellTransfer,commitMultiDestinationTerritoryCellTransfer,
  readPendingTerritoryCellTransfer,inspectPendingTerritoryCellTransfer,
  resolveTerritoryCellTransfer}
  from "../scripts/territory-grid-transfer.js";

const MODULE="fvtt-atlas-navigation";
function fixture(){
  const events=[],flags={};
  const region=(id,offsets)=>{
    const values={atlas:{schemaVersion:1,linked:true},
      territoryGeography:{schemaVersion:1,kind:"continent",parentRegionId:null,
        roadOverrides:{}}};
    const doc={id,name:id,parent:{id:"test-scene"},shapes:[{type:"grid",origin:null,
      offsets:structuredClone(offsets)}],hidden:false,behaviors:[{id:`${id}-behavior`}],
      color:0x11bb77,canUserModify:()=>true,
      getFlag:(_scope,key)=>values[key]??null,
      update:async patch=>{
        events.push({type:"region",id,pending:!!flags.territoryGridTransferIntent});
        if(fixture.failTarget===id)throw Error("Simulated native target failure");
        if(fixture.silentTarget===id)return;
        if(patch.shapes)doc.shapes=structuredClone(patch.shapes).map(shape=>
          fixture.withNativeDefaults?{...shape,hole:false,gridBased:true}:shape);
        for(const [field,value] of Object.entries(patch)){
          const prefix=`flags.${MODULE}.`;
          if(!field.startsWith(prefix))continue;
          const name=field.slice(prefix.length);
          if(name.startsWith("-="))values[name.slice(2)]=null;
          else if(value?.__forcedReplacement)values[name]=structuredClone(value.data);
          else if(name==="territoryBoundarySource"&&values[name])
            values[name]={...values[name],...structuredClone(value)};
          else values[name]=structuredClone(value);
        }
      }};
    return doc;
  };
  const source=region("Reshara",[{i:0,j:0},{i:1,j:0},{i:2,j:0}]);
  const target=region("Valecor",[{i:5,j:0}]);
  const regions=new Map([[source.id,source],[target.id,target]]);
  const scene={id:"test-scene",grid:{type:1,size:10},width:200,height:200,
    regions,canUserModify:()=>true,getFlag:(_scope,key)=>flags[key]??null,
    unsetFlag:async (_scope,key)=>{
      events.push({type:"scene-unset",key});
      if(!fixture.silentUnset)delete flags[key];
    },
    update:async patch=>{
      events.push({type:"scene"});
      for(const [field,value] of Object.entries(patch)){
        const name=field.slice(`flags.${MODULE}.`.length);
        if(name.startsWith("-="))flags[name.slice(2)]=null;
        else flags[name]=structuredClone(value);
      }
    }};
  const view={ready:true,scene:{id:scene.id},dimensions:{sceneX:0,sceneY:0,
    sceneWidth:200,sceneHeight:200},grid:{type:1,size:10,isGridless:false,
    getShape:()=>[{x:-5,y:-5},{x:5,y:-5},{x:5,y:5},{x:-5,y:5}],
    getCenterPoint:({i,j})=>({x:i*10+5,y:j*10+5})}};
  return {source,target,scene,view,flags,events,makeRegion:region};
}
function globals(){
  const before={game:globalThis.game,foundry:globalThis.foundry,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.foundry={data:{GridShapeData:class{},operators:{
    ForcedReplacement:{create:data=>({__forcedReplacement:true,data})}}}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  return ()=>Object.assign(globalThis,before);
}
function draft(f){
  const candidate=readTerritoryDraft(f.scene,f.target.id,{view:f.view});
  candidate.geography=f.target.getFlag(MODULE,"territoryGeography");
  candidate.offsets.push({i:1,j:0});
  return candidate;
}
function draftFor(f,region,offsets){
  const candidate=readTerritoryDraft(f.scene,region.id,{view:f.view});
  candidate.geography=region.getFlag(MODULE,"territoryGeography");
  candidate.offsets.push(...offsets);
  return {regionId:region.id,draft:candidate};
}
function batch(f){
  const source=f.makeRegion("Millstone",[{i:3,j:0},{i:4,j:0}]);
  const target=f.makeRegion("Keystone",[{i:10,j:0}]);
  f.scene.regions.set(source.id,source);f.scene.regions.set(target.id,target);
  const staged=[draftFor(f,f.target,[{i:1,j:0}]),draftFor(f,target,[{i:3,j:0}])];
  return {source,target,staged};
}

test("batch planner previews two destinations and two sources without native writes",()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    assert.equal(plan.schemaVersion,3);
    assert.deepEqual(plan.sourceIds,["Millstone","Reshara"]);
    assert.deepEqual(plan.targetIds,["Keystone","Valecor"]);
    assert.equal(plan.records.length,4);
    assert.equal(plan.movedCells,2);
    assert.deepEqual(plan.destinations.map(d=>[d.id,d.addedCells,d.finalCells]),
      [["Keystone",1,2],["Valecor",1,2]]);
    assert.equal(f.events.length,0,"planning is strictly read-only");
    globalThis.game.user.isGM=false;
    assert.throws(()=>planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view}),
      /GM/);
  }finally{restore();}
});

test("confirmed multi-destination batch persists v3 recovery before all native writes",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    const progress=[];
    await commitMultiDestinationTerritoryCellTransfer(f.scene,plan,{view:f.view,
      onProgress:event=>progress.push(event)});
    assert.deepEqual(progress.map(p=>p.step),[0,1,2,3,4,5,6,7]);
    assert.deepEqual(f.events.map(e=>e.type),
      ["scene","region","region","region","region","scene-unset"]);
    assert.deepEqual(f.events.filter(e=>e.type==="region").map(e=>e.id),
      ["Millstone","Reshara","Keystone","Valecor"]);
    assert.ok(f.events.filter(e=>e.type==="region").every(e=>e.pending));
    assert.deepEqual(b.source.shapes[0].offsets,[{i:4,j:0}]);
    assert.deepEqual(f.source.shapes[0].offsets,[{i:0,j:0},{i:2,j:0}]);
    assert.deepEqual(b.target.shapes[0].offsets,[{i:10,j:0},{i:3,j:0}]);
    assert.deepEqual(f.target.shapes[0].offsets,[{i:5,j:0},{i:1,j:0}]);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{restore();}
});

test("unclaimed-only batch saves two independent destination edits with no source owner",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    b.staged[0].draft.offsets=[{i:5,j:0},{i:14,j:0}];
    b.staged[1].draft.offsets=[{i:10,j:0},{i:16,j:0}];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    assert.deepEqual(plan.sourceIds,[]);
    assert.equal(plan.movedCells,0);
    assert.equal(plan.unclaimedAddedCells,2);
    assert.equal(plan.removedCells,0);
    assert.equal(plan.records.length,2);
    await commitMultiDestinationTerritoryCellTransfer(f.scene,plan,{view:f.view});
    assert.deepEqual(f.events.map(e=>e.type),
      ["scene","region","region","scene-unset"]);
    assert.deepEqual(f.events.filter(e=>e.type==="region").map(e=>e.id),
      ["Keystone","Valecor"]);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.deepEqual(f.source.shapes[0].offsets,[{i:0,j:0},{i:1,j:0},{i:2,j:0}]);
    assert.deepEqual(b.source.shapes[0].offsets,[{i:3,j:0},{i:4,j:0}]);
  }finally{restore();}
});

test("v14 grid writer fully replaces former polygon boundary nodes",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    // Simulate a converted polygon whose previous edit controls are still in
    // the boundary-source flag. Native v14 deeply merges ordinary flag maps.
    const nodes=[{id:"legacy",x:2,y:3}];
    for(const region of [f.target,b.target]){
      const original=region.shapes[0];
      const source={schemaVersion:1,kind:"grid",coordinateSpace:"scene-image",
        nodes:structuredClone(nodes),offsets:structuredClone(original.offsets),
        wallIds:[],smoothing:0,
        shapeDigest:readTerritoryDraft(f.scene,region.id,{view:f.view}).sourceDigest};
      // The fixture's update models a Foundry deep-merge, so set it first.
      await region.update({[`flags.${MODULE}.territoryBoundarySource`]:source});
    }
    const staged=[draftFor(f,f.target,[{i:14,j:0}]),
      draftFor(f,b.target,[{i:16,j:0}])];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,staged,{view:f.view});
    await commitMultiDestinationTerritoryCellTransfer(f.scene,plan,{view:f.view});
    assert.equal(f.target.getFlag(MODULE,"territoryBoundarySource").nodes,undefined);
    assert.equal(b.target.getFlag(MODULE,"territoryBoundarySource").nodes,undefined);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{restore();}
});

test("recovery refuses new polygon nodes even when every grid cell matches",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f),target=f.target;
    const nodes=[{id:"before",x:2,y:3}];
    await target.update({[`flags.${MODULE}.territoryBoundarySource`]:{
      schemaVersion:1,kind:"grid",coordinateSpace:"scene-image",nodes,
      offsets:structuredClone(target.shapes[0].offsets),wallIds:[],smoothing:0,
      shapeDigest:readTerritoryDraft(f.scene,target.id,{view:f.view}).sourceDigest}});
    const staged=[draftFor(f,target,[{i:14,j:0}]),
      draftFor(f,b.target,[{i:16,j:0}])];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,staged,{view:f.view});
    fixture.silentTarget=target.id;
    await assert.rejects(()=>commitMultiDestinationTerritoryCellTransfer(f.scene,plan,
      {view:f.view}),/did not retain/);
    fixture.silentTarget=null;
    const record=readPendingTerritoryCellTransfer(f.scene).records
      .find(r=>r.id===target.id);
    target.shapes=structuredClone(record.after.shapes);
    await target.update({[`flags.${MODULE}.territoryBoundarySource`]:{
      ...record.after.source,nodes:[{id:"unknown",x:200,y:200}]}});
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(review.canResume,false);
    assert.equal(review.canRollback,false);
    assert.match(review.resumeBlocker,/boundary controls/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
  }finally{fixture.silentTarget=null;restore();}
});

test("legacy retained original nodes alone permit a guarded recovery, not arbitrary edits",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f),nodes=[{id:"historic",x:12,y:24}];
    const target=f.target;
    const before={schemaVersion:1,kind:"grid",coordinateSpace:"scene-image",
      nodes,offsets:structuredClone(target.shapes[0].offsets),wallIds:[],smoothing:0,
      shapeDigest:readTerritoryDraft(f.scene,target.id,{view:f.view}).sourceDigest};
    await target.update({[`flags.${MODULE}.territoryBoundarySource`]:before});
    const staged=[draftFor(f,target,[{i:14,j:0}]),
      draftFor(f,b.target,[{i:16,j:0}])];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,staged,{view:f.view});
    fixture.silentTarget=target.id;
    await assert.rejects(()=>commitMultiDestinationTerritoryCellTransfer(f.scene,plan,
      {view:f.view}),/did not retain|Simulated|after investigating/);
    fixture.silentTarget=null;
    const record=readPendingTerritoryCellTransfer(f.scene).records
      .find(r=>r.id===target.id);
    target.shapes=structuredClone(record.after.shapes);
    const retained={...structuredClone(record.after.source),nodes:structuredClone(nodes)};
    await target.update({[`flags.${MODULE}.territoryBoundarySource`]:retained});
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(review.canResume,true);
    assert.equal(review.records.find(r=>r.id===target.id).state,"after");
    const savedWrites=f.events.length;
    await resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view});
    assert.ok(f.events.length>savedWrites);
    assert.equal(target.getFlag(MODULE,"territoryBoundarySource").nodes,undefined);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{fixture.silentTarget=null;restore();}
});

test("unclaimed-only v3 batch can roll back after partial native failure",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    b.staged[0].draft.offsets=[{i:5,j:0},{i:14,j:0}];
    b.staged[1].draft.offsets=[{i:10,j:0},{i:16,j:0}];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    fixture.failTarget="Valecor";
    await assert.rejects(()=>commitMultiDestinationTerritoryCellTransfer(f.scene,plan,
      {view:f.view}),/Simulated native target failure/);
    const pending=readPendingTerritoryCellTransfer(f.scene);
    assert.deepEqual(pending.sourceIds,[]);
    assert.deepEqual(inspectPendingTerritoryCellTransfer(f.scene,{view:f.view})
      .records.map(r=>[r.role,r.state]),[["target","after"],["target","before"]]);
    fixture.failTarget=null;
    await resolveTerritoryCellTransfer(f.scene,"rollback",{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.deepEqual(b.target.shapes[0].offsets,[{i:10,j:0}]);
    assert.deepEqual(f.target.shapes[0].offsets,[{i:5,j:0}]);
  }finally{fixture.failTarget=null;restore();}
});

test("blocked recovery identifies exactly which snapshot fields drifted without writing",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    b.staged[0].draft.offsets=[{i:5,j:0},{i:14,j:0}];
    b.staged[1].draft.offsets=[{i:10,j:0},{i:16,j:0}];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    fixture.failTarget="Valecor";
    await assert.rejects(()=>commitMultiDestinationTerritoryCellTransfer(f.scene,plan,
      {view:f.view}),/Simulated native target failure/);
    fixture.failTarget=null;
    const written=b.target.getFlag(MODULE,"territoryBoundarySource");
    assert.ok(written);
    written.offsets.reverse(); // A benign-looking but unapproved flag mutation.
    const count=f.events.length;
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    const blocked=review.records.find(record=>record.id==="Keystone");
    assert.equal(blocked.state,"blocked");
    assert.match(blocked.reason,/Differences from original: native Shape/);
    assert.match(blocked.reason,/from planned result: Atlas boundary controls/);
    assert.equal(review.canResume,false);
    assert.equal(review.canRollback,false);
    assert.equal(f.events.length,count,"diagnostics may not touch native documents");
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
  }finally{fixture.failTarget=null;restore();}
});

test("batch permits erasures without peer transfers but rejects all-no-op stages",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    b.staged[0].draft.offsets=[{i:5,j:0}];
    b.staged[1].draft.offsets=[{i:10,j:0}];
    assert.throws(()=>planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view}),
      /no Hex\/Grid cell changes/);
    b.target.shapes[0].offsets.push({i:11,j:0});
    b.staged[1]=draftFor(f,b.target,[]);
    b.staged[1].draft.offsets=[{i:10,j:0}];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    assert.equal(plan.removedCells,1);
    assert.equal(plan.unclaimedAddedCells,0);
    await commitMultiDestinationTerritoryCellTransfer(f.scene,plan,{view:f.view});
    assert.deepEqual(b.target.shapes[0].offsets,[{i:10,j:0}]);
  }finally{restore();}
});

test("interrupted v3 batch keeps all snapshots and explicitly resumes or rolls back",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    const originals=[b.source,f.source,b.target,f.target].map(r=>structuredClone(r.shapes));
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    fixture.failTarget="Valecor";
    await assert.rejects(()=>commitMultiDestinationTerritoryCellTransfer(f.scene,plan,
      {view:f.view}),/Simulated native target failure/);
    const pending=readPendingTerritoryCellTransfer(f.scene);
    assert.equal(pending.schemaVersion,3);
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(review.regionCount,4);
    assert.deepEqual(review.records.map(r=>[r.role,r.state]),
      [["source","after"],["source","after"],["target","after"],["target","before"]]);
    assert.equal(review.canResume,true);
    assert.equal(review.canRollback,true);
    fixture.failTarget=null;
    await resolveTerritoryCellTransfer(f.scene,"rollback",{view:f.view});
    assert.deepEqual([b.source,f.source,b.target,f.target].map(r=>r.shapes),originals);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    await commitMultiDestinationTerritoryCellTransfer(f.scene,plan,{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{fixture.failTarget=null;restore();}
});

test("v3 batch resumes idempotently after a target failure and blocks unrelated edits",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    fixture.failTarget="Keystone";
    await assert.rejects(()=>commitMultiDestinationTerritoryCellTransfer(f.scene,plan,
      {view:f.view}),/Simulated native target failure/);
    fixture.failTarget=null;
    f.target.shapes[0].offsets.push({i:18,j:0});
    const blocked=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(blocked.canResume,false);
    assert.equal(blocked.canRollback,false);
    await assert.rejects(()=>resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view}),
      /changed outside the transfer/);
    f.target.shapes[0].offsets.pop();
    await resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.deepEqual(b.target.shapes[0].offsets,[{i:10,j:0},{i:3,j:0}]);
  }finally{fixture.failTarget=null;restore();}
});

test("one source can distribute distinct cells to two destinations in the same batch",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    b.staged[0].draft.offsets=[{i:5,j:0},{i:1,j:0}];
    b.staged[1].draft.offsets=[{i:10,j:0},{i:2,j:0}];
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    assert.deepEqual(plan.sourceIds,["Reshara"]);
    assert.equal(plan.movedCells,2);
    await commitMultiDestinationTerritoryCellTransfer(f.scene,plan,{view:f.view});
    assert.deepEqual(f.source.shapes[0].offsets,[{i:0,j:0}]);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{restore();}
});

test("batch refuses destination swaps, duplicate claims and stale plan without writes",async()=>{
  const restore=globals();
  try{
    const f=fixture(),b=batch(f);
    b.staged[1].draft.offsets.push({i:5,j:0});
    assert.throws(()=>planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view}),
      /destination.*cell|Destination-to-destination/i);
    b.staged[1].draft.offsets.pop();
    b.staged[1].draft.offsets.push({i:1,j:0});
    assert.throws(()=>planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view}),
      /same Hex\/Grid cell/);
    b.staged[1].draft.offsets.pop();
    b.staged[0].draft.offsets=b.staged[0].draft.offsets.filter(offset=>offset.i!==5);
    b.staged[1].draft.offsets.push({i:5,j:0});
    assert.throws(()=>planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view}),
      /Destination-to-destination cell moves/);
    b.staged[0].draft.offsets.push({i:5,j:0});
    b.staged[1].draft.offsets.pop();
    const plan=planMultiDestinationTerritoryCellTransfer(f.scene,b.staged,{view:f.view});
    b.source.shapes[0].offsets.push({i:9,j:0});
    await assert.rejects(()=>commitMultiDestinationTerritoryCellTransfer(f.scene,plan,
      {view:f.view}),/changed since preview/);
    assert.equal(f.events.length,0);
  }finally{restore();}
});

test("Hex/Grid ownership review distinguishes unclaimed, single-peer and multi-peer cells without writes",()=>{
  const restore=globals();
  try{
    const f=fixture(),candidate=draft(f);
    candidate.offsets.push({i:4,j:0});
    const first=inspectTerritoryGridOwnership(f.scene,f.target.id,candidate,{view:f.view});
    assert.equal(first.addedCells,2);
    assert.equal(first.unclaimedAddedCells,1);
    assert.equal(first.peerOwnedAddedCells,1);
    assert.equal(first.contestedAddedCells,0);
    assert.deepEqual(first.peers.map(p=>[p.name,p.cells]),[["Reshara",1]]);
    assert.deepEqual(first.previewCells.map(cell=>[cell.i,cell.status]),
      [[1,"peer"],[4,"unclaimed"]],"visual review marks same-tier ownership without writing");
    assert.equal(first.previewTruncated,false);
    assert.equal(first.canUseExistingTransferWriter,true);
    const another=f.makeRegion("Third",[{i:4,j:0},{i:6,j:0}]);
    f.scene.regions.set(another.id,another);
    const multiple=inspectTerritoryGridOwnership(f.scene,f.target.id,candidate,{view:f.view});
    assert.equal(multiple.peerOwnedAddedCells,2);
    assert.equal(multiple.requiresMultiRegionReview,true);
    assert.equal(multiple.peers.length,2);
    assert.deepEqual(multiple.previewCells.map(cell=>cell.status),["peer","peer"]);
    const multiPlan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    assert.equal(multiPlan.sourceIds.length,2,"two separate owners create one multi-source plan");
    assert.equal(multiPlan.records.length,3);
    another.shapes[0].offsets=[{i:1,j:0}];
    const contested=inspectTerritoryGridOwnership(f.scene,f.target.id,candidate,{view:f.view});
    assert.equal(contested.contestedAddedCells,1);
    assert.equal(contested.unclaimedAddedCells,1);
    assert.deepEqual(contested.previewCells.map(cell=>cell.status),
      ["contested","unclaimed"],"conflicting cells take priority in the visual preview");
    assert.equal(f.events.length,0,"ownership review and failed plan never write");
    globalThis.game.user.isGM=false;
    assert.throws(()=>inspectTerritoryGridOwnership(f.scene,f.target.id,candidate,{view:f.view}),
      /GM/);
  }finally{restore();}
});

test("shared-border inspection uses native square and hex adjacency without writing",()=>{
  const restore=globals();
  try{
    const f=fixture();
    const squareNeighbors=({i,j})=>[
      {i:i-1,j},{i:i+1,j},{i,j:j-1},{i,j:j+1}];
    f.view.grid.getAdjacentOffsets=squareNeighbors;
    let review=inspectTerritoryGridOwnership(f.scene,f.target.id,draft(f),{view:f.view});
    assert.equal(review.seamInspectionAvailable,true);
    assert.equal(review.sharedBorderEdges,2,
      "two native edges meet the same source peer while another added cell remains unclaimed");
    assert.deepEqual(review.adjacentPeers,[{id:"Reshara",name:"Reshara",touchingEdges:2}]);
    assert.equal(review.existingOverlapCells,0);
    f.target.shapes[0].offsets.push({i:2,j:0});
    const unchanged=readTerritoryDraft(f.scene,f.target.id,{view:f.view});
    unchanged.geography=f.target.getFlag(MODULE,"territoryGeography");
    review=inspectTerritoryGridOwnership(f.scene,f.target.id,unchanged,{view:f.view});
    assert.equal(review.existingOverlapCells,1,
      "existing same-tier overlap is identified even with no draft additions");

    const hex=fixture();
    hex.target.shapes[0].offsets=[{i:1,j:1}];
    hex.source.shapes[0].offsets=[{i:2,j:0}];
    hex.view.grid.getAdjacentOffsets=({i,j})=>[
      {i:i+1,j:j-1},{i:i-1,j:j+1}];
    const hexDraft=readTerritoryDraft(hex.scene,hex.target.id,{view:hex.view});
    hexDraft.geography=hex.target.getFlag(MODULE,"territoryGeography");
    review=inspectTerritoryGridOwnership(hex.scene,hex.target.id,hexDraft,{view:hex.view});
    assert.equal(review.sharedBorderEdges,1,
      "Foundry's hex neighbor offsets are authoritative, not hardcoded square steps");
    assert.equal(hex.events.length+f.events.length,0);
  }finally{restore();}
});

test("shared-border preview reports unavailable topology instead of partial counts",()=>{
  const restore=globals();
  try{
    const f=fixture();
    const review=inspectTerritoryGridOwnership(f.scene,f.target.id,draft(f),{view:f.view});
    assert.equal(review.seamInspectionAvailable,false);
    assert.equal(review.sharedBorderEdges,null);
    assert.deepEqual(review.adjacentPeers,[]);
    assert.equal(review.peerOwnedAddedCells,1,
      "lack of native adjacency must not alter exact transfer ownership counts");
    assert.equal(f.events.length,0);
  }finally{restore();}
});

test("GM ownership preview marks removed cells and caps large overlays without altering full counts",()=>{
  const restore=globals();
  try{
    const f=fixture(),candidate=draft(f);
    candidate.offsets=candidate.offsets.filter(cell=>cell.i!==5);
    const removed=inspectTerritoryGridOwnership(f.scene,f.target.id,candidate,{view:f.view});
    assert.equal(removed.removedCells,1);
    assert.deepEqual(removed.previewCells.map(cell=>cell.status),["peer","removed"]);
    const large=draft(f);
    for(let i=10;i<550;i++)large.offsets.push({i,j:0});
    const report=inspectTerritoryGridOwnership(f.scene,f.target.id,large,{view:f.view});
    assert.equal(report.addedCells,541);
    assert.equal(report.previewTotalCells,541);
    assert.equal(report.previewCells.length,500);
    assert.equal(report.previewTruncated,true);
    assert.equal(report.previewCells[0].status,"peer",
      "peer claims remain visible even when the unclaimed overlay is capped");
    assert.equal(f.events.length,0,"all ownership overlays are strictly read-only");
  }finally{restore();}
});

test("Hex/Grid ownership review rejects stale target geometry without writes",()=>{
  const restore=globals();
  try{
    const f=fixture(),candidate=draft(f);
    f.target.shapes[0].offsets.push({i:8,j:0});
    assert.throws(()=>inspectTerritoryGridOwnership(f.scene,f.target.id,candidate,{view:f.view}),
      /changed/);
    assert.equal(f.events.length,0);
  }finally{restore();}
});

test("GM transfer preflights exact ownership, writes persistent intent first, then two Regions",async()=>{
  const restore=globals();
  try{
    const f=fixture(),candidate=draft(f);
    const beforeSource=structuredClone(f.source.shapes);
    const plan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    assert.equal(plan.movedCells,1);
    assert.equal(f.events.length,0,"preview never writes");
    const progress=[];
    await commitTerritoryCellTransfer(f.scene,plan,{view:f.view,
      onProgress:status=>progress.push(status)});
    assert.deepEqual(progress.map(status=>status.step),[0,1,2,3,4,5]);
    assert.match(progress.at(-2).message,/Verifying native Region geometry/);
    assert.deepEqual(f.events.map(e=>e.type),["scene","region","region","scene-unset"]);
    assert.equal(f.events[1].id,f.source.id,"remove ownership before adding it");
    assert.ok(f.events[1].pending&&f.events[2].pending);
    assert.deepEqual(f.source.shapes[0].offsets,[{i:0,j:0},{i:2,j:0}]);
    assert.deepEqual(f.target.shapes[0].offsets,[{i:5,j:0},{i:1,j:0}]);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.equal(f.source.behaviors[0].id,"Reshara-behavior");
    assert.equal(f.target.color,0x11bb77);
    assert.equal(beforeSource[0].offsets.length,3);
  }finally{restore();}
});

test("interrupted Region transfer persists before/after snapshots for explicit rollback",async()=>{
  const restore=globals();
  try{
    const f=fixture(),candidate=draft(f),before=structuredClone(f.source.shapes);
    const plan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    fixture.failTarget=f.target.id;
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
    assert.deepEqual(f.source.shapes[0].offsets,[{i:0,j:0},{i:2,j:0}]);
    fixture.failTarget=null;
    await resolveTerritoryCellTransfer(f.scene,"rollback",{view:f.view});
    assert.deepEqual(f.source.shapes,before);
    assert.deepEqual(f.target.shapes[0].offsets,[{i:5,j:0}]);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{fixture.failTarget=null;restore();}
});

test("interrupted transfer resumes idempotently and blocks unrelated native edits",async()=>{
  const restore=globals();
  try{
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    fixture.failTarget=f.target.id;
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    fixture.failTarget=null;
    await resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.deepEqual(f.target.shapes[0].offsets,[{i:5,j:0},{i:1,j:0}]);
  }finally{fixture.failTarget=null;restore();}
});

test("recovery inspector summarizes v1 partial writes without modifying native documents",async()=>{
  const restore=globals();
  try{
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    fixture.failTarget=f.target.id;
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    fixture.failTarget=null;
    const before=f.events.length;
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(review.regionCount,2);
    assert.equal(review.appliedRegions,1);
    assert.equal(review.originalRegions,1);
    assert.deepEqual(review.records.map(r=>[r.id,r.role,r.state,r.beforeCells,r.afterCells]),
      [["Reshara","source","after",3,2],["Valecor","target","before",1,2]]);
    assert.equal(review.canResume,true);
    assert.equal(review.canRollback,true);
    assert.equal(f.events.length,before,"preflight does not write Region or Scene data");
    globalThis.game.user.isGM=false;
    assert.throws(()=>inspectPendingTerritoryCellTransfer(f.scene,{view:f.view}),/GM/);
  }finally{fixture.failTarget=null;restore();}
});

test("a resolved-but-ignored Region update fails postflight and retains durable intent",async()=>{
  const restore=globals();
  try{
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    fixture.silentTarget=f.target.id;
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /did not retain the expected native geometry/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
    assert.equal(f.events.filter(event=>event.type==="scene-unset").length,0,
      "postflight prevents removing the recovery record");
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(review.canResume,true,"a retry remains safe after ignored native write");
    fixture.silentTarget=null;
    const progress=[];
    await resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view,
      onProgress:event=>progress.push(event)});
    assert.deepEqual(progress.map(event=>event.step),[1,2,3,4,5]);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{fixture.silentTarget=null;restore();}
});

test("a silently ignored Scene cleanup remains explicitly recoverable",async()=>{
  const restore=globals();
  try{
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    fixture.silentUnset=true;
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /did not clear the recovery record/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.deepEqual(review.records.map(r=>r.state),["after","after"]);
    assert.equal(review.canResume,true);
    assert.equal(review.canRollback,true);
    fixture.silentUnset=false;
    await resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{fixture.silentUnset=false;restore();}
});

test("recovery preflight blocks both choices after an active grid identity change",async()=>{
  const restore=globals();
  try{
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    fixture.failTarget=f.target.id;
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    fixture.failTarget=null;
    const writes=f.events.length;
    f.scene.grid.size=20;
    const inspected=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(inspected.gridMatches,false);
    assert.equal(inspected.canResume,false);
    assert.equal(inspected.canRollback,false);
    assert.match(inspected.resumeBlocker,/Scene grid/);
    assert.equal(f.events.length,writes);
    await assert.rejects(()=>resolveTerritoryCellTransfer(f.scene,"rollback",{view:f.view}),
      /Scene grid changed/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
  }finally{fixture.failTarget=null;restore();}
});

test("transfer rejects changed native target and a non-GM without writes",async()=>{
  const restore=globals();
  try{
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    f.source.shapes[0].offsets.push({i:3,j:0});
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),/changed since preview/);
    assert.equal(f.events.length,0);
    globalThis.game.user.isGM=false;
    assert.throws(()=>planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view}),/GM/);
    assert.equal(f.events.length,0);
  }finally{restore();}
});

test("recovery refuses third-party edits and retains the intent for manual inspection",async()=>{
  const restore=globals();
  try{
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    fixture.failTarget=f.target.id;
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    fixture.failTarget=null;
    f.target.shapes[0].offsets.push({i:9,j:9});
    const inspected=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(inspected.canResume,false);
    assert.equal(inspected.canRollback,false);
    assert.equal(inspected.records.find(record=>record.id===f.target.id).state,"blocked");
    await assert.rejects(()=>resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view}),
      /changed outside the transfer/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
    globalThis.game.user.isGM=false;
    await assert.rejects(()=>resolveTerritoryCellTransfer(f.scene,"rollback",{view:f.view}),/GM/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
  }finally{fixture.failTarget=null;restore();}
});

test("transfer refuses a proposed source with zero remaining cells",()=>{
  const restore=globals();
  try{
    const f=fixture();
    f.source.shapes[0].offsets=[{i:1,j:0}];
    assert.throws(()=>planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view}),
      /leave the source Region empty/);
    assert.equal(f.events.length,0);
  }finally{restore();}
});

test("transfer tolerates native RegionShapeData materializing default Shape fields",async()=>{
  const restore=globals();
  try{
    fixture.withNativeDefaults=true;
    const f=fixture(),plan=planTerritoryCellTransfer(f.scene,f.target.id,draft(f),{view:f.view});
    await commitTerritoryCellTransfer(f.scene,plan,{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.deepEqual(f.source.shapes[0].offsets,[{i:0,j:0},{i:2,j:0}]);
  }finally{fixture.withNativeDefaults=false;restore();}
});

test("multi-source Hex/Grid transfer persists v2 intent and removes both sources before target",async()=>{
  const restore=globals();
  try{
    const f=fixture(),third=f.makeRegion("Millstone",[{i:4,j:0},{i:6,j:0}]);
    f.scene.regions.set(third.id,third);
    const candidate=draft(f);candidate.offsets.push({i:4,j:0});
    const plan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    assert.deepEqual(plan.sourceIds,["Millstone","Reshara"]);
    assert.equal(plan.movedCells,2);
    assert.deepEqual(plan.sources.map(s=>[s.id,s.movedCells,s.remainingCells]),
      [["Millstone",1,1],["Reshara",1,2]]);
    assert.equal(f.events.length,0,"planning never edits native Regions");
    const progress=[];
    await commitTerritoryCellTransfer(f.scene,plan,{view:f.view,
      onProgress:p=>progress.push(p)});
    assert.deepEqual(progress.map(p=>p.step),[0,1,2,3,4,5,6]);
    assert.deepEqual(f.events.map(e=>e.type),
      ["scene","region","region","region","scene-unset"]);
    assert.deepEqual(f.events.filter(e=>e.type==="region").map(e=>e.id),
      ["Millstone","Reshara","Valecor"]);
    assert.ok(f.events.filter(e=>e.type==="region").every(e=>e.pending),
      "durable intent precedes every native update");
    assert.deepEqual(third.shapes[0].offsets,[{i:6,j:0}]);
    assert.deepEqual(f.source.shapes[0].offsets,[{i:0,j:0},{i:2,j:0}]);
    assert.deepEqual(f.target.shapes[0].offsets,
      [{i:5,j:0},{i:1,j:0},{i:4,j:0}]);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.deepEqual(third.behaviors,[{id:"Millstone-behavior"}]);
  }finally{restore();}
});

test("interrupted v2 multi-source transfer rolls back all three Regions with preserved intent",async()=>{
  const restore=globals();
  try{
    const f=fixture(),third=f.makeRegion("Millstone",[{i:4,j:0},{i:6,j:0}]);
    f.scene.regions.set(third.id,third);
    const before=[third,f.source,f.target].map(r=>structuredClone(r.shapes));
    const candidate=draft(f);candidate.offsets.push({i:4,j:0});
    const plan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    fixture.failTarget="Reshara";
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    const pending=readPendingTerritoryCellTransfer(f.scene);
    assert.equal(pending.schemaVersion,2);
    assert.deepEqual(pending.sourceIds,["Millstone","Reshara"]);
    assert.deepEqual(third.shapes[0].offsets,[{i:6,j:0}],
      "first Region already changed before interruption");
    fixture.failTarget=null;
    const review=inspectPendingTerritoryCellTransfer(f.scene,{view:f.view});
    assert.equal(review.regionCount,3);
    assert.deepEqual(review.records.map(record=>record.state),["after","before","before"]);
    assert.equal(review.canResume,true);
    assert.equal(review.canRollback,true);
    await resolveTerritoryCellTransfer(f.scene,"rollback",{view:f.view});
    assert.deepEqual([third,f.source,f.target].map(r=>r.shapes),before);
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{fixture.failTarget=null;restore();}
});

test("interrupted v2 transfer resumes and rejects third-party edits",async()=>{
  const restore=globals();
  try{
    const f=fixture(),third=f.makeRegion("Millstone",[{i:4,j:0},{i:6,j:0}]);
    f.scene.regions.set(third.id,third);
    const candidate=draft(f);candidate.offsets.push({i:4,j:0});
    const plan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    fixture.failTarget="Valecor";
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    fixture.failTarget=null;
    f.source.shapes[0].offsets.push({i:8,j:0});
    await assert.rejects(()=>resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view}),
      /changed outside the transfer/);
    assert.ok(readPendingTerritoryCellTransfer(f.scene));
    f.source.shapes[0].offsets.pop();
    await resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
    assert.equal(f.target.shapes[0].offsets.length,3);
  }finally{fixture.failTarget=null;restore();}
});

test("multi-source transfer rejects ambiguous duplicate ownership and stale sources before writing",async()=>{
  const restore=globals();
  try{
    const f=fixture(),third=f.makeRegion("Millstone",[{i:1,j:0},{i:6,j:0}]);
    f.scene.regions.set(third.id,third);
    const candidate=draft(f);
    assert.throws(()=>planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view}),
      /multiple peer Territories/);
    third.shapes[0].offsets=[{i:4,j:0},{i:6,j:0}];
    candidate.offsets.push({i:4,j:0});
    const plan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    third.shapes[0].offsets.push({i:7,j:0});
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /changed since preview/);
    assert.equal(f.events.length,0);
  }finally{restore();}
});

test("multi-source preflight refuses empty source Regions and overlarge peer groups",()=>{
  const restore=globals();
  try{
    const f=fixture(),third=f.makeRegion("Millstone",[{i:4,j:0}]);
    f.scene.regions.set(third.id,third);
    const candidate=draft(f);candidate.offsets.push({i:4,j:0});
    assert.throws(()=>planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view}),
      /leave Millstone empty/);
    third.shapes[0].offsets.push({i:6,j:0});
    for(let k=0;k<3;k++){
      const offset=10+k*2;
      const peer=f.makeRegion(`Extra-${k}`,[{i:offset,j:0},{i:offset+1,j:0}]);
      f.scene.regions.set(peer.id,peer);
      candidate.offsets.push({i:offset,j:0});
    }
    assert.throws(()=>planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view}),
      /over four peer Territories/);
    assert.equal(f.events.length,0);
  }finally{restore();}
});

test("malformed v2 recovery intent fails closed without editing native Regions",async()=>{
  const restore=globals();
  try{
    const f=fixture(),third=f.makeRegion("Millstone",[{i:4,j:0},{i:6,j:0}]);
    f.scene.regions.set(third.id,third);
    const candidate=draft(f);candidate.offsets.push({i:4,j:0});
    const plan=planTerritoryCellTransfer(f.scene,f.target.id,candidate,{view:f.view});
    fixture.failTarget="Valecor";
    await assert.rejects(()=>commitTerritoryCellTransfer(f.scene,plan,{view:f.view}),
      /Simulated native target failure/);
    fixture.failTarget=null;
    const intent=f.flags.territoryGridTransferIntent;
    const ids=structuredClone(intent.sourceIds);
    intent.sourceIds=["Reshara","Reshara"];
    assert.throws(()=>readPendingTerritoryCellTransfer(f.scene),/unsupported/);
    await assert.rejects(()=>resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view}),
      /unsupported/);
    assert.ok(f.flags.territoryGridTransferIntent,
      "malformed recovery record is never automatically discarded");
    intent.sourceIds=ids;
    await resolveTerritoryCellTransfer(f.scene,"resume",{view:f.view});
    assert.equal(readPendingTerritoryCellTransfer(f.scene),null);
  }finally{fixture.failTarget=null;restore();}
});
