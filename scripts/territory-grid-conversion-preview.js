/** Disposable, noninteractive canvas preview of one proposed polygon-to-grid
 * conversion. Cyan shows proposed native grid spaces; orange traces original
 * native polygons. Both are GM-only and live above Atlas fog. */
import {readNativeTerritoryPaths} from "./territory-view-overlay.js";

function shape(graphics,points,fillColor,alpha){
  if(typeof graphics.poly==="function"&&typeof graphics.fill==="function")
    graphics.poly(points).fill({color:fillColor,alpha});
  else if(typeof graphics.beginFill==="function"&&
      typeof graphics.drawPolygon==="function"&&typeof graphics.endFill==="function"){
    graphics.beginFill(fillColor,alpha);graphics.drawPolygon(points);graphics.endFill();
  }else throw Error("This canvas cannot render a native grid conversion preview.");
}
function trace(graphics,points){
  if(typeof graphics.poly==="function"&&typeof graphics.stroke==="function")
    graphics.poly(points).stroke({width:3,color:0xffa24e,alpha:1,join:"round"});
  else if(typeof graphics.lineStyle==="function"&&typeof graphics.moveTo==="function"&&
      typeof graphics.lineTo==="function"){
    graphics.lineStyle(3,0xffa24e,1);
    graphics.moveTo(points[0],points[1]);
    for(let i=2;i<points.length;i+=2)graphics.lineTo(points[i],points[i+1]);
    graphics.lineTo(points[0],points[1]);
  }else throw Error("This canvas cannot draw the original Region boundary.");
}

export class TerritoryGridConversionPreview{
  layer=null;
  clear(){
    const layer=this.layer;this.layer=null;
    if(!layer)return;
    layer.parent?.removeChild?.(layer);
    layer.destroy?.({children:true});
  }
  show(scene,plan,{view=globalThis.canvas}={}){
    this.clear();
    const pixi=globalThis.PIXI,region=scene?.regions?.get?.(plan?.regionId);
    if(!globalThis.game?.user?.isGM||!view?.ready||view.scene?.id!==scene?.id||
        plan?.sceneId!==scene.id||!region||!view.interface?.addChild||
        !pixi?.Graphics||!pixi?.Container)
      throw Error("The GM canvas or selected Region changed; reopen preview.");
    const contours=readNativeTerritoryPaths(region);
    const points=view.grid?.getShape?.();
    if(!contours||!Array.isArray(points)||!points.length)
      throw Error("Original native Region and Scene grid geometry are unavailable.");
    const layer=new pixi.Container();layer.eventMode="none";
    const proposed=new pixi.Graphics(),original=new pixi.Graphics();
    proposed.eventMode="none";original.eventMode="none";
    layer.addChild(proposed);layer.addChild(original);
    try{
      for(const offset of plan.offsets){
        const center=view.grid.getCenterPoint(offset);
        shape(proposed,points.flatMap(p=>[p.x+center.x,p.y+center.y]),0x41decb,.32);
      }
      for(const path of contours)trace(original,path);
      view.interface.addChild(layer);this.layer=layer;
    }catch(error){layer.parent?.removeChild?.(layer);layer.destroy?.({children:true});throw error;}
    return layer;
  }
}
