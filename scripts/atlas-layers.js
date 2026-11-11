/** Persistent, client-local map presentation. Never writes Scene/Region documents. */
import {MODULE_ID,readAtlas} from "./atlas-storage.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {listPlayerTerritories} from "./player-territory-sharing.js";
import {playerAtlasOverlay} from "./player-overlay-model.js";
import {readPartyExploration} from "./party-exploration-storage.js";
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
    position:{width:430,height:620,left:110,top:105}
  };

  constructor(controller){
    super();this.controller=controller;this.updates=Promise.resolve();
  }

  async _renderHTML(){
    if(!globalThis.game?.user)throw Error("Sign in to view Atlas Layers.");
    const gm=game.user.isGM===true;
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
      "saved for this client; no native Region or Road data is changed."+
      (gm?"":" Only Territories explicitly shared by the GM can be displayed."),
      "atlas-layers-note"));
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
    if(gm){
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
    }else{
      group("Roads","The GM controls which Roads and Checkpoints are revealed. " +
        "Their display remains unchanged by Territory settings.");
    }
    const regions=group("Regions",gm?
      "GM outlines and optional translucent fills. Native Region Shapes and Behaviors stay authoritative.":
      "Choose how to display GM-shared boundaries. Names appear only when " +
      "the GM also publishes a public Territory name. Native Regions are unchanged.");
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
    this.configureRegion=null;
  }

  /** A shortcut to Foundry's authoritative Region Appearance sheet. */
  listColorRegions(){
    const scene=globalThis.canvas?.scene;
    if(!game.user?.isGM||!scene)return [];
    return listSceneGeography(scene).filter(entry=>entry.linked&&!entry.invalid&&
      entry.geography).map(entry=>({id:entry.id,name:entry.name,
      color:scene.regions?.get?.(entry.id)?.color??null}));
  }

  async configureColorRegion(regionId){
    const scene=globalThis.canvas?.scene,region=scene?.regions?.get?.(regionId);
    if(!game.user?.isGM||!scene?.canUserModify?.(game.user,"update")||
        !region||region.parent?.id!==scene.id||
        !region.canUserModify?.(game.user,"update")||
        !this.listColorRegions().some(entry=>entry.id===regionId)||
        typeof this.configureRegion!=="function")
      throw Error("Only an authorized GM may configure this native Region color.");
    return this.configureRegion(scene,regionId);
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
          (["width","height","padding","grid","background"].some(key=>
            Object.hasOwn(changes??{},key))||
            Object.hasOwn(changes?.flags?.[MODULE_ID]??{},"atlas")||
            Object.hasOwn(changes??{},`flags.${MODULE_ID}.atlas`)))this.refresh();
    });
    for(const event of ["createRegion","updateRegion","deleteRegion"])
      Hooks.on(event,region=>{
        if(region?.parent?.id!==globalThis.canvas?.scene?.id)return;
        this.refresh();
        if(this.window?.rendered)
          void Promise.resolve(this.window.render(true)).catch(error=>
            console.warn("Atlas Layers palette native Region refresh failed",error));
      });
  }

  read(){
    return validateAtlasLayers(game.settings.get(MODULE_ID,ATLAS_LAYERS_SETTING));
  }

  async update(patch){
    if(!game.user)throw Error("Sign in before changing Atlas Layers.");
    const next=updateAtlasLayers(this.read(),patch);
    await game.settings.set(MODULE_ID,ATLAS_LAYERS_SETTING,next);
    return next;
  }

  /** Invalid/obsolete client data is replaced only after a deliberate GM click. */
  async reset(){
    if(!game.user)throw Error("Sign in before resetting Atlas Layers.");
    await game.settings.set(MODULE_ID,ATLAS_LAYERS_SETTING,{...DEFAULT_ATLAS_LAYERS});
  }

  clear({resetCheckpointLabels=true,redraw=false}={}){
    this.regions.clear();this.corridors.clear();
    if(resetCheckpointLabels)
      this.roadCanvas.setTerritoryLabelCheckpointIds(new Set(),{redraw});
  }

  refresh(preferences=null){
    this.clear({resetCheckpointLabels:false});
    const gm=game.user?.isGM===true;
    let settings;
    try{settings=validateAtlasLayers(preferences??this.read());}
    catch(error){
      this.roadCanvas.setTerritoryLabelCheckpointIds(new Set());
      console.warn("Atlas Layers settings could not be read",error);return;
    }
    if(gm)this.roadCanvas.setViewMode(settings.roadMode);
    const scene=globalThis.canvas?.scene;
    if(!globalThis.canvas?.ready||!scene){
      this.roadCanvas.setTerritoryLabelCheckpointIds(new Set());return;
    }
    try{
      if(gm&&settings.roadMode==="corridors"){
        const entries=listGeneratedRegions(scene).filter(entry=>
          !entry.invalid&&entry.metadata?.kind==="corridor")
          .map(entry=>({id:entry.id,name:entry.name,linked:true,invalid:false,
            geography:{kind:"area"}}));
        this.corridors.sync(scene,entries,{mode:"continents",continentFillOpacity:.28});
      }
      if(settings.regionMode!=="off"){
        const atlas=readAtlas(scene);
        const entries=gm?listSceneGeography(scene):listPlayerTerritories(scene);
        const checkpoints=gm?atlas.checkpoints??[]:
          playerAtlasOverlay(atlas,readPartyExploration(scene)).checkpoints;
        this.regions.sync(scene,entries,{
          mode:settings.regionMode,showNames:settings.showRegionNames,
          continentFillOpacity:settings.continentFillOpacity,
          settlementFillOpacity:settings.settlementFillOpacity,
          checkpointsById:new Map(checkpoints
            .map(checkpoint=>[checkpoint.id,checkpoint]))
        });
      }
      this.roadCanvas.setTerritoryLabelCheckpointIds(this.regions.labelCheckpointIds);
    }catch(error){this.clear({redraw:true});console.warn("Atlas Layers preview failed",error);}
  }

  async open(){
    if(!game.user)throw Error("Sign in before opening Atlas Layers.");
    if(!this.window)this.window=new AtlasLayersWindow(this);
    return this.window.render(true);
  }
}
