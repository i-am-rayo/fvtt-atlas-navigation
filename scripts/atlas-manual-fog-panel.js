import { readManualFog } from "./atlas-manual-fog-storage.js";
import { MODULE_ID } from "./atlas-storage.js";

import { BRUSH_MODIFIERS as MODIFIERS } from "./atlas-manual-fog-shortcuts.js";
export const BRUSH_REVEAL_SHORTCUT = "brushRevealShortcut";
export const BRUSH_HIDE_SHORTCUT = "brushHideShortcut";
export const BRUSH_RADIUS_SETTING = "brushRadius";

export function registerManualBrushSettings() {
  for (const [key,name,def] of [
    [BRUSH_REVEAL_SHORTCUT,"Reveal brush modifier","alt"],
    [BRUSH_HIDE_SHORTCUT,"Hide brush modifier","shift"]
  ]) {
    game.settings.register(MODULE_ID,key,{
      name:"Atlas: "+name,
      hint:"While the Atlas brush palette is open, hold this modifier and click the Scene to temporarily use this brush.",
      scope:"world",config:true,type:String,choices:MODIFIERS,default:def
    });
  }
  game.settings.register(MODULE_ID,BRUSH_RADIUS_SETTING,{
    name:"Atlas brush radius",scope:"client",config:false,type:Number,default:1
  });
}
const el=(tag,label,cls)=>{
  const node=document.createElement(tag);
  if(label!==undefined)node.textContent=label;
  if(cls)node.className=cls;
  return node;
};
const shortcut = key => game.settings.get(MODULE_ID,key);
export class AtlasManualFogPalette {
  constructor(controller){this.controller=controller;this.element=null;
    this.radius=1;
    this.onKeyDown=event=>{if(event.key==="Escape"&&this.open){event.preventDefault();this.close();}};}
  get open(){return !!this.element?.isConnected;}
  toggle(){return this.open?this.close():this.show();}
  show(){
    if(this.open)return;
    if(!game.user?.isGM)return;
    if(!canvas?.ready||!canvas.scene){ui.notifications.warn("Open an Atlas Scene first.");return;}
    this.radius=Math.max(0,Math.min(20,Math.round(Number(game.settings.get(MODULE_ID,BRUSH_RADIUS_SETTING))||0)));
    this.element=el("section",undefined,"atlas-brush-palette");
    this.element.setAttribute("aria-label","Atlas exploration brushes");
    document.body.appendChild(this.element);
    document.addEventListener("keydown",this.onKeyDown);
    this.controller.paletteOpen=true;
    this.controller.setBrush(this.controller.brush?.mode??null,this.radius);
    this.draw();
  }
  close(){
    document.removeEventListener("keydown",this.onKeyDown);
    this.controller.paletteOpen=false;
    this.controller.setBrush(null,this.radius);
    this.element?.remove();this.element=null;
  }
  draw(){
    const root=this.element;
    if(!root)return;
    root.replaceChildren();
    const header=el("div",undefined,"atlas-brush-header");
    header.append(el("strong","Atlas — Exploration Brushes"));
    const close=el("button","×","atlas-brush-close");
    close.type="button";close.title="Close brush palette (Esc)";
    close.addEventListener("click",()=>this.close());
    header.append(close);root.append(header);
    const scene=canvas?.scene;
    const enabled=scene?readManualFog(scene).enabled:false;
    root.append(el("p",enabled?
      "Paint Scene cells. Select a brush or hold a shortcut while clicking.":
      "Enable Atlas Manual Fog in the Scene Atlas settings before painting.","atlas-brush-help"));
    const section=el("fieldset",undefined,"atlas-brush-fieldset");
    section.append(el("legend","Brushes"));
    const radiusRow=el("div",undefined,"atlas-brush-radius");
    const label=el("label","Brush radius");
    const slider=el("input"),number=el("input");
    slider.type="range";slider.min="0";slider.max="20";slider.step="1";
    number.type="number";number.min="0";number.max="20";number.step="1";
    slider.value=number.value=String(this.radius);
    label.htmlFor="atlas-brush-radius-range";slider.id="atlas-brush-radius-range";
    const setRadius=value=>{
      const parsed=Number(value);
      if(!Number.isSafeInteger(parsed)||parsed<0||parsed>20)return;
      this.radius=parsed;
      slider.value=number.value=String(parsed);
      this.controller.setBrush(this.controller.brush?.mode??null,parsed);
      void game.settings.set(MODULE_ID,BRUSH_RADIUS_SETTING,parsed).catch(error=>
        console.warn("[fvtt-atlas-navigation] Failed saving brush radius",error));
    };
    slider.addEventListener("input",()=>setRadius(slider.value));
    number.addEventListener("change",()=>setRadius(number.value));
    radiusRow.append(label,slider,number);section.append(radiusRow);
    for(const [mode,title,icon] of [["reveal","Reveal","✦"],["hide","Hide","◼"],["clear","Clear override","⌫"]]){
      const button=el("button",icon+"  "+title,"atlas-brush-mode");
      button.type="button";button.disabled=!enabled;
      if(this.controller.brush?.mode===mode)button.classList.add("active");
      button.setAttribute("aria-pressed",String(this.controller.brush?.mode===mode));
      button.addEventListener("click",()=>{
        this.controller.setBrush(this.controller.brush?.mode===mode?null:mode,this.radius);
        this.draw();
      });
      section.append(button);
    }
    root.append(section);
    const shortcutGroup=el("fieldset",undefined,"atlas-brush-fieldset");
    shortcutGroup.append(el("legend","Quick shortcuts"));
    const reveal=shortcut(BRUSH_REVEAL_SHORTCUT),hide=shortcut(BRUSH_HIDE_SHORTCUT);
    shortcutGroup.append(el("p","Reveal: "+MODIFIERS[reveal]+" + Click"));
    shortcutGroup.append(el("p","Hide: "+MODIFIERS[hide]+" + Click"));
    if(reveal!=="off"&&reveal===hide)shortcutGroup.append(el("p",
      "Both actions share the same shortcut. Change one in Module Settings.","atlas-brush-warning"));
    shortcutGroup.append(el("p","Change shortcuts in Configure Settings → Module Settings → Atlas."));
    root.append(shortcutGroup);
    const footer=el("div",undefined,"atlas-brush-footer");
    const preview=el("button",this.controller.preview?"Hide GM Fog Preview":"Show GM Fog Preview");
    preview.type="button";preview.addEventListener("click",()=>{
      this.controller.setPreview(!this.controller.preview);this.draw();
    });
    const stop=el("button","Stop brush");
    stop.type="button";stop.addEventListener("click",()=>{
      this.controller.setBrush(null,this.radius);this.draw();
    });
    footer.append(preview,stop);root.append(footer);
    const counter=scene?readManualFog(scene):null;
    if(counter)root.append(el("p",counter.revealed.length+" revealed · "+
      counter.hidden.length+" hidden cells","atlas-brush-help"));
  }
}
