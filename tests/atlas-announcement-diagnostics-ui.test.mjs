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

test("GM Module Settings reports last status and trigger but never exposes them to a player",async()=>{
  const previous={foundry:globalThis.foundry,Hooks:globalThis.Hooks,
    document:globalThis.document,game:globalThis.game};
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class{}}}};
    globalThis.Hooks={once:()=>{}};
    globalThis.document={createElement:element};
    globalThis.game={user:{id:"gm",isGM:true}};
    const {AtlasAnnouncementPreviewSettings}=await import(
      "../scripts/atlas-announcement-settings.js");
    const {atlasAnnouncementRuntime}=await import(
      "../scripts/atlas-announcement-runtime.js");
    atlasAnnouncementRuntime.diagnostic({type:"checkpoint.discovered",
      subject:"SECRET Bridge",from:"unknown",to:"visited",
      method:"automatic",decision:"Queued"});
    const app=new AtlasAnnouncementPreviewSettings();
    const root=await app._renderHTML();
    const status=root.children.find(node=>node.tag==="ol");
    assert.ok(status,"GM gets a diagnostic history panel");
    assert.match(status.children.at(-1).textContent,/SECRET Bridge/);
    assert.match(status.children.at(-1).textContent,/unknown → visited/);
    const refresh=root.children.find(node=>node.textContent==="Refresh discovery diagnostics");
    assert.equal(typeof refresh.listeners.click,"function");
    refresh.listeners.click();
    assert.equal(status.children.length,1);
    globalThis.game.user={id:"player",isGM:false};
    const playerRoot=await new AtlasAnnouncementPreviewSettings()._renderHTML();
    assert.equal(playerRoot.children.some(node=>node.tag==="ol"),false,
      "non-GM cannot render GM discovery names/statuses");
    assert.equal(JSON.stringify(playerRoot).includes("SECRET"),false);
  }finally{
    globalThis.foundry=previous.foundry;globalThis.Hooks=previous.Hooks;
    globalThis.document=previous.document;globalThis.game=previous.game;
  }
});
