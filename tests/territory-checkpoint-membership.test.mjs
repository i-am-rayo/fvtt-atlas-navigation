import test from "node:test";
import assert from "node:assert/strict";
import {inspectCheckpointTerritoryMembership} from "../scripts/territory-checkpoint-membership.js";
import {createEmptyAtlas} from "../scripts/atlas-model.js";
import {addRoad} from "../scripts/road-model.js";
import {addRoadCheckpoint} from "../scripts/checkpoint-model.js";

const geography=(kind,parentRegionId=null)=>({schemaVersion:1,kind,parentRegionId,roadOverrides:{}});
const region=(id,cells,kind="city",parent=null,checkpointId=null)=>({
  id,name:id,parent:{id:"scene"},hidden:false,
  shapes:[{type:"grid",offsets:cells}],
  getFlag(_namespace,key){return {
    atlas:{schemaVersion:1,linked:true},territoryGeography:geography(kind,parent),
    territoryCheckpoint:checkpointId?{schemaVersion:1,checkpointId}:null
  }[key]??null;}
});

test("read-only native grid membership detects nested leaf, overlapping peer and link mismatch",()=>{
  const previous={game:globalThis.game};
  try{
    globalThis.game={user:{isGM:true}};
    let sequence=0,atlas=addRoad(createEmptyAtlas(),{
      points:[{x:100,y:100},{x:900,y:900}],name:"Route",idFactory:()=>`id${++sequence}`});
    const from=atlas.segments[0].from,to=atlas.segments[0].to;
    atlas=addRoadCheckpoint(atlas,{roadId:atlas.roads[0].id,
      candidate:{kind:"node",nodeId:from},name:"Checkpoint One",idFactory:()=>`id${++sequence}`});
    atlas=addRoadCheckpoint(atlas,{roadId:atlas.roads[0].id,
      candidate:{kind:"node",nodeId:to},name:"Checkpoint Two",idFactory:()=>`id${++sequence}`});
    const cp1=atlas.checkpoints[0].id,cp2=atlas.checkpoints[1].id;
    const regions=[region("continent",[{i:1,j:1}],"continent"),
      region("town",[{i:1,j:1}],"town","continent",cp2),
      region("peer",[{i:1,j:1}],"town",null),
      region("remote",[{i:9,j:9}],"town",null,cp1)];
    const scene={id:"scene",regions:new Map(regions.map(r=>[r.id,r])),
      getFlag(_namespace,key){return key==="atlas"?atlas:null;}};
    const view={ready:true,scene,grid:{isGridless:false,
      getOffset:point=>({i:Math.floor(point.x/100),j:Math.floor(point.y/100)})},
      dimensions:{sceneX:0,sceneY:0}};
    const result=inspectCheckpointTerritoryMembership(scene,{view});
    assert.equal(result.available,true);
    assert.equal(result.items.find(item=>item.regionId==="continent").ambiguous,false,
      "an enclosing ancestor is not an ambiguous same-level overlap");
    assert.equal(result.items.find(item=>item.regionId==="town"&&item.checkpointId===cp1).ambiguous,true);
    assert.equal(result.items.find(item=>item.regionId==="peer").ambiguous,true);
    assert.equal(result.items.find(item=>item.regionId==="remote"&&item.checkpointId===cp1).contains,false,
      "an explicit link outside native grid ownership is reported, not relocated");
    assert.equal(result.items.find(item=>item.regionId==="town"&&item.checkpointId===cp2).explicit,true);
    assert.equal(regions[0].shapes[0].offsets.length,1,"inspection does not mutate native cells");
    globalThis.game.user.isGM=false;
    assert.equal(inspectCheckpointTerritoryMembership(scene,{view}).available,false,
      "no GM-only membership diagnostics on player clients");
  }finally{globalThis.game=previous.game;}
});
