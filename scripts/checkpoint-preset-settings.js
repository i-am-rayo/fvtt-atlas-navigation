/** World-wide GM-owned templates. Never writes Scene checkpoints or native Regions. */
import { MODULE_ID } from "./atlas-storage.js";
import { CHECKPOINT_TYPE_GROUPS, CHECKPOINT_TYPES } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING, defaultCheckpointPresets,
  validateCheckpointPresets, upsertCheckpointPreset, removeCheckpointPreset }
  from "./checkpoint-preset-model.js";
import { readWorldTravelPresets } from "./travel-preset-settings.js";

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
    root.appendChild(node("p","Checkpoint presets fill editable defaults for new or existing checkpoints. They never copy checkpoint names, locations, Journal links, discovery status or native Region geometry. Events are informational only in this release."));
    for(const [group,types] of CHECKPOINT_TYPE_GROUPS){
      const matches=catalog.presets.filter(p=>types.some(([type])=>type===p.category));
      if(!matches.length)continue;
      const fieldset=node("fieldset");fieldset.style.cssText="min-width:0;display:grid;gap:.3rem;";
      fieldset.appendChild(node("legend",group));
      for(const preset of matches){
        const row=node("div");row.style.cssText="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;padding:.2rem 0;";
        const label=node("span",preset.name+" · "+(CHECKPOINT_TYPES.find(([id])=>id===preset.category)?.[1]??preset.category));
        label.style.cssText="flex:1 1 12rem;";row.appendChild(label);
        const edit=node("button","Edit");edit.type="button";
        edit.addEventListener("click",()=>void this._run(()=>this._edit(preset)));
        const remove=node("button","Delete");remove.type="button";
        remove.addEventListener("click",()=>void this._run(()=>this._delete(preset)));
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
    const shell=node("div"),body=node("div");
    body.style.cssText="display:grid;gap:.45rem;max-height:65vh;overflow:auto;";
    shell.appendChild(body); // DialogV2.input expects a plain outer div.
    const field=(label,name,tag="input",value="",attrs={})=>{
      const row=node("label",label),input=node(tag);row.style.cssText="display:grid;gap:.2rem;";
      input.name=name;for(const [k,v] of Object.entries(attrs))input[k]=v;
      if(tag==="select"){
        for(const [id,text] of value){const op=node("option",text);op.value=id;
          op.defaultSelected=id===(attrs.current??"");input.appendChild(op);}
      }else input.defaultValue=String(value);
      row.appendChild(input);body.appendChild(row);return input;
    };
    field("Preset name","name","input",existing?.name??"",{required:true,maxLength:120});
    field("Checkpoint category","category","select",CHECKPOINT_TYPES,
      {current:existing?.category??"custom"});
    field("Discovery method","discoveryMethod","select",[
      ["automatic","Automatic"],["gm","GM Only"],["lore","Lore Only"]],
      {current:existing?.discoveryMethod??"automatic"});
    field("Reveal radius (cells)","revealRadiusCells","input",existing?.revealRadiusCells??3,
      {type:"number",min:"0",max:"100",step:"0.25"});
    const travel=[["","None — no terrain suggestion"],...readWorldTravelPresets().presets.map(p=>[p.id,p.name])];
    field("Suggested Terrain Region travel preset","terrainId","select",travel,
      {current:existing?.terrain?.presetId??""});
    field("Suggested checkpoint Region radius (cells)","terrainRadius","input",
      existing?.terrain?.radiusCells??.25,{type:"number",min:"0.25",max:"3",step:"0.25"});
    field("Event classification (future only)","eventKind","select",[
      ["none","None"],["hazard","Environmental hazard"],["encounter","Encounter"]],
      {current:existing?.event?.kind??"none"});
    body.appendChild(node("p","Marker and label appearance can be captured using Save as Preset in an individual Checkpoint Settings window. Existing appearance stays intact when editing this template."));
    const form=await foundry.applications.api.DialogV2.input({
      window:{title:existing?"Edit Checkpoint Preset":"Add Checkpoint Preset"},
      content:shell,ok:{label:"Save Preset"},rejectClose:false,modal:true
    });
    if(!form)return;
    const preset={id:existing?.id??("checkpoint-custom-"+foundry.utils.randomID()),
      name:String(form.name??"").trim(),category:String(form.category),
      appearance:existing?.appearance??null,
      discoveryMethod:String(form.discoveryMethod),revealRadiusCells:Number(form.revealRadiusCells),
      terrain:{presetId:form.terrainId||null,radiusCells:Number(form.terrainRadius)},
      event:{kind:String(form.eventKind),enabled:false}};
    const next=upsertCheckpointPreset(readWorldCheckpointPresets(),preset);
    await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,next);
    await this.render();
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
