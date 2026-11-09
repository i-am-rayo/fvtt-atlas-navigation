import test from "node:test";
import assert from "node:assert/strict";
import {saveTerritoryDraft,readTerritoryDraft,selectedBlankWallBoundary,
  territoryBoundaryNeedsAdoption,planNativeTerritoryAdoption,adoptNativeTerritoryBoundary}
  from "../scripts/territory-authoring.js";

const mkDraft=()=>({kind:"polygon",name:"Dirwest",
  points:[{id:"a",x:0,y:0},{id:"b",x:10,y:0},{id:"c",x:10,y:10},
    {id:"d",x:0,y:10}],offsets:[],wallIds:[],smoothing:0,
  geography:{schemaVersion:1,kind:"town",parentRegionId:null,roadOverrides:{}}});
const mockRegion=(id,kind,intersection=0)=>({id,name:"Millstone",parent:{id:"paedor"},
  canUserModify:()=>true,hidden:false,shapes:[{type:"polygon",origin:{x:0,y:0},
    points:[0,0,10,0,10,10,0,10],hole:false,gridBased:false}],
  getFlag:(_module,key)=>key==="atlas"?{schemaVersion:1,linked:true}:
    key==="territoryGeography"?{schemaVersion:1,kind,parentRegionId:null,
      roadOverrides:{}}:null,
  polygonTree:{intersectPolygon:()=>({area:intersection})}});

function fixture(peers=[]){
  const created=[];
  const regions=new Map(peers.map(region=>[region.id,region]));
  const scene={id:"paedor",regions,canUserModify:()=>true,
    async createEmbeddedDocuments(type,payload){created.push({type,payload});
      return [{id:"new-region",name:payload[0].name,parent:{id:"paedor"}}];}};
  const view={ready:true,scene:{id:"paedor"},
    dimensions:{sceneX:100,sceneY:200,sceneWidth:1000,sceneHeight:1000}};
  return {created,scene,view};
}

test("Territory save creates a native Region with one opt-in Atlas source and geography",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {created,scene,view}=fixture();
    const saved=await saveTerritoryDraft(scene,mkDraft(),{view});
    assert.equal(saved.id,"new-region");
    assert.equal(created.length,1);
    assert.equal(created[0].type,"Region");
    const data=created[0].payload[0];
    assert.equal(data.shapes[0].type,"polygon");
    assert.deepEqual(data.behaviors,[]);
    assert.equal(data.flags["fvtt-atlas-navigation"].territoryBoundarySource.nodes.length,4);
    assert.deepEqual(data.flags["fvtt-atlas-navigation"].territoryBoundarySource.nodes[0],
      {id:"a",x:-100,y:-200});
    assert.equal(data.flags["fvtt-atlas-navigation"].territoryGeography.kind,"town");
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("non-GMs and overlapping peer Territories cause zero writes",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {created,scene,view}=fixture([mockRegion("peer","village",30)]);
    globalThis.game={user:{isGM:false}};
    await assert.rejects(saveTerritoryDraft(scene,mkDraft(),{view}),/authorized GM/);
    globalThis.game={user:{isGM:true}};
    await assert.rejects(saveTerritoryDraft(scene,mkDraft(),{view}),/overlaps/);
    assert.equal(created.length,0);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("grid native save rejects cells owned by another settlement",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  const peer=mockRegion("peer","town");
  peer.shapes=[{type:"grid",offsets:[{i:2,j:3}]}];
  const {scene,created}=fixture([peer]);
  const draft={...mkDraft(),kind:"grid",points:[],offsets:[{i:2,j:3}]};
  const view={ready:true,scene:{id:"paedor"},
    dimensions:{sceneX:0,sceneY:0,sceneWidth:1000,sceneHeight:1000},grid:{
    getShape:()=>[{x:0,y:0},{x:1,y:0},{x:0,y:1}],
    getCenterPoint:()=>({x:0,y:0})}};
  try{
    await assert.rejects(saveTerritoryDraft(scene,draft,{view}),/already owned/);
    assert.equal(created.length,0);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("adopting existing native Regions never edits geometry on read",()=>{
  const old=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const region=mockRegion("dirwest","town");
    let updates=0;region.update=async()=>updates++;
    const {scene,view}=fixture([region]);
    const draft=readTerritoryDraft(scene,"dirwest",{view});
    assert.equal(draft.points.length,4);
    assert.equal(updates,0);
  }finally{globalThis.game=old;}
});

test("Atlas controls follow native Region coordinates after a Scene padding change",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {created,scene,view}=fixture();
    await saveTerritoryDraft(scene,mkDraft(),{view});
    const data=created[0].payload[0];
    const region=mockRegion("new-region","town");
    region.name=data.name;
    region.shapes=data.shapes;
    region.getFlag=(module,key)=>data.flags[module]?.[key]??null;
    scene.regions.set(region.id,region);
    const first=readTerritoryDraft(scene,region.id,{view});
    assert.deepEqual(first.points,mkDraft().points);
    view.dimensions.sceneX=120;view.dimensions.sceneY=180;
    const shifted=readTerritoryDraft(scene,region.id,{view});
    assert.deepEqual(shifted.points[0],{id:"a",x:0,y:0},
      "native Region remains authoritative even when Scene image origin changes");
    region.update=async patch=>{
      assert.equal(Object.hasOwn(patch,"shapes"),false,
        "unchanged geometry must not be rewritten during a flag-only Save");
      if(patch.shapes)region.shapes=patch.shapes;
    };
    const draft={...shifted,name:region.name,geography:mkDraft().geography};
    await saveTerritoryDraft(scene,draft,{regionId:region.id,view});
    assert.equal(region.shapes[0].origin.x,0,
      "explicitly saving an unchanged boundary must not shift the native Shape");
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("smoothed Atlas controls remain aligned to native Region geometry after padding changes",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {created,scene,view}=fixture();
    const original=mkDraft();original.smoothing=1;
    await saveTerritoryDraft(scene,original,{view});
    const data=created[0].payload[0];
    const region=mockRegion("smoothed","town");
    region.shapes=structuredClone(data.shapes);
    region.getFlag=(module,key)=>data.flags[module]?.[key]??null;
    scene.regions.set(region.id,region);
    const originalShape=structuredClone(region.shapes[0]);
    view.dimensions.sceneX+=75;
    view.dimensions.sceneY-=35;
    const draft=readTerritoryDraft(scene,region.id,{view});
    assert.deepEqual(draft.points,original.points);
    region.update=async patch=>{
      assert.equal(Object.hasOwn(patch,"shapes"),false,
        "an unchanged smoothed boundary must preserve its native Shape");
      if(patch.shapes)region.shapes=patch.shapes;
    };
    await saveTerritoryDraft(scene,{...draft,name:region.name,
      geography:original.geography},{regionId:region.id,view});
    assert.deepEqual(region.shapes[0],originalShape,
      "smoothing and unchanged controls must reproduce the same native geometry");
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("authoring requires full native parent containment, not a majority overlap",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const continent=mockRegion("valecor","continent",80);
    const {created,scene,view}=fixture([continent]);
    const draft=mkDraft();draft.geography.parentRegionId="valecor";
    await assert.rejects(saveTerritoryDraft(scene,draft,{view}),/beyond its designated parent/);
    assert.equal(created.length,0);
    continent.polygonTree.intersectPolygon=()=>({area:100});
    await saveTerritoryDraft(scene,draft,{view});
    assert.equal(created.length,1);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("stale native Region edits cannot be overwritten by an older Atlas draft",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const region=mockRegion("dirwest","town");
    let writes=0;region.update=async()=>{writes++;};
    const {scene,view}=fixture([region]);
    const draft={...readTerritoryDraft(scene,region.id,{view}),
      geography:mkDraft().geography,name:region.name};
    region.shapes=[{type:"polygon",origin:{x:0,y:0},
      points:[0,0,20,0,20,10,0,10],hole:false}];
    await assert.rejects(saveTerritoryDraft(scene,draft,{regionId:region.id,view}),
      /changed during editing/);
    assert.equal(writes,0);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("a standalone City can be authored without any Continent",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {scene,view,created}=fixture();
    const draft=mkDraft();draft.geography.kind="city";
    await saveTerritoryDraft(scene,draft,{view});
    assert.equal(created[0].payload[0].flags["fvtt-atlas-navigation"].territoryGeography.parentRegionId,null);
    assert.equal(created[0].payload[0].flags["fvtt-atlas-navigation"].territoryGeography.kind,"city");
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("reconcile native edits by refreshing Atlas controls without moving the native Shape",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {scene,view,created}=fixture();
    await saveTerritoryDraft(scene,mkDraft(),{view});
    const data=created[0].payload[0],flags=data.flags["fvtt-atlas-navigation"];
    const region=mockRegion("dirwest","town");
    region.shapes=structuredClone(data.shapes);
    region.behaviors=[{type:"teleport"}];
    region.getFlag=(_module,key)=>flags[key]??null;
    const writes=[];
    region.update=async patch=>{
      writes.push(patch);
      assert.equal(Object.hasOwn(patch,"shapes"),false,"Reconcile never rewrites native geometry");
      flags.territoryBoundarySource=patch["flags.fvtt-atlas-navigation.territoryBoundarySource"];
    };
    scene.regions.set(region.id,region);
    assert.equal(territoryBoundaryNeedsAdoption(region),false);
    region.shapes[0].origin={x:50,y:30}; // GM moved the native Region outside Atlas.
    assert.equal(territoryBoundaryNeedsAdoption(region),true);
    assert.throws(()=>readTerritoryDraft(scene,region.id,{view}),/Reconcile/);
    const plan=planNativeTerritoryAdoption(scene,region.id,{view});
    assert.equal(plan.controls,4);
    assert.equal(plan.source.nodes[0].x,-50);
    assert.equal(plan.source.nodes[0].y,-170);
    await adoptNativeTerritoryBoundary(scene,plan,{view});
    assert.equal(writes.length,1);
    assert.equal(region.shapes[0].origin.x,50);
    assert.deepEqual(region.behaviors,[{type:"teleport"}]);
    assert.equal(territoryBoundaryNeedsAdoption(region),false);
    const recovered=readTerritoryDraft(scene,region.id,{view});
    assert.equal(recovered.points[0].x,50);
    assert.equal(recovered.points[0].y,30);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("adopted native polygon origin need not be its minimum local vertex",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {scene,view,created}=fixture();
    await saveTerritoryDraft(scene,mkDraft(),{view});
    const data=created[0].payload[0];
    const flags=data.flags["fvtt-atlas-navigation"];
    const region=mockRegion("hearths-heart","town");
    region.shapes=[{type:"polygon",origin:{x:6333.14,y:2966.27},
      points:[-15,25,25,25,25,65,-15,65],hole:false,gridBased:false}];
    region.getFlag=(_module,key)=>flags[key]??null;
    region.update=async patch=>{
      if(patch["flags.fvtt-atlas-navigation.territoryBoundarySource"])
        flags.territoryBoundarySource=patch["flags.fvtt-atlas-navigation.territoryBoundarySource"];
      assert.equal(Object.hasOwn(patch,"shapes"),false,
        "adopted and untouched controls must preserve the native Shape representation");
      if(patch.shapes)region.shapes=patch.shapes;
    };
    scene.regions.set(region.id,region);
    const plan=planNativeTerritoryAdoption(scene,region.id,{view});
    await adoptNativeTerritoryBoundary(scene,plan,{view});
    const draft=readTerritoryDraft(scene,region.id,{view});
    assert.equal(draft.points[0].x,6318.14);
    assert.equal(draft.points[0].y,2991.27);
    const absoluteVertices=shape=>shape.points.map((n,i)=>
      n+(i%2?shape.origin.y:shape.origin.x));
    const before=absoluteVertices(region.shapes[0]);
    await saveTerritoryDraft(scene,{...draft,geography:mkDraft().geography,
      name:region.name},{regionId:region.id,view});
    assert.deepEqual(absoluteVertices(region.shapes[0]),before,
      "unchanged adopted controls must retain the exact native world boundary");
    assert.deepEqual(region.shapes[0].origin,{x:6333.14,y:2966.27},
      "even the native polygon's nonstandard origin must remain unchanged");
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("reconciliation refuses concurrent native geometry changes without writing",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {scene,view,created}=fixture();
    await saveTerritoryDraft(scene,mkDraft(),{view});
    const region=mockRegion("dirwest","town");
    const flags=created[0].payload[0].flags["fvtt-atlas-navigation"];
    region.getFlag=(_module,key)=>flags[key]??null;
    region.shapes=structuredClone(created[0].payload[0].shapes);
    region.shapes[0].origin={x:12,y:18};
    let writes=0;region.update=async()=>writes++;
    scene.regions.set(region.id,region);
    const plan=planNativeTerritoryAdoption(scene,region.id,{view});
    region.shapes[0].origin.x+=2;
    await assert.rejects(adoptNativeTerritoryBoundary(scene,plan,{view}),/changed/);
    assert.equal(writes,0);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("non-GMs cannot adopt a manually edited native Territory",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:false}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const region=mockRegion("dirwest","town");
    const {scene,view}=fixture([region]);
    assert.throws(()=>planNativeTerritoryAdoption(scene,region.id,{view}),/authorized GM/);
    await assert.rejects(adoptNativeTerritoryBoundary(scene,{regionId:region.id},
      {view}),/authorized GM/);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});
