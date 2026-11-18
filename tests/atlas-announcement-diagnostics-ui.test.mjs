import test from "node:test";
import assert from "node:assert/strict";

function element(tag){
  return {tag,children:[],attributes:{},listeners:{},textContent:"",
    append(...children){this.children.push(...children);},
    appendChild(child){this.children.push(child);return child;},
    replaceChildren(...children){this.children=[...children];},
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(name,handler){this.listeners[name]=handler;}};
}

test("Banner Samples stays preview-only; GM diagnostics moved to the verbose console",async()=>{
  const previous={foundry:globalThis.foundry,Hooks:globalThis.Hooks,
    document:globalThis.document,game:globalThis.game};
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
    globalThis.Hooks={once:()=>{}};
    globalThis.document={createElement:element};
    globalThis.game={user:{id:"gm",isGM:true}};
    const {AtlasAnnouncementPreviewSettings}=await import(
      "../scripts/atlas-announcement-settings.js");
    const app=new AtlasAnnouncementPreviewSettings();
    const root=await app._renderHTML();
    assert.equal(root.children.length,3,"only heading, description, and previews");
    const grid=root.children.at(-1);
    assert.ok(grid.children.length>5,"GM can still preview all banner samples");
    assert.ok(grid.children.every(button=>typeof button.listeners.click==="function"));
    assert.equal(JSON.stringify(root).includes("diagnostic"),false);
    globalThis.game.user={id:"player",isGM:false};
    const playerRoot=await new AtlasAnnouncementPreviewSettings()._renderHTML();
    assert.equal(playerRoot.children.some(node=>node.tag==="ol"),false,
      "non-GM cannot render GM discovery names/statuses");
    assert.equal(playerRoot.children.at(-1).textContent,
      "Only a GM may preview Atlas announcement banners.");
    assert.equal(JSON.stringify(playerRoot).includes("SECRET"),false);
  }finally{
    globalThis.foundry=previous.foundry;globalThis.Hooks=previous.Hooks;
    globalThis.document=previous.document;globalThis.game=previous.game;
  }
});
