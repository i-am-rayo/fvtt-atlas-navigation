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
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:60,y:30}),"Dirwest, Valecor");
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
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:30,y:30}),"Valecor, Valecor",
      "one local Area and one continent may both be named without explicit parentage");
    const twin2=region("sibling2","Valecor","area",[0,0,150,150]);
    world=scene(a,twin,twin2);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:30,y:30}),null,
      "two co-containing sibling Areas must remain ambiguous, even with identical names");
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

test("one unparented local and one continent combine from native 2D containment",()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const continent=region("reshara","Reshara","continent",[0,0,200,200]);
    const village=region("village","Genasi Village","settlement",[20,20,80,80]);
    const area=region("dunes","Desert Dunes","area",[100,20,160,80]);
    const world=scene(continent,village,area),canvas=view(world);
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:50,y:50}),
      "Genasi Village, Reshara");
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:125,y:50}),
      "Desert Dunes, Reshara");
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:180,y:50}),"Reshara");
    assert.equal(gmRoadTerritoryAtPoint(world,canvas,{x:210,y:50}),null);
  }finally{globalThis.game=previous;}
});

test("nested Area and Settlement prefer deepest local while ambiguity still fails closed",()=>{
  const previous=globalThis.game;globalThis.game={user:{isGM:true}};
  try{
    const continent=region("c","Reshara","continent",[0,0,200,200]);
    const area=region("a","Mensa Damnum","area",[20,20,180,180],{parent:"c"});
    const settlement=region("s","Genasi Village","settlement",[30,30,80,80],{parent:"a"});
    let world=scene(continent,area,settlement);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:50,y:50}),
      "Genasi Village, Reshara");
    const second=region("s2","Other Village","settlement",[30,30,80,80]);
    world=scene(continent,area,settlement,second);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:50,y:50}),null,
      "two competing local Regions must not be selected by taxonomy");
    const unrelated=region("other","Unrelated","continent",[0,0,200,200]);
    world=scene(continent,settlement,unrelated);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:50,y:50}),null,
      "overlapping continents remain ambiguous");
    const wrong=region("wrong","Other Village","settlement",[30,30,80,80],
      {parent:"elsewhere"});
    world=scene(continent,wrong);
    assert.equal(gmRoadTerritoryAtPoint(world,view(world),{x:50,y:50}),null,
      "a conflicting explicit parent must not be inferred from overlapping geometry");
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
