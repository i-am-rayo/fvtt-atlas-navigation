import assert from "node:assert/strict";
import test from "node:test";
import {createNavigationTransferSection,createNavigationTransferLegCard,
  renderNavigationTransferRoadNames,renderNavigationTransferLegOutcome,
  renderNavigationLaterLegsPreview} from "../scripts/navigation-transfer-preview-view.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  let handlers=0;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
    append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},
    addEventListener(){handlers++;}})};
  return {restore:()=>{globalThis.document=previous;},
    get handlers(){return handlers;}};
};

test("transfer frame preserves current-leg notice and recovered-voyage protections",()=>{
  const dom=mockDOM();
  try{
    const ordinary=createNavigationTransferSection();
    const recovered=createNavigationTransferSection({recovered:true});
    assert.equal(ordinary.tag,"section");
    assert.equal(ordinary.children[0].textContent,"Current journey leg");
    assert.match(ordinary.children[1].textContent,/GM preview; no booking, payment or movement/);
    assert.match(recovered.children[1].textContent,/No second fare or boarding is applied/);
    assert.equal(dom.handlers,0);
  }finally{dom.restore();}
});

test("approved transfer card and context render a complete leg without authorizing it",()=>{
  const dom=mockDOM();
  try{
    const leg={surface:"water",departureCheckpoint:{name:"Port Barthos"},
      arrivalCheckpoint:{name:"Hearth's Heart Dock"}};
    const card=createNavigationTransferLegCard(leg);
    assert.equal(card.tag,"article");
    assert.equal(card.children[0].textContent,
      "Leg 1 · WATER · Port Barthos → Hearth's Heart Dock");
    const roads=renderNavigationTransferRoadNames(["Caelthor Harbor-Port Barthos",
      "Dirwest-Hearth's Heart"]);
    assert.equal(roads.textContent,
      "Caelthor Harbor-Port Barthos, Dirwest-Hearth's Heart");
    const extras=renderNavigationTransferLegOutcome({
      estimateLabel:"55.09 mi · 1d 3h 33m moving · 2 GP estimated cost",
      narration:["The party booked passage.","Disembarked at the dock."],
      errors:["Some method constraint"],arrivalCheckpointName:"Hearth's Heart Dock"});
    assert.deepEqual(extras.map(node=>node.tag),["small","div","div","small","small"]);
    assert.match(extras[4].textContent,/stop and replan/);
    assert.equal(renderNavigationTransferRoadNames([]).textContent,"Surface not authored");
    assert.equal(dom.handlers,0);
  }finally{dom.restore();}
});

test("future legs remain tentative, ordered and never committed by their preview",()=>{
  const dom=mockDOM();
  try{
    const later=[
      {index:1,surface:"land",departureCheckpoint:{name:"Port Barthos"},
        arrivalCheckpoint:{name:"Dirwest"},roadNames:["Dirwest-Port Barthos"]},
      {index:2,surface:"unspecified",departureCheckpoint:null,
        arrivalCheckpoint:null,roadNames:[]}
    ];
    const preview=renderNavigationLaterLegsPreview(later);
    assert.equal(preview.tag,"details");
    assert.equal(preview.children[0].textContent,
      "GM preview · 2 possible later leg(s) (no decisions committed)");
    assert.match(preview.children[1].textContent,/tentative road segments/);
    assert.match(preview.children[2].textContent,/Leg 2 · land · Port Barthos → Dirwest/);
    assert.match(preview.children[3].textContent,/Leg 3 · Unclassified/);
    assert.equal(renderNavigationLaterLegsPreview([]),null);
    assert.equal(dom.handlers,0);
    assert.equal(later[0].roadNames[0],"Dirwest-Port Barthos");
  }finally{dom.restore();}
});
