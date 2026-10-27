import { readManualFog, applyManualFogBrush } from "./atlas-manual-fog-storage.js";
import { nativeFogCells, brushCells } from "./atlas-manual-fog-geometry.js";
import { cellKey } from "./atlas-manual-fog-model.js";
/** Dedicated independent renderer: only persisted manual overrides determine visibility. */
export class AtlasManualFogController {
  constructor() {
    this.layer=null;this.view=null;this.preview=false;this.brush=null;
    this.pointerTarget=null;this.pointerDown=this.onPointerDown.bind(this);
  }
  setPreview(enabled) { this.preview=!!enabled;this.refresh(); }
  setBrush(mode,radius=0) {
    if(mode!==null&&!["reveal","hide","clear"].includes(mode))
      throw new Error("Choose a valid Atlas brush.");
    if(!Number.isSafeInteger(radius)||radius<0||radius>20)
      throw new Error("Brush radius must be 0–20 cells.");
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
    if(!this.brush||!globalThis.game?.user?.isGM||event.button!==0||
        !globalThis.canvas?.ready) return;
    const scene=canvas.scene;
    if(!readManualFog(scene).enabled)return;
    const p=canvas.canvasCoordinatesFromClient?.({x:event.clientX,y:event.clientY});
    if(!p)return;
    let cells;
    try{cells=brushCells(nativeFogCells(canvas),p,this.brush.radius,
      Number(scene.grid?.size));}
    catch(error){ui.notifications.error(error.message);return;}
    if(!cells.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{await applyManualFogBrush(scene,cells,this.brush.mode);this.refresh();}
    catch(error){ui.notifications.error(error.message);}
  }
  tearDown() {
    this.pointerTarget?.removeEventListener?.("pointerdown",this.pointerDown,true);
    this.pointerTarget=null;this.brush=null;
    this.layer?.parent?.removeChild?.(this.layer);
    this.layer?.destroy?.();
    this.layer=null;this.view=null;
  }
  refresh(){
    const view=globalThis.canvas;
    if(!view?.ready||!view.scene||!globalThis.game?.user)return;
    this.installPointer();
    const state=readManualFog(view.scene);
    const shouldDraw=state.enabled&&(!game.user.isGM||this.preview);
    if(!shouldDraw){if(this.layer)this.layer.visible=false;return;}
    if(!globalThis.PIXI?.Graphics||!view.primary?.addChild)return;
    if(!this.layer||this.view!==view||this.layer.destroyed) {
      this.layer?.parent?.removeChild?.(this.layer);this.layer?.destroy?.();
      const sort=foundry?.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS;
      if(!Number.isFinite(sort?.TILES))throw new Error("Foundry v14 Primary Canvas is unavailable.");
      this.layer=new PIXI.Graphics();
      this.layer.label="Atlas Manual Exploration Fog";
      this.layer.eventMode="none";this.layer.sortLayer=sort.TILES+1;
      this.layer.elevation=0;this.layer.sort=1e100;
      view.primary.addChild(this.layer);this.view=view;
    }
    const g=this.layer;
    // Fail closed if geometry is not valid. No token position or travel history is used.
    const sceneX=Number(view.dimensions?.sceneX),sceneY=Number(view.dimensions?.sceneY);
    const width=Number(view.dimensions?.sceneWidth),height=Number(view.dimensions?.sceneHeight);
    g.clear();g.visible=true;
    if([sceneX,sceneY,width,height].every(Number.isFinite)&&width>0&&height>0){
      g.beginFill(0x080b12,1);g.drawRect(sceneX,sceneY,width,height);g.endFill();
    }
    const all=nativeFogCells(view);
    const revealed=new Set(state.revealed.map(cellKey));
    const hidden=new Set(state.hidden.map(cellKey));
    g.clear();
    for(const cell of all) {
      const key=cellKey(cell);
      if(revealed.has(key)&&!hidden.has(key))continue;
      g.beginFill(0x080b12,game.user.isGM?0.62:1);
      g.drawPolygon(cell.polygon.flat());
      g.endFill();
    }
  }
}
