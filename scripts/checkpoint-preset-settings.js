/** World-wide GM-owned templates. Never writes Scene checkpoints or native Regions. */
import { MODULE_ID } from "./atlas-storage.js";
import { CHECKPOINT_TYPE_GROUPS, CHECKPOINT_TYPES } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING, defaultCheckpointPresets,
  validateCheckpointPresets, removeCheckpointPreset }
  from "./checkpoint-preset-model.js";
import { resolveCheckpointAppearance }
  from "./checkpoint-appearance.js";
import { createCheckpointIconGlyph } from "./checkpoint-icon-control.js";
import { createSettingsActionButton } from "./settings-controls.js";

const node=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};
export function readWorldCheckpointPresets(){
  return validateCheckpointPresets(game.settings.get(MODULE_ID,CHECKPOINT_PRESET_SETTING));
}
export function registerWorldCheckpointPresets(){
  game.settings.register(MODULE_ID,CHECKPOINT_PRESET_SETTING,{
    name:"Atlas Checkpoint Presets",scope:"world",config:false,type:Object,
    default:defaultCheckpointPresets()
  });
  game.settings.registerMenu(MODULE_ID,"checkpointPresetMenu",{
    name:"Atlas — Checkpoint Presets",label:"Configure Checkpoint Presets",
    hint:"Reusable, World-wide checkpoint types, marker styles, discovery and terrain suggestions. No automatic events.",
    icon:"fa-solid fa-map-location-dot",type:AtlasCheckpointPresetSettings,restricted:true
  });
}

export class AtlasCheckpointPresetSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:"fvtt-atlas-checkpoint-presets",
    window:{title:"Atlas — Checkpoint Presets",resizable:true},
    position:{width:740,height:650}};

  async _renderHTML(){
    const catalog=readWorldCheckpointPresets();
    const root=node("div");
    root.style.cssText="padding:1rem;overflow:auto;height:100%;display:grid;gap:.8rem;align-content:start;";
    root.appendChild(node("p","Checkpoint presets fill editable defaults for new or existing checkpoints, including marker, labels, discovery and optional Journal links. Checkpoint names, map positions and native Region geometry remain independent. Events are informational only in this release."));
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
        row.append(edit,remove);fieldset.appendChild(row);
      }
      root.appendChild(fieldset);
    }
    const add=node("button","＋ Add Checkpoint Preset");add.type="button";
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
  async _delete(preset){
    if(!game.user?.isGM)throw Error("GM permission required.");
    const confirmed=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Delete Checkpoint Preset"},content:"Delete preset ‘"+preset.name+"’? Existing checkpoints are independent and remain unchanged.",
      rejectClose:false,modal:true});
    if(!confirmed)return;
    await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,
      removeCheckpointPreset(readWorldCheckpointPresets(),preset.id));
    await this.render();
  }
}
