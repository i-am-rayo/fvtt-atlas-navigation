import assert from "node:assert/strict";
import test from "node:test";
import { AtlasManualFogController } from "../scripts/atlas-manual-fog-renderer.js";

test("invalid saved manual Fog covers the Scene without a read-side write",()=>{
  const previous={canvas:globalThis.canvas,game:globalThis.game,
    PIXI:globalThis.PIXI,foundry:globalThis.foundry};
  const masks=[];
  let writes=0;
  class Graphics {
    constructor(){this.rectangles=[];this.polygons=[];this.destroyed=false;}
    beginFill(){}
    drawRect(...values){this.rectangles.push(values);}
    drawPolygon(...values){this.polygons.push(values);}
    endFill(){}
    destroy(){this.destroyed=true;}
  }
  const fog=new AtlasManualFogController();
  try {
    const scene={id:"scene",getFlag:(_module,key)=>key==="manualFog"?
      {schemaVersion:1,enabled:true,revealed:[{x:0,y:0}],hidden:[{x:0,y:0}]}:null,
    setFlag:()=>{writes++;}};
    globalThis.canvas={ready:true,scene,
      dimensions:{sceneX:100,sceneY:200,sceneWidth:400,sceneHeight:300},
      primary:{addChild:graphics=>{masks.push(graphics);}}};
    globalThis.game={user:{isGM:false}};
    globalThis.PIXI={Graphics};
    globalThis.foundry={canvas:{groups:{PrimaryCanvasGroup:{
      SORT_LAYERS:{TILES:30}}}}};
    const warn=console.warn;
    try{console.warn=()=>{};fog.refresh();}
    finally{console.warn=warn;}
    assert.equal(masks.length,1,"invalid fog state still creates an opaque mask");
    assert.deepEqual(masks[0].rectangles,[[100,200,400,300]]);
    assert.equal(masks[0].polygons.length,0,"no permissive cell fragments are drawn");
    assert.equal(writes,0,"the corrupted Scene flag is not silently fixed");
  }finally{fog.tearDown();Object.assign(globalThis,previous);}
});

test("unsupported native grid remains opaque instead of exposing unexplored terrain",()=>{
  const previous={canvas:globalThis.canvas,game:globalThis.game,
    PIXI:globalThis.PIXI,foundry:globalThis.foundry};
  const masks=[];
  class Graphics {
    constructor(){this.rectangles=[];this.destroyed=false;}
    beginFill(){}
    drawRect(...values){this.rectangles.push(values);}
    endFill(){}
    destroy(){this.destroyed=true;}
  }
  const fog=new AtlasManualFogController();
  try{
    globalThis.game={user:{isGM:false}};
    globalThis.canvas={ready:true,
      scene:{id:"invalid-grid",grid:{type:0},
        getFlag:(_module,key)=>key==="manualFog"?
          {schemaVersion:1,enabled:true,revealed:[],hidden:[]}:null},
      dimensions:{sceneX:50,sceneY:80,sceneWidth:640,sceneHeight:380},
      grid:{isGridless:true},
      primary:{addChild:g=>masks.push(g)}};
    globalThis.PIXI={Graphics};
    globalThis.foundry={canvas:{groups:{PrimaryCanvasGroup:{
      SORT_LAYERS:{TILES:30}}}}};
    const warn=console.warn;
    try{console.warn=()=>{};fog.refresh();}
    finally{console.warn=warn;}
    assert.deepEqual(masks[0].rectangles,[[50,80,640,380]]);
  }finally{fog.tearDown();Object.assign(globalThis,previous);}
});
