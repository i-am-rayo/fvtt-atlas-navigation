import assert from "node:assert/strict";
import test from "node:test";
import { appendGroupedTransportationOptions } from "../scripts/navigation-transport-choices.js";

const element=tag=>({
  tagName:tag.toUpperCase(),children:[],label:"",value:"",textContent:"",
  appendChild(node){this.children.push(node);}
});

test("navigation and leg method choices group by source and preserve option IDs",()=>{
  const select=element("select");
  const groups=appendGroupedTransportationOptions(select,[
    {group:"Party",value:"owned|walking",label:"Walking (party pace)"},
    {group:"Party",value:"owned|camel",label:"Camel"},
    {group:"Port Barthos",value:"hire|sailing",label:"Sailing Ship"},
    {group:"Port Barthos",value:"hire|ship-passage",label:"Ship passage"},
    {group:"Haven Dock",value:"hire|rowboat",label:"Rowboat"}
  ],{documentProvider:()=>({createElement:element})});
  assert.deepEqual(select.children.map(node=>node.label),["Party","Port Barthos","Haven Dock"]);
  assert.equal(groups.get("Party").children.length,2);
  assert.deepEqual(groups.get("Port Barthos").children.map(node=>node.value),
    ["hire|sailing","hire|ship-passage"]);
  assert.equal(groups.get("Port Barthos").children[0].textContent,"Sailing Ship");
  assert.equal(select.children[2].children[0].value,"hire|rowboat");
});

test("group renderer never accepts invalid choice IDs or blank source markers",()=>{
  const select=element("select");
  assert.throws(()=>appendGroupedTransportationOptions(select,[{label:"Only label"}],
    {documentProvider:()=>({createElement:element})}),/Invalid/);
  appendGroupedTransportationOptions(select,[{value:"owned|walking",label:"Walking",group:""}],
    {documentProvider:()=>({createElement:element})});
  assert.equal(select.children[0].label,"Party");
});
