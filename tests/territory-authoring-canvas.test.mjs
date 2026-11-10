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
  constructor(){this.strokes=[];this.disks=[];this.fills=[];}
  clear(){return this;}
  moveTo(){return this;}
  lineTo(){return this;}
  stroke(style){this.strokes.push(style);return this;}
  circle(x,y,radius){this.disks.push({x,y,radius});return this;}
  fill(options){this.fills.push(options);return this;}
  poly(){return this;}
  destroy(){this.destroyed=true;}
}
class LegacyGraphics{
  constructor(){this.calls={lines:0,circles:0,polygons:0};}
  clear(){return this;}
  moveTo(){return this;}
  lineTo(){return this;}
  lineStyle(){this.calls.lines++;return this;}
  beginFill(){return this;}
  drawCircle(){this.calls.circles++;return this;}
  drawPolygon(){this.calls.polygons++;return this;}
  endFill(){return this;}
  destroy(){this.destroyed=true;}
}

test("Territory canvas authoring is staged, undoable and fully cleaned on Cancel",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    PIXI:globalThis.PIXI,requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={children:[],addChild(child){this.children.push(child);child.parent=this;},
    removeChild(child){this.children=this.children.filter(c=>c!==child);child.parent=null;}};
  const view={ready:true,scene:{id:"scene1"},app:{canvas:surface},interface:group,
    primary:{addChild(){throw Error("Territory nodes must never render beneath fog");}},
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
    assert.match(editor.session.panel.style.cssText,/left:24px/);
    assert.doesNotMatch(editor.session.panel.style.cssText,/right:24px/);
    const polygonShortcuts=editor.session.panel.children.find(child=>
      child.className==="atlas-territory-shortcuts");
    assert.deepEqual(polygonShortcuts.children.slice(1).map(row=>row.children[0].textContent),
      ["Left click","Drag","Right click","Cmd / Ctrl + Z","Esc"]);
    assert.equal(group.children.length,1);
    assert.deepEqual(editor.session.layer.strokes.map(item=>item.color),
      [0x121826,0xffe3a2],"dark halo and bright outline stay visible above Atlas fog");
    assert.equal(editor.session.layer.disks.length,6,
      "each control node receives a contrast halo and a colored center");
    assert.ok(surface.listeners.has("pointerdown"));
    surface.listeners.get("pointerdown")({button:0,clientX:20,clientY:110,
      preventDefault(){},stopImmediatePropagation(){}});
    assert.equal(editor.session.draft.points.length,4);
    doc.listeners.get("pointerup")();
    assert.ok(!editor.session.panel.children.find(child=>child.tagName==="div")
      .children.some(child=>child.textContent==="Undo"),
    "keyboard shortcut replaces the visible Undo button");
    doc.listeners.get("keydown")({key:"z",metaKey:true,preventDefault(){},
      stopImmediatePropagation(){}});
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

test("hex/square brush rings show a live add/erase footprint before any write",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    PIXI:globalThis.PIXI,requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={children:[],addChild(g){this.children.push(g);g.parent=this;},
    removeChild(g){this.children=this.children.filter(x=>x!==g);g.parent=null;}};
  const scene={id:"atlas-scene"};let committed=0;
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Graphics};globalThis.requestAnimationFrame=undefined;
  globalThis.document=doc;
  globalThis.canvas={ready:true,scene,app:{canvas:surface},interface:group,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:400,sceneHeight:400},
    stage:{scale:{x:2}},canvasCoordinatesFromClient:p=>p,
    grid:{getShape:()=>[{x:-9,y:-9},{x:9,y:-9},{x:9,y:9},{x:-9,y:9}],
      getCenterPoint:({i,j})=>({x:i*20+10,y:j*20+10}),
      getOffset:({x,y})=>({i:Math.floor(x/20),j:Math.floor(y/20)}),
      getAdjacentOffsets:({i,j})=>[{i:i+1,j},{i:i-1,j},{i,j:j+1},{i,j:j-1}]}};
  const editor=new TerritoryAuthoringCanvas();
  try{
    const pending=editor.begin(scene,{kind:"grid",offsets:[]},async()=>{committed++;});
    const gridShortcuts=editor.session.panel.children.find(child=>
      child.className==="atlas-territory-shortcuts");
    assert.deepEqual(gridShortcuts.children.slice(1).map(row=>row.children[0].textContent),
      ["Click / drag","Shift + click / drag","Scroll","Shift + scroll",
        "Cmd / Ctrl + Z","Esc"]);
    const label=editor.session.panel.children.find(child=>child.tagName==="label"&&
      child.textContent.includes("Brush radius"));
    const slider=label.children.find(child=>child.tagName==="input");
    slider.value="2";slider.listeners.get("input")();
    const move=doc.listeners.get("pointermove");
    move({clientX:110,clientY:110,target:surface});
    assert.equal(editor.session.hoverOffsets.length,13,"two-square-ring footprint previews 13 cells");
    assert.equal(editor.session.draft.offsets.length,0,
      "hover must not touch the staged Region geometry");
    assert.equal(committed,0,"hover cannot commit native Region changes");
    assert.match(editor.session.info.textContent,/Hover: add 13 cells \(13 in brush\)/);
    assert.ok(editor.session.layer.fills.some(item=>item?.alpha===.16),
      "preview uses translucent high-contrast cell outlines");
    const down=surface.listeners.get("pointerdown");
    down({button:0,clientX:110,clientY:110,preventDefault(){},stopImmediatePropagation(){}});
    assert.equal(editor.session.draft.offsets.length,13,"click applies previewed footprint");
    assert.equal(committed,0,"click edits only the draft");
    doc.listeners.get("pointerup")();
    move({clientX:110,clientY:110,target:surface,shiftKey:true});
    assert.match(editor.session.info.textContent,/Hover: erase 13 cells/);
    down({button:0,clientX:110,clientY:110,shiftKey:true,
      preventDefault(){},stopImmediatePropagation(){}});
    doc.listeners.get("pointerup")();
    assert.equal(editor.session.draft.offsets.length,0,"Shift+click erases painted cells");
    doc.listeners.get("keydown")({key:"z",ctrlKey:true,preventDefault(){},
      stopImmediatePropagation(){}});
    assert.equal(editor.session.draft.offsets.length,13,
      "Ctrl+Z undoes an entire erasing stroke");
    surface.listeners.get("wheel")({deltaY:-120,preventDefault(){},
      stopImmediatePropagation(){}});
    assert.equal(editor.session.radius,3,"wheel up increases the brush footprint");
    assert.equal(slider.value,"3");
    surface.listeners.get("wheel")({deltaY:120,preventDefault(){},
      stopImmediatePropagation(){}});
    assert.equal(editor.session.radius,2,"wheel down decreases the footprint");
    doc.listeners.get("pointerup")();
    surface.listeners.get("pointerleave")();
    assert.equal(editor.session.hoverOffsets.length,0,"pointer exit clears preview");
    editor.cancel();assert.equal(await pending,false);
    assert.equal(committed,0,"Cancel discards painted cells");
    assert.equal(doc.listeners.size,0);assert.equal(surface.listeners.size,0);
  }finally{Object.assign(globalThis,saved);}
});

test("polygon right-click deletes the last node and Cmd+Z restores only staged edits",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    PIXI:globalThis.PIXI,requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={addChild(g){g.parent=this;},removeChild(g){g.parent=null;}};
  const scene={id:"polygon-scene"};let nativeWrites=0;
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Graphics};globalThis.document=doc;
  globalThis.requestAnimationFrame=undefined;
  globalThis.canvas={ready:true,scene,app:{canvas:surface},interface:group,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:400,sceneHeight:400},
    stage:{scale:{x:1}},canvasCoordinatesFromClient:p=>p};
  const draft={kind:"polygon",smoothing:0,points:[
    {id:"a",x:10,y:10},{id:"b",x:100,y:10},{id:"c",x:100,y:100}]};
  const editor=new TerritoryAuthoringCanvas();
  try{
    const pending=editor.begin(scene,draft,async()=>{nativeWrites++;});
    const down=surface.listeners.get("pointerdown");
    down({button:0,clientX:240,clientY:240,preventDefault(){},
      stopImmediatePropagation(){}});
    doc.listeners.get("pointerup")();
    assert.equal(editor.session.draft.points.length,4,"left-click adds a node");
    const removed=editor.session.draft.points[3];
    let canceledMenu=false;
    down({button:2,clientX:240,clientY:240,preventDefault(){},
      stopImmediatePropagation(){}});
    surface.listeners.get("contextmenu")({preventDefault(){canceledMenu=true;},
      stopImmediatePropagation(){}});
    assert.equal(canceledMenu,true,"native context menu is suppressed while editing polygons");
    assert.equal(editor.session.draft.points.length,3,"right-click removes only the last node");
    const key=doc.listeners.get("keydown");
    key({key:"z",metaKey:true,preventDefault(){},stopImmediatePropagation(){}});
    assert.equal(editor.session.draft.points.length,4,"Cmd+Z restores the deleted node");
    assert.deepEqual(editor.session.draft.points[3],removed);
    key({key:"z",ctrlKey:true,target:{tagName:"TEXTAREA"},preventDefault(){
      throw Error("Typing text must retain native undo");}});
    assert.equal(editor.session.draft.points.length,4);
    key({key:"z",ctrlKey:true,preventDefault(){},stopImmediatePropagation(){}});
    assert.equal(editor.session.draft.points.length,3,"Ctrl+Z undoes the preceding add");
    assert.equal(nativeWrites,0,"shortcuts cannot commit native Region changes");
    editor.cancel();assert.equal(await pending,false);
    assert.equal(doc.listeners.size,0);
    assert.equal(surface.listeners.size,0);
  }finally{Object.assign(globalThis,saved);}
});

test("wheel brush size is clamped and Shift/Alt+wheel can pass through to map zoom",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    PIXI:globalThis.PIXI,requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={addChild(g){g.parent=this;},removeChild(g){g.parent=null;}};
  const scene={id:"brush-scene"};
  globalThis.game={user:{isGM:true}};globalThis.PIXI={Graphics};
  globalThis.document=doc;globalThis.requestAnimationFrame=undefined;
  globalThis.canvas={ready:true,scene,app:{canvas:surface},interface:group,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:400,sceneHeight:400},
    stage:{scale:{x:1}},canvasCoordinatesFromClient:p=>p,
    grid:{getShape:()=>[{x:-5,y:-5},{x:5,y:-5},{x:5,y:5}],
      getCenterPoint:({i,j})=>({x:i*10,y:j*10})}};
  const editor=new TerritoryAuthoringCanvas();
  try{
    const pending=editor.begin(scene,{kind:"grid",offsets:[]},async()=>{});
    const wheel=surface.listeners.get("wheel");
    for(let i=0;i<9;i++)wheel({deltaY:-100,preventDefault(){},
      stopImmediatePropagation(){}});
    assert.equal(editor.session.radius,4,"wheel size stays within max four rings");
    for(let i=0;i<9;i++)wheel({deltaY:100,preventDefault(){},
      stopImmediatePropagation(){}});
    assert.equal(editor.session.radius,0,"wheel size stays at least one cell");
    let prevented=false;
    wheel({deltaY:-100,altKey:true,preventDefault(){prevented=true;}});
    assert.equal(prevented,false,"Alt+wheel is reserved for default map interaction");
    assert.equal(editor.session.radius,0);
    let stopped=false;
    wheel({deltaY:-100,shiftKey:true,preventDefault(){prevented=true;},
      stopImmediatePropagation(){stopped=true;}});
    assert.equal(prevented,false,"Shift+wheel must reach Foundry's native zoom handler");
    assert.equal(stopped,false,"Shift+wheel must propagate to the map");
    assert.equal(editor.session.radius,0,"zoom gesture must not resize brush");
    editor.cancel();assert.equal(await pending,false);
    assert.equal(surface.listeners.size,0);
  }finally{Object.assign(globalThis,saved);}
});

test("Paint Territory reviews peer Hex/Grid cell ownership and invalidates stale summaries",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    PIXI:globalThis.PIXI,requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={addChild(g){g.parent=this;},removeChild(g){g.parent=null;}};
  const scene={id:"paedor"};let inspections=0,writes=0;
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Graphics};globalThis.document=doc;
  globalThis.requestAnimationFrame=undefined;
  globalThis.canvas={ready:true,scene,app:{canvas:surface},interface:group,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:200,sceneHeight:200},
    stage:{scale:{x:1}},canvasCoordinatesFromClient:p=>p,
    grid:{getShape:()=>[{x:0,y:0},{x:10,y:0},{x:10,y:10}],
      getCenterPoint:({i,j})=>({x:i*10+5,y:j*10+5}),
      getOffset:({x,y})=>({i:Math.floor(x/10),j:Math.floor(y/10)}),
      getAdjacentOffsets:()=>[]}};
  const editor=new TerritoryAuthoringCanvas();
  try{
    const pending=editor.begin(scene,{kind:"grid",offsets:[]},async()=>{writes++;},
      {inspectDraft:async()=>{inspections++;return {proposedCells:0,addedCells:2,
        removedCells:0,unclaimedAddedCells:0,peerOwnedAddedCells:2,
        peers:[{name:"Dirwest",cells:1},{name:"Valecor",cells:1}],
        contestedAddedCells:0,requiresMultiRegionReview:true};}});
    const action=editor.session.panel.children.find(c=>c.tagName==="div"&&
      c.children.some(b=>b.textContent==="Review Shared Cells"))
      .children.find(b=>b.textContent==="Review Shared Cells");
    await action.listeners.get("click")();
    const review=editor.session.ownershipReview;
    assert.equal(inspections,1);
    assert.match(review.textContent,/Dirwest \(1\), Valecor \(1\)/);
    assert.match(review.textContent,/Multiple peers require an explicit multi-Region transfer/);
    assert.equal(writes,0,"read-only review cannot trigger native writes");
    surface.listeners.get("pointerdown")({button:0,clientX:20,clientY:20,
      preventDefault(){},stopImmediatePropagation(){}});
    assert.match(review.textContent,/Draft changed/);
    editor.cancel();assert.equal(await pending,false);
  }finally{Object.assign(globalThis,saved);}
});

test("Foundry legacy Graphics renders edited nodes, new outlines and native grid cells",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    PIXI:globalThis.PIXI,requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={children:[],addChild(g){this.children.push(g);g.parent=this;},
    removeChild(g){this.children=this.children.filter(x=>x!==g);g.parent=null;}};
  const scene={id:"paedor"};
  globalThis.game={user:{isGM:true}};
  globalThis.PIXI={Graphics:LegacyGraphics};
  globalThis.requestAnimationFrame=undefined;
  globalThis.document=doc;
  globalThis.canvas={ready:true,scene,app:{canvas:surface},interface:group,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:200,sceneHeight:200},
    stage:{scale:{x:1}},canvasCoordinatesFromClient:p=>p,
    grid:{getShape:()=>[{x:-5,y:-5},{x:5,y:-5},{x:0,y:5}],
      getCenterPoint:()=>({x:50,y:50})}};
  const editor=new TerritoryAuthoringCanvas();
  try{
    const existing=editor.begin(scene,{kind:"polygon",points:[
      {id:"a",x:10,y:10},{id:"b",x:100,y:10},{id:"c",x:100,y:100}]},async()=>{});
    assert.ok(editor.session.layer.calls.lines>0,"legacy lineStyle draws outlines");
    assert.equal(editor.session.layer.calls.circles,6,
      "legacy drawCircle draws both node halos and centers");
    editor.cancel();assert.equal(await existing,false);

    const creation=editor.begin(scene,{kind:"polygon",points:[]},async()=>{});
    for(const [x,y] of [[10,10],[80,10],[80,80]])
      surface.listeners.get("pointerdown")({button:0,clientX:x,clientY:y,
        preventDefault(){},stopImmediatePropagation(){}});
    assert.equal(editor.session.draft.points.length,3);
    assert.ok(editor.session.layer.calls.lines>0,"new polygon uses legacy outline styling");
    editor.cancel();assert.equal(await creation,false);

    const painting=editor.begin(scene,{kind:"grid",offsets:[{i:0,j:0}]},async()=>{});
    assert.equal(editor.session.layer.calls.polygons,1,
      "legacy drawPolygon renders a native grid cell without graphics.poly");
    const radiusControl=editor.session.panel.children.find(child=>child.tagName==="label"&&
      child.textContent.includes("Brush radius"));
    const slider=radiusControl.children.find(child=>child.tagName==="input");
    const value=radiusControl.children.find(child=>child.tagName==="output");
    assert.equal(slider.type,"range");
    assert.equal(slider.max,"4","max ring count stays below the stroke safety budget");
    slider.value="3";slider.listeners.get("input")();
    assert.equal(editor.session.radius,3);
    assert.equal(value.textContent,"3 rings");
    editor.cancel();assert.equal(await painting,false);
    assert.equal(surface.listeners.size,0);
    assert.equal(doc.listeners.size,0);
    assert.equal(group.children.length,0);
  }finally{Object.assign(globalThis,saved);}
});

test("Preview & Save uses the v14 DialogV2 namespace and commits only on confirmation",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    foundry:globalThis.foundry,PIXI:globalThis.PIXI,
    requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={children:[],addChild(g){this.children.push(g);g.parent=this;},
    removeChild(g){this.children=this.children.filter(x=>x!==g);g.parent=null;}};
  const scene={id:"paedor"};let confirm=false,confirmCalls=0,saves=0,savedDraft;
  globalThis.game={user:{isGM:true}};
  globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>{
    confirmCalls++;return confirm;
  }}},instances:new Map()}};
  globalThis.PIXI={Graphics:Graphics};globalThis.requestAnimationFrame=undefined;
  globalThis.document=doc;
  globalThis.canvas={ready:true,scene,app:{canvas:surface},interface:group,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:300,sceneHeight:300},
    stage:{scale:{x:1}},canvasCoordinatesFromClient:p=>p};
  const draft={kind:"polygon",points:[{id:"a",x:5,y:5},
    {id:"b",x:100,y:5},{id:"c",x:100,y:100}],smoothing:0};
  const editor=new TerritoryAuthoringCanvas();
  try{
    const pending=editor.begin(scene,draft,async candidate=>{
      saves++;savedDraft=candidate;
    });
    const save=editor.session.panel.children.find(c=>c.tagName==="div")
      .children.find(c=>c.textContent==="Preview & Save");
    await save.listeners.get("click")();
    assert.equal(confirmCalls,1);
    assert.equal(saves,0,"No unconfirmed native writes");
    assert.ok(editor.session,"Declined confirmation leaves the draft open");
    confirm=true;
    await save.listeners.get("click")();
    assert.equal(confirmCalls,2);
    assert.equal(saves,1);
    assert.deepEqual(savedDraft,draft);
    assert.equal(await pending,true);
    assert.equal(group.children.length,0);
    assert.equal(body.children.length,0);
    assert.equal(doc.listeners.size,0);
  }finally{Object.assign(globalThis,saved);}
});

test("Paint Territory shows a full-sized progress surface and hides brush controls during transfer",async()=>{
  const saved={game:globalThis.game,canvas:globalThis.canvas,document:globalThis.document,
    foundry:globalThis.foundry,PIXI:globalThis.PIXI,
    requestAnimationFrame:globalThis.requestAnimationFrame};
  const surface=new Element("canvas"),body=new Element("body"),doc=new Element("document");
  doc.createElement=tag=>new Element(tag);doc.body=body;
  const group={addChild(g){g.parent=this;},removeChild(g){g.parent=null;}};
  const scene={id:"paedor"};
  globalThis.game={user:{isGM:true}};
  globalThis.foundry={applications:{api:{DialogV2:{confirm:async()=>true}}}};
  globalThis.PIXI={Graphics};globalThis.document=doc;
  globalThis.requestAnimationFrame=undefined;
  globalThis.canvas={ready:true,scene,app:{canvas:surface},interface:group,
    dimensions:{sceneX:0,sceneY:0,sceneWidth:200,sceneHeight:200},
    stage:{scale:{x:1}},canvasCoordinatesFromClient:p=>p,
    grid:{getShape:()=>[{x:0,y:0},{x:10,y:0},{x:10,y:10}],
      getCenterPoint:({i,j})=>({x:i*10,y:j*10}),
      getOffset:()=>({i:0,j:0}),getAdjacentOffsets:()=>[]}};
  const editor=new TerritoryAuthoringCanvas();let complete;
  const held=new Promise(resolve=>{complete=resolve;});
  try{
    const pending=editor.begin(scene,{kind:"grid",offsets:[]},async (_draft,report)=>{
      report({step:1,total:4,message:"Updating two native Regions"});
      await held;
      throw Error("Simulated transfer failure");
    });
    const panel=editor.session.panel;
    const controls=panel.children.find(child=>child.tagName==="label");
    const save=panel.children.find(child=>child.tagName==="div"&&
      child.children.some(c=>c.textContent==="Preview & Save"))
      .children.find(c=>c.textContent==="Preview & Save");
    const operation=save.listeners.get("click")();
    await Promise.resolve();
    const progress=panel.children.find(c=>c.attributes.role==="status");
    assert.equal(progress.style.display,"block");
    assert.equal(progress.children[0].textContent,"Updating two native Regions");
    assert.equal(progress.children[1].value,1);
    assert.equal(controls.style.display,"none","brush radius is hidden during transfer");
    assert.equal(panel.children.find(child=>child.className==="atlas-territory-shortcuts")
      .style.display,"none","shortcut guide is hidden during transfer");
    assert.equal(panel.style.minHeight,"190px","progress surface cannot collapse");
    assert.match(panel.children.find(c=>c.tagName==="h3").textContent,/Transferring/);
    complete();await operation;
    assert.equal(progress.style.display,"none","failed transfer restores edit controls");
    assert.equal(controls.style.display,undefined);
    editor.cancel();assert.equal(await pending,false);
  }finally{Object.assign(globalThis,saved);}
});
