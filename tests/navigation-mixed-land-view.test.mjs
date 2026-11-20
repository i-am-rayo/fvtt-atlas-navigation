import test from "node:test";
import assert from "node:assert/strict";
import {renderNavigationMixedLandControls}
  from "../scripts/navigation-mixed-land-view.js";

test("mixed travel view has per-member assignments, hire units and one shared pace",()=>{
  const original=globalThis.document;
  globalThis.document={createElement:tag=>({
    tag,children:[],style:{},listeners:new Map(),
    append(...elements){this.children.push(...elements);},
    addEventListener(type,callback){this.listeners.set(type,callback);},
    setAttribute(){}
  })};
  try{
    const changes=[];
    const root=renderNavigationMixedLandControls({
      travelers:[
        {actorId:"pc1",name:"PC One",seatsNeeded:1,passengers:1},
        {actorId:"npc1",name:"Companion",seatsNeeded:0,passengers:1}
      ],
      methods:[
        {key:"owned|walking",name:"Walking",arrangement:"owned",
          speedLabel:"3 mph",available:null},
        {key:"hire|coach-hire",name:"Coach",arrangement:"hire",
          speedLabel:"4 mph",available:1,minimumUnits:1}
      ],assignments:{pc1:"owned|walking",npc1:"hire|coach-hire"},
      units:{},recommended:"3.00",maximum:"4.00",unit:"mph",
      preview:{speed:"3.00",moving:"8h",passengers:1,walking:1,cost:"300 CP"},
      onAssignment:(id,key)=>changes.push([id,key]),
      onUnits:(key,n)=>changes.push([key,n]),
      onPace:pace=>changes.push(["pace",pace])
    });
    const all=node=>[node,...node.children.flatMap(all)];
    const selects=all(root).filter(n=>n.tag==="select");
    assert.equal(selects.length,2);
    assert.equal(selects[0].value,"owned|walking");
    assert.equal(selects[1].value,"hire|coach-hire");
    assert.equal(selects[0].children.length,3,
      "the option list includes neither an implicit seat nor hidden methods");
    assert.deepEqual(changes,[],"rendering never assigns riders or books hires");
    selects[0].value="hire|coach-hire";
    selects[0].listeners.get("change")();
    const quantity=all(root).find(n=>n.tag==="input"&&n.type==="number"&&n.min==="1");
    quantity.value="2";quantity.listeners.get("change")();
    const radios=all(root).filter(n=>n.tag==="input"&&n.type==="radio");
    assert.equal(radios.length,2);
    radios[1].checked=true;radios[1].listeners.get("change")();
    assert.deepEqual(changes,[
      ["pc1","hire|coach-hire"],["hire|coach-hire",2],["pace","custom"]
    ]);
  }finally{globalThis.document=original;}
});
