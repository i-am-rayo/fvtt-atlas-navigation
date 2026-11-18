import { MODULE_ID } from "./atlas-storage.js";
import { resolveAtlasMeasuringUnits } from "./navigation-measure-units.js";
import { CHECKPOINT_TYPE_GROUPS,CHECKPOINT_TYPES } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING,upsertCheckpointPreset,
  checkpointPresetAppearance } from "./checkpoint-preset-model.js";
import { readWorldCheckpointPresets } from "./checkpoint-preset-store.js";
import { createTravelPresetSelect,createSettingsIconButton } from "./settings-controls.js";
import { createSettingsSelect,createSettingsGroupedSelect } from "./settings-select.js";
import { approveSettingsClose,trackSettingsChanges } from "./settings-close-guard.js";
import { createCheckpointIconPicker,createCheckpointIconGlyph } from "./checkpoint-icon-control.js";
import { createCheckpointTransportationEditor } from "./checkpoint-transportation-editor.js";
import { createCheckpointChoice,createCheckpointNumber,createCheckpointRange,
  createCheckpointRegionWidth,createCheckpointMarkerSize,createCheckpointColor,
  createCheckpointCheckbox,createCheckpointElevation }
  from "./checkpoint-form-controls.js";
import { appendSettingsField } from "./settings-layout.js";
import { resolveCheckpointAppearance,validateCheckpointAppearance,
  withCheckpointBanner,resolveCheckpointBanner }
  from "./checkpoint-appearance.js";
import { CHECKPOINT_MARKER_TYPES,CHECKPOINT_LABEL_MODES,
  CHECKPOINT_DISCOVERY_STATES,CHECKPOINT_DISCOVERY_METHODS }
  from "./checkpoint-field-definitions.js";

const el=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};

/** Full World template form. No Scene/Region/Journal write occurs here. */
export class AtlasCheckpointPresetEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:"fvtt-atlas-checkpoint-preset-editor",
    window:{title:"Atlas — Edit Map Marker Preset",resizable:true},
    position:{width:720,height:740,left:24}};

  constructor({preset=null,onSaved}){
    super({position:{left:24,width:Math.min(720,window.innerWidth-60),
      height:Math.min(740,window.innerHeight-65)}});
    this.preset=preset;this.onSaved=onSaved;this.activeTab="General";
  }

  async close(options){
    if(!this._skipClosePrompt){
      if(this._checkingClose)return this;
      this._checkingClose=true;
      try{
        const approved=await approveSettingsClose({isDirty:this._isDirty,
          save:this._saveDraft,title:"Map Marker Preset"});
        if(!approved||this._skipClosePrompt)return this;
      }finally{this._checkingClose=false;}
    }
    return super.close(options);
  }

  async _renderHTML(){
    if(!game.user?.isGM)throw Error("Only a GM can edit World Map Marker presets.");
    const preset=this.preset;
    const appearance=resolveCheckpointAppearance(preset?.appearance);
    const root=el("div");
    root.className="atlas-marker-preset-editor";
    root.style.cssText="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;";
    const body=el("div");
    body.className="atlas-marker-preset-body";
    const tabs=el("nav");
    tabs.className="atlas-marker-preset-tabs";
    tabs.style.cssText="display:flex;gap:.35rem;flex-wrap:wrap;";
    tabs.setAttribute("role","tablist");
    tabs.setAttribute("aria-label","Map Marker preset sections");
    const sections=new Map(),buttons=new Map();
    for(const name of ["General","Customization","Terrain Region","Transportation"]){
      const button=el("button",name);button.type="button";
      button.style.cssText="flex:1 1 9rem;min-height:2.25rem;";
      button.setAttribute("role","tab");
      const panel=el("section");panel.style.cssText="display:grid;gap:.6rem;align-content:start;";
      panel.setAttribute("role","tabpanel");
      panel.setAttribute("aria-label",name);
      tabs.appendChild(button);sections.set(name,panel);buttons.set(name,button);
      button.addEventListener("click",()=>{this.activeTab=name;showTab();});
    }
    const showTab=()=>{
      for(const [name,panel] of sections){
        panel.hidden=name!==this.activeTab;
        const selected=name===this.activeTab;
        buttons.get(name).setAttribute("aria-selected",String(selected));
        buttons.get(name).tabIndex=selected?0:-1;
        buttons.get(name).style.background=selected?"var(--color-bg-option,#2c2540)":"";
      }
    };
    tabs.addEventListener("keydown",event=>{
      const names=[...buttons.keys()];
      const index=names.findIndex(name=>buttons.get(name)===event.target);
      if(index<0)return;
      const next=event.key==="ArrowRight"?(index+1)%names.length:
        event.key==="ArrowLeft"?(index+names.length-1)%names.length:
        event.key==="Home"?0:event.key==="End"?names.length-1:-1;
      if(next<0)return;
      event.preventDefault();
      this.activeTab=names[next];showTab();
      buttons.get(this.activeTab).focus();
    });
    body.appendChild(tabs);
    const field=(panel,label,control)=>appendSettingsField(panel,label,control,{variant:"grid"});
    const input=(value,type="text")=>{
      const n=el("input");n.type=type;n.value=String(value??"");return n;
    };
    const choose=(choices,value)=>createSettingsSelect(choices,{selectedId:value});
    const general=sections.get("General");
    general.appendChild(el("p","Reusable defaults for Map Markers. Names, map coordinates and discovery history remain independent until the GM explicitly applies this preset."));
    const name=field(general,"Preset name",input(preset?.name??""));name.maxLength=120;name.required=true;
    const category=createSettingsGroupedSelect(CHECKPOINT_TYPE_GROUPS.map(
      ([heading,types])=>({label:heading,options:types})),
      {selectedId:preset?.category??"custom"});
    field(general,"Map Marker type",category);
    const imperial=resolveAtlasMeasuringUnits()==="imperial";
    const elevationControl=createCheckpointElevation(preset?.elevationMeters??null,{imperial});
    field(general,imperial?"Default elevation (ft)":"Default elevation (m)",elevationControl.element);
    const elevation=elevationControl.number;
    elevation.placeholder="No elevation override";
    const discovery=field(general,"Default discovery status",createCheckpointChoice(
      CHECKPOINT_DISCOVERY_STATES,preset?.discoveryStatus??"unknown"));
    const discoveryMethod=field(general,"Discovery method",createCheckpointChoice(
      CHECKPOINT_DISCOVERY_METHODS,preset?.discoveryMethod??"automatic"));
    const revealControl=createCheckpointRange(preset?.revealRadiusCells??3,
      {min:0,max:100,step:.25,label:"Map Marker terrain reveal radius in grid cells"});
    field(general,"Reveal radius (cells)",revealControl.element);
    const reveal=revealControl.number;
    const journal=field(general,"Default linked Journal / Page UUID",input(preset?.journalUuid??""));
    journal.placeholder="Optional; copied only when this preset is applied";
    general.appendChild(el("small","Journal links follow Foundry's native permissions. Leave empty if each Map Marker should link to a different entry."));
    const playerVisible=field(general,"Show to players by default",
      createCheckpointCheckbox(preset?.playerVisible===true));
    general.appendChild(el("small","Visibility is still controlled by Atlas discovery and native Foundry permissions. A preset never reveals existing Map Markers retroactively."));

    const marker=sections.get("Customization");
    const markerSettings=el("fieldset");
    markerSettings.className="atlas-checkpoint-customization-section";
    markerSettings.appendChild(el("legend","Map Marker settings"));
    const bannerSettings=el("fieldset");
    bannerSettings.className="atlas-checkpoint-customization-section";
    bannerSettings.appendChild(el("legend","Banner information"));
    const markerType=createCheckpointChoice(CHECKPOINT_MARKER_TYPES,appearance.type);
    markerType.id="atlas-marker-preset-icon-type";
    markerType.setAttribute("aria-label","Map Marker icon type");
    const markerSize=createCheckpointMarkerSize(appearance.size);
    field(markerSettings,"Marker size (12–64 px)",markerSize.element);
    const size=markerSize.input;
    const color=field(markerSettings,"Map Marker color",createCheckpointColor(appearance.color));
    const borderEnabled=field(markerSettings,"Map Marker border",
      createCheckpointCheckbox(appearance.borderEnabled!==false));
    const border=field(markerSettings,"Map Marker border color",createCheckpointColor(appearance.borderColor));
    const borderRow=el("div");
    borderRow.className="atlas-checkpoint-border-inline";
    borderRow.append(borderEnabled.closest("label"),border.closest("label"));
    markerSettings.appendChild(borderRow);
    const bannerColors=el("div");
    bannerColors.className="atlas-marker-preset-banner-colors";
    bannerSettings.appendChild(bannerColors);
    const labelMode=field(bannerColors,"Banner display",
      createCheckpointChoice(CHECKPOINT_LABEL_MODES,appearance.labelMode));
    const textColor=field(bannerColors,"Banner text color",
      createCheckpointColor(appearance.textColor));
    const roadName=field(bannerSettings,"Include Road name in banner",
      createCheckpointCheckbox(appearance.showRoadName));
    const banner=resolveCheckpointBanner(appearance);
    const bannerType=field(bannerSettings,"Include Map Marker type in banner",
      createCheckpointCheckbox(banner.showType));
    const bannerElevation=field(bannerSettings,"Include elevation in banner",
      createCheckpointCheckbox(banner.showElevation));
    bannerSettings.appendChild(el("small",
      "Scene-specific Territory selection is configured on each placed Map Marker. "+
      "A reusable World preset never stores native Region IDs."));
    const imagePath=input(appearance.image);
    imagePath.placeholder="worlds/…/checkpoint.webp";
    const imageRow=el("div");imageRow.style.cssText="display:flex;gap:.3rem;";
    imagePath.style.flex="1";
    const browse=el("button","Browse…");browse.type="button";
    browse.addEventListener("click",()=>{
      const Picker=foundry.applications.apps?.FilePicker;
      if(!Picker){ui.notifications.error("Foundry File Picker is unavailable.");return;}
      new Picker({type:"image",callback:path=>{imagePath.value=path;refreshPreview();}}).render(true);
    });
    imageRow.append(imagePath,browse);field(markerSettings,"Custom image path",imageRow);

    let iconId=appearance.icon;
    let refreshPreview=()=>{};
    const iconPicker=createCheckpointIconPicker({selectedId:iconId,compact:true,
      onChange:id=>{iconId=id;refreshPreview();}});
    const iconSection=iconPicker.element;
    iconSection.className+=" atlas-checkpoint-icon-selector";
    const iconRow=el("div");
    iconRow.className="atlas-checkpoint-marker-row";
    const caption=el("label","Map Marker icon");
    caption.htmlFor=markerType.id;
    const iconControls=el("div");
    iconControls.className="atlas-checkpoint-marker-controls";
    iconControls.append(iconSection,markerType);
    iconRow.append(caption,iconControls);
    markerSettings.insertBefore(iconRow,markerSettings.children[1]??null);
    const updateMarker=()=>{
      iconSection.hidden=markerType.value!=="fa";
      imageRow.closest("label").hidden=markerType.value!=="image";
      refreshPreview();
    };
    markerType.addEventListener("change",updateMarker);
    const restore=el("button","Use recommended type icon & color");restore.type="button";
    restore.title="Replace only the marker icon and its color with the default for this Map Marker type.";
    restore.addEventListener("click",()=>{
      const recommended=checkpointPresetAppearance(category.value);
      if(!recommended){ui.notifications.warn("No built-in icon for this custom Map Marker type.");return;}
      markerType.value="fa";iconId=recommended.icon;iconPicker.value=iconId;
      color.value=recommended.color;updateMarker();
    });
    markerSettings.appendChild(restore);
    const preview=el("fieldset");
    preview.className="atlas-checkpoint-preview";
    preview.appendChild(el("legend","Map preview"));
    const sample=el("div");
    sample.className="atlas-marker-preset-preview-sample";
    sample.tabIndex=0;
    const previewMarker=el("span"),previewBanner=el("span");
    previewBanner.className="atlas-checkpoint-banner-detail";
    sample.append(previewMarker,previewBanner);
    preview.append(sample,el("small",
      "Preview uses sample Map Marker text only; World presets have no Scene position, Road or Territory."));
    const updatePreview=()=>{
      border.disabled=!borderEnabled.checked;
      const isOff=labelMode.value==="off";
      for(const control of [roadName,bannerType,bannerElevation,textColor])control.disabled=isOff;
      const glyph=markerType.value==="fa"?createCheckpointIconGlyph(iconId):
        el(markerType.value==="image"?"img":"span");
      const width=Math.max(12,Math.min(64,Number(size.value)||24));
      glyph.style.width=width+"px";glyph.style.height=width+"px";
      glyph.style.fontSize=width+"px";glyph.style.color=color.value;
      glyph.style.display="inline-grid";glyph.style.placeItems="center";
      glyph.style.boxSizing="border-box";
      glyph.style.filter="";glyph.style.textShadow="";glyph.style.border="none";
      if(markerType.value==="image"){
        try{glyph.src=validateCheckpointAppearance({...appearance,
          type:"image",image:imagePath.value.trim()}).image;}
        catch{/* Invalid draft paths are not loaded into the preview. */}
        glyph.alt="Sample Map Marker";
        if(borderEnabled.checked)glyph.style.filter="drop-shadow(1px 0 "+border.value+")";
      }else if(markerType.value==="dot"){
        glyph.style.borderRadius="50%";
        glyph.style.background=color.value;
        if(borderEnabled.checked)glyph.style.border="2px solid "+border.value;
      }else if(markerType.value==="fa"&&glyph.tagName?.toLowerCase?.()==="img"){
        if(borderEnabled.checked)glyph.style.filter="drop-shadow(1px 0 "+border.value+") "+
          "drop-shadow(-1px 0 "+border.value+")";
      }else if(borderEnabled.checked)
        glyph.style.textShadow="1px 1px "+border.value+",-1px -1px "+border.value;
      previewMarker.replaceChildren(glyph);
      const description=[];
      if(bannerType.checked)description.push(
        CHECKPOINT_TYPES.find(([id])=>id===category.value)?.[1]??category.value);
      if(bannerElevation.checked&&elevation.value!=="")
        description.push("Elevation "+elevation.value+" "+(imperial?"ft":"m"));
      previewBanner.replaceChildren(el("strong",name.value.trim()||"Sample Map Marker"),
        ...(description.length?[el("small",description.join(" · "))]:[]));
      previewBanner.style.color=textColor.value;
      previewBanner.hidden=isOff;
      preview.setAttribute("data-label-mode",labelMode.value);
    };
    refreshPreview=updatePreview;
    marker.addEventListener("input",updatePreview);
    marker.addEventListener("change",updatePreview);
    general.addEventListener("input",updatePreview);
    general.addEventListener("change",updatePreview);
    updateMarker();
    marker.append(markerSettings,bannerSettings,preview);
    updatePreview();

    const terrain=sections.get("Terrain Region");
    terrain.appendChild(el("p","These are suggestions for the native Map Marker Region generator; creating or editing actual Region geometry and Behaviors still requires GM confirmation."));
    const terrainId=createTravelPresetSelect({selectedId:preset?.terrain?.presetId,
      noneLabel:"None — no terrain suggestion"});
    field(terrain,"Suggested travel preset",terrainId);
    const regionRadius=createCheckpointRegionWidth(preset?.terrain?.radiusCells??.25,
      {label:"Suggested Map Marker Region radius in grid cells"});
    field(terrain,"Suggested radius (cells)",regionRadius.element);
    const radius=regionRadius.input;
    const eventKind=field(terrain,"Event classification (future)",choose([
      ["none","None"],["hazard","Environmental hazard"],["encounter","Encounter"]],
      preset?.event?.kind??"none"));
    terrain.appendChild(el("small","No automatic event triggers, random rolls or encounter spawning are enabled by this preset."));

    const transportEditor=createCheckpointTransportationEditor({offers:preset?.transportation??[]});
    sections.get("Transportation").append(transportEditor.element);
    for(const panel of sections.values())body.appendChild(panel);
    const footer=el("div");
    footer.className="atlas-marker-preset-footer";
    const save=createSettingsIconButton({icon:"floppy-disk",label:"Save preset"});
    save.type="button";
    const saveValue=async()=>{
      if(save.disabled)return false;
      save.disabled=true;
      try{
        const style=withCheckpointBanner({
          type:markerType.value,icon:iconId,
          image:imagePath.value.trim(),size:markerSize.getValue(),color:color.value,
          borderColor:border.value,borderEnabled:borderEnabled.checked,
          labelMode:labelMode.value,
          showRoadName:roadName.checked,textColor:textColor.value},{
          showType:bannerType.checked,showElevation:bannerElevation.checked,
          territoryRegionId:null});
        const next={id:preset?.id??("checkpoint-custom-"+foundry.utils.randomID()),
          name:name.value.trim(),category:category.value,appearance:style,
          elevationMeters:elevationControl.getMeters(),
          discoveryStatus:discovery.value,discoveryMethod:discoveryMethod.value,
          revealRadiusCells:revealControl.getValue(),journalUuid:journal.value.trim()||null,
          playerVisible:playerVisible.checked,
          terrain:{presetId:terrainId.value||null,radiusCells:regionRadius.getValue()},
          transportation:transportEditor.getOffers(),
          event:{kind:eventKind.value,enabled:false}};
        await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,
          upsertCheckpointPreset(readWorldCheckpointPresets(),next));
        this._skipClosePrompt=true;
        await this.close();await this.onSaved?.();
        ui.notifications.info("Map Marker preset saved. Existing Map Markers remain unchanged.");
        return true;
      }catch(error){ui.notifications.error(error.message??String(error));return false;}
      finally{save.disabled=false;}
    };
    save.addEventListener("click",()=>void saveValue());
    footer.append(save);root.append(body,footer);showTab();
    this._saveDraft=saveValue;
    this._isDirty=trackSettingsChanges(root,()=>({iconId}));
    return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
}
