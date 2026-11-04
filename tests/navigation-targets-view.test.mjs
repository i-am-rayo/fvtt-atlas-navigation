import assert from "node:assert/strict";
import test from "node:test";
import {renderJourneyTargets} from "../scripts/navigation-targets-view.js";
import {buildJourneyTargets} from "../scripts/navigation-route-targets.js";

test("GM A/B/C display is read-only and highlights the next persisted target",()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,children:[],style:{},
    appendChild(child){this.children.push(child);}})};
  try{
    const plan=buildJourneyTargets({route:{status:"ok",start:{x:0,y:0},
      end:{x:30,y:20},legs:[{kind:"road",roadId:"road",segmentId:"segment",
        points:[{x:0,y:0},{x:30,y:20}],distance:36}]},atlas:{segments:[{id:"segment"}]}});
    const before=structuredClone(plan);
    const view=renderJourneyTargets(plan);
    assert.equal(view.tag,"details");
    assert.match(view.children[0].textContent,/A → B · next B/);
    assert.match(view.children[1].children[1].textContent,/B \(next\): \[30.0, 20.0\]/);
    assert.deepEqual(plan,before,"display never changes persisted route intent");
  }finally{globalThis.document=previous;}
});
