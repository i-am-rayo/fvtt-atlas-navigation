import test from "node:test";
import assert from "node:assert/strict";
import {gmRoadTerritoryAtPoint} from "../scripts/road-territory-hover.js";

const geography=(kind,parentRegionId=null)=>({schemaVersion:1,kind,
  parentRegionId,roadOverrides:{}});
const region=(id,name,kind,box,{parent=null,linked=true,hidden=false}={})=>({
  id,name,hidden,parent:{id:"scene"},shapes:[],behaviors:[],
  polygonTree:{testPoint:point=>point.x>=box[0]&&point.x<=box[2]&&
    point.y>=box[1]&&point.y<=box[3]},
  getFlag(_scope,key){
    if(key==="atlas")return linked?{schemaVersion:1,linked:true}:null;
    if(key==="territoryGeography")return geography(kind,parent);
    return null;
  },
  setFlag(){throw Error("Reading Road hover must not write native Regions");}
});
const scene=(...entries)=>({id:"scene",regions:new Map(entries.map(r=>[r.id,r])),
  setFlag(){throw Error("Reading Road hover must not write Scene flags");}});
const view=scene=>({ready:true,scene});

test("GM hover selects native point containment and deepest verified descendant",()=>{
  const previous=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const continent=region("valecor","Valecor","continent",[0,0,200,100]);
    const village=region("dirwest","Dirwest","village",[40,0,80,100],
      {parent:"valecor"});
    const world=scene(continent,village),canvas=view(world);
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:60,y:30}),"Dirwest");
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:120,y:30}),"Valecor");
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:220,y:30}),null);
    assert.equal(gmRoadTerritoryAtPoint(world,{ready:false,scene:world},{x:60,y:30}),null);
    assert.equal(gmRoadTerritoryAtPoint(world,{ready:true,scene:{id:"other"}},{x:60,y:30}),null);
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:NaN,y:0}),null);
  }finally{globalThis.game=previous;}
});

test("unrelated overlaps, sibling names and invalid geographic ancestry fail closed",()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const a=region("a","Valecor","continent",[0,0,150,150]);
    const b=region("b","Reshara","continent",[0,0,150,150]);
    let world=scene(a,b);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:30,y:30}),null);
    const twin=region("sibling","Valecor","area",[0,0,150,150]);
    world=scene(a,twin);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:30,y:30}),null,
      "same-name overlapping Regions cannot manufacture unique ancestry");
    const invalid=region("invalid","Orphan","city",[0,0,10,10],{parent:"missing"});
    world=scene(a,invalid);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:5,y:5}),null);
    const unsupported=region("bad","Unknown","area",[0,0,100,100]);
    delete unsupported.polygonTree;
    world=scene(a,unsupported);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:30,y:30}),null,
      "unsupported native Region geometry must not guess a winner");
    const notLinked=region("other","Unlinked","city",[0,0,100,100],
      {linked:false});
    world=scene(a,notLinked);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:30,y:30}),"Valecor");
  }finally{globalThis.game=previous;}
});

test("GM-only guard prevents native metadata reads by player and on stale canvas",()=>{
  const previous=globalThis.game;
  let reads=0;
  const secret=region("secret","GM private Region","continent",[0,0,100,100],
    {hidden:true});
  const original=secret.getFlag;
  secret.getFlag=(...args)=>{reads++;return original(...args);};
  const world=scene(secret),canvas=view(world);
  try{
    globalThis.game={user:{isGM:false}};
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:30,y:30}),null);
    assert.equal(reads,0);
    globalThis.game={user:{isGM:true}};
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:30,y:30}),
      "GM private Region","hidden native names stay exclusively GM-side");
    assert.ok(reads>0);
  }finally{globalThis.game=previous;}
});
