import { MODULE_ID } from "./atlas-storage.js";
import { resolveAtlasMeasuringUnits } from "./navigation-measure-units.js";
import { CHECKPOINT_TYPE_GROUPS } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING,upsertCheckpointPreset,
  checkpointPresetAppearance } from "./checkpoint-preset-model.js";
import { readWorldCheckpointPresets } from "./checkpoint-preset-store.js";
import { createTravelPresetSelect,createSettingsIconButton } from "./settings-controls.js";
import { createSettingsSelect,createSettingsGroupedSelect } from "./settings-select.js";
import { approveSettingsClose,trackSettingsChanges } from "./settings-close-guard.js";
import { createCheckpointIconPicker } from "./checkpoint-icon-control.js";
import { createCheckpointTransportationEditor } from "./checkpoint-transportation-editor.js";
import { createCheckpointChoice,createCheckpointNumber,createCheckpointRange,
  createCheckpointRegionWidth,createCheckpointMarkerSize,createCheckpointColor,
  createCheckpointCheckbox,createCheckpointElevation }
  from "./checkpoint-form-controls.js";
import { appendSettingsField } from "./settings-layout.js";
import { resolveCheckpointAppearance,validateCheckpointAppearance }
  from "./checkpoint-appearance.js";
import { CHECKPOINT_MARKER_TYPES,CHECKPOINT_LABEL_MODES,
  CHECKPOINT_DISCOVERY_STATES,CHECKPOINT_DISCOVERY_METHODS }
  from "./checkpoint-field-definitions.js";

const el=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};

/** Full World template form. No Scene/Region/Journal write occurs here. */
export class AtlasCheckpointPresetEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:"fvtt-atlas-checkpoint-preset-editor",
    window:{title:"Atlas — Edit Checkpoint Preset",resizable:true},
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
          save:this._saveDraft,title:"Checkpoint Preset"});
        if(!approved||this._skipClosePrompt)return this;
      }finally{this._checkingClose=false;}
    }
    return super.close(options);
  }

  async _renderHTML(){
    if(!game.user?.isGM)throw Error("Only a GM can edit World checkpoint presets.");
    const preset=this.preset;
    const appearance=resolveCheckpointAppearance(preset?.appearance);
    const root=el("div");
    root.style.cssText="padding:.8rem 1rem;display:flex;flex-direction:column;gap:.75rem;height:100%;overflow:auto;box-sizing:border-box;";
    const tabs=el("div");tabs.style.cssText="display:flex;gap:.35rem;flex-wrap:wrap;";
    const sections=new Map(),buttons=new Map();
    for(const name of ["General","Marker & labels","Terrain Region","Transportation"]){
      const button=el("button",name);button.type="button";
      button.style.cssText="flex:1 1 9rem;min-height:2.25rem;";
      const panel=el("section");panel.style.cssText="display:grid;gap:.6rem;align-content:start;";
      tabs.appendChild(button);sections.set(name,panel);buttons.set(name,button);
      button.addEventListener("click",()=>{this.activeTab=name;showTab();});
    }
    const showTab=()=>{
      for(const [name,panel] of sections){
        panel.hidden=name!==this.activeTab;
        buttons.get(name).setAttribute("aria-pressed",String(name===this.activeTab));
        buttons.get(name).style.background=name===this.activeTab?"var(--color-bg-option,#2c2540)":"";
      }
    };
    root.appendChild(tabs);
    const field=(panel,label,control)=>appendSettingsField(panel,label,control,{variant:"grid"});
    const input=(value,type="text")=>{
      const n=el("input");n.type=type;n.value=String(value??"");return n;
    };
    const choose=(choices,value)=>createSettingsSelect(choices,{selectedId:value});
    const general=sections.get("General");
    general.appendChild(el("p","Reusable defaults for checkpoints. Names, map coordinates and discovery history remain independent until the GM explicitly applies this preset."));
    const name=field(general,"Preset name",input(preset?.name??""));name.maxLength=120;name.required=true;
    const category=createSettingsGroupedSelect(CHECKPOINT_TYPE_GROUPS.map(
      ([heading,types])=>({label:heading,options:types})),
      {selectedId:preset?.category??"custom"});
    field(general,"Checkpoint type",category);
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
      {min:0,max:100,step:.25,label:"Checkpoint terrain reveal radius in grid cells"});
    field(general,"Reveal radius (cells)",revealControl.element);
    const reveal=revealControl.number;
    const journal=field(general,"Default linked Journal / Page UUID",input(preset?.journalUuid??""));
    journal.placeholder="Optional; copied only when this preset is applied";
    general.appendChild(el("small","Journal links follow Foundry's native permissions. Leave empty if each checkpoint should link to a different entry."));
    const playerVisible=field(general,"Show to players by default",
      createCheckpointCheckbox(preset?.playerVisible===true));
    general.appendChild(el("small","Visibility is still controlled by Atlas discovery and native Foundry permissions. A preset never reveals existing checkpoints retroactively."));

    const marker=sections.get("Marker & labels");
    const markerType=field(marker,"Checkpoint marker",createCheckpointChoice(CHECKPOINT_MARKER_TYPES,
      appearance.type));
    const markerSize=createCheckpointMarkerSize(appearance.size);
    field(marker,"Marker size (12–64 px)",markerSize.element);
    const size=markerSize.input;
    const color=field(marker,"Dot / icon color",createCheckpointColor(appearance.color));
    const border=field(marker,"Checkpoint border color",createCheckpointColor(appearance.borderColor));
    const labelMode=field(marker,"Checkpoint label",createCheckpointChoice(CHECKPOINT_LABEL_MODES,
      appearance.labelMode));
    const roadName=field(marker,"Include road name",createCheckpointCheckbox(appearance.showRoadName));
    const textColor=field(marker,"Label text color",createCheckpointColor(appearance.textColor));
    const imagePath=input(appearance.image);
    imagePath.placeholder="worlds/…/checkpoint.webp";
    const imageRow=el("div");imageRow.style.cssText="display:flex;gap:.3rem;";
    imagePath.style.flex="1";
    const browse=el("button","Browse…");browse.type="button";
    browse.addEventListener("click",()=>{
      const Picker=foundry.applications.apps?.FilePicker;
      if(!Picker){ui.notifications.error("Foundry File Picker is unavailable.");return;}
      new Picker({type:"image",callback:path=>{imagePath.value=path;}}).render(true);
    });
    imageRow.append(imagePath,browse);field(marker,"Custom image path",imageRow);

    let iconId=appearance.icon;
    const iconPicker=createCheckpointIconPicker({selectedId:iconId,
      onChange:id=>{iconId=id;}});
    const iconSection=iconPicker.element;
    // The same shared icon browser appears in Checkpoint Settings and World presets.
    marker.appendChild(markerType.closest("label"));
    marker.appendChild(imageRow.closest("label"));
    marker.appendChild(iconSection);
    const updateMarker=()=>{
      iconSection.hidden=markerType.value!=="fa";
      imageRow.closest("label").hidden=markerType.value!=="image";
    };
    markerType.addEventListener("change",updateMarker);updateMarker();
    const restore=el("button","Use recommended type icon & color");restore.type="button";
    restore.title="Replace only the marker icon and its color with the default for this checkpoint type.";
    restore.addEventListener("click",()=>{
      const recommended=checkpointPresetAppearance(category.value);
      if(!recommended){ui.notifications.warn("No built-in icon for this custom checkpoint type.");return;}
      markerType.value="fa";iconId=recommended.icon;iconPicker.value=iconId;
      color.value=recommended.color;updateMarker();
    });
    marker.appendChild(restore);

    const terrain=sections.get("Terrain Region");
    terrain.appendChild(el("p","These are suggestions for the native checkpoint Region generator; creating or editing actual Region geometry and Behaviors still requires GM confirmation."));
    const terrainId=createTravelPresetSelect({selectedId:preset?.terrain?.presetId,
      noneLabel:"None — no terrain suggestion"});
    field(terrain,"Suggested travel preset",terrainId);
    const regionRadius=createCheckpointRegionWidth(preset?.terrain?.radiusCells??.25,
      {label:"Suggested checkpoint Region radius in grid cells"});
    field(terrain,"Suggested radius (cells)",regionRadius.element);
    const radius=regionRadius.input;
    const eventKind=field(terrain,"Event classification (future)",choose([
      ["none","None"],["hazard","Environmental hazard"],["encounter","Encounter"]],
      preset?.event?.kind??"none"));
    terrain.appendChild(el("small","No automatic event triggers, random rolls or encounter spawning are enabled by this preset."));

    const transportEditor=createCheckpointTransportationEditor({offers:preset?.transportation??[]});
    sections.get("Transportation").append(transportEditor.element);
    for(const panel of sections.values())root.appendChild(panel);
    const footer=el("div");
    footer.style.cssText="display:flex;justify-content:flex-end;gap:.5rem;position:sticky;bottom:0;background:#100f17;padding:.5rem 0;";
    const save=createSettingsIconButton({icon:"floppy-disk",label:"Save preset"});
    save.type="button";
    const saveValue=async()=>{
      if(save.disabled)return false;
      save.disabled=true;
      try{
        const style=validateCheckpointAppearance({type:markerType.value,icon:iconId,
          image:imagePath.value.trim(),size:Number(size.value),color:color.value,
          borderColor:border.value,labelMode:labelMode.value,
          showRoadName:roadName.checked,textColor:textColor.value});
        const next={id:preset?.id??("checkpoint-custom-"+foundry.utils.randomID()),
          name:name.value.trim(),category:category.value,appearance:style,
          elevationMeters:elevationControl.getMeters(),
          discoveryStatus:discovery.value,discoveryMethod:discoveryMethod.value,
          revealRadiusCells:Number(reveal.value),journalUuid:journal.value.trim()||null,
          playerVisible:playerVisible.checked,
          terrain:{presetId:terrainId.value||null,radiusCells:Number(radius.value)},
          transportation:transportEditor.getOffers(),
          event:{kind:eventKind.value,enabled:false}};
        await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,
          upsertCheckpointPreset(readWorldCheckpointPresets(),next));
        this._skipClosePrompt=true;
        await this.close();await this.onSaved?.();
        ui.notifications.info("Checkpoint preset saved. Existing checkpoints remain unchanged.");
        return true;
      }catch(error){ui.notifications.error(error.message??String(error));return false;}
      finally{save.disabled=false;}
    };
    save.addEventListener("click",()=>void saveValue());
    footer.append(save);root.appendChild(footer);showTab();
    this._saveDraft=saveValue;
    this._isDirty=trackSettingsChanges(root,()=>({iconId}));
    return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
}
