import assert from "node:assert/strict";
import test from "node:test";
import {createNavigationMapPickPrompt}
  from "../scripts/navigation-map-pick-prompt.js";

const mockEnvironment=()=>{
  const before={foundry:globalThis.foundry,document:globalThis.document};
  const events=[];
  class FakeApplicationV2 {
    async render(force){events.push(["render",force]);return this;}
    async close(){events.push(["close"]);this._onClose?.({});return this;}
    _onClose(){events.push(["super-close"]);}
  }
  globalThis.foundry={applications:{api:{ApplicationV2:FakeApplicationV2}}};
  globalThis.document={createElement:tag=>({
    tag,style:{},children:[],listeners:{},textContent:"",
    append(...args){this.children.push(...args);},
    appendChild(child){this.children.push(child);},
    addEventListener(name,fn){this.listeners[name]=fn;}
  })};
  return {events,restore(){
    globalThis.foundry=before.foundry;
    globalThis.document=before.document;
  }};
};

test("GM's modeless map prompt only displays instructions and a cancel action",async()=>{
  const env=mockEnvironment();
  try{
    let cancelCalls=0;
    const prompt=createNavigationMapPickPrompt({onCancel:()=>cancelCalls++});
    const view=await prompt._renderHTML();
    assert.equal(view.tag,"section");
    assert.equal(view.children[0].tag,"p");
    assert.match(view.children[0].textContent,/Click a location on the Scene/);
    const button=view.children[1];
    assert.equal(button.textContent,"Cancel map selection");
    assert.equal(button.type,"button");
    assert.equal(cancelCalls,0,"render must not select or update any destination");
    await prompt.render(true);
    assert.deepEqual(env.events,[["render",true]]);
    button.listeners.click();
    assert.equal(cancelCalls,1);
  }finally{env.restore();}
});

test("native window close routes to the idempotent controller cancellation callback",async()=>{
  const env=mockEnvironment();
  try{
    let cancelled=0;
    const prompt=createNavigationMapPickPrompt({onCancel:()=>cancelled++});
    await prompt.close();
    assert.equal(cancelled,1);
    assert.deepEqual(env.events,[["close"],["super-close"]]);
  }finally{env.restore();}
});

test("prompt creation requires an explicit cancellation hook",()=>{
  assert.throws(()=>createNavigationMapPickPrompt(),/cancel callback/);
});
