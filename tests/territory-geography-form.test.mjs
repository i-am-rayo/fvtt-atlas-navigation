import test from "node:test";
import assert from "node:assert/strict";
import {buildTerritoryGeographyForm,geographyFromForm}
  from "../scripts/territory-geography-form.js";

class Element {
  constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();}
  appendChild(child){this.children.push(child);return child;}
  setAttribute(name,value){this[name]=value;}
  addEventListener(name,listener){this.listeners.set(name,listener);}
}
const all=e=>[e,...(e.children??[]).flatMap(all)];

test("geographic type, parent and corrective selections survive DialogV2 serialization",()=>{
  const previous=globalThis.document;
  try {
    globalThis.document={createElement:tag=>new Element(tag)};
    const current={schemaVersion:1,kind:"city",parentRegionId:"valecor",
      roadOverrides:{road1:"exclude"}};
    const form=buildTerritoryGeographyForm({region:{id:"dirwest"},current,
      territories:[{id:"valecor",name:"Valecor",linked:true,invalid:false,
        geography:{kind:"continent"}}],roads:[{id:"road1",name:"Millstone Road"}]});
    const fields=all(form).filter(item=>item.tag==="select");
    assert.deepEqual(fields.map(item=>item.name),["kind","parentId","roadId","roadMode"]);
    const [kind,parentId]=fields;
    assert.equal(kind.value,"city");
    assert.equal(parentId.value,"valecor");
    assert.equal(all(kind).find(item=>item.tag==="option"&&item.value==="city").defaultSelected,true);
    assert.equal(all(parentId).find(item=>item.tag==="option"&&item.value==="valecor").defaultSelected,true);
    assert.deepEqual(geographyFromForm({kind:"city",parentId:"valecor",
      roadId:"road1",roadMode:"include"},current).roadOverrides,{road1:"include"});
    assert.deepEqual(geographyFromForm({kind:"city",parentId:"valecor",
      roadId:"road1",roadMode:"auto"},current).roadOverrides,{});
    assert.equal(geographyFromForm({kind:""},current),null);
    assert.throws(()=>geographyFromForm({kind:"city",roadMode:"include"},current),/Select a Road/);
  } finally {globalThis.document=previous;}
});
