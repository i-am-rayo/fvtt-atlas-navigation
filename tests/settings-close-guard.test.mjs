import test from "node:test";
import assert from "node:assert/strict";
import { editableSettingsSnapshot,trackSettingsChanges,
  approveSettingsClose,confirmUnsavedSettings } from "../scripts/settings-close-guard.js";

test("settings dirty tracking captures typed, checked, selected and icon values",()=>{
  const state=[
    {name:"name",type:"text",value:"Bridge",dataset:{}},
    {name:"visible",type:"checkbox",checked:false,dataset:{}},
    {name:"terrain",type:"select-one",value:"dirt",dataset:{}},
    {name:"search",type:"search",value:"",dataset:{}}
  ];
  const root={querySelectorAll:()=>state};
  let icon="bridge";
  const dirty=trackSettingsChanges(root,()=>icon);
  assert.equal(dirty(),false);
  state[3].value="anchor";
  assert.equal(dirty(),false,"transient icon searches are not settings edits");
  state[1].checked=true;
  assert.equal(dirty(),true);
  state[1].checked=false;
  assert.equal(dirty(),false);
  icon="archway";
  assert.equal(dirty(),true);
  assert.match(editableSettingsSnapshot(root),/Bridge/);
});

test("closing with edits offers Save, Discard and Continue in that order",async()=>{
  const previous=globalThis.foundry;
  let presented;
  globalThis.foundry={applications:{api:{DialogV2:{wait:async options=>{
    presented=options;return "continue";
  }}}}};
  try{
    assert.equal(await confirmUnsavedSettings("Road Settings"),"continue");
    assert.deepEqual(presented.buttons.map(button=>button.action),
      ["save","discard","continue"]);
    assert.equal(presented.modal,true);
  }finally{globalThis.foundry=previous;}
});

test("unsaved close guard keeps editing on canceled or unsuccessful Save",async()=>{
  const previous=globalThis.foundry;
  let choice="save",saves=0;
  globalThis.foundry={applications:{api:{DialogV2:{wait:async()=>choice}}}};
  try{
    const guard=()=>approveSettingsClose({title:"Checkpoint Settings",isDirty:()=>true,
      save:async()=>{saves++;return false;}});
    assert.equal(await guard(),false);
    assert.equal(saves,1);
    choice="continue";
    assert.equal(await guard(),false);
    assert.equal(saves,1);
    choice="discard";
    assert.equal(await guard(),true);
    assert.equal(await approveSettingsClose({isDirty:()=>false,save:async()=>false}),true);
  }finally{globalThis.foundry=previous;}
});
