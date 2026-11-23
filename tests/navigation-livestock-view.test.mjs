import test from "node:test";
import assert from "node:assert/strict";
import {renderJourneyLivestockBoarding} from "../scripts/navigation-livestock-view.js";
test("ship boarding remains a keyboard-accessible, noncommitting mount draft",()=>{
 const saved=globalThis.document;
 globalThis.document={createElement:tag=>({
   tag,children:[],style:{},listeners:{},textContent:"",
   append(...nodes){this.children.push(...nodes);},
   setAttribute(name,value){this[name]=value;},
   addEventListener(name,fn){this.listeners[name]=fn;}
 })};
 try{
   const changes=[];
   const board=renderJourneyLivestockBoarding({resources:[
     {actorId:"horse",name:"Warhorse",quantity:1},
     {actorId:"pair",name:"Riding Horse",quantity:2}],
     method:{livestockCapacity:null},decisions:{horse:1},
     onChange:(id,n)=>changes.push([id,n])});
   const flat=el=>[el,...(el.children??[]).flatMap(flat)];
   const selects=flat(board).filter(el=>el.tag==="select");
   assert.equal(selects.length,2);
   assert.match(selects[0]["aria-label"],/Number of Warhorse/);
   assert.equal(selects[0].value,"1");assert.equal(selects[1].value,"");
   assert.ok(flat(board).some(el=>String(el.textContent).includes("unverified")));
   selects[1].value="2";selects[1].listeners.change();
   assert.deepEqual(changes,[["pair",2]]);
   assert.equal(board.className,"atlas-journey-livestock");
 }finally{globalThis.document=saved;}
});
