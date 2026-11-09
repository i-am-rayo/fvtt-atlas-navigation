import test from "node:test";
import assert from "node:assert/strict";
import {projectTerritoryView,territoryTier} from "../scripts/territory-view-model.js";
import {readNativeTerritoryPaths,TerritoryViewOverlay}
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

test("GM overlay mounts above fog, draws continents first, and cleans up with no native writes", () => {
  const previous={canvas:globalThis.canvas,PIXI:globalThis.PIXI,game:globalThis.game};
  const draw=[];
  class Container {
    constructor(){this.children=[];this.parent=null;this.destroyed=false;}
    addChild(c){c.parent=this;this.children.push(c);return c;}
    removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parent=null;}
    destroy(){this.destroyed=true;}
  }
  class Graphics {
    poly(p){this.points=p;return this;}
    stroke(opts){draw.push({points:this.points,opts});return this;}
  }
  class Text {
    constructor(options){this.text=options.text;this.style=options.style;
      this.anchor={set:(...args)=>{this.anchorSet=args;}};
      this.position={set:(...args)=>{this.positionSet=args;}};
      this.scale={set:value=>{this.scaleSet=value;}};}
  }
  try {
    const regions=new Map([
      ["big",{id:"big",name:"Valecor",color:"#112233",
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
      geo("big","Valecor","continent")],{showNames:true});
    assert.deepEqual(result,{shown:2,skipped:0});
    assert.equal(interfaceGroup.children.length,1);
    assert.equal(interfaceGroup.children[0].eventMode,"none");
    assert.deepEqual(draw.map(item=>item.points[0]),[0,0,200,200,20,20],
      "continent halo/core must draw before settlement halo/core");
    assert.deepEqual(overlay.labels.map(item=>item.text),["Valecor","Dirwest"]);
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
