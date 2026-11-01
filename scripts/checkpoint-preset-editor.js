import { MODULE_ID } from "./atlas-storage.js";
import { CHECKPOINT_TYPE_GROUPS } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING,upsertCheckpointPreset,
  checkpointPresetAppearance } from "./checkpoint-preset-model.js";
import { readWorldCheckpointPresets } from "./checkpoint-preset-settings.js";
import { createTravelPresetSelect } from "./settings-controls.js";
import { createCheckpointIconPicker } from "./checkpoint-icon-control.js";
import { resolveCheckpointAppearance,validateCheckpointAppearance }
  from "./checkpoint-appearance.js";
import { CHECKPOINT_MARKER_TYPES,CHECKPOINT_LABEL_MODES,
  CHECKPOINT_DISCOVERY_STATES,CHECKPOINT_DISCOVERY_METHODS,CHECKPOINT_REGION_RADIUS }
  from "./checkpoint-field-definitions.js";

const el=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};

/** Full World template form. No Scene/Region/Journal write occurs here. */
export class AtlasCheckpointPresetEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:"fvtt-atlas-checkpoint-preset-editor",
    window:{title:"Atlas — Edit Checkpoint Preset",resizable:true},
    position:{width:720,height:740}};

  constructor({preset=null,onSaved}){
    super({position:{width:Math.min(720,window.innerWidth-60),
      height:Math.min(740,window.innerHeight-65)}});
    this.preset=preset;this.onSaved=onSaved;this.activeTab="General";
  }

  async _renderHTML(){
    if(!game.user?.isGM)throw Error("Only a GM can edit World checkpoint presets.");
    const preset=this.preset;
    const appearance=resolveCheckpointAppearance(preset?.appearance);
    const root=el("div");
    root.style.cssText="padding:.8rem 1rem;display:flex;flex-direction:column;gap:.75rem;height:100%;overflow:auto;box-sizing:border-box;";
    const tabs=el("div");tabs.style.cssText="display:flex;gap:.35rem;flex-wrap:wrap;";
    const sections=new Map(),buttons=new Map();
    for(const name of ["General","Marker & labels","Terrain Region"]){
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
    const field=(panel,label,control)=>{
      const row=el("label");
      row.style.cssText="display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,1.4fr);gap:.6rem;align-items:center;";
      row.append(el("span",label),control);panel.appendChild(row);return control;
    };
    const input=(value,type="text")=>{
      const n=el("input");n.type=type;n.value=String(value??"");return n;
    };
    const choose=(choices,value)=>{
      const n=el("select");
      for(const [key,title] of choices){const option=el("option",title);option.value=key;n.appendChild(option);}
      n.value=value;return n;
    };
    const general=sections.get("General");
    general.appendChild(el("p","Reusable defaults for checkpoints. Names, map coordinates and discovery history remain independent until the GM explicitly applies this preset."));
    const name=field(general,"Preset name",input(preset?.name??""));name.maxLength=120;name.required=true;
    const category=el("select");
    for(const [heading,types] of CHECKPOINT_TYPE_GROUPS){
      const group=el("optgroup");group.label=heading;
      for(const [key,title] of types){const option=el("option",title);option.value=key;group.appendChild(option);}
      category.appendChild(group);
    }
    category.value=preset?.category??"custom";
    field(general,"Checkpoint type",category);
    const elevation=field(general,"Default elevation (m)",input(preset?.elevationMeters??"","number"));
    elevation.step="any";elevation.placeholder="No elevation override";
    const discovery=field(general,"Default discovery status",choose(
      CHECKPOINT_DISCOVERY_STATES,preset?.discoveryStatus??"unknown"));
    const discoveryMethod=field(general,"Discovery method",choose(
      CHECKPOINT_DISCOVERY_METHODS,preset?.discoveryMethod??"automatic"));
    const reveal=field(general,"Reveal radius (cells)",input(preset?.revealRadiusCells??3,"number"));
    reveal.min="0";reveal.max="100";reveal.step="0.25";
    const journal=field(general,"Default linked Journal / Page UUID",input(preset?.journalUuid??""));
    journal.placeholder="Optional; copied only when this preset is applied";
    general.appendChild(el("small","Journal links follow Foundry's native permissions. Leave empty if each checkpoint should link to a different entry."));
    const playerVisible=field(general,"Show to players by default",el("input"));
    playerVisible.type="checkbox";playerVisible.checked=preset?.playerVisible===true;
    general.appendChild(el("small","Visibility is still controlled by Atlas discovery and native Foundry permissions. A preset never reveals existing checkpoints retroactively."));

    const marker=sections.get("Marker & labels");
    const markerType=field(marker,"Checkpoint marker",choose(CHECKPOINT_MARKER_TYPES,
      appearance.type));
    const size=field(marker,"Marker size (12–64 px)",input(appearance.size,"number"));
    size.min="12";size.max="64";size.step="1";
    const color=field(marker,"Dot / icon color",input(appearance.color,"color"));
    const border=field(marker,"Checkpoint border color",input(appearance.borderColor,"color"));
    const labelMode=field(marker,"Checkpoint label",choose(CHECKPOINT_LABEL_MODES,
      appearance.labelMode));
    const roadName=field(marker,"Include road name",el("input"));
    roadName.type="checkbox";roadName.checked=appearance.showRoadName;
    const textColor=field(marker,"Label text color",input(appearance.textColor,"color"));
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
    const radius=field(terrain,"Suggested radius (cells)",input(preset?.terrain?.radiusCells??.25,"number"));
    radius.min=String(CHECKPOINT_REGION_RADIUS.min);
    radius.max=String(CHECKPOINT_REGION_RADIUS.max);
    radius.step=String(CHECKPOINT_REGION_RADIUS.step);
    const eventKind=field(terrain,"Event classification (future)",choose([
      ["none","None"],["hazard","Environmental hazard"],["encounter","Encounter"]],
      preset?.event?.kind??"none"));
    terrain.appendChild(el("small","No automatic event triggers, random rolls or encounter spawning are enabled by this preset."));

    for(const panel of sections.values())root.appendChild(panel);
    const footer=el("div");
    footer.style.cssText="display:flex;justify-content:flex-end;gap:.5rem;position:sticky;bottom:0;background:#100f17;padding:.5rem 0;";
    const cancel=el("button","Cancel");cancel.type="button";
    cancel.addEventListener("click",()=>this.close());
    const save=el("button","Save Checkpoint Preset");save.type="button";
    save.addEventListener("click",async()=>{
      if(save.disabled)return;
      save.disabled=true;
      try{
        const style=validateCheckpointAppearance({type:markerType.value,icon:iconId,
          image:imagePath.value.trim(),size:Number(size.value),color:color.value,
          borderColor:border.value,labelMode:labelMode.value,
          showRoadName:roadName.checked,textColor:textColor.value});
        const next={id:preset?.id??("checkpoint-custom-"+foundry.utils.randomID()),
          name:name.value.trim(),category:category.value,appearance:style,
          elevationMeters:elevation.value.trim()===""?null:Number(elevation.value),
          discoveryStatus:discovery.value,discoveryMethod:discoveryMethod.value,
          revealRadiusCells:Number(reveal.value),journalUuid:journal.value.trim()||null,
          playerVisible:playerVisible.checked,
          terrain:{presetId:terrainId.value||null,radiusCells:Number(radius.value)},
          event:{kind:eventKind.value,enabled:false}};
        await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,
          upsertCheckpointPreset(readWorldCheckpointPresets(),next));
        await this.close();await this.onSaved?.();
        ui.notifications.info("Checkpoint preset saved. Existing checkpoints remain unchanged.");
      }catch(error){ui.notifications.error(error.message??String(error));}
      finally{save.disabled=false;}
    });
    footer.append(cancel,save);root.appendChild(footer);showTab();
    return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
}
