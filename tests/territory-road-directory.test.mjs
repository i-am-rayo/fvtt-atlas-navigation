import test from "node:test";
import assert from "node:assert/strict";
import { readTerritoryRoadDirectory } from "../scripts/territory-road-directory.js";

function region(id,name,kind,parentRegionId,points) {
  return {id,name,hidden:false,behaviors:[],shapes:[{type:"polygon",points}],
    getFlag:(_module,key)=>key==="atlas"?{schemaVersion:1,linked:true}:
      key==="territoryGeography"?{schemaVersion:1,kind,parentRegionId,roadOverrides:{}}:null};
}
const atlas={schemaVersion:3,roads:[{id:"millstone-dirwest"},{id:"sea-road"}],
  nodes:[{id:"a",x:0,y:20},{id:"b",x:200,y:20},{id:"c",x:0,y:200},{id:"d",x:200,y:200}],
  segments:[{roadId:"millstone-dirwest",from:"a",to:"b",via:[]},
    {roadId:"sea-road",from:"c",to:"d",via:[]}]};

test("Road directory honors image origin and native polygons without writing on read",()=>{
  let writes=0;
  const regions=new Map([
    region("continent","Valecor","continent",null,[100,100,400,100,400,220,100,220]),
    region("city1","Millstone","city","continent",[100,100,180,100,180,140,100,140]),
    region("city2","Dirwest","city","continent",[220,100,300,100,300,140,220,140])
  ].map(item=>[item.id,item]));
  const scene={id:"scene",regions,setFlag:()=>{writes++;}};
  const view={ready:true,scene,dimensions:{sceneX:100,sceneY:100,size:100}};
  const result=readTerritoryRoadDirectory(scene,atlas,view);
  const root=result.tree[0];
  assert.equal(root.name,"Valecor");
  assert.deepEqual(root.roadIds,["millstone-dirwest"]);
  assert.equal(root.children.length,2);
  assert.ok(root.children.every(item=>item.roadIds.includes("millstone-dirwest")));
  assert.deepEqual(result.unclassifiedRoadIds,["sea-road"]);
  assert.equal(writes,0);
  const inactive=readTerritoryRoadDirectory(scene,atlas,{ready:false});
  assert.equal(inactive.geometryAvailable,false);
  assert.deepEqual(inactive.unclassifiedRoadIds,["millstone-dirwest","sea-road"]);
});
