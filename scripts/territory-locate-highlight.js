/** Transient GM-only Region locator. Does not change saved Atlas Layers modes,
 * native Region visibility, Fog of War, Shapes or Scene metadata. */
import {readNativeTerritoryPaths,readNativeTerritoryTriangles}
  from "./territory-view-overlay.js";

export const TERRITORY_LOCATE_DURATION_MS=30000;

/** Native bounds are in absolute canvas pixels; camera scale fits all islands
 * with generous space for window chrome and labels. */
export function territoryLocateCamera(view,bounds){
  if(!bounds||![bounds.x,bounds.y,bounds.width,bounds.height]
    .every(Number.isFinite)||bounds.width<=0||bounds.height<=0)
    throw Error("This native Territory has no usable map bounds.");
  const viewport=view?.app?.renderer?.screen??view?.app?.screen;
  const current=Number(view?.stage?.scale?.x);
  const fallback=Number.isFinite(current)&&current>0?current:1;
  const hasViewport=Number.isFinite(viewport?.width)&&viewport.width>0&&
    Number.isFinite(viewport?.height)&&viewport.height>0;
  const fit=hasViewport?Math.min(viewport.width*.78/bounds.width,
    viewport.height*.78/bounds.height):fallback;
  // Foundry applies its own zoom limits; do not zoom beyond a usable map level.
  return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,
    scale:Math.max(.05,Math.min(2.25,fit))};
}

function drawOutline(graphics,points,width,color,alpha){
  if(typeof graphics.poly==="function"&&typeof graphics.stroke==="function")
    graphics.poly(points).stroke({width,color,alpha,join:"round"});
  else if(typeof graphics.lineStyle==="function"&&
      typeof graphics.moveTo==="function"&&typeof graphics.lineTo==="function"){
    graphics.lineStyle(width,color,alpha);
    graphics.moveTo(points[0],points[1]);
    for(let k=2;k<points.length;k+=2)graphics.lineTo(points[k],points[k+1]);
    graphics.lineTo(points[0],points[1]);
  }else throw Error("Foundry's Graphics canvas cannot highlight this Territory.");
}

function drawFill(graphics,triangles){
  for(const points of triangles){
    if(typeof graphics.poly==="function"&&typeof graphics.fill==="function")
      graphics.poly(points).fill({color:0xffd36c,alpha:.17});
    else if(typeof graphics.beginFill==="function"&&
        typeof graphics.drawPolygon==="function"&&typeof graphics.endFill==="function"){
      graphics.beginFill(0xffd36c,.17);
      graphics.drawPolygon(points);
      graphics.endFill();
    }
  }
}

export class TerritoryLocateHighlight{
  constructor({now=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),
    cancel=id=>clearTimeout(id)}={}){
    this.now=now;this.schedule=schedule;this.cancel=cancel;
    this.active=null;
  }

  clear(){
    const active=this.active;
    this.active=null;
    if(!active)return;
    if(active.timer!=null)this.cancel(active.timer);
    active.layer.parent?.removeChild?.(active.layer);
    active.layer.destroy?.({children:true});
  }

  async focus(scene,region,{view=globalThis.canvas,
    durationMs=TERRITORY_LOCATE_DURATION_MS}={}){
    this.clear();
    if(!globalThis.game?.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
      throw Error("Only an authorized GM may locate a native Territory.");
    if(!region||region.parent?.id!==scene.id||!view?.ready||
        view.scene?.id!==scene.id||typeof view.animatePan!=="function"||
        !view.interface?.addChild)
      throw Error("Open this native Territory's Scene to locate it.");
    const camera=territoryLocateCamera(view,region.bounds);
    const paths=readNativeTerritoryPaths(region);
    if(!paths)throw Error("The native Territory has no drawable outline.");
    const pixi=globalThis.PIXI;
    if(!pixi?.Container||!pixi?.Graphics)
      throw Error("Foundry's canvas Graphics are not available.");
    const layer=new pixi.Container();layer.eventMode="none";
    // Keep native triangulated fills separate from outline strokes. Sharing a
    // GraphicsContext caused stray radial lines in the main Territory layer.
    const fills=new pixi.Graphics();fills.eventMode="none";
    const borders=new pixi.Graphics();borders.eventMode="none";
    layer.addChild(fills);
    layer.addChild(borders);
    try{
      const triangles=readNativeTerritoryTriangles(region,{maxTriangles:3000});
      if(triangles)drawFill(fills,triangles);
      for(const path of paths){
        drawOutline(borders,path,13,0xffb347,.35);
        drawOutline(borders,path,4,0xffdf87,1);
      }
      view.interface.addChild(layer);
      const active={view,scene,region,layer,startAt:this.now(),timer:null};
      this.active=active;
      // Highlight is independent of persistent Atlas Layers visibility. If
      // Regions are Hidden, only this one translucent outline is temporarily
      // shown, and the user's selected mode stays untouched.
      const reduced=globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const tick=()=>{
        if(this.active!==active)return;
        if(globalThis.canvas!==view||!view.ready||view.scene?.id!==scene.id||
            scene.regions?.get?.(region.id)!==region||layer.parent!==view.interface){
          this.clear();return;
        }
        const elapsed=this.now()-active.startAt;
        if(elapsed>=durationMs){this.clear();return;}
        layer.alpha=reduced ? .85 : .65+.3*Math.sin((elapsed/1250)*Math.PI*2)**2;
        active.timer=this.schedule(tick,100);
      };
      tick();
      await view.animatePan({...camera,duration:750});
      return camera;
    }catch(error){
      if(this.active?.layer===layer)this.clear();
      else layer.destroy?.({children:true});
      throw error;
    }
  }
}
