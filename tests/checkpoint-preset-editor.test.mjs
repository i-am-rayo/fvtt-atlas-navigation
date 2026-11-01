import test from "node:test";
import assert from "node:assert/strict";
import {defaultCheckpointPresets} from "../scripts/checkpoint-preset-model.js";

test("World checkpoint preset editor exposes all three tabs and full appearance controls",async()=>{
  const previous={foundry:globalThis.foundry,document:globalThis.document,
    game:globalThis.game,window:globalThis.window,ui:globalThis.ui};
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.tag=tag;this.children=[];
      this.style={};this.textContent="";this.value="";this.listeners=new Map();}
    append(...children){children.forEach(child=>this.appendChild(child));}
    appendChild(child){child.parentNode=this;this.children.push(child);return child;}
    replaceChildren(...children){this.children=[];this.append(...children);}
    addEventListener(name,callback){this.listeners.set(name,callback);}
    setAttribute(){}
    closest(tag){for(let element=this;element;element=element.parentNode)
      if(element.tag===tag)return element;return null;}
  }
  const all=root=>[root,...root.children.flatMap(all)];
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class{constructor(){}}}}};
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.window={innerWidth:1280,innerHeight:900};
    globalThis.game={user:{isGM:true},settings:{get:(_module,key)=>
      key==="checkpointPresets"?defaultCheckpointPresets():null}};
    globalThis.ui={notifications:{error(message){throw Error(message);},info(){}}};
    const {AtlasCheckpointPresetEditor}=await import("../scripts/checkpoint-preset-editor.js");
    const editor=new AtlasCheckpointPresetEditor({preset:defaultCheckpointPresets().presets[0]});
    const root=await editor._renderHTML();
    const labels=all(root).map(item=>item.textContent);
    for(const label of ["General","Marker & labels","Terrain Region",
      "Default elevation (m)","Default discovery status","Default linked Journal / Page UUID",
      "Checkpoint marker","Marker size (12–64 px)","Checkpoint border color",
      "Checkpoint label","Suggested travel preset","Save Checkpoint Preset"])
      assert.ok(labels.includes(label),label);
    assert.ok(all(root).some(item=>item.tag==="input"&&item.type==="color"));
    assert.ok(all(root).some(item=>item.tag==="input"&&item.placeholder?.includes("fantasy icons")));
    assert.ok(labels.includes("RPG picks"));
    assert.ok(labels.includes("All / Advanced"));
    assert.ok(all(root).some(item=>item.tag==="optgroup"&&item.label==="Land"));
    assert.ok(all(root).some(item=>item.tag==="optgroup"&&item.label==="Air"));
  }finally{Object.assign(globalThis,previous);}
});
