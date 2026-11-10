import { readManualFog, applyManualFogBrush } from "./atlas-manual-fog-storage.js";
import { nativeFogCells, brushCells } from "./atlas-manual-fog-geometry.js";
import { coveredManualFogCells } from "./atlas-manual-fog-projection.js";
import { MODULE_ID, readAtlas } from "./atlas-storage.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { checkpointRevealKeys } from "./checkpoint-exploration.js";
import { resolveManualBrushMode } from "./atlas-manual-fog-shortcuts.js";
import { BRUSH_REVEAL_SHORTCUT, BRUSH_HIDE_SHORTCUT }
  from "./atlas-manual-fog-panel.js";
import { atlasDebug } from "./atlas-debug.js";
/** Dedicated independent renderer: only persisted manual overrides determine visibility. */
export class AtlasManualFogController {
  constructor() {
    this.layer=null;this.view=null;this.preview=true;this.editorHidden=false;this.brush=null;
    this.pointerTarget=null;this.pointerDown=this.onPointerDown.bind(this);
    this.paletteOpen=false;this.radius=1;
  }
  setPreview(enabled) { this.preview=!!enabled;this.refresh(); }
  setEditorHidden(hidden) {
    this.editorHidden=!!hidden;
    this.refresh();
  }
  setBrush(mode,radius=0) {
    if(mode!==null&&!["reveal","hide","clear"].includes(mode))
      throw new Error("Choose a valid Atlas brush.");
    if(!Number.isSafeInteger(radius)||radius<0||radius>20)
      throw new Error("Brush radius must be 0–20 cells.");
    this.radius=radius;
    this.brush=mode?{mode,radius}:null;
    this.installPointer();this.refresh();
  }
  installPointer() {
    const target=globalThis.canvas?.app?.canvas??globalThis.canvas?.app?.view;
    if(this.pointerTarget===target)return;
    this.pointerTarget?.removeEventListener?.("pointerdown",this.pointerDown,true);
    this.pointerTarget=target??null;
    target?.addEventListener?.("pointerdown",this.pointerDown,true);
  }
  async onPointerDown(event) {
    if(!globalThis.game?.user?.isGM||event.button!==0||!globalThis.canvas?.ready)return;
    const mode=resolveManualBrushMode(this.brush?.mode,event,{
      reveal:game.settings.get(MODULE_ID,BRUSH_REVEAL_SHORTCUT),
      hide:game.settings.get(MODULE_ID,BRUSH_HIDE_SHORTCUT)
    },this.paletteOpen);
    if(!mode)return;
    const scene=canvas.scene;
    try{if(!readManualFog(scene).enabled)return;}
    catch(error){ui.notifications.error(error.message);return;}
    const p=canvas.canvasCoordinatesFromClient?.({x:event.clientX,y:event.clientY});
    if(!p)return;
    let cells;
    try{cells=brushCells(nativeFogCells(canvas),p,this.brush?.radius??this.radius,
      Number(scene.grid?.size));}
    catch(error){ui.notifications.error(error.message);return;}
    if(!cells.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{await applyManualFogBrush(scene,cells,mode);this.refresh();}
    catch(error){ui.notifications.error(error.message);}
  }
  tearDown() {
    this.pointerTarget?.removeEventListener?.("pointerdown",this.pointerDown,true);
    this.pointerTarget=null;this.brush=null;this.paletteOpen=false;
    this.editorHidden=false;
    this.layer?.parent?.removeChild?.(this.layer);
    this.layer?.destroy?.();
    this.layer=null;this.view=null;
  }
  refresh(){
    const view=globalThis.canvas;
    if(!view?.ready||!view.scene||!globalThis.game?.user)return;
    this.installPointer();
    let state,invalidState=null;
    try{state=readManualFog(view.scene);}
    catch(error){
      // Invalid saved flags are never treated as a disabled mask. Keep the
      // native Scene untouched and cover the whole image until GM repair.
      invalidState=error;
      state={enabled:true};
    }
    const shouldDraw=state.enabled&&(!game.user.isGM||
      (this.preview&&!this.editorHidden));
    if(!shouldDraw){if(this.layer)this.layer.visible=false;return;}
    if(!globalThis.PIXI?.Graphics||!view.primary?.addChild)return;
    const sort=foundry?.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS;
    if(!Number.isFinite(sort?.TILES))throw new Error("Foundry v14 Primary Canvas is unavailable.");
    // Build off-screen, then replace the previous complete mask. Re-clearing a
    // live mask on every explorer TokenDocument.move briefly flashed a solid
    // black screen while the new grid polygons were tessellated.
    const g=new PIXI.Graphics();
    g.label="Atlas Manual Exploration Fog";
    g.eventMode="none";g.sortLayer=sort.TILES+1;
    g.elevation=0;g.sort=1e100;
    const sceneX=Number(view.dimensions?.sceneX),sceneY=Number(view.dimensions?.sceneY);
    const width=Number(view.dimensions?.sceneWidth),height=Number(view.dimensions?.sceneHeight);
    try{
      if(invalidState)throw invalidState;
      const all=nativeFogCells(view);
      const checkpointCells=checkpointRevealKeys(all,readAtlas(view.scene),
        readPartyExploration(view.scene),Number(view.scene.grid?.size),
        {x:sceneX,y:sceneY});
      const covered=coveredManualFogCells(all,state,checkpointCells);
      atlasDebug("fog","Exploration mask rebuilt",{
        sceneId:view.scene.id,totalCells:all.length,
        revealedCells:state.revealed.length,hiddenCells:state.hidden.length,
        checkpointCells:checkpointCells.size,coveredCells:covered.length
      },{level:"trace"});
      for(const cell of covered) {
        g.beginFill(0x080b12,game.user.isGM?0.62:1);
        g.drawPolygon(cell.polygon.flat());
        g.endFill();
      }
    }catch(error){
      // Failed grid validation must never expose previously hidden cells.
      if([sceneX,sceneY,width,height].every(Number.isFinite)&&width>0&&height>0){
        g.beginFill(0x080b12,1);g.drawRect(sceneX,sceneY,width,height);g.endFill();
      }else{g.destroy?.();throw error;}
      console.warn("[fvtt-atlas-navigation] Atlas fog was covered after invalid grid geometry",error);
    }
    view.primary.addChild(g);
    const old=this.layer;
    this.layer=g;this.view=view;
    old?.parent?.removeChild?.(old);old?.destroy?.();
  }
}
