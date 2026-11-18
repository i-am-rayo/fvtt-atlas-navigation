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
    prepend(...children){for(const child of [...children].reverse()){
      child.parentNode=this;this.children.unshift(child);
    }}
    replaceChildren(...children){this.children=[];this.append(...children);}
    addEventListener(name,callback){this.listeners.set(name,callback);}
    setAttribute(key,value){(this.attrs??=new Map()).set(key,String(value));}
    getAttribute(key){return this.attrs?.get(key)??null;}
    focus(){this.focused=true;}
    closest(tag){for(let element=this;element;element=element.parentNode)
      if(element.tag===tag)return element;return null;}
  }
  const all=root=>[root,...root.children.flatMap(all)];
  try{
    globalThis.foundry={applications:{api:{ApplicationV2:class{
      constructor(options){this.options=options;}
    }}}};
    globalThis.document={createElement:tag=>new Element(tag)};
    globalThis.window={innerWidth:1280,innerHeight:900};
    let writes=0;
    globalThis.game={user:{isGM:true},settings:{
      get:(_module,key)=>key==="checkpointPresets"?defaultCheckpointPresets():
        key==="measuringUnits"?"metric":null,
      async set(){writes++;}
    }};
    globalThis.ui={notifications:{error(message){throw Error(message);},info(){}}};
    const {AtlasCheckpointPresetEditor}=await import("../scripts/checkpoint-preset-editor.js");
    const editor=new AtlasCheckpointPresetEditor({preset:defaultCheckpointPresets().presets[0]});
    assert.equal(editor.options.position.left,24,"preset editor opens from the left edge");
    const root=await editor._renderHTML();
    assert.equal(root.className,"atlas-marker-preset-editor");
    assert.equal(root.children.length,2,"body and footer share one stable parent");
    const [body,footer]=root.children;
    assert.equal(body.className,"atlas-marker-preset-body");
    assert.equal(footer.className,"atlas-marker-preset-footer");
    assert.ok(footer.children.some(item=>item.title==="Save preset"),
      "Save stays outside the scrolling tab content");
    const tabs=body.children[0];
    const titleField=all(body).find(item=>item.tag==="input"&&item.maxLength===120);
    assert.ok(titleField);
    titleField.value="Unsaved map marker preset";
    tabs.children[1].listeners.get("click")();
    tabs.children[0].listeners.get("click")();
    assert.equal(titleField.value,"Unsaved map marker preset",
      "switching tab never discards an unsaved World preset draft");
    assert.equal(tabs.getAttribute("role"),"tablist");
    assert.equal(tabs.children[0].getAttribute("aria-selected"),"true");
    tabs.children[1].listeners.get("click")();
    assert.equal(tabs.children[1].getAttribute("aria-selected"),"true");
    tabs.listeners.get("keydown")({key:"Home",target:tabs.children[1],
      preventDefault(){}});
    assert.equal(tabs.children[0].focused,true,"Home focuses the first tab");
    tabs.children[1].listeners.get("click")();
    const labels=all(root).map(item=>item.textContent);
    for(const label of ["General","Customization","Terrain Region",
      "Default elevation (m)","Default discovery status","Default linked Journal / Page UUID",
      "Map Marker icon","Marker size (12–64 px)","Map Marker border color",
      "Banner display","Suggested travel preset","Air Travel"])
      assert.ok(labels.includes(label),label);
    assert.ok(all(root).some(item=>item.title==="Save preset"),"shared save icon");
    assert.ok(all(root).some(item=>item.title==="Add Air Travel method"),
      "air travel shares the compact plus icon control");
    assert.equal(all(root).some(item=>item.textContent==="+ Add Land Travel"),false);
    assert.ok(all(root).some(item=>item.tag==="input"&&item.type==="color"));
    const picker=all(root).find(item=>item.className?.includes?.("atlas-checkpoint-icon-selector"));
    assert.equal(picker.tag,"div",
      "the World preset uses the placed-marker compact icon trigger, not the expanded details");
    const trigger=picker.children[0];
    assert.ok(trigger.className?.includes("atlas-checkpoint-icon-trigger"));
    assert.equal(trigger.title,"Choose checkpoint icon");
    assert.ok(all(root).some(item=>item.tag==="input"&&item.placeholder?.includes("fantasy icons")));
    const customization=body.children[2];
    const sections=customization.children;
    assert.deepEqual(sections.map(item=>item.children[0]?.textContent),
      ["Map Marker settings","Banner information","Map preview"],
      "the World preset matches placed-marker appearance section order");
    const preview=sections[2],sample=preview.children[1];
    assert.equal(sample.className,"atlas-marker-preset-preview-sample");
    assert.ok(all(sample).some(item=>item.textContent==="Unsaved map marker preset"),
      "preview uses an unsaved World preset name, without a Scene name");
    const markerColors=all(sections[0]).filter(item=>item.tag==="input"&&item.type==="color");
    assert.equal(markerColors.length,2);
    markerColors[0].value="#8844cc";
    const bannerPair=all(root).find(item=>item.className==="atlas-marker-preset-banner-colors");
    assert.ok(bannerPair,"banner mode and its text color remain adjacent");
    assert.equal(bannerPair.children.length,2,
      "mode and color retain separate accessible form labels");
    assert.equal(bannerPair.children[0].children[0].textContent,"Banner display");
    assert.equal(bannerPair.children[1].children[0].textContent,"Banner text color");
    const bannerMode=bannerPair.children[0].children[1];
    const bannerColor=bannerPair.children[1].children[1];
    bannerMode.value="always";
    bannerColor.value="#aa55ee";
    customization.listeners.get("change")();
    assert.equal(bannerColor.disabled,false);
    assert.equal(sample.children[0].children[0].style.color,"#8844cc");
    assert.equal(sample.children[1].style.color,"#aa55ee");
    assert.equal(preview.getAttribute("data-label-mode"),"always");
    bannerMode.value="off";customization.listeners.get("change")();
    assert.equal(bannerColor.disabled,true,"Banner Off disables but never clears the color draft");
    assert.equal(sample.children[1].hidden,true);
    assert.equal(bannerColor.value,"#aa55ee");
    bannerMode.value="hover";customization.listeners.get("change")();
    assert.equal(bannerColor.disabled,false);
    assert.equal(sample.children[1].hidden,false);
    assert.equal(preview.getAttribute("data-label-mode"),"hover");
    assert.equal(writes,0,"icon and preview editing is entirely draft-only");
    assert.ok(labels.includes("RPG picks"));
    assert.ok(labels.includes("All / Advanced"));
    assert.ok(all(root).some(item=>item.tag==="optgroup"&&item.label==="Land"));
    assert.ok(all(root).some(item=>item.tag==="optgroup"&&item.label==="Air"));
  }finally{Object.assign(globalThis,previous);}
});
