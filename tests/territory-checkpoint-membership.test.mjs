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
    assert.equal(result.items.find(item=>item.regionId==="town"&&item.checkpointId===cp1).overlap,"peer");
    assert.equal(result.items.find(item=>item.regionId==="peer").ambiguous,true);
    assert.equal(result.items.find(item=>item.regionId==="remote"&&item.checkpointId===cp1).contains,false,
      "an explicit link outside native grid ownership is reported, not relocated");
    assert.equal(result.items.find(item=>item.regionId==="town"&&item.checkpointId===cp2).explicit,true);
    // A saved Checkpoint relocation and native grid transfer must be reflected
    // by the very next inspection; no cached membership or Scene flag write.
    const firstNode=atlas.nodes.find(n=>n.id===from);
    firstNode.x=950;firstNode.y=950;
    let changed=inspectCheckpointTerritoryMembership(scene,{view});
    assert.equal(changed.items.find(item=>item.regionId==="remote"&&item.checkpointId===cp1).contains,true);
    regions[3].shapes[0].offsets=[{i:8,j:8}];
    changed=inspectCheckpointTerritoryMembership(scene,{view});
    assert.equal(changed.items.find(item=>item.regionId==="remote"&&item.checkpointId===cp1).contains,false);
    assert.ok(changed.items.find(item=>item.regionId==="remote"&&item.checkpointId===cp1).explicit);
    assert.equal(regions[0].shapes[0].offsets.length,1,"inspection does not mutate native cells");
    globalThis.game.user.isGM=false;
    assert.equal(inspectCheckpointTerritoryMembership(scene,{view}).available,false,
      "no GM-only membership diagnostics on player clients");
  }finally{globalThis.game=previous.game;}
});

test("unrelated cross-tier cells are advisory, not conflicting peer ownership",()=>{
  const previous={game:globalThis.game};
  try{
    globalThis.game={user:{isGM:true}};
    let sequence=0;
    let atlas=addRoad(createEmptyAtlas(),{points:[{x:100,y:100},{x:200,y:200}],
      name:"Road",idFactory:()=>`i${++sequence}`});
    atlas=addRoadCheckpoint(atlas,{roadId:atlas.roads[0].id,
      candidate:{kind:"node",nodeId:atlas.segments[0].from},
      name:"Gate",idFactory:()=>`i${++sequence}`});
    const regions=[region("continent",[{i:1,j:1}],"continent"),
      region("settlement",[{i:1,j:1}],"city")];
    const scene={id:"scene",regions:new Map(regions.map(r=>[r.id,r])),
      getFlag(_scope,key){return key==="atlas"?atlas:null;}};
    const view={ready:true,scene,grid:{isGridless:false,
      getOffset:point=>({i:Math.floor(point.x/100),j:Math.floor(point.y/100)})},
      dimensions:{sceneX:0,sceneY:0}};
    const result=inspectCheckpointTerritoryMembership(scene,{view});
    assert.deepEqual(result.items.map(item=>item.overlap),["cross-tier","cross-tier"]);
    assert.equal(result.items.some(item=>item.ambiguous),false);
  }finally{globalThis.game=previous.game;}
});
