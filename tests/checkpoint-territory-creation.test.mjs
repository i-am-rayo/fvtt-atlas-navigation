import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createEmptyAtlas} from "../scripts/atlas-model.js";
import {addRoadCheckpoint} from "../scripts/checkpoint-model.js";
import {planCheckpointTerritory,createCheckpointTerritory,
  checkpointTerritoryCellDraft,CheckpointTerritoryCellPreview}
  from "../scripts/checkpoint-territory-creation.js";

function fixture({kind="city",gridShape=[{x:-50,y:-50},{x:50,y:-50},
  {x:50,y:50},{x:-50,y:50}]}={}){
  const old={game:globalThis.game,foundry:globalThis.foundry,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.foundry={data:{GridShapeData:class {}}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  const atlas=addRoadCheckpoint({...createEmptyAtlas(),revision:7,enabled:true,
    nodes:[{id:"a",x:20,y:20},{id:"b",x:120,y:120}],
    roads:[{id:"r",name:"North Road"}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[],bidirectional:true}]},
  {roadId:"r",candidate:{kind:"node",nodeId:"b"},name:"The Eyrie",
    elevationMeters:0,idFactory:()=>"cp1"});
  let current=atlas,category=kind;
  const writes=[];
  const scene={id:"atlas-scene",regions:new Map(),canUserModify:()=>true,
    getFlag:(_module,key)=>key==="atlas"?current:
      key==="checkpointCategories"?{cp1:category}:null,
    async createEmbeddedDocuments(type,payload){
      writes.push({type,payload});
      const flags=payload[0].flags["fvtt-atlas-navigation"];
      const region={id:"created",name:payload[0].name,parent:{id:scene.id},
        hidden:false,canUserModify:()=>true,shapes:payload[0].shapes,
        getFlag:(_scope,key)=>flags[key]??null};
      scene.regions.set(region.id,region);
      return [region];
    }};
  const view={ready:true,scene:{id:scene.id},dimensions:{sceneX:100,sceneY:200,
    sceneWidth:2000,sceneHeight:2000},grid:{isGridless:false,
    getOffset:point=>({i:Math.floor((point.x-100)/100),
      j:Math.floor((point.y-200)/100)}),
    getCenterPoint:offset=>({x:150+offset.i*100,y:250+offset.j*100}),
    getShape:()=>gridShape}};
  const peer=(id,name,peerKind,offsets)=>{
    const flags={atlas:{schemaVersion:1,linked:true},
      territoryGeography:{schemaVersion:1,kind:peerKind,parentRegionId:null,roadOverrides:{}}};
    const region={id,name,parent:{id:scene.id},hidden:false,canUserModify:()=>true,
      shapes:[{type:"grid",offsets}],getFlag:(_scope,key)=>flags[key]??null};
    scene.regions.set(id,region);return region;
  };
  return {scene,view,writes,peer,atlas,
    setCategory:value=>{category=value;},setAtlas:value=>{current=value;},
    restore(){globalThis.game=old.game;globalThis.foundry=old.foundry;
      globalThis.PIXI=old.PIXI;}};
}

for(const kind of ["city","town","village","settlement"]){
  test(`${kind} Checkpoint offers one native cell and atomically links identity`,async()=>{
    const f=fixture({kind});
    try{
      const plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
      assert.equal(plan.kind,kind);
      assert.deepEqual(plan.offset,{i:1,j:1},"Scene image origin is respected");
      assert.deepEqual(checkpointTerritoryCellDraft(plan).offsets,[{i:1,j:1}]);
      const region=await createCheckpointTerritory(f.scene,plan,{view:f.view});
      assert.equal(region.id,"created");
      assert.equal(f.writes.length,1,"no separate Scene/Region flag write is needed");
      const data=f.writes[0].payload[0];
      assert.equal(f.writes[0].type,"Region");
      assert.equal(data.name,"The Eyrie");
      assert.deepEqual(data.behaviors,[]);
      assert.deepEqual(data.shapes,[{type:"grid",offsets:[{i:1,j:1}],origin:null}]);
      assert.deepEqual(data.flags["fvtt-atlas-navigation"].territoryCheckpoint,
        {schemaVersion:1,checkpointId:"cp1"});
      assert.equal(data.flags["fvtt-atlas-navigation"].territoryGeography.kind,kind);
      assert.equal(data.flags["fvtt-atlas-navigation"].territoryBoundarySource.kind,"grid");
      assert.equal(data.flags["fvtt-atlas-navigation"].atlas.linked,true);
      assert.equal(planCheckpointTerritory(f.scene,"cp1",{view:f.view}),null,
        "already associated Checkpoints get no second offer");
    }finally{f.restore();}
  });
}

test("non-settlement types never offer the one-cell creation",()=>{
  const f=fixture({kind:"bridge"});
  try{assert.equal(planCheckpointTerritory(f.scene,"cp1",{view:f.view}),null);}
  finally{f.restore();}
});

test("close name matches suggest linking; exact duplicates block new creation",async()=>{
  const f=fixture({kind:"town"});
  try{
    f.peer("near","The Eyrie - Abandoned Town","town",[{i:8,j:8}]);
    const plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    assert.deepEqual(plan.compatible.map(item=>[item.id,item.nameMatch]),
      [["near","leading"]]);
    assert.equal(plan.createBlocked,null);
    f.peer("exact","The Eyrie","town",[{i:9,j:9}]);
    const existing=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    assert.match(existing.createBlocked,/exact name/);
    await assert.rejects(createCheckpointTerritory(f.scene,existing,{view:f.view}),/exact name/);
    assert.equal(f.writes.length,0);
  }finally{f.restore();}
});

test("existing peer settlement cell prevents creation even with different subtype",async()=>{
  const f=fixture({kind:"village"});
  try{
    f.peer("owner","Woodland","settlement",[{i:1,j:1}]);
    const plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    assert.match(plan.createBlocked,/already owned/);
    await assert.rejects(createCheckpointTerritory(f.scene,plan,{view:f.view}),/already owned/);
    assert.equal(f.writes.length,0);
  }finally{f.restore();}
});

test("stale revision, relocated node, altered type and new Region each prevent writes",async()=>{
  const f=fixture();
  try{
    let plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    f.setAtlas({...f.atlas,revision:f.atlas.revision+1});
    await assert.rejects(createCheckpointTerritory(f.scene,plan,{view:f.view}),/changed during review/);
    f.setAtlas(f.atlas);
    plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    f.setAtlas({...f.atlas,nodes:f.atlas.nodes.map(node=>node.id==="b"?
      {...node,x:130}:node)});
    await assert.rejects(createCheckpointTerritory(f.scene,plan,{view:f.view}),/changed during review/);
    f.setAtlas(f.atlas);
    plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    f.setCategory("town");
    await assert.rejects(createCheckpointTerritory(f.scene,plan,{view:f.view}),/changed during review/);
    f.setCategory("city");
    plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    f.peer("new","New distant Territory","area",[{i:8,j:8}]);
    await assert.rejects(createCheckpointTerritory(f.scene,plan,{view:f.view}),/changed during review/);
    assert.equal(f.writes.length,0);
  }finally{f.restore();}
});

test("changed native cell geometry prevents committing a stale hex/square preview",async()=>{
  const f=fixture();
  try{
    const plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    f.view.grid.getShape=()=>[{x:-35,y:-35},{x:35,y:-35},
      {x:35,y:35},{x:-35,y:35}];
    await assert.rejects(createCheckpointTerritory(f.scene,plan,{view:f.view}),/changed during review/);
    assert.equal(f.writes.length,0);
  }finally{f.restore();}
});

test("the native authoring write refuses a mismatched checkpoint cell or name",async()=>{
  const f=fixture();
  try{
    const plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    const {saveTerritoryDraft}=await import("../scripts/territory-authoring.js");
    const wrongCell={...checkpointTerritoryCellDraft(plan),offsets:[{i:3,j:4}]};
    const wrongName={...checkpointTerritoryCellDraft(plan),name:"Different City"};
    const options={view:f.view,checkpointAssociation:{checkpointId:"cp1",
      expectedAtlasRevision:plan.atlasRevision}};
    await assert.rejects(saveTerritoryDraft(f.scene,wrongCell,options),/position or type changed/);
    await assert.rejects(saveTerritoryDraft(f.scene,wrongName,options),/position or type changed/);
    assert.equal(f.writes.length,0);
  }finally{f.restore();}
});

test("GM, native grid and live Scene constraints fail closed without writes",async()=>{
  const f=fixture();
  try{
    globalThis.game.user.isGM=false;
    assert.throws(()=>planCheckpointTerritory(f.scene,"cp1",{view:f.view}),/GM/);
    globalThis.game.user.isGM=true;
    f.view.grid.isGridless=true;
    assert.throws(()=>planCheckpointTerritory(f.scene,"cp1",{view:f.view}),/native Grid Shapes/);
    f.view.grid.isGridless=false;
    globalThis.foundry.data.GridShapeData=null;
    assert.throws(()=>planCheckpointTerritory(f.scene,"cp1",{view:f.view}),/native Grid Shapes/);
    globalThis.foundry.data.GridShapeData=class {};
    f.view.scene.id="different";
    assert.throws(()=>planCheckpointTerritory(f.scene,"cp1",{view:f.view}),/native Grid Shapes/);
    assert.equal(f.writes.length,0);
  }finally{f.restore();}
});

test("a rejected native create leaves no dangling Region or association",async()=>{
  const f=fixture();
  try{
    const plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    f.scene.createEmbeddedDocuments=async()=>{throw Error("Foundry storage unavailable");};
    await assert.rejects(createCheckpointTerritory(f.scene,plan,{view:f.view}),/storage unavailable/);
    assert.equal(f.scene.regions.size,0);
  }finally{f.restore();}
});

test("one-cell GM highlight is disposable and uses native square/hex vertices",()=>{
  const f=fixture({kind:"settlement",gridShape:[{x:0,y:-40},{x:45,y:-20},
    {x:45,y:20},{x:0,y:40},{x:-45,y:20},{x:-45,y:-20}]});
  try{
    const plan=planCheckpointTerritory(f.scene,"cp1",{view:f.view});
    const calls=[];
    globalThis.PIXI.Graphics=class{
      poly(points){calls.push(points);return this;}
      fill(){return this;}
      stroke(){return this;}
      destroy(){calls.push("destroy");}
    };
    f.view.interface={addChild:()=>{}};
    const preview=new CheckpointTerritoryCellPreview();
    preview.show(f.scene,plan,{view:f.view});
    assert.equal(calls[0].length,12,"six hex vertices, not a circular approximation");
    preview.clear();
    assert.equal(calls[1],"destroy");
  }finally{f.restore();}
});

test("Road Settings is a minimizable native v14 dialog and retains guarded close",()=>{
  const source=readFileSync(new URL("../scripts/main.js",import.meta.url),"utf8");
  assert.match(source,/window:\s*\{\s*title:\s*atlasSettingsTitle\("Road",actual\.name\),\s*resizable:\s*true,\s*minimizable:\s*true\s*\}/);
  assert.match(source,/approveSettingsClose\(/);
  assert.match(source,/trackSettingsChanges\(/);
});
