/** Persistent, GM-local map presentation. Never writes Scene/Region documents. */
import {MODULE_ID} from "./atlas-storage.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {listGeneratedRegions} from "./region-native-read.js";
import {TerritoryViewOverlay} from "./territory-view-overlay.js";
import {ATLAS_LAYERS_SETTING,DEFAULT_ATLAS_LAYERS,ROAD_LAYER_MODES,
  REGION_LAYER_MODES,validateAtlasLayers,updateAtlasLayers}
  from "./atlas-layer-preferences.js";

const element=(tag,label,className)=>{
  const result=document.createElement(tag);
  if(label!==undefined)result.textContent=label;
  if(className)result.className=className;
  return result;
};

export class AtlasLayersWindow extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={
    id:"fvtt-atlas-layer-palette",
    window:{title:"Atlas Layers",resizable:true,minimizable:true},
    position:{width:345,height:445,left:110,top:105}
  };

  constructor(controller){super();this.controller=controller;this.updates=Promise.resolve();}

  async _renderHTML(){
    if(!globalThis.game?.user?.isGM)
      throw Error("Only a GM can open Atlas Layers.");
    let current,invalid=null;
    try{current=this.controller.read();}
    catch(error){invalid=error;current={...DEFAULT_ATLAS_LAYERS};}
    const root=element("div",undefined,"atlas-layers-palette");
    if(invalid){
      root.appendChild(element("p",invalid.message??"These display preferences are invalid.",
        "atlas-layers-error"));
      const reset=element("button","Reset display preferences to defaults");
      reset.type="button";
      reset.addEventListener("click",async()=>{
        try{await this.controller.reset();await this.render(true);}
        catch(error){globalThis.ui?.notifications?.error?.(error.message??String(error));}
      });
      root.appendChild(reset);
      return root;
    }
    root.appendChild(element("p","Choose what appears on your map. Preferences are " +
      "saved for this client; no native Region or Road data is changed.","atlas-layers-note"));
    const change=patch=>{
      // Sequence preference writes so rapid toggles never overwrite each other
      // with stale settings snapshots or silently drop a selected choice.
      this.updates=this.updates.then(()=>this.controller.update(patch)).catch(async error=>{
        globalThis.ui?.notifications?.error?.(error.message??String(error));
        await this.render(true);
      });
      return this.updates;
    };
    const group=(title,description)=>{
      const fieldset=element("fieldset");
      fieldset.appendChild(element("legend",title));
      fieldset.appendChild(element("p",description,"atlas-layers-help"));
      root.appendChild(fieldset);
      return fieldset;
    };
    const roads=group("Roads","Choose authored Road colors, the terrain sampled " +
      "under Roads, or native generated corridor boundaries.");
    for(const [mode,title] of Object.entries(ROAD_LAYER_MODES)){
      const label=element("label",undefined,"atlas-layers-choice");
      const input=element("input");
      input.type="radio";input.name="atlas-road-layer-mode";input.value=mode;
      input.checked=current.roadMode===mode;
      input.addEventListener("change",()=>{if(input.checked)void change({roadMode:mode});});
      label.append(input,element("span",title));roads.appendChild(label);
    }
    const regions=group("Regions","GM-only outlines and optional translucent fills. " +
      "Native Region Shapes, geometry and Behaviors stay authoritative.");
    for(const [mode,title] of Object.entries(REGION_LAYER_MODES)){
      const label=element("label",undefined,"atlas-layers-choice");
      const input=element("input");
      input.type="radio";input.name="atlas-region-layer-mode";input.value=mode;
      input.checked=current.regionMode===mode;
      input.addEventListener("change",()=>{if(input.checked)void change({regionMode:mode});});
      label.append(input,element("span",title));regions.appendChild(label);
    }
    const names=element("label",undefined,"atlas-layers-choice atlas-layers-names");
    const nameToggle=element("input");
    nameToggle.type="checkbox";nameToggle.checked=current.showRegionNames;
    nameToggle.setAttribute("aria-label","Show Region names");
    nameToggle.addEventListener("change",()=>void change({showRegionNames:nameToggle.checked}));
    names.append(nameToggle,element("span","Show Region names"));regions.appendChild(names);
    for(const [key,title] of [["continentFillOpacity","Continent fill"],
      ["settlementFillOpacity","Settlement fill"]]){
      const label=element("label",undefined,"atlas-layers-opacity");
      const value=element("output",`${Math.round(current[key]*100)}%`);
      const slider=element("input");slider.type="range";slider.min="0";
      slider.max="50";slider.step="1";slider.value=String(Math.round(current[key]*100));
      slider.setAttribute("aria-label",title+" opacity");
      slider.addEventListener("input",()=>{value.textContent=`${slider.value}%`;});
      slider.addEventListener("change",()=>void change({[key]:Number(slider.value)/100}));
      label.append(element("span",title),slider,value);regions.appendChild(label);
    }
    return root;
  }

  _replaceHTML(result,content){content.replaceChildren(result);}
}

/** One controller per client; reuses the already-authoritative RoadCanvas. */
export class AtlasLayersController {
  constructor(roadCanvas){
    this.roadCanvas=roadCanvas;
    this.regions=new TerritoryViewOverlay();
    this.corridors=new TerritoryViewOverlay();
    this.window=null;
  }

  register(){
    game.settings.register(MODULE_ID,ATLAS_LAYERS_SETTING,{
      name:"Atlas Layers display preferences",scope:"client",config:false,
      type:Object,default:{...DEFAULT_ATLAS_LAYERS},
      onChange:value=>this.refresh(value)
    });
    const sync=()=>this.refresh();
    Hooks.on("canvasReady",sync);
    Hooks.on("canvasTearDown",()=>this.clear());
    Hooks.on("canvasPan",()=>{
      this.regions.updateLabelScale();this.corridors.updateLabelScale();
    });
    Hooks.on("updateUser",user=>{
      if(user?.id===game.user?.id)this.refresh();
    });
    Hooks.on("updateScene",(scene,changes)=>{
      if(scene?.id===globalThis.canvas?.scene?.id&&
          ["width","height","padding","grid","background"].some(key=>
            Object.hasOwn(changes??{},key)))this.refresh();
    });
    for(const event of ["createRegion","updateRegion","deleteRegion"])
      Hooks.on(event,region=>{
        if(region?.parent?.id===globalThis.canvas?.scene?.id)this.refresh();
      });
  }

  read(){
    return validateAtlasLayers(game.settings.get(MODULE_ID,ATLAS_LAYERS_SETTING));
  }

  async update(patch){
    if(!game.user?.isGM)throw Error("Only a GM may change Atlas Layers.");
    const next=updateAtlasLayers(this.read(),patch);
    await game.settings.set(MODULE_ID,ATLAS_LAYERS_SETTING,next);
    return next;
  }

  /** Invalid/obsolete client data is replaced only after a deliberate GM click. */
  async reset(){
    if(!game.user?.isGM)throw Error("Only a GM may reset Atlas Layers.");
    await game.settings.set(MODULE_ID,ATLAS_LAYERS_SETTING,{...DEFAULT_ATLAS_LAYERS});
  }

  clear(){this.regions.clear();this.corridors.clear();}

  refresh(preferences=null){
    this.clear();
    if(!game.user?.isGM)return;
    let settings;
    try{settings=validateAtlasLayers(preferences??this.read());}
    catch(error){console.warn("Atlas Layers settings could not be read",error);return;}
    this.roadCanvas.setViewMode(settings.roadMode);
    const scene=globalThis.canvas?.scene;
    if(!globalThis.canvas?.ready||!scene)return;
    try{
      if(settings.roadMode==="corridors"){
        const entries=listGeneratedRegions(scene).filter(entry=>
          !entry.invalid&&entry.metadata?.kind==="corridor")
          .map(entry=>({id:entry.id,name:entry.name,linked:true,invalid:false,
            geography:{kind:"area"}}));
        this.corridors.sync(scene,entries,{mode:"continents",continentFillOpacity:.28});
      }
      if(settings.regionMode!=="off")
        this.regions.sync(scene,listSceneGeography(scene),{
          mode:settings.regionMode,showNames:settings.showRegionNames,
          continentFillOpacity:settings.continentFillOpacity,
          settlementFillOpacity:settings.settlementFillOpacity
        });
    }catch(error){this.clear();console.warn("Atlas Layers preview failed",error);}
  }

  async open(){
    if(!game.user?.isGM)throw Error("Only a GM can open Atlas Layers.");
    if(!this.window)this.window=new AtlasLayersWindow(this);
    return this.window.render(true);
  }
}
