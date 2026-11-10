import test from "node:test";
import assert from "node:assert/strict";
import {readTerritoryDraft} from "../scripts/territory-authoring.js";
import {inspectTerritoryGridOwnership,planTerritoryCellTransfer,commitTerritoryCellTransfer,
  readPendingTerritoryCellTransfer,resolveTerritoryCellTransfer}
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
        if(patch.shapes)doc.shapes=structuredClone(patch.shapes).map(shape=>
          fixture.withNativeDefaults?{...shape,hole:false,gridBased:true}:shape);
        for(const [field,value] of Object.entries(patch)){
          const prefix=`flags.${MODULE}.`;
          if(!field.startsWith(prefix))continue;
          const name=field.slice(prefix.length);
          if(name.startsWith("-="))values[name.slice(2)]=null;
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
    unsetFlag:async (_scope,key)=>{events.push({type:"scene-unset",key});delete flags[key];},
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
  globalThis.foundry={data:{GridShapeData:class{}}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  return ()=>Object.assign(globalThis,before);
}
function draft(f){
  const candidate=readTerritoryDraft(f.scene,f.target.id,{view:f.view});
  candidate.geography=f.target.getFlag(MODULE,"territoryGeography");
  candidate.offsets.push({i:1,j:0});
  return candidate;
}

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
    assert.deepEqual(progress.map(status=>status.step),[0,1,2,3,4]);
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
    assert.deepEqual(progress.map(p=>p.step),[0,1,2,3,4,5]);
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
