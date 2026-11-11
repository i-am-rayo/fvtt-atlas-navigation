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

test("creating a distant native polygon preserves absolute v14 vertex positions",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {created,scene,view}=fixture();
    const draft=mkDraft();
    draft.points=draft.points.map(p=>({...p,x:p.x+3167.38,y:p.y+1480.8}));
    await saveTerritoryDraft(scene,draft,{view});
    const shape=created[0].payload[0].shapes[0];
    assert.deepEqual(shape.points,[3167.38,1480.8,3177.38,1480.8,
      3177.38,1490.8,3167.38,1490.8],
    "the native Region receives canvas-space vertices without adding its origin");
    assert.deepEqual(shape.origin,{x:3167.38,y:1480.8});
    const source=created[0].payload[0].flags["fvtt-atlas-navigation"]
      .territoryBoundarySource;
    assert.deepEqual(source.nodes[0],{id:"a",x:3067.38,y:1280.8},
      "Atlas-only control provenance remains Scene-image relative");
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

test("a newly authored Settlement cannot overlap an existing village",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {created,scene,view}=fixture([mockRegion("peer","village",30)]);
    const draft=mkDraft();draft.geography.kind="settlement";
    await assert.rejects(saveTerritoryDraft(scene,draft,{view}),/overlaps/);
    assert.equal(created.length,0);
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("a newly authored Settlement saves its kind without extra native Behaviors",async()=>{
  const old={game:globalThis.game,PIXI:globalThis.PIXI};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Polygon:class{constructor(points){this.points=points;}}};
  try{
    const {created,scene,view}=fixture();
    const draft=mkDraft();draft.geography.kind="settlement";
    await saveTerritoryDraft(scene,draft,{view});
    const data=created[0].payload[0];
    assert.equal(data.flags["fvtt-atlas-navigation"].territoryGeography.kind,"settlement");
    assert.deepEqual(data.behaviors,[]);
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
    region.shapes[0].points=region.shapes[0].points.map((value,index)=>
      value+(index%2===0?50:30)); // v14 polygon vertices move in canvas space.
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
    region.shapes=[{type:"polygon",origin:{x:6333.25,y:2963.39},
      points:[3167.38,1480.80,3999.07,1480.80,3999.07,2071.49,3167.38,2071.49],
      hole:false,gridBased:false,
      bounds:{x:3167.38,y:1480.8,width:831.69,height:590.69}}];
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
    // Simulate the previous test build's wrong adoption of origin+point. A valid
    // current native Shape and matching digest must still open in the new build.
    flags.territoryBoundarySource.nodes=flags.territoryBoundarySource.nodes.map(
      node=>({...node,x:node.x+region.shapes[0].origin.x,
        y:node.y+region.shapes[0].origin.y}));
    const draft=readTerritoryDraft(scene,region.id,{view});
    assert.ok(Math.abs(draft.points[0].x-3167.38)<1e-6);
    assert.ok(Math.abs(draft.points[0].y-1480.8)<1e-6);
    const before=structuredClone(region.shapes[0]);
    await saveTerritoryDraft(scene,{...draft,geography:mkDraft().geography,
      name:region.name},{regionId:region.id,view});
    assert.deepEqual(region.shapes[0],before,
      "an unchanged Save must preserve the original native raw world vertices and anchor");
    const repaired=readTerritoryDraft(scene,region.id,{view});
    assert.ok(Math.abs(repaired.points[0].x-3167.38)<1e-6,
      "explicit Save corrects erroneous Atlas provenance without moving native geometry");
    let editedShape;
    region.update=async patch=>{
      if(patch.shapes){editedShape=patch.shapes[0];region.shapes=patch.shapes;}
    };
    const edited={...repaired,points:repaired.points.map(p=>({...p})),
      geography:mkDraft().geography,name:region.name};
    edited.points[0].x+=5;
    await saveTerritoryDraft(scene,edited,{regionId:region.id,view});
    assert.equal(editedShape.origin.x,6333.25,
      "node edits must preserve the native manipulation anchor");
    assert.ok(Math.abs(editedShape.points[0]-3172.38)<1e-6);
    assert.ok(Math.abs(editedShape.points[2]-3999.07)<1e-6,
      "editing a node must not shift the rest of the polygon");
  }finally{globalThis.game=old.game;globalThis.PIXI=old.PIXI;}
});

test("native bounds discrepancy blocks unsupported polygon coordinate assumptions",()=>{
  const old=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const region=mockRegion("unsupported","town");
    region.shapes[0].bounds={x:9000,y:4000,width:10,height:10};
    const {scene,view}=fixture([region]);
    assert.throws(()=>readTerritoryDraft(scene,region.id,{view}),/rendered bounds/);
  }finally{globalThis.game=old;}
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
