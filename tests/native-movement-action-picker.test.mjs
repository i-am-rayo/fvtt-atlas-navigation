import test from "node:test";
import assert from "node:assert/strict";
import { promptNativeMovementAction } from "../scripts/native-movement-action-picker.js";

class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes=new Map();this.value="";this.listeners=new Map();}
  append(...children){this.children.push(...children);}
  appendChild(child){this.children.push(child);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  addEventListener(name,handler){this.listeners.set(name,handler);}
  set defaultSelected(value){if(value)this.setAttribute("selected","");}
}

test("both native cost dialogs can reuse one prompt without writing Behaviors",async()=>{
  const previous={document:globalThis.document,foundry:globalThis.foundry,
    game:globalThis.game};
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={i18n:{localize:label=>label}};
    let dialog;
    globalThis.foundry={applications:{api:{DialogV2:{input:async options=>{
      dialog=options;return {atlasMovementAction:"fly"};
    }}}}};
    const actions=[{id:"walk",label:"Walk"},{id:"fly",label:"Fly"}];
    const action=await promptNativeMovementAction({title:"Select",message:"Legacy cost",actions});
    assert.equal(action,actions[1]);
    assert.equal(dialog.content.children[1].name,"atlasMovementAction");
    assert.equal(dialog.content.children[1].children[0].attributes.get("selected"),"");
    assert.deepEqual(dialog.content.children[1].children.map(item=>item.value),["","walk","fly"]);
    globalThis.foundry.applications.api.DialogV2.input=async()=>null;
    assert.equal(await promptNativeMovementAction({title:"Select",message:"Cost",actions}),null);
    globalThis.foundry.applications.api.DialogV2.input=async()=>({atlasMovementAction:"nope"});
    await assert.rejects(()=>promptNativeMovementAction({title:"Select",message:"Cost",actions}),
      /supported movement action/);
  }finally{Object.assign(globalThis,previous);}
});
