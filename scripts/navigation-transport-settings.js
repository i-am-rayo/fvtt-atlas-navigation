/**
 * GM World transportation settings. Pure catalog logic lives in
 * navigation-transport-catalog.js; this file owns DOM, dialogs and persistence.
 * No Scene, Region, Token, currency or Actor data is changed by editing.
 */
import { TRANSPORT_CATALOG_SETTING,TRANSPORT_SURFACES,TRANSPORT_KINDS,
  TRANSPORT_COST_BASES,readTransportationCatalog,listTransportationPresets,
  selectedTransportationProfile,setTransportationPreset,resetTransportationPreset,
  deleteCustomTransportationPreset,addOptionalTirelessExamples }
  from "./navigation-transport-catalog.js";
import { NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED } from "./navigation-time.js";
import { NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT,
  NAVIGATION_PLAYBACK_MIN,NAVIGATION_PLAYBACK_MAX } from "./navigation-playback.js";
import { NAVIGATION_RULES_PROFILE_SETTING,NAVIGATION_RULES_PROFILES,
  CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
  CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING }
  from "./navigation-rules-profile.js";
import { NAVIGATION_WORLD_CLOCK_SETTING } from "./navigation-world-clock.js";
import { NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING,
  NAVIGATION_MOUNTED_SPEED_DEFAULT,NAVIGATION_SAILING_SPEED_DEFAULT }
  from "./navigation-travel-method.js";
import { createSettingsSelect } from "./settings-select.js";
const MODULE_ID="fvtt-atlas-navigation";
const names={land:"Land",water:"Water",air:"Air",foot:"On foot",mount:"Mount",vehicle:"Vehicle"};
const element=(tag,label)=>{
  const node=document.createElement(tag);
  if(label!==undefined)node.textContent=label;
  return node;
};
const button=(label,action)=>{
  const control=element("button",label);control.type="button";
  control.addEventListener("click",async()=>{
    control.disabled=true;
    try{await action();}catch(error){
      console.error("["+MODULE_ID+"] Transportation Presets",error);
      globalThis.ui?.notifications?.error?.(error.message||String(error));
    }finally{control.disabled=false;}
  });
  return control;
};
const current=(key,fallback)=>{
  try{return game.settings.get(MODULE_ID,key)??fallback;}catch{return fallback;}
};
const field=(label,input,help=null)=>{
  const row=element("label");
  row.style.cssText="display:grid;gap:.3rem;min-width:0;";
  const heading=element("span",label);heading.style.fontWeight="600";
  row.append(heading,input);
  if(help){const hint=element("small",help);hint.style.opacity=".75";row.append(hint);}
  return row;
};
const numberInput=(name,value,{min=0,max=1000,step=0.1}={})=>{
  const input=element("input");input.type="number";input.name=name;
  input.min=String(min);input.max=String(max);input.step=String(step);
  input.value=String(value);input.defaultValue=String(value);
  input.style.cssText="width:100%;min-width:0;box-sizing:border-box;";
  return input;
};
const checkbox=(name,checked)=>{
  const input=element("input");input.type="checkbox";input.name=name;
  input.checked=Boolean(checked);input.defaultChecked=Boolean(checked);
  return input;
};
const slider=(name,value,{min=0.1,max=100,step=0.1}={})=>{
  const wrapper=element("div");
  wrapper.style.cssText="display:flex;gap:.65rem;align-items:center;min-width:0;";
  const range=element("input");range.type="range";range.min=String(min);
  range.max=String(max);range.step=String(step);range.value=String(Math.min(max,Math.max(min,value)));
  range.style.cssText="flex:1;min-width:5rem;";
  const numeric=numberInput(name,value,{min:0.1,max:600,step});
  numeric.style.width="6.5rem";
  range.setAttribute("aria-label","Speed slider");
  range.addEventListener("input",()=>{numeric.value=range.value;numeric.defaultValue=range.value;});
  numeric.addEventListener("input",()=>{
    if(Number.isFinite(Number(numeric.value)))range.value=String(Math.min(max,Number(numeric.value)));
  });
  wrapper.append(range,numeric);return wrapper;
};
const heading=(text,description)=>{
  const section=element("div");
  const h=element("h3",text);h.style.margin="0 0 .3rem";
  section.append(h);
  if(description){const p=element("p",description);p.style.cssText="margin:0;opacity:.8;";section.append(p);}
  return section;
};
const selected=(choices,value,name)=>{
  const control=createSettingsSelect(choices,{selectedId:value,name});
  control.style.cssText="width:100%;min-width:0;";return control;
};
const costLabel=p=>p.costBasis==="none"?"No recurring cost":
  p.costCp+" CP / "+(p.costBasis==="day"?"day":"mile");
const snapshot=()=>JSON.stringify(readTransportationCatalog(game.settings));

// Tests import the registration module before Foundry globals exist.
const ApplicationBase=globalThis.foundry?.applications?.api?.ApplicationV2??class {};
export class AtlasTransportationSettings extends ApplicationBase {
  static DEFAULT_OPTIONS={
    id:"fvtt-atlas-transportation-settings",
    window:{title:"Atlas — Transportation Presets",resizable:true},
    position:{width:810,height:690}
  };
  constructor(...args){super(...args);this.activeTab="methods";}

  async _renderHTML(){
    const root=element("section");
    root.style.cssText="padding:1rem;display:flex;flex-direction:column;gap:1rem;"+
      "height:100%;overflow:auto;box-sizing:border-box;";
    const top=heading("Transportation Presets",
      "Manage travel speeds, transport costs and journey rules for this Foundry World. "+
      "Changes affect future estimates; no Actor resources or currency are changed.");
    root.appendChild(top);
    const tabs=element("nav");tabs.style.cssText="display:flex;gap:.5rem;flex-wrap:wrap;";
    for(const [id,label] of [["methods","Transportation"],["rules","Travel rules"],
      ["journey","Journey & playback"]]){
      const control=button(label,async()=>{this.activeTab=id;await this.render();});
      control.setAttribute("aria-pressed",String(id===this.activeTab));
      control.style.cssText="padding:.5rem .75rem;"+(id===this.activeTab?
        "border:2px solid var(--color-border-highlight, #a78bfa);font-weight:bold;":"");
      tabs.appendChild(control);
    }
    root.appendChild(tabs);
    if(this.activeTab==="methods")this._renderMethods(root);
    else if(this.activeTab==="rules")this._renderRules(root);
    else this._renderJourney(root);
    return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}

  _renderMethods(root){
    const profile=selectedTransportationProfile(game.settings,game.system?.id);
    root.appendChild(element("p","Reference: "+(
      profile==="dnd5e2024"?"D&D 2024 / 5.5e":
      profile==="dnd5e2014"?"D&D 2014 / 5e":
      profile==="custom"?"Custom (2024 starting values)":"System-neutral (2024 examples)")+
      ". Changing the Rules Profile changes built-in reference values. GM edits are saved separately for each profile."));
    const toolbar=element("div");toolbar.style.cssText="display:flex;gap:.5rem;flex-wrap:wrap;";
    toolbar.append(button("＋ Add custom transport",()=>this._edit(null)));
    toolbar.append(button("＋ Add optional tireless creatures",()=>this._importExamples()));
    root.appendChild(toolbar);
    const methods=listTransportationPresets(game.settings,game.system?.id);
    for(const surface of TRANSPORT_SURFACES){
      const group=methods.filter(p=>p.surface===surface);
      if(!group.length)continue;
      const section=element("fieldset");
      section.style.cssText="display:grid;gap:.65rem;min-width:0;border-radius:.5rem;";
      section.appendChild(element("legend",names[surface]+" travel"));
      for(const preset of group){
        const row=element("div");
        row.style.cssText="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;"+
          "padding:.5rem 0;border-bottom:1px solid var(--color-border-light-primary, #555);";
        const details=element("div");details.style.cssText="flex:1 1 16rem;min-width:0;";
        const name=element("strong",preset.name);
        details.append(name);
        const rate=element("div",preset.id==="walking"?
          "Party pace · World fallback "+current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED)+" Scene units/hour":
          preset.speedMph+" mph · "+costLabel(preset));
        rate.style.cssText="font-size:.9em;opacity:.8";details.append(rate);
        if(preset.note){const note=element("small",preset.note);note.style.cssText="display:block;opacity:.65";details.append(note);}
        row.appendChild(details);
        row.appendChild(button("Edit",()=>this._edit(preset)));
        if(preset.builtIn&&preset.customized)
          row.appendChild(button("Reset",()=>this._reset(preset,profile)));
        if(!preset.builtIn)row.appendChild(button("Delete",()=>this._delete(preset)));
        section.appendChild(row);
      }
      root.appendChild(section);
    }
    root.appendChild(element("p",
      "All non-walking methods are distance/time previews until checkpoint embark/disembark "+
      "transfers and method-specific travel-day rules are implemented. A compatible road does "+
      "not yet authorize guided movement. Costs are reference estimates only."));
  }

  async _edit(preset){
    if(!game.user?.isGM)throw new Error("Only a GM may edit transportation presets.");
    const existing=Boolean(preset),profile=selectedTransportationProfile(game.settings,game.system?.id);
    const before=snapshot();
    const body=element("div");
    body.style.cssText="display:grid;gap:.8rem;padding:.5rem;max-height:65vh;overflow-y:auto;";
    const value=preset??{name:"",kind:"vehicle",surface:"land",speedMph:3,costCp:0,
      costBasis:"none",purchaseGp:null,note:""};
    if(!existing||!preset.builtIn){
      const name=element("input");name.name="name";name.type="text";
      name.maxLength=80;name.required=true;name.placeholder="e.g. Wind-powered skiff";
      name.value=value.name;name.defaultValue=value.name;
      body.appendChild(field("Name",name));
      body.appendChild(field("Type",selected(TRANSPORT_KINDS.map(k=>[k,names[k]]),
        value.kind,"kind")));
      body.appendChild(field("Route surface",selected(TRANSPORT_SURFACES.map(k=>[k,names[k]]),
        value.surface,"surface")));
    }else body.appendChild(heading(preset.name,
      preset.builtIn?"Built-in rules preset; changes are saved only for the active Rules Profile.":
        "Custom World preset; changes keep its stable ID."));
    if(preset?.id==="walking"){
      body.appendChild(field("Fallback walking speed (Scene units/hour)",
        numberInput("worldSpeed",current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED),
          {min:.1,max:1000,step:.1}),
        "When no compatible Group Actor pace is available. Actual walking uses the party's speed."));
    }else body.appendChild(field("Sustained travel speed (miles/hour)",
      slider("speedMph",value.speedMph),
      "0.1 to 600 mph. This is travel pace, not tactical feet-per-round movement."));
    const costs=element("div");costs.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.65rem;";
    costs.appendChild(field("Recurring cost (copper pieces)",
      numberInput("costCp",value.costCp,{min:0,max:100000000,step:1}),
      "Shown for planning only; no currency deducted."));
    costs.appendChild(field("Cost applies",selected(TRANSPORT_COST_BASES.map(k=>[
      k,k==="none"?"No automatic cost":k==="day"?"Per calendar day":"Per traveled mile"
    ]),value.costBasis,"costBasis")));
    costs.appendChild(field("Purchase price (gold pieces)",
      (()=>{const n=numberInput("purchaseGp",value.purchaseGp??0,{min:0,max:100000000,step:1});
        if(value.purchaseGp===null){n.value="";n.defaultValue="";}n.placeholder="Not specified";return n;})()));
    body.appendChild(costs);
    if(!preset?.builtIn){
      const note=element("textarea");note.name="note";note.maxLength=240;
      note.rows=2;note.value=value.note??"";note.defaultValue=value.note??"";
      body.appendChild(field("GM note (optional)",note));
    }
    const response=await foundry.applications.api.DialogV2.input({
      window:{title:existing?"Edit "+preset.name:"Add custom transportation"},
      content:body,ok:{label:"Save preset"},rejectClose:false,modal:true
    });
    if(!response)return;
    if(before!==snapshot())throw new Error("Transportation presets changed while you were editing. Reopen and review.");
    if(preset?.id==="walking"){
      const numeric=Number(response.worldSpeed);
      if(!Number.isFinite(numeric)||numeric<.1||numeric>1000)
        throw new Error("Walking fallback speed must be between 0.1 and 1000.");
      await game.settings.set(MODULE_ID,NAVIGATION_SPEED_SETTING,numeric);
    }
    const id=preset?.id??"custom-"+(
      globalThis.foundry?.utils?.randomID?.(12)??crypto.randomUUID().replaceAll("-","").slice(0,12)
    ).toLowerCase();
    const next={...value,id,
      name:preset?.builtIn?value.name:String(response.name??"").trim(),
      kind:preset?.builtIn?value.kind:String(response.kind??""),
      surface:preset?.builtIn?value.surface:String(response.surface??""),
      speedMph:id==="walking"?null:Number(response.speedMph),
      costCp:Number(response.costCp),costBasis:String(response.costBasis),
      purchaseGp:response.purchaseGp===""||response.purchaseGp==null?
        null:Number(response.purchaseGp),
      note:preset?.builtIn?value.note:String(response.note??"")};
    const updated=setTransportationPreset(readTransportationCatalog(game.settings),profile,next);
    await game.settings.set(MODULE_ID,TRANSPORT_CATALOG_SETTING,updated);
    ui.notifications.info("Transportation preset saved.");
    await this.render();
  }
  async _reset(preset,profile){
    if(!game.user?.isGM)throw new Error("Only a GM may reset presets.");
    const yes=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Reset "+preset.name},modal:true,rejectClose:false,
      content:"<p>Restore the reference speed and costs for this preset in the current Rules Profile?</p>"
    });
    if(!yes)return;
    const before=snapshot();
    const updated=resetTransportationPreset(readTransportationCatalog(game.settings),profile,preset.id);
    if(before!==snapshot())throw new Error("Preset data changed; reopen the editor.");
    // Legacy beta.1 speed values are explicitly reset only when resetting that preset.
    if(preset.id==="mounted")
      await game.settings.set(MODULE_ID,NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_MOUNTED_SPEED_DEFAULT);
    if(preset.id==="sailing")
      await game.settings.set(MODULE_ID,NAVIGATION_SAILING_SPEED_SETTING,NAVIGATION_SAILING_SPEED_DEFAULT);
    await game.settings.set(MODULE_ID,TRANSPORT_CATALOG_SETTING,updated);
    await this.render();
  }
  async _delete(preset){
    if(!game.user?.isGM||preset.builtIn)throw new Error("Only custom presets can be deleted.");
    const yes=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Delete "+preset.name},modal:true,rejectClose:false,
      content:"<p>Remove this custom transportation option from future route planning? "+
        "Previously saved Journey Journals and Scene data will not be changed.</p>"
    });
    if(!yes)return;
    const next=deleteCustomTransportationPreset(readTransportationCatalog(game.settings),preset.id);
    await game.settings.set(MODULE_ID,TRANSPORT_CATALOG_SETTING,next);await this.render();
  }
  async _importExamples(){
    if(!game.user?.isGM)throw new Error("Only a GM may import presets.");
    const yes=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Import optional creatures"},modal:true,rejectClose:false,
      content:"<p>Add the missing tireless creature examples from the supplied 5e travel-speed workbook? "+
        "These are optional homebrew pace conversions, NOT the D&D 2024 sustained mount rule. "+
        "Existing presets and overrides will not be replaced.</p>"
    });
    if(!yes)return;
    const next=addOptionalTirelessExamples(readTransportationCatalog(game.settings));
    await game.settings.set(MODULE_ID,TRANSPORT_CATALOG_SETTING,next);await this.render();
  }
  _renderRules(root){
    root.appendChild(heading("Travel rules",
      "These values control how Atlas offers GM-approved travel-day rests. "+
      "Changing the profile also selects the matching transportation reference list."));
    const panel=element("div");panel.style.cssText="display:grid;gap:.85rem;max-width:35rem;";
    panel.appendChild(field("Rules Profile",
      selected(Object.entries(NAVIGATION_RULES_PROFILES),
        current(NAVIGATION_RULES_PROFILE_SETTING,"system"),"profile")));
    const fields=[
      ["day",CUSTOM_DAY_HOURS_SETTING,"Moving hours per day",8,1,24,1],
      ["overnight",CUSTOM_OVERNIGHT_HOURS_SETTING,"Overnight downtime (hours)",16,0,24,1],
      ["short",CUSTOM_SHORT_REST_HOURS_SETTING,"Short rest (hours)",1,.5,8,.5],
      ["long",CUSTOM_LONG_REST_HOURS_SETTING,"Long rest (hours)",8,1,24,1]
    ];
    for(const [name,key,label,fallback,min,max,step] of fields)
      panel.appendChild(field(label,numberInput(name,current(key,fallback),{min,max,step}),
        "Applies when Rules Profile is Custom."));
    panel.appendChild(button("Save travel rules",async()=>{
      if(!game.user?.isGM)throw new Error("GM access required.");
      const profile=panel.querySelector("[name=profile]").value;
      if(!Object.hasOwn(NAVIGATION_RULES_PROFILES,profile))throw new Error("Unknown rules profile.");
      const values=fields.map(([name,key,label,fallback,min,max])=>{
        const value=Number(panel.querySelector("[name="+name+"]").value);
        if(!Number.isFinite(value)||value<min||value>max)throw new Error("Invalid "+label+".");
        return [key,value];
      });
      for(const [key,val] of values)await game.settings.set(MODULE_ID,key,val);
      await game.settings.set(MODULE_ID,NAVIGATION_RULES_PROFILE_SETTING,profile);
      ui.notifications.info("Atlas travel rules saved.");await this.render();
    }));
    root.appendChild(panel);
  }
  _renderJourney(root){
    root.appendChild(heading("Journey and playback",
      "World time and visual playback are independent. Atlas never applies Actor rests, exhaustion or transport fares."));
    const panel=element("div");panel.style.cssText="display:grid;gap:.85rem;max-width:35rem;";
    panel.appendChild(field("Animation speed (real seconds per in-game travel hour)",
      numberInput("playback",current(NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT),
        {min:NAVIGATION_PLAYBACK_MIN,max:NAVIGATION_PLAYBACK_MAX,step:.5}),
      "Only changes visual playback; never travel hours or World time."));
    const clock=checkbox("clock",current(NAVIGATION_WORLD_CLOCK_SETTING,false));
    const clockRow=element("label");clockRow.style.cssText="display:flex;gap:.6rem;align-items:center;";
    clockRow.append(clock,element("span","Advance World time for confirmed travel and GM-approved rests"));
    panel.append(clockRow);
    panel.appendChild(button("Save journey options",async()=>{
      if(!game.user?.isGM)throw new Error("GM access required.");
      const playback=Number(panel.querySelector("[name=playback]").value);
      if(!Number.isFinite(playback)||playback<NAVIGATION_PLAYBACK_MIN||
          playback>NAVIGATION_PLAYBACK_MAX||Math.abs(playback*2-Math.round(playback*2))>1e-8)
        throw new Error("Animation speed must use half-second steps.");
      await game.settings.set(MODULE_ID,NAVIGATION_PLAYBACK_SETTING,playback);
      await game.settings.set(MODULE_ID,NAVIGATION_WORLD_CLOCK_SETTING,clock.checked);
      ui.notifications.info("Atlas journey options saved.");await this.render();
    }));
    root.appendChild(panel);
  }
}
