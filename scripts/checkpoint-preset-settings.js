/** World-wide GM-owned templates. Never writes Scene checkpoints or native Regions. */
import { MODULE_ID,readAtlas } from "./atlas-storage.js";
import { CHECKPOINT_TYPE_GROUPS, CHECKPOINT_TYPES } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING, defaultCheckpointPresets,
  removeCheckpointPreset }
  from "./checkpoint-preset-model.js";
import { readWorldCheckpointPresets } from "./checkpoint-preset-store.js";
import { resolveCheckpointAppearance }
  from "./checkpoint-appearance.js";
import { createCheckpointIconGlyph } from "./checkpoint-icon-control.js";
import { createSettingsActionButton } from "./settings-controls.js";
import { CHECKPOINT_BULK_FIELDS,buildCheckpointBulkUpdate,
  applyCheckpointPresetBulk } from "./checkpoint-bulk-apply.js";

const node=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};
// Keep the public import stable for existing callers while the data read lives
// outside of the ApplicationV2 module.
export { readWorldCheckpointPresets };
export function registerWorldCheckpointPresets(){
  game.settings.register(MODULE_ID,CHECKPOINT_PRESET_SETTING,{
    name:"Atlas Map Marker Presets",scope:"world",config:false,type:Object,
    default:defaultCheckpointPresets()
  });
  game.settings.registerMenu(MODULE_ID,"checkpointPresetMenu",{
    name:"Atlas — Map Marker Presets",label:"Configure Map Marker Presets",
    hint:"World-wide Map Marker defaults for appearance, discovery and terrain. Changes do not automatically update placed markers.",
    icon:"fa-solid fa-map-location-dot",type:AtlasCheckpointPresetSettings,restricted:true
  });
}

export class AtlasCheckpointPresetSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:"fvtt-atlas-checkpoint-presets",
    window:{title:"Atlas — Map Marker Presets",resizable:true},
    position:{width:740,height:650}};

  async _renderHTML(){
    const catalog=readWorldCheckpointPresets();
    const root=node("div");
    root.style.cssText="padding:1rem;overflow:auto;height:100%;display:grid;gap:.8rem;align-content:start;";
    root.appendChild(node("p","Map Marker Presets provide reusable World defaults for new and existing Map Markers, including appearance, discovery and optional Journal links. Editing these presets never automatically changes placed Map Markers, their positions or native Regions. Events are informational only."));
    for(const [group,types] of CHECKPOINT_TYPE_GROUPS){
      const matches=catalog.presets.filter(p=>types.some(([type])=>type===p.category));
      if(!matches.length)continue;
      const fieldset=node("fieldset");fieldset.style.cssText="min-width:0;display:grid;gap:.3rem;";
      fieldset.appendChild(node("legend",group));
      for(const preset of matches){
        const row=node("div");row.style.cssText="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding:.2rem 0;";
        const appearance=resolveCheckpointAppearance(preset.appearance);
        const symbol=node("span");
        symbol.style.cssText="display:grid;place-items:center;width:1.6rem;height:1.6rem;flex:0 0 1.6rem;color:"+appearance.color+";";
        if(appearance.type==="fa"){
          symbol.appendChild(createCheckpointIconGlyph(appearance.icon));
        }else if(appearance.type==="image"&&appearance.image){
          const image=node("img");image.src=appearance.image;image.alt="";
          image.style.cssText="max-width:1.6rem;max-height:1.6rem;object-fit:contain;";
          symbol.appendChild(image);
        }else{
          symbol.textContent="●";
        }
        symbol.setAttribute("aria-hidden","true");row.appendChild(symbol);
        const typeName=CHECKPOINT_TYPES.find(([id])=>id===preset.category)?.[1]??preset.category;
        const label=node("span",preset.name.toLocaleLowerCase()===typeName.toLocaleLowerCase()
          ?preset.name:preset.name+" · "+typeName);
        label.style.cssText="flex:1 1 12rem;";row.appendChild(label);
        const edit=createSettingsActionButton({icon:"gear",label:"Edit "+preset.name,
          onClick:()=>void this._run(()=>this._edit(preset))});
        const remove=createSettingsActionButton({icon:"trash",label:"Delete "+preset.name,
          onClick:()=>void this._run(()=>this._delete(preset)),danger:true});
        const apply=createSettingsActionButton({icon:"layer-group",
          label:"Apply "+preset.name+" to open Scene",
          onClick:()=>void this._run(()=>this._apply(preset))});
        row.append(edit,apply,remove);fieldset.appendChild(row);
      }
      root.appendChild(fieldset);
    }
    const add=node("button","＋ Add Map Marker Preset");add.type="button";
    add.addEventListener("click",()=>void this._run(()=>this._edit(null)));
    root.appendChild(add);
    return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
  async _run(action){try{await action();}catch(e){ui.notifications.error(e.message??String(e));}}
  async _edit(existing){
    if(!game.user?.isGM)throw Error("GM permission required.");
    const {AtlasCheckpointPresetEditor}=await import("./checkpoint-preset-editor.js");
    new AtlasCheckpointPresetEditor({preset:existing,onSaved:()=>this.render()}).render(true);
  }
  async _apply(preset){
    if(!game.user?.isGM)throw Error("GM permission required.");
    const scene=globalThis.canvas?.scene;
    if(!scene?.canUserModify?.(game.user,"update"))
      throw Error("Open an editable Scene canvas first.");
    // Foundry v14 DialogV2.input requires a plain outer DIV without attributes.
    const shell=node("div");
    const root=node("div");
    root.style.cssText="display:grid;gap:.55rem;max-height:65vh;overflow:auto;";
    shell.append(root);
    const warning=node("p","WARNING: This changes selected fields on EXISTING Map Markers in the open Scene. You cannot undo this as one operation. Coordinates, names, visited/lore discovery history, Roads and native Regions are preserved.");
    warning.style.cssText="color:#e6ad6e;font-weight:700;";root.append(warning);
    root.append(node("strong","Preset: "+preset.name+" · Scene: "+scene.name));
    const target=node("select");target.name="scope";
    for(const [id,label] of [["category","Only Map Markers of the same type"],
      ["assigned","Only Map Markers assigned this preset"],
      ["all","ALL Map Markers in the open Scene (use caution)"]]){
      const item=node("option",label);item.value=id;target.append(item);
    }
    const scopeLabel=node("label","Apply to");scopeLabel.append(target);root.append(scopeLabel);
    root.append(node("strong","Choose precisely which fields to overwrite:"));
    for(const [id,label] of CHECKPOINT_BULK_FIELDS){
      const line=node("label");line.style.cssText="display:flex;gap:.5rem;align-items:center;";
      const input=node("input");input.type="checkbox";input.name="field_"+id;
      line.append(input,node("span",label));root.append(line);
    }
    const values=await foundry.applications.api.DialogV2.input({
      window:{title:"Apply Map Marker Preset to Scene"},content:shell,
      ok:{label:"Review changes"},rejectClose:false,modal:true
    });
    if(!values)return;
    const fields=CHECKPOINT_BULK_FIELDS.filter(([id])=>Boolean(values["field_"+id]))
      .map(([id])=>id);
    if(!fields.length)throw Error("Choose at least one field to apply.");
    const samePreset=()=>JSON.stringify(readWorldCheckpointPresets().presets
      .find(item=>item.id===preset.id)??null)===JSON.stringify(preset);
    if(!samePreset())throw Error("This Map Marker preset changed elsewhere. Reopen before applying.");
    const options={scope:values.scope,fields,expectedRevision:readAtlas(scene).revision};
    const plan=buildCheckpointBulkUpdate(scene,preset,options);
    const confirmContent=node("div");
    confirmContent.appendChild(node("p","Update "+plan.targets.length+
      " Map Marker(s) in ‘"+scene.name+"’ using ‘"+preset.name+
      "’? Fields: "+fields.join(", ")+
      ". Selected values will be overwritten. There is no automatic rollback."));
    const confirmed=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Confirm Map Marker bulk update"},
      content:confirmContent,modal:true,rejectClose:false});
    if(!confirmed)return;
    if(!samePreset())throw Error("This Map Marker preset changed during review. Reopen before applying.");
    const count=await applyCheckpointPresetBulk(scene,preset,options);
    ui.notifications.info("Updated "+count+" Map Marker(s). Roads and exploration were preserved.");
    await this.render();
  }
  async _delete(preset){
    if(!game.user?.isGM)throw Error("GM permission required.");
    const content=node("div");
    content.appendChild(node("p","Delete preset ‘"+preset.name+
      "’? Existing Map Markers are independent and remain unchanged."));
    const confirmed=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Delete Map Marker Preset"},content,
      rejectClose:false,modal:true});
    if(!confirmed)return;
    const latest=readWorldCheckpointPresets();
    if(JSON.stringify(latest.presets.find(item=>item.id===preset.id)??null)!==
        JSON.stringify(preset))
      throw Error("This Map Marker preset changed elsewhere. Refresh before deleting.");
    await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,
      removeCheckpointPreset(latest,preset.id));
    await this.render();
  }
}
