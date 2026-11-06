import test from "node:test";
import assert from "node:assert/strict";
import {publicRegionDestinationName}
  from "../scripts/atlas-announcement-region.js";
import {MODULE_ID} from "../scripts/atlas-storage.js";
import {PUBLIC_TERRITORY_FLAG} from "../scripts/region-narration-model.js";

function fixture(){
  const observed=[];
  const region={id:"territory",name:"GM only original name",hidden:false,
    parent:{id:"scene"},testPoint:point=>{
      observed.push(point);return point.x===510&&point.y===320&&point.elevation===10;
    },getFlag:(scope,key)=>{
      assert.equal(scope,MODULE_ID);assert.equal(key,PUBLIC_TERRITORY_FLAG);
      return {schemaVersion:1,enabled:true,label:"Valecor"};}};
  const record={sceneId:"scene",tokenId:"party",status:"moving",
    destination:{x:10,y:20},lastConfirmedAnchor:{point:{x:0,y:0}}};
  const scene={id:"scene",grid:{size:100},
    tokens:{get:()=>({elevation:10})},regions:{contents:[region]}};
  const view={ready:true,scene:{id:"scene"},
    dimensions:{sceneX:500,sceneY:300}};
  const atlas={schemaVersion:9};
  return {scene,view,atlas,record,region,observed};
}

test("only an opted-in, nonhidden Region containing native elevated Point B names a journey",()=>{
  const s=fixture();
  assert.equal(publicRegionDestinationName(s),"Valecor");
  assert.deepEqual(s.observed,[{x:510,y:320,elevation:10}],
    "native testPoint receives canvas coordinates with image origin and elevation");
  s.region.hidden=true;
  assert.equal(publicRegionDestinationName(s),null);
  s.region.hidden=false;
  s.region.getFlag=()=>null;
  assert.equal(publicRegionDestinationName(s),null);
  s.region.getFlag=()=>({schemaVersion:99,enabled:true,label:"Secret"});
  assert.equal(publicRegionDestinationName(s),null);
  s.region.getFlag=()=>({schemaVersion:1,enabled:true,label:"Valecor"});
  s.region.testPoint=()=>false;
  assert.equal(publicRegionDestinationName(s),null);
});

test("overlap, unknown elevation, wrong canvas and unsafe completion fail closed",()=>{
  const s=fixture();
  s.scene.regions.contents.push({...s.region,id:"territory2",
    getFlag:()=>({schemaVersion:1,enabled:true,label:"Reshara"})});
  assert.equal(publicRegionDestinationName(s),null);
  s.scene.regions.contents.pop();
  s.view.ready=false;
  assert.equal(publicRegionDestinationName(s),null);
  s.view.ready=true;s.view.scene.id="other";
  assert.equal(publicRegionDestinationName(s),null);
  s.view.scene.id="scene";
  s.scene.tokens.get=()=>({elevation:NaN});
  assert.equal(publicRegionDestinationName(s),null);
  s.scene.tokens.get=()=>({elevation:10});
  s.record.status="completed";
  s.record.lastConfirmedAnchor.point={x:9999,y:9999};
  assert.equal(publicRegionDestinationName(s),null);
  s.record.lastConfirmedAnchor.point={x:10,y:20};
  assert.equal(publicRegionDestinationName(s),"Valecor");
  s.region.testPoint=()=>{throw Error("Native Region unavailable");};
  assert.equal(publicRegionDestinationName(s),null);
});
