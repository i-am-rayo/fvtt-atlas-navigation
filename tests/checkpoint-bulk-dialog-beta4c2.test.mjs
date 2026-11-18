import test from "node:test";
import assert from "node:assert/strict";

test("Foundry v14 bulk-apply input uses an attribute-free outer DIV",async()=>{
  const before={foundry:globalThis.foundry,document:globalThis.document,
    canvas:globalThis.canvas,game:globalThis.game};
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};
      this.textContent="";this.name="";this.type="";}
    append(...items){this.children.push(...items);}
  }
  let observed=false;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.game={user:{isGM:true}};
    globalThis.canvas={scene:{name:"Test Scene",canUserModify:()=>true}};
    globalThis.foundry={applications:{api:{
      ApplicationV2:class {},
      DialogV2:{input:async config=>{
        const shell=config.content;
        assert.equal(shell.tagName,"DIV");
        assert.equal(shell.style.cssText,undefined,
          "Foundry rejects even a style attribute on the dialog root");
        assert.equal(shell.children.length,1);
        assert.match(shell.children[0].style.cssText,/display:grid/);
        observed=true;
        return null;
      }}
    }}};
    const {AtlasCheckpointPresetSettings}=await import("../scripts/checkpoint-preset-settings.js");
    const app=new AtlasCheckpointPresetSettings();
    await app._apply({name:"Port",category:"port"});
    assert.equal(observed,true);
  }finally{
    for(const [name,value] of Object.entries(before))globalThis[name]=value;
  }
});
