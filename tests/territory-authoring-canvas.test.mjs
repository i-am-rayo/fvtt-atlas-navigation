import test from "node:test";
import assert from "node:assert/strict";
import {TerritoryAuthoringCanvas} from "../scripts/territory-authoring-canvas.js";

class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.listeners=new Map();
    this.style={};this.parent=null;this.attributes={};this.textContent="";}
  addEventListener(type,callback){this.listeners.set(type,callback);}
  removeEventListener(type){this.listeners.delete(type);}
  setAttribute(key,value){this.attributes[key]=value;}
  appendChild(child){this.children.push(child);child.parent=this;return child;}
  append(...children){for(const child of children)this.appendChild(child);}
  prepend(...children){for(const child of children){this.children.unshift(child);child.parent=this;}}
  remove(){if(!this.parent)return;this.parent.children=this.parent.children.filter(c=>c!==this);
    this.parent=null;}
}
class Graphics{
  clear(){return this;}
  moveTo(){return this;}
  lineTo(){return this;}
  stroke(){return this;}
  circle(){return this;}
  fill(){return this;}
  poly(){return this;}
  destroy(){this.destroyed=true;}
}

test("Territory canvas authoring is staged, undoable and fully cleaned on Cancel",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    PIXI:globalThis.PIXI,requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={children:[],addChild(child){this.children.push(child);child.parent=this;},
    removeChild(child){this.children=this.children.filter(c=>c!==child);child.parent=null;}};
  const view={ready:true,scene:{id:"scene1"},app:{canvas:surface},primary:group,
    stage:{scale:{x:1}},dimensions:{sceneX:0,sceneY:0,sceneWidth:500,sceneHeight:500},
    canvasCoordinatesFromClient:point=>point};
  globalThis.game={user:{isGM:true}};
  globalThis.canvas=view;globalThis.document=doc;globalThis.PIXI={Graphics};
  globalThis.requestAnimationFrame=undefined;
  const editor=new TerritoryAuthoringCanvas();let writes=0;
  const draft={kind:"polygon",points:[{id:"a",x:10,y:10},
    {id:"b",x:100,y:10},{id:"c",x:100,y:100}],offsets:[],smoothing:0};
  try{
    const pending=editor.begin(view.scene,draft,async()=>{writes++;});
    assert.equal(body.children.length,1);
    assert.equal(group.children.length,1);
    assert.ok(surface.listeners.has("pointerdown"));
    surface.listeners.get("pointerdown")({button:0,clientX:20,clientY:110,
      preventDefault(){},stopImmediatePropagation(){}});
    assert.equal(editor.session.draft.points.length,4);
    const undo=editor.session.panel.children.find(child=>child.tagName==="div")
      .children.find(child=>child.textContent==="Undo");
    undo.listeners.get("click")();
    assert.equal(editor.session.draft.points.length,3);
    editor.cancel();
    assert.equal(await pending,false);
    assert.equal(writes,0);
    assert.equal(body.children.length,0);
    assert.equal(group.children.length,0);
    assert.equal(surface.listeners.size,0);
    assert.equal(doc.listeners.size,0);
  }finally{Object.assign(globalThis,saved);}
});
