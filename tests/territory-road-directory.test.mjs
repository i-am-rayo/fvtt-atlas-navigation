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

test("an unassigned city groups under the dominant native continent without a flag write",()=>{
  const continent=region("valecor","Valecor","continent",null,
    [100,100,400,100,400,220,100,220]);
  const city=region("dirwest","Dirwest","city",null,
    [110,110,150,110,150,140,110,140]);
  continent.parent={id:"scene"};city.parent={id:"scene"};
  continent.area=36000;continent.bounds={x:100,y:100,width:300,height:120};
  continent.polygonTree={intersectPolygon:()=>({area:90})};
  city.area=100;city.isSingleShape=true;city.polygons=[{id:"city-polygon"}];
  city.bounds={x:110,y:110,width:40,height:30};
  const scene={id:"scene",regions:new Map([continent,city].map(item=>[item.id,item]))};
  let writes=0;scene.setFlag=()=>{writes++;};
  const view={ready:true,scene,dimensions:{sceneX:100,sceneY:100,size:100}};
  const result=readTerritoryRoadDirectory(scene,atlas,view);
  assert.equal(result.tree.length,1);
  assert.equal(result.tree[0].name,"Valecor");
  assert.equal(result.tree[0].children[0].name,"Dirwest");
  assert.equal(writes,0);
  assert.equal(city.getFlag(null,"territoryGeography").parentRegionId,null);
});

test("Road directory asks native Region geometry for grid Shape membership",()=>{
  const native=region("grid","Grid Territory","continent",null,[]);
  native.shapes=[{type:"grid",origin:null,offsets:[{i:0,j:0}]}];
  let calls=0;
  native.testPoint=point=>{calls++;return point.x>=0&&point.x<100&&point.y<100;};
  const scene={id:"scene",regions:new Map([[native.id,native]])};
  const view={ready:true,scene,dimensions:{sceneX:0,sceneY:0,size:100}};
  const result=readTerritoryRoadDirectory(scene,atlas,view);
  assert.ok(calls>0);
  assert.ok(result.tree[0].roadIds.includes("millstone-dirwest"));
});
