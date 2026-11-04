import assert from "node:assert/strict";
import test from "node:test";
import {atlasNativeLevelSetup} from "../scripts/navigation-native-level-setup.js";

class Element{
  constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();this.dataset={};
    this.className="";this.textContent="";this.disabled=false;this.value="";this.checked=false;}
  appendChild(child){this.children.push(child);return child;}
  append(...children){children.forEach(child=>this.appendChild(child));}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  setAttribute(){}
}
const walk=(root,result=[])=>{
  result.push(root);
  for(const child of root.children??[])walk(child,result);
  return result;
};
const event={preventDefault(){}};

test("Scene native Levels are created only after GM preview and explicit approval",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,
    foundry:globalThis.foundry,ui:globalThis.ui};
  const created=[];let confirmations=0;
  const scene={id:"native-level-preview",grid:{units:"mi"},
    levels:{contents:[]},canUserModify:()=>true,
    async createEmbeddedDocuments(type,data){created.push({type,data});
      for(const item of data)this.levels.contents.push(item);}};
  try{
    globalThis.document={createElement:tag=>new Element(tag),
      createTextNode:text=>({children:[],textContent:text})};
    globalThis.game={user:{isGM:true}};
    globalThis.ui={notifications:{warn:message=>{throw Error(message);}}};
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>{
      confirmations++;return true;
    }}}}};
    const panel=atlasNativeLevelSetup(scene);
    const elements=walk(panel),buttons=elements.filter(item=>item.tag==="button");
    const toggle=elements.find(item=>item.type==="checkbox");
    const elevations=elements.filter(item=>item.type==="number");
    assert.equal(buttons[1].disabled,true);
    assert.equal(created.length,0);
    toggle.checked=true;toggle.listeners.get("change")();
    elevations[0].value="-10";elevations[0].listeners.get("input")();
    elevations[1].value="10";elevations[1].listeners.get("input")();
    buttons[0].listeners.get("click")(event);
    assert.equal(buttons[1].disabled,false);
    assert.equal(created.length,0,"preview is read-only");
    await buttons[1].listeners.get("click")(event);
    assert.equal(confirmations,1);
    assert.deepEqual(created,[{type:"Level",data:[{
      name:"Surface",elevation:{bottom:-10,top:10}
    }]}]);
    assert.equal(buttons[1].disabled,true);
  }finally{Object.assign(globalThis,previous);}
});

test("native Level creation is unavailable without GM Scene permission",()=>{
  const previous={document:globalThis.document,game:globalThis.game};
  try{
    globalThis.document={createElement:tag=>new Element(tag),
      createTextNode:text=>({children:[],textContent:text})};
    globalThis.game={user:{isGM:false}};
    const scene={id:"not-gm",grid:{units:"mi"},levels:{contents:[]},
      canUserModify:()=>true};
    const elements=walk(atlasNativeLevelSetup(scene));
    const preview=elements.find(item=>item.textContent==="Preview native Levels");
    preview.listeners.get("click")(event);
    assert.equal(elements.find(item=>item.textContent==="Create reviewed Levels").disabled,true);
    assert.match(elements.at(-1).textContent,/GM Scene edit permission/);
  }finally{Object.assign(globalThis,previous);}
});
