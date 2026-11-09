import test from "node:test";
import assert from "node:assert/strict";
import {planTerritoryGridConversion} from "../scripts/territory-grid-conversion.js";
import {TerritoryGridConversionPreview} from "../scripts/territory-grid-conversion-preview.js";

const region=(id,kind,tree)=>({
  id,name:id,parent:{id:"scene1"},color:"#4d972b",hidden:false,behaviors:[],
  shapes:[{type:"polygon",origin:{x:0,y:0},
    points:[0,0,20,0,20,20,0,20],hole:false,gridBased:false}],
  bounds:{x:0,y:0,width:20,height:20},polygonTree:tree,
  polygons:[{points:[0,0,20,0,20,20,0,20]}],
  canUserModify:()=>true,
  getFlag(_scope,key){
    if(key==="atlas")return {schemaVersion:1,linked:true};
    if(key==="territoryGeography")return {schemaVersion:1,kind,
      parentRegionId:null,roadOverrides:{}};
    return null;
  },
  update(){throw Error("A read-only conversion preview cannot write a Region");}
});

function fixture(){
  const target=region("Reshara","continent",{
    area:400,testPoint:({x,y})=>x>=0&&x<20&&y>=0&&y<20
  });
  const settlement=region("Dirwest","town",{
    area:100,testPoint:({x,y})=>x>=0&&x<10&&y>=0&&y<10
  });
  const scene={id:"scene1",regions:new Map([[target.id,target],[settlement.id,settlement]]),
    canUserModify:()=>true};
  const grid={isGridless:false,type:4,size:10,
    getOffsetRange:()=>[0,0,3,3],
    getCenterPoint:({i,j})=>({x:i*10+5,y:j*10+5}),
    getShape:()=>[{x:-5,y:-5},{x:5,y:-5},{x:5,y:5},{x:-5,y:5}]};
  const view={ready:true,scene:{id:"scene1"},grid,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:100,sceneHeight:100}};
  return {scene,view,target,settlement};
}

test("preview samples native hex/grid centers, preserves parent/child overlap, writes nothing",()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry};
  globalThis.game={user:{isGM:true}};
  globalThis.foundry={data:{GridShapeData:class{}}};
  try{
    const {scene,view,target}=fixture();
    const priorShape=structuredClone(target.shapes);
    const plan=planTerritoryGridConversion(scene,target.id,{view});
    assert.deepEqual(plan.offsets,[{i:0,j:0},{i:0,j:1},{i:1,j:0},{i:1,j:1}]);
    assert.equal(plan.cellCount,4);
    assert.equal(plan.netAreaChangePercent,0);
    assert.equal(plan.tier,"continent");
    assert.deepEqual(plan.peerCenterOverlaps,[],
      "settlement inside its parent continent is an intentional different-tier overlap");
    assert.equal(plan.writes,0);
    assert.deepEqual(target.shapes,priorShape);
  }finally{Object.assign(globalThis,previous);}
});

test("same-tier peers are reported, never overwritten, by read-only preview",()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry};
  globalThis.game={user:{isGM:true}};
  globalThis.foundry={data:{GridShapeData:class{}}};
  try{
    const {scene,view,target}=fixture();
    const other=region("Peer","continent",{
      area:100,testPoint:({x,y})=>x>=0&&x<10&&y>=0&&y<10
    });
    scene.regions.set(other.id,other);
    const plan=planTerritoryGridConversion(scene,target.id,{view});
    assert.deepEqual(plan.peerCenterOverlaps,[{regionId:"Peer",name:"Peer",count:1}]);
    assert.equal(scene.regions.get(other.id),other);
  }finally{Object.assign(globalThis,previous);}
});

test("conversion preview fails closed for non-GM, unsupported builds, holes and oversized grids",()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry};
  const {scene,view,target}=fixture();
  try{
    globalThis.game={user:{isGM:false}};
    globalThis.foundry={data:{GridShapeData:class{}}};
    assert.throws(()=>planTerritoryGridConversion(scene,target.id,{view}),/GM/);
    globalThis.game.user.isGM=true;
    delete globalThis.foundry.data.GridShapeData;
    assert.throws(()=>planTerritoryGridConversion(scene,target.id,{view}),/v14.370/);
    globalThis.foundry.data.GridShapeData=class{};
    view.grid.isGridless=true;
    assert.throws(()=>planTerritoryGridConversion(scene,target.id,{view}),/square\/hex/);
    view.grid.isGridless=false;
    target.shapes[0].hole=true;
    assert.throws(()=>planTerritoryGridConversion(scene,target.id,{view}),/no holes/);
    target.shapes[0].hole=false;
    view.grid.getOffsetRange=()=>[0,0,200,200];
    assert.throws(()=>planTerritoryGridConversion(scene,target.id,{view}),/preview budget/);
  }finally{Object.assign(globalThis,previous);}
});

test("read-only conversion overlay shows candidate and original outlines and tears down",()=>{
  const previous={game:globalThis.game,PIXI:globalThis.PIXI,canvas:globalThis.canvas};
  class Container{
    constructor(){this.children=[];this.parent=null;this.destroyed=false;}
    addChild(item){this.children.push(item);item.parent=this;return item;}
    removeChild(item){this.children.splice(this.children.indexOf(item),1);}
    destroy(){this.destroyed=true;}
  }
  const strokes=[],fills=[];
  class Graphics{
    poly(points){this.points=points;return this;}
    fill(options){fills.push({points:this.points,options});return this;}
    stroke(options){strokes.push({points:this.points,options});return this;}
  }
  try{
    const {scene,view,target}=fixture();
    const interfaceLayer=new Container();
    view.interface=interfaceLayer;
    globalThis.game={user:{isGM:true}};
    globalThis.PIXI={Container,Graphics};globalThis.canvas=view;
    const preview=new TerritoryGridConversionPreview();
    preview.show(scene,{sceneId:scene.id,regionId:target.id,
      offsets:[{i:0,j:0},{i:1,j:0}]});
    assert.equal(fills.length,2);
    assert.equal(strokes.length,1);
    assert.equal(interfaceLayer.children.length,1);
    preview.clear();
    assert.equal(interfaceLayer.children.length,0);
    assert.equal(preview.layer,null);
  }finally{Object.assign(globalThis,previous);}
});
