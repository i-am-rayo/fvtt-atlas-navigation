import test from "node:test";
import assert from "node:assert/strict";
import {projectTerritoryView,territoryTier} from "../scripts/territory-view-model.js";
import {readNativeTerritoryPaths,readNativeTerritoryTriangles,TerritoryViewOverlay}
  from "../scripts/territory-view-overlay.js";

const geo = (id,name,kind,linked=true) =>
  ({id,name,linked,invalid:false,geography:kind?{kind}:null});

test("tier projection orders combined map below settlements, while directory is settlement-first", () => {
  const entries=[geo("c","C", "continent"),geo("u","Unknown",null,false),
    geo("a","A","area"),geo("t","Town","town"),geo("v","Village","village")];
  assert.deepEqual(projectTerritoryView(entries).map(e=>e.id),["t","v","a","c","u"]);
  assert.deepEqual(projectTerritoryView(entries,"combined",{drawOrder:true}).map(e=>e.id),
    ["a","c","t","v","u"]);
  assert.deepEqual(projectTerritoryView(entries,"continents").map(e=>e.id),["a","c"]);
  assert.deepEqual(projectTerritoryView(entries,"settlements").map(e=>e.id),["t","v"]);
  assert.equal(territoryTier({...entries[0],invalid:true}),"unclassified");
  assert.throws(()=>projectTerritoryView(entries,"unknown"),/Unknown Atlas Territory view/);
});

test("native polygon paths are absolute and reject excessive or invalid geometry", () => {
  const region={polygons:[{points:[100,200,120,200,110,230]}],
    shapes:[{origin:{x:500,y:500}}]};
  assert.deepEqual(readNativeTerritoryPaths(region),[[100,200,120,200,110,230]],
    "do not add a native Shape origin to already absolute polygon vertices");
  assert.equal(readNativeTerritoryPaths(region,{vertexBudget:2}),null);
  assert.equal(readNativeTerritoryPaths({polygons:[{points:[1,2,3,4,5,Infinity]}]}),null);
  assert.equal(readNativeTerritoryPaths({get polygons(){throw Error("invalid shape");}}),null);
});

test("native Region triangulation drives translucent fills without bridging holes",()=>{
  const triangulation={vertices:Float32Array.from([10,20,30,20,30,40,
    110,120,130,120,130,140]),indices:Uint16Array.from([0,1,2,3,4,5])};
  assert.deepEqual(readNativeTerritoryTriangles({triangulation}),
    [[10,20,30,20,30,40],[110,120,130,120,130,140]],
    "disconnected Region islands remain separate triangles");
  assert.equal(readNativeTerritoryTriangles({triangulation},{maxTriangles:1}),null);
  assert.equal(readNativeTerritoryTriangles({triangulation:{...triangulation,
    indices:Uint16Array.from([0,1,6])}}),null,"out of bounds triangles are rejected");
  assert.equal(readNativeTerritoryTriangles({get triangulation(){throw Error("unavailable");}}),null);
});

test("GM overlay mounts above fog, draws continents first, and cleans up with no native writes", () => {
  const previous={canvas:globalThis.canvas,PIXI:globalThis.PIXI,game:globalThis.game};
  const draw=[],graphicInstances=[];
  class Container {
    constructor(){this.children=[];this.parent=null;this.destroyed=false;}
    addChild(c){c.parent=this;this.children.push(c);return c;}
    removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parent=null;}
    destroy(){this.destroyed=true;}
  }
  class Graphics {
    constructor(){this.operations=[];graphicInstances.push(this);}
    poly(p){this.points=p;return this;}
    stroke(opts){this.operations.push("stroke");draw.push({points:this.points,opts});return this;}
    fill(opts){this.operations.push("fill");draw.push({fillPoints:this.points,opts});return this;}
  }
  class Text {
    constructor(value,style){this.text=typeof value==="string"?value:String(value);
      this.style=style;
      this.anchor={set:(...args)=>{this.anchorSet=args;}};
      this.position={set:(...args)=>{this.positionSet=args;}};
      this.scale={set:value=>{this.scaleSet=value;}};}
  }
  try {
    const regions=new Map([
      ["big",{id:"big",name:"Valecor",color:new Number(0x4d972b),
        triangulation:{vertices:Float32Array.from([0,0,100,0,100,100]),
          indices:Uint16Array.from([0,1,2])},
        polygons:[{points:[0,0,100,0,100,100,0,100]},
          {points:[200,200,210,200,210,210,200,210]}],
        bounds:{x:0,y:0,width:210,height:210}}],
      ["small",{id:"small",name:"Dirwest",color:"#aabbcc",
        polygons:[{points:[20,20,35,20,35,35,20,35]}],
        bounds:{x:20,y:20,width:15,height:15}}]
    ]);
    let writeCount=0;
    for(const region of regions.values())region.update=()=>{writeCount++;};
    const scene={id:"scene",regions};
    const interfaceGroup=new Container();
    globalThis.PIXI={Container,Graphics,Text};
    globalThis.game={user:{isGM:true}};
    globalThis.canvas={scene,ready:true,interface:interfaceGroup,stage:{scale:{x:2}}};
    const overlay=new TerritoryViewOverlay();
    const result=overlay.sync(scene,[geo("small","Dirwest","city"),
      geo("big","Valecor","continent")],{showNames:true,continentFillOpacity:.22,
      settlementFillOpacity:.11});
    assert.deepEqual(result,{shown:2,skipped:0});
    assert.equal(interfaceGroup.children.length,1);
    assert.equal(interfaceGroup.children[0].eventMode,"none");
    assert.deepEqual(graphicInstances.map(instance=>[...new Set(instance.operations)]),
      [["fill"],["stroke"]],
      "fills and borders need isolated GraphicsContexts so triangle edges cannot bleed into strokes");
    assert.deepEqual(draw.filter(item=>item.points).map(item=>item.points[0]),
      [0,0,200,200,20,20],
      "continent halo/core must draw before settlement halo/core");
    assert.ok(draw.some(item=>item.points&&item.opts?.color===0x4d972b),
      "native Region Appearance color is used for the continental boundary");
    assert.ok(draw.some(item=>item.points&&item.opts?.color===0xaabbcc),
      "nested settlement keeps its own native color");
    assert.equal(draw.filter(item=>item.fillPoints).length,1,
      "only Regions with public, valid native triangulation receive a fill");
    assert.equal(draw.find(item=>item.fillPoints).opts.alpha,.22);
    assert.deepEqual(overlay.labels.map(item=>item.text),["Valecor","Dirwest"]);
    assert.equal(overlay.labels.some(item=>item.text==="[object Object]"),false,
      "v14 positional PIXI.Text signature must receive a string");
    assert.deepEqual(overlay.labels[0].positionSet,[50,50],
      "a disconnected Region's label belongs to its largest island, not the empty overall bounds center");
    assert.equal(overlay.labels[0].scaleSet,.5,"labels keep constant screen size while zoomed");
    globalThis.canvas.stage.scale.x=4;
    overlay.updateLabelScale();
    assert.equal(overlay.labels[1].scaleSet,.25);
    assert.equal(writeCount,0);
    const priorLayer=overlay.layer;
    overlay.clear();
    assert.equal(interfaceGroup.children.length,0);
    assert.equal(priorLayer.destroyed,true);
    assert.equal(writeCount,0);
    globalThis.game.user.isGM=false;
    assert.deepEqual(overlay.sync(scene,[geo("big","Valecor","continent")]),
      {shown:0,skipped:0});
    assert.equal(interfaceGroup.children.length,0,"non-GM must never get Territory overlay");
  } finally {Object.assign(globalThis,previous);}
});

test("linked geographic label uses Checkpoint name and double-click opens its authorized Journal",async()=>{
  const previous={canvas:globalThis.canvas,PIXI:globalThis.PIXI,game:globalThis.game,
    fromUuid:globalThis.fromUuid,foundry:globalThis.foundry};
  const handlers=new Map(),removals=[];
  class Container{
    constructor(){this.children=[];}
    addChild(item){item.parent=this;this.children.push(item);return item;}
    removeChild(item){this.children.splice(this.children.indexOf(item),1);}
    destroy(){}
  }
  class Graphics{poly(){return this;}stroke(){return this;}clear(){} }
  class Text{
    constructor(text){this.text=text;this.anchor={set(){}};this.position={set(){}};
      this.scale={set(){}};}
  }
  try{
    let linked=true;
    const region={id:"region",name:"Dirwest Region",color:"#abcdef",
      polygons:[{points:[0,0,100,0,100,100,0,100]}],
      getFlag(_module,key){return linked&&key==="territoryCheckpoint"?
        {schemaVersion:1,checkpointId:"checkpoint1"}:null;}};
    const scene={id:"scene",regions:new Map([[region.id,region]]),
      getFlag(_module,key){return key==="atlasJournalLinks"?
        {schemaVersion:1,roads:{},checkpoints:{checkpoint1:"JournalEntry.ABCDEFGHIJKLMNOP"}}:null;}};
    const canvasElement={addEventListener(name,handler){handlers.set(name,handler);},
      removeEventListener(name,handler){removals.push(name);if(handlers.get(name)===handler)
        handlers.delete(name);}};
    globalThis.PIXI={Container,Graphics,Text};
    globalThis.game={user:{isGM:true}};
    globalThis.canvas={scene,ready:true,interface:new Container(),
      app:{canvas:canvasElement},stage:{scale:{x:1}},
      canvasCoordinatesFromClient:point=>point};
    let opened=0;
    globalThis.foundry={utils:{fromUuid:async()=>({documentName:"JournalEntry",
      sheet:{render:async()=>{opened++;}}})}};
    const overlay=new TerritoryViewOverlay();
    overlay.sync(scene,[geo("region","Dirwest Region","city")],{
      showNames:true,checkpointsById:new Map([["checkpoint1",
        {id:"checkpoint1",name:"Dirwest"}]])});
    assert.deepEqual(overlay.labels.map(label=>label.text),["Dirwest"]);
    assert.deepEqual([...overlay.labelCheckpointIds],["checkpoint1"]);
    assert.equal(typeof handlers.get("dblclick"),"function");
    let prevented=0;
    handlers.get("dblclick")({button:0,clientX:50,clientY:50,
      preventDefault(){prevented++;},stopImmediatePropagation(){}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(prevented,1);
    assert.equal(opened,1);
    linked=false;
    handlers.get("dblclick")({button:0,clientX:50,clientY:50,
      preventDefault(){prevented++;},stopImmediatePropagation(){}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(prevented,1,"a stale native association never opens its former Journal");
    assert.equal(opened,1);
    overlay.clear();
    assert.ok(removals.includes("dblclick"),"clear always unregisters Journal handlers");
    assert.equal(handlers.size,0);
  }finally{Object.assign(globalThis,previous);}
});
