import test from "node:test";
import assert from "node:assert/strict";
import {suggestTerritoryCheckpointLinks,effectiveCheckpointLabelMode,
  territoryDisplayName} from "../scripts/territory-checkpoint-presentation.js";

const territory=(id,name,kind)=>({id,name,linked:true,invalid:false,
  geography:{kind}});

test("exact name and matching city/town/village type produce review-only suggestions",()=>{
  const regions=[territory("dirwest","Dirwest","city"),
    territory("millstone","Millstone","village"),
    territory("sea","Dirwest","area")];
  const checkpoints=[{id:"c1",name:" dirwest "},{id:"c2",name:"Millstone"},
    {id:"c3",name:"Dirwest North"}];
  const types={c1:"city",c2:"village",c3:"city"};
  assert.deepEqual(suggestTerritoryCheckpointLinks(regions,checkpoints,id=>types[id]),
    [{regionId:"dirwest",checkpointId:"c1"},
      {regionId:"millstone",checkpointId:"c2"}]);
  assert.deepEqual(suggestTerritoryCheckpointLinks([...regions,
    territory("duplicate","Dirwest","city")],checkpoints,id=>types[id]),
    [{regionId:"millstone",checkpointId:"c2"}],
  "duplicate names must not produce ambiguous auto-suggestions");
  assert.deepEqual(suggestTerritoryCheckpointLinks(regions,checkpoints,
    id=>id==="c1"?"town":types[id]),[{regionId:"millstone",checkpointId:"c2"}]);
});

test("visible geographic name temporarily moves an Always checkpoint label to Hover",()=>{
  assert.equal(effectiveCheckpointLabelMode("always",true),"hover");
  assert.equal(effectiveCheckpointLabelMode("always",false),"always");
  assert.equal(effectiveCheckpointLabelMode("off",true),"off");
  assert.equal(effectiveCheckpointLabelMode("hover",true),"hover");
  assert.equal(territoryDisplayName("Dirwest Area",{name:"Dirwest"}),"Dirwest");
  assert.equal(territoryDisplayName("Dirwest Area",null),"Dirwest Area");
});
