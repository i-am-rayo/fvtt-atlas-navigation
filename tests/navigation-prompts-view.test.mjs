import assert from "node:assert/strict";
import test from "node:test";
import {renderRepeatedCheckpointNotice,renderCheckpointArrivalPrompt,
  renderDailyTravelPrompt} from "../scripts/navigation-prompts-view.js";

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

test("daily-limit notice renders supplied rules in order without authorizing actions",()=>{
  const dom=mockDOM();
  try{
    const options=["Overnight Camp: +16h downtime; resets travel allowance to 8h.",
      "Long Rest: +8h downtime; resets travel allowance to 8h.",
      "Short Rest: +1h downtime; does not restore daily travel hours.",
      "Continue March: +1h moving (roughly 3 mi on this route). DC 11 Constitution save afterward (GM adjudicates)."];
    const prompt=renderDailyTravelPrompt(options);
    assert.equal(prompt.tag,"div");
    assert.equal(prompt.children[0].textContent,
      "Daily travel limit reached — choose how to proceed:");
    assert.deepEqual(prompt.children.slice(1).map(node=>node.textContent),options);
    assert.match(prompt.style.cssText,/border:1px solid #d99c46/);
    assert.equal(dom.handlers,0);
    assert.equal(options.length,4,"presenting a rule must not change its input");
  }finally{dom.restore();}
});

test("checkpoint arrival notices retain destination and continuation distinctions",()=>{
  const dom=mockDOM();
  try{
    const onward=renderCheckpointArrivalPrompt({checkpointName:"Port Barthos"});
    const destination=renderCheckpointArrivalPrompt({
      checkpointName:"Hearth's Heart Dock",atDestination:true});
    assert.equal(onward.tag,"section");
    assert.equal(onward.children[0].textContent,"Checkpoint reached · Port Barthos");
    assert.match(onward.children[1].textContent,/No further token movement, booking or payment/);
    assert.match(destination.children[1].textContent,/original destination/);
    assert.match(destination.children[1].textContent,/not create another short leg/);
    assert.equal(dom.handlers,0);
  }finally{dom.restore();}
});

test("repeated arrival warning prohibits the same checkpoint voyage without creating buttons",()=>{
  const dom=mockDOM();
  try{
    const notice=renderRepeatedCheckpointNotice("Port Barthos");
    assert.equal(notice.tag,"p");
    assert.match(notice.textContent,/Already at Port Barthos/);
    assert.match(notice.textContent,/A second voyage to that same checkpoint is blocked/);
    assert.equal(dom.handlers,0);
  }finally{dom.restore();}
});
