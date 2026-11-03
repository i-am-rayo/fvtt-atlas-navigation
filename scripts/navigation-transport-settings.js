/**
 * GM World transportation settings. Pure catalog logic lives in
 * navigation-transport-catalog.js; this file owns DOM, dialogs and persistence.
 * No Scene, Region, Token, currency or Actor data is changed by editing.
 */
import { TRANSPORT_CATALOG_SETTING,TRANSPORT_SURFACES,TRANSPORT_KINDS,
  TRANSPORT_COST_BASES,TRANSPORT_HIRE_BASES,TRANSPORT_CREW_WAGE_BASES,readTransportationCatalog,listTransportationPresets,
  selectedTransportationProfile,setTransportationPreset,resetTransportationPreset,
  deleteCustomTransportationPreset,addOptionalTirelessExamples,estimateTransportationTrip }
  from "./navigation-transport-catalog.js";
import { NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED } from "./navigation-time.js";
import { NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT,
  NAVIGATION_PLAYBACK_MIN,NAVIGATION_PLAYBACK_MAX,
  exampleTripPlayback,formatPlaybackDuration } from "./navigation-playback.js";
import { NAVIGATION_RULES_PROFILE_SETTING,NAVIGATION_RULES_PROFILES,
  CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
  CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING }
  from "./navigation-rules-profile.js";
import { NAVIGATION_WORLD_CLOCK_SETTING } from "./navigation-world-clock.js";
import {readPartyExploration} from "./party-exploration-storage.js";
import {projectGroupTransportation,readGroupTransportation} from "./navigation-group-transport.js";
import { NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING,
  NAVIGATION_MOUNTED_SPEED_DEFAULT,NAVIGATION_SAILING_SPEED_DEFAULT }
  from "./navigation-travel-method.js";
import { createSettingsSelect } from "./settings-select.js";
import {createTransportNumberSlider,createTransportCurrencyPool,transportCurrencyAmount}
 from "./navigation-transport-form-controls.js";
import { atlasCurrencyChoices,coinFromCopper,dndCurrencyBreakdown } from "./navigation-currency.js";
import { atlasDisplayPresetSpeed,atlasPresetSpeedFromDisplay,
  atlasDisplayCostPerDistance,atlasCostPerMileFromDisplay,
  resolveAtlasMeasuringUnits,atlasDisplaySpeed,atlasFormatMeasure,
  atlasSceneDistanceFromDisplay,atlasDisplayDistance }
  from "./navigation-measure-units.js";
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
const iconButton=(icon,label,action)=>{
  const control=button("",action);
  const glyph=element("i");glyph.className="fa-solid fa-"+icon;
  glyph.setAttribute("aria-hidden","true");control.appendChild(glyph);
  control.setAttribute("aria-label",label);control.title=label;
  control.style.cssText="min-width:2.3rem;min-height:2.3rem;display:inline-grid;"+
    "place-items:center;padding:.4rem;flex-shrink:0;";
  return control;
};
const current=(key,fallback)=>{
  try{return game.settings.get(MODULE_ID,key)??fallback;}catch{return fallback;}
};
const field=(label,input,help=null)=>{
  const row=element("label");
  row.className="atlas-transport-field";
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
const slider=(name,value,options={})=>createTransportNumberSlider(name,value,options);
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
/** Forms serialize DOM content in DialogV2. Listeners attached before opening do
 * not survive Foundry's markup serialization; reconnect them after rendering.
 */
const wireSliders=container=>{
  const root=container?.querySelectorAll?container:container?.element;
  for(const range of root?.querySelectorAll?.("[data-atlas-range-for]")??[]){
    const name=range.getAttribute("data-atlas-range-for");
    const numeric=root.querySelector('[name="'+name+'"]');
    if(!numeric||range.dataset.atlasWired==="true")continue;
    range.dataset.atlasWired="true";
    range.addEventListener("input",()=>{numeric.value=range.value;});
    numeric.addEventListener("input",()=>{
      if(numeric.value!==""&&Number.isFinite(Number(numeric.value)))
        range.value=String(Math.max(Number(range.min),Math.min(Number(range.max),Number(numeric.value))));
    });
  }
};
/** Reconnect preset tabs/preview after DialogV2 serializes and rehydrates its HTML. */
const wirePresetDialog=container=>{
  const root=container?.querySelectorAll?container:container?.element;
  if(!root?.querySelectorAll)return;
  const tabs=[...root.querySelectorAll("[data-atlas-preset-tab]")];
  if(!tabs.length)return;
  const panels=[...root.querySelectorAll("[data-atlas-preset-panel]")];
  const activate=id=>{
    for(const tab of tabs)tab.setAttribute("aria-selected",String(tab.dataset.atlasPresetTab===id));
    for(const panel of panels)panel.style.display=panel.dataset.atlasPresetPanel===id?"grid":"none";
  };
  for(const tab of tabs){
    if(tab.dataset.atlasWired==="true")continue;
    tab.dataset.atlasWired="true";
    tab.addEventListener("click",()=>activate(tab.dataset.atlasPresetTab));
  }
  activate("general");
  const fieldValue=name=>root.querySelector('[name="'+name+'"]');
  const number=name=>Number(fieldValue(name)?.value??0);
  const currency=name=>transportCurrencyAmount(Object.fromEntries(
    [...root.querySelectorAll('[name^="'+name+'_"]')].map(input=>[input.name,input.value])),name);
  const formatCost=cp=>dndCurrencyBreakdown(Math.max(0,cp),
    globalThis.CONFIG?.DND5E?.currencies).label;
  const setCells=(selector,values)=>{
    for(const cell of root.querySelectorAll(selector)){
      const key=cell.getAttribute("data-atlas-preview-key");
      cell.textContent=String(values[key]??"—");
    }
  };
  const update=()=>{
    try{
      const hireOn=Boolean(fieldValue("hireEnabled")?.checked);
      const crewOption=root.querySelector("[data-atlas-hire-crew-option]");
      if(crewOption){crewOption.style.opacity=hireOn?"1":".42";
        crewOption.style.pointerEvents=hireOn?"auto":"none";}
      const hireControls=root.querySelector("[data-atlas-hire-controls]");
      if(hireControls){hireControls.style.opacity=hireOn?"1":".42";
        hireControls.style.pointerEvents=hireOn?"auto":"none";
        hireControls.setAttribute("aria-disabled",String(!hireOn));}
      const purchasable=Boolean(fieldValue("purchaseEnabled")?.checked);
      const purchaseControls=root.querySelector("[data-atlas-purchase-controls]");
      if(purchaseControls){purchaseControls.style.opacity=purchasable?"1":".42";
        purchaseControls.style.pointerEvents=purchasable?"auto":"none";}
      const crew=number("crewCount");
      const travelerCount=Math.max(1,Number(root.querySelector("[data-atlas-travelers]")?.getAttribute("data-atlas-travelers")??1));
      const capacity=Math.max(1,number("capacity")||1);
      const units=Math.ceil(travelerCount/capacity);
      const displaySpeed=number("speedDisplay")||number("worldSpeed");
      const speedMph=fieldValue("speedDisplay")?
        atlasPresetSpeedFromDisplay(displaySpeed):3;
      const distanceMi=8*Math.max(.1,speedMph);
      const fareBasis=fieldValue("hireBasis")?.value??"day";
      const applies=fieldValue("hireApplies")?.value??"unit";
      const charges=applies==="passenger"?travelerCount:units;
      const metric=resolveAtlasMeasuringUnits()==="metric";
      const distanceShown=metric?distanceMi*1.609344:distanceMi;
      const periods=fareBasis==="mile"?distanceShown:1;
      const fare=currency("hire");
      setCells("[data-atlas-hire-preview]",{
        scenario:fareBasis==="day"?"8h × 1 operating day":
          fareBasis==="mile"?distanceShown.toFixed(1)+(metric?" km":" mi")+" (8h)":"1 trip (8h)",
        count:charges+" "+(applies==="passenger"?"passenger(s)":"mount(s)/vehicle(s)"),
        fare:formatCost(fare),total:hireOn?formatCost(fare*periods*charges):"Hire unavailable"
      });
      const wageBasis=fieldValue("crewWageBasis")?.value??"day";
      const wagePeriod=wageBasis==="day"?3:wageBasis==="mile"?10:1;
      const wage=currency("crewWage");
      setCells("[data-atlas-wage-preview]",{
        scenario:wageBasis==="day"?"3 operating days":wageBasis==="mile"?
          "10 miles (distance)":"1 trip",
        count:String(crew),wage:formatCost(crew>0?wage:0),
        total:formatCost(wage*crew*wagePeriod)
      });
      const upkeep=currency("cost");
      const upkeepBasis=fieldValue("costBasis")?.value??"none";
      const upkeepCount=(fieldValue("costApplies")?.value??"unit")==="passenger"?
        travelerCount:units;
      const upkeepPeriods=upkeepBasis==="day"?3:upkeepBasis==="mile"?10:0;
      setCells("[data-atlas-upkeep-preview]",{
        scenario:upkeepBasis==="day"?"3 operating days":upkeepBasis==="mile"?
          "10 miles":"No recurring upkeep",
        total:formatCost(upkeep*upkeepCount*upkeepPeriods)
      });
      const error=root.querySelector("[data-atlas-quote-error]");
      if(error)error.textContent="";
    }catch(error){
      const info=root.querySelector("[data-atlas-quote-error]");
      if(info)info.textContent="Enter valid, nonnegative currency amounts to preview estimates.";
    }
  };
  if(root.dataset.atlasPreviewWired!=="true"){
    root.dataset.atlasPreviewWired="true";
    root.addEventListener("input",update);
    root.addEventListener("change",update);
  }
  update();
};
const costLabel=p=>p.costBasis==="none"?"No recurring cost":
  coinLabel(p.costBasis==="mile"?atlasDisplayCostPerDistance(p.costCp):p.costCp)+
    " / "+(p.costBasis==="day"?"day":resolveAtlasMeasuringUnits()==="metric"?"km":"mi")+
    (p.costApplies==="passenger"?" per passenger":" per transport unit");
const currentTravelers=()=>{
  try{
    const scene=globalThis.game?.scenes?.current;
    const exploration=readPartyExploration(scene);
    const token=scene?.tokens?.get?.(exploration.tokenId);
    const group=token?.actor;
    if(group?.type!=="group")return {count:1,source:"Example: 1 passenger (no assigned Group Actor)"};
    const projection=projectGroupTransportation(group,readGroupTransportation(game.settings),[]);
    return {count:Math.max(1,projection.travelers),
      source:projection.travelers>0?
        "Assigned Group Actor: "+projection.travelers+" player character(s)":
        "Assigned Group Actor has no counted player characters; showing one example passenger"};
  }catch{return {count:1,source:"Example: 1 passenger (no assigned Group Actor)"};}
};
const snapshot=()=>JSON.stringify(readTransportationCatalog(game.settings));
const nativeCoins=()=>atlasCurrencyChoices(game.system?.id,globalThis.CONFIG?.DND5E?.currencies);
const priceInput=(name,copper)=>createTransportCurrencyPool(name,copper).element;
const currencyFromResponse=(response,name)=>transportCurrencyAmount(response,name);
const coinLabel=(copper,denomination="cp")=>{
  const value=coinFromCopper(copper,denomination);
  return value.toLocaleString(undefined,{maximumFractionDigits:2})+" "+denomination;
};

// Tests import the registration module before Foundry globals exist.
const ApplicationBase=globalThis.foundry?.applications?.api?.ApplicationV2??class {};
export class AtlasTransportationSettings extends ApplicationBase {
  static DEFAULT_OPTIONS={
    id:"fvtt-atlas-transportation-settings",
    window:{title:"Atlas — Transportation Presets",resizable:true},
    position:{width:810,height:690}
  };
  constructor(...args){
    super(...args);this.activeTab="methods";
    // Stable random sample trips; speed changes update times, not distances.
    this.exampleDistancesMi=Array.from({length:3},()=>Math.floor(5+Math.random()*120));
  }

  async _renderHTML(){
    const root=element("section");
    root.style.cssText="padding:1rem;display:flex;flex-direction:column;gap:1rem;"+
      "height:100%;overflow:auto;box-sizing:border-box;";
    const top=heading("Transportation Presets",
      "Manage travel speeds, transport costs and journey rules for this Foundry World. "+
      "Changes affect future estimates; no Actor resources or currency are changed.");
    root.appendChild(top);
    const tabs=element("nav");tabs.setAttribute("role","tablist");
    tabs.setAttribute("aria-label","Atlas transportation settings sections");
    tabs.style.cssText="display:flex;gap:.25rem;flex-wrap:wrap;"+
      "border-bottom:2px solid var(--color-border-light-tertiary,#555);padding:.25rem .25rem 0;";
    for(const [id,label] of [["methods","Transportation"],["rules","Travel rules"],
      ["journey","Journey & playback"]]){
      const control=button(label,async()=>{this.activeTab=id;await this.render();});
      control.setAttribute("role","tab");
      control.setAttribute("aria-selected",String(id===this.activeTab));
      control.setAttribute("tabindex",id===this.activeTab?"0":"-1");
      control.style.cssText="padding:.65rem .9rem;border-radius:8px 8px 0 0;"+
        "border:1px solid var(--color-border-light-primary,#666);border-bottom:3px solid "+
        (id===this.activeTab?"var(--color-border-highlight,#a78bfa)":"transparent")+";"+
        (id===this.activeTab?
          "background:var(--color-bg-option,#30283d);font-weight:750;"+
          "color:var(--color-text-primary,#f8f2e9);":"opacity:.75;");
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
    toolbar.append(button("＋ Import optional workbook examples",()=>this._importExamples()));
    root.appendChild(toolbar);
    const methods=listTransportationPresets(game.settings,game.system?.id);
    for(const surface of TRANSPORT_SURFACES){
      const group=methods.filter(p=>p.surface===surface);
      const section=element("fieldset");
      section.style.cssText="display:grid;gap:.65rem;min-width:0;border-radius:.5rem;";
      const legend=element("legend");legend.style.cssText="display:flex;align-items:center;gap:.5rem;font-weight:700;";
      legend.appendChild(element("span",names[surface]+" travel"));
      const add=iconButton("plus","Add "+names[surface].toLowerCase()+" transport",()=>this._edit(null,surface));
      add.style.cssText="min-width:2.3rem;min-height:2.3rem;padding:.35rem;";
      legend.appendChild(add);section.appendChild(legend);
      if(!group.length)section.appendChild(element("p","No presets yet for this route surface."));
      for(const preset of group){
        const row=element("div");
        row.style.cssText="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;"+
          "padding:.5rem 0;border-bottom:1px solid var(--color-border-light-primary, #555);";
        const details=element("div");details.style.cssText="flex:1 1 16rem;min-width:0;";
        const name=element("strong",preset.name);
        details.append(name);
        const travelSpeed=atlasDisplayPresetSpeed(preset.speedMph);
        const currentSceneUnit=globalThis.canvas?.scene?.grid?.units??
          game.scenes?.current?.grid?.units??"";
        const fallback=current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED);
        const walkingLabel=currentSceneUnit?
          atlasFormatMeasure(atlasDisplaySpeed(fallback,currentSceneUnit)):
          fallback+" Scene units/hour";
        const rate=element("div",preset.id==="walking"?
          "Party pace · World fallback "+walkingLabel:
          atlasFormatMeasure(travelSpeed)+" · "+costLabel(preset)+
          (preset.capacity===null?" · Capacity not set":" · "+preset.capacity+" rider(s)/unit"));
        rate.style.cssText="font-size:.9em;opacity:.8";details.append(rate);
        if(preset.note){const note=element("small",preset.note);note.style.cssText="display:block;opacity:.65";details.append(note);}
        row.appendChild(details);
        row.appendChild(iconButton("pen-to-square","Edit "+preset.name,()=>this._edit(preset)));
        if(preset.builtIn&&preset.customized)
          row.appendChild(iconButton("rotate-left","Reset "+preset.name,()=>this._reset(preset,profile)));
        if(!preset.builtIn)row.appendChild(iconButton("trash","Delete "+preset.name,()=>this._delete(preset)));
        section.appendChild(row);
      }
      root.appendChild(section);
    }
    root.appendChild(element("p",
      "All non-walking methods are distance/time previews until checkpoint embark/disembark "+
      "transfers and method-specific travel-day rules are implemented. A compatible road does "+
      "not yet authorize guided movement. Costs are reference estimates only."));
  }

  async _edit(preset,surface="land",{scope="world",onSave=null}={}){
    if(!game.user?.isGM)throw new Error("Only a GM may edit transportation presets.");
    const existing=Boolean(preset),profile=selectedTransportationProfile(game.settings,game.system?.id);
    const before=snapshot();
    const sceneUnit=globalThis.canvas?.scene?.grid?.units??
      game.scenes?.current?.grid?.units??"";
    const body=element("div");
    body.className="atlas-transport-edit-dialog";
    body.style.cssText="display:grid;gap:.7rem;padding:.5rem;max-height:65vh;overflow-y:auto;";
    const value=preset??{name:"",kind:"vehicle",surface,speedMph:3,costCp:0,
      costBasis:"none",costApplies:"unit",capacity:null,purchaseGp:null,note:"",
      crewCount:0,crewWageCpPerDay:0,crewWageBasis:"day",includeCrewWages:false};
    const travelers=currentTravelers();
    body.setAttribute("data-atlas-travelers",String(travelers.count));
    body.appendChild(heading(existing?"Edit "+value.name:"New "+names[surface]+" transportation",
      scope==="checkpoint"?"Change local checkpoint settings; unchanged values continue to inherit World presets. Nothing is charged.":
      scope==="journey"?"Change this journey estimate only. World, checkpoint and Actor data will not change.":
      "Edit reference values for your World. Nothing is charged automatically."));
    const nav=element("nav");nav.setAttribute("role","tablist");
    nav.setAttribute("aria-label","Transportation preset editor sections");
    nav.style.cssText="display:flex;gap:.3rem;border-bottom:2px solid var(--color-border-light-tertiary,#555);";
    const panels={};
    for(const [id,label] of [["general","General"],["services","Services"],["cost","Ownership"]]){
      const tab=element("button",label);tab.type="button";
      tab.setAttribute("role","tab");tab.setAttribute("data-atlas-preset-tab",id);
      tab.setAttribute("aria-selected",String(id==="general"));
      tab.style.cssText="padding:.6rem 1rem;border-radius:.45rem .45rem 0 0;";
      nav.append(tab);
      const panel=element("section");panel.setAttribute("role","tabpanel");
      panel.setAttribute("data-atlas-preset-panel",id);
      panel.style.cssText="display:"+(id==="general"?"grid":"none")+";gap:.85rem;min-width:0;";
      panels[id]=panel;
    }
    body.append(nav,panels.general,panels.services,panels.cost);
    const row=(minimum="14rem",columns=null)=>{
      const section=element("div");
      section.className="atlas-transport-row"+(columns?" atlas-transport-row-"+columns:"");
      section.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax("+minimum+",1fr));gap:.75rem;align-items:start;min-width:0;";
      return section;
    };
    const preview=(headers,values,attribute)=>{
      const area=element("div");area.style.cssText="overflow-x:auto;min-width:0;";
      const table=element("table");
      table.style.cssText="width:100%;border-collapse:collapse;font-size:.9em;";
      const head=element("tr");
      for(const label of headers){const th=element("th",label);
        th.style.cssText="padding:.4rem;text-align:left;border-bottom:1px solid #777;";
        head.append(th);}
      const thead=element("thead");thead.append(head);table.append(thead);
      const tr=element("tr");
      for(const key of values){
        const td=element("td","—");
        td.setAttribute(attribute,"");
        td.setAttribute("data-atlas-preview-key",key);
        td.style.cssText="padding:.45rem;border-bottom:1px solid #555;";
        tr.append(td);
      }
      const tbody=element("tbody");tbody.append(tr);table.append(tbody);area.append(table);
      return area;
    };
    const serviceToggle=(name,checked,label,description)=>{
      const input=checkbox(name,checked);
      if(input.checked)input.setAttribute("checked","checked");
      const wrapper=element("label");
      wrapper.style.cssText="display:flex;gap:.55rem;align-items:center;";
      wrapper.append(input,element("strong",label));
      const box=element("div");box.className="atlas-transport-toggle";
      box.style.cssText="display:grid;gap:.25rem;";
      box.append(wrapper);
      if(description){const small=element("small",description);small.style.opacity=".75";box.append(small);}
      return box;
    };
    // General — identity, behavior and required crew.
    const name=element("input");name.name="name";name.type="text";
    name.maxLength=80;name.required=true;name.placeholder="e.g. Wind-powered skiff";
    name.value=value.name;name.defaultValue=value.name;
    if(preset&&(preset.builtIn||scope!=="world")){
      name.readOnly=true;name.title="Transportation method identity is World-owned.";}
    const kind=selected(TRANSPORT_KINDS.map(k=>[k,names[k]]),value.kind,"kind");
    if(preset&&(preset.builtIn||scope!=="world"))kind.disabled=true;
    const speedControl=preset?.id==="walking"?
      slider("worldSpeed",Number((sceneUnit?
        atlasDisplaySpeed(current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED),sceneUnit).value:
        current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED)).toFixed(2)),
        {min:.1,max:100,step:.1,numericStep:.01,label:"Fallback walking speed"}):
      slider("speedDisplay",Number(atlasDisplayPresetSpeed(value.speedMph).value.toFixed(2)),
        {min:.1,max:resolveAtlasMeasuringUnits()==="metric"?966:600,
        step:.1,numericStep:.01,label:"Travel planning speed"});
    const identity=row("12rem");
    identity.append(field("Name",name),field("Type",kind),
      field("Planning speed ("+(preset?.id==="walking"?
        (sceneUnit||"Scene units")+"/hour":atlasDisplayPresetSpeed(value.speedMph??3).unit)+")",
        speedControl,"Sustained travel pace, not combat speed."));
    panels.general.append(identity);
    const capacity=slider("capacity",value.capacity??"",{min:1,max:1000,step:1,
      numericStep:1,label:"Passenger capacity"});
    const capNumber=capacity.querySelector?.('[name="capacity"]')??capacity.children?.[1];
    if(capNumber&&value.capacity==null)capNumber.placeholder="Unspecified";
    if(preset?.id==="walking"){
      for(const input of capacity.querySelectorAll?.("input")??capacity.children??[])
        input.disabled=true;
    }
    const operations=row("13rem");
    operations.append(field("Passenger capacity",capacity,
      "Passenger seats excluding required crew."),
      field("Required crew",slider("crewCount",value.crewCount??0,
        {min:0,max:1000,step:1,numericStep:1,label:"Required crew count"}),
      "Crew separate from paying passengers; native ship values are reference counts."));
    panels.general.append(operations);
    const note=element("textarea");note.name="note";note.maxLength=240;
    note.rows=2;note.value=value.note??"";note.defaultValue=value.note??"";
    if(preset?.builtIn&&scope==="world"){note.readOnly=true;note.title="Reference note is read-only.";}
    panels.general.append(field("GM note",note,preset?.builtIn&&scope==="world"?
      "Reference note is read-only; use a custom transport for your own notes.":
      "Optional setting and world-building details."));

    // Services — hired quotes and optional operating schedules.
    panels.services.append(heading("Hired transportation",
      "Rates are GM estimates unless noted as published D&D references. No booking or payment occurs."));
    const toggles=row("16rem");
    const hireControl=serviceToggle("hireEnabled",value.hireEnabled??false,
      "Available for hire / passage","Single-rider mounts are not offered for hire by default.");
    const crewOption=serviceToggle("hireCrewIncluded",value.hireCrewIncluded??true,
      "Driver / crew included in fare","Included by default; never charge the same crew twice.");
    crewOption.setAttribute("data-atlas-hire-crew-option","");
    toggles.append(hireControl,crewOption);
    if(value.kind==="foot")toggles.style.opacity=".5";
    panels.services.append(toggles);
    const hireControls=element("div");hireControls.setAttribute("data-atlas-hire-controls","");
    hireControls.style.cssText="display:grid;gap:.85rem;";
    const hireRow=row("13rem");
    hireRow.append(field("Hired service fare",priceInput("hire",
        value.hireBasis==="mile"?atlasDisplayCostPerDistance(value.hireCostCp??0):
          value.hireCostCp??0),
      "Combine PP, GP, EP, SP and CP to set one fare."),
      field("Fare frequency",selected(TRANSPORT_HIRE_BASES.map(k=>[
        k,k==="trip"?"Once per trip":k==="day"?"Per operating day":
          "Per "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile")
      ]),value.hireBasis??"day","hireBasis"),
      "Trip = once; day = each operating day; distance = every mile/km traveled."),
      field("Charge per",selected([["unit","Whole mount or vehicle"],
        ["passenger","Each passenger"]],value.hireApplies??"unit","hireApplies"),
      "Whole vehicle charges once per required vehicle; passenger charges each traveler."));
    hireControls.append(hireRow);
    const overtime=row("13rem");
    overtime.append(serviceToggle("overtimeEnabled",value.overtimeEnabled??false,
      "Allow overtime travel","Requires GM choice in Navigation."),
      field("Extra hours per day (1–8)",
        slider("overtimeExtraHours",value.overtimeExtraHours??8,
          {min:1,max:8,step:1,numericStep:1,label:"Overtime hours"})),
      field("Overtime multiplier",
        slider("overtimeMultiplier",value.overtimeMultiplier??1.5,
          {min:1,max:5,step:.1,numericStep:.1,label:"Overtime multiplier"}),
        "Premium for extra travel hours."));
    hireControls.append(overtime);
    if(value.kind==="vehicle"&&["water","air"].includes(value.surface))
      hireControls.append(serviceToggle("continuousEnabled",value.continuousEnabled??false,
        "Allow continuous travel",
        "Ships or aircraft with suitable shifts or magic; not standard overland travel."));
    const hireExplanation=element("small",travelers.source+
      ". Preview assumes an 8-hour operating day; route-length fare follows that day's travel distance.");
    hireControls.append(hireExplanation);
    hireControls.append(preview(["Scenario","Charged to","Service fare","Estimated cost"],
      ["scenario","count","fare","total"],"data-atlas-hire-preview"));
    panels.services.append(hireControls);

    // Ownership — sale price, staff pay, and optional feed/maintenance.
    panels.cost.append(heading("Ownership",
      "Buying, staffing and maintaining a vehicle are separate from hired passage. Nothing is deducted."));
    const hiredOnly=["ship-passage","coach-hire"].includes(value.id);
    const purchase=row("16rem");
    purchase.append(serviceToggle("purchaseEnabled",!hiredOnly&&value.purchaseGp!==null,
      "Available for purchase","Sale is optional; ship passage is a service, not a vehicle."),
      field("Purchase price",priceInput("purchase",
        value.purchaseGp===null?0:value.purchaseGp*100)));
    const priceWrap=element("div");priceWrap.setAttribute("data-atlas-purchase-controls","");
    priceWrap.append(purchase.children?.[1]??element("span"));
    if(hiredOnly)panels.cost.append(element("p",
      "Hired-only passage is not a vehicle for sale. Crew and operating costs are part of the service."));
    else{
      const purchaseToggle=purchase.children?.[0];
      const buyRow=row("14rem",3);
      buyRow.append(purchaseToggle,priceWrap);panels.cost.append(buyRow);
      const wageRow=row("14rem",3);
      wageRow.append(field("Crew wage per person",priceInput("crewWage",
          value.crewWageCpPerDay??200),
        "D&D 2024 skilled hireling reference: 2 GP per operating day."),
        field("Wage frequency",selected(TRANSPORT_CREW_WAGE_BASES.map(k=>[
          k,k==="day"?"Per operating day":k==="trip"?"Per trip":"Per mile"
        ]),value.crewWageBasis??"day","crewWageBasis"),
        "Select how often each required crew member is paid."),
        serviceToggle("includeCrewWages",value.includeCrewWages??false,
          "Include crew wages in owned-trip costs",
          "This affects estimates only."));
      panels.cost.append(wageRow);
      panels.cost.append(preview(["Example journey","Crew","Wage each","Total crew pay"],
        ["scenario","count","wage","total"],"data-atlas-wage-preview"));
      const upkeepSection=element("section");
      upkeepSection.className="atlas-transport-upkeep-section";
      upkeepSection.append(heading("Feed, supplies and maintenance",
        "Recurring costs for owned transport. These estimates never deduct currency."));
      const upkeep=row("13rem",3);
      upkeep.append(field("Recurring upkeep",priceInput("cost",
          value.costBasis==="mile"?atlasDisplayCostPerDistance(value.costCp):value.costCp)),
        field("Upkeep frequency",selected(TRANSPORT_COST_BASES.map(k=>[
          k,k==="none"?"No recurring cost":k==="day"?"Per operating day":
            "Per "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile")
        ]),value.costBasis??"none","costBasis")),
        field("Charge upkeep per",selected([["unit","Whole mount or vehicle"],
          ["passenger","Each passenger"]],value.costApplies??"unit","costApplies")));
      upkeepSection.append(upkeep,preview(["Example journey","Total upkeep"],
        ["scenario","total"],"data-atlas-upkeep-preview"));
      panels.cost.append(upkeepSection);
    }
    const error=element("small","");error.setAttribute("data-atlas-quote-error","");
    panels.cost.append(error);
    // DialogV2 requires a plain outer HTMLDivElement with no attributes.
    const shell=element("div");shell.appendChild(body);
    const response=await foundry.applications.api.DialogV2.input({
      window:{title:existing?"Edit "+preset.name:"Add "+names[surface]+" transportation"},
      position:{width:Math.max(360,Math.min(860,(globalThis.window?.innerWidth??980)-60)),
        height:Math.max(460,Math.min(730,(globalThis.window?.innerHeight??850)-80))},
      content:shell,ok:{label:scope==="checkpoint"?"Apply checkpoint overrides":
        scope==="journey"?"Apply journey estimate":"Save preset"},rejectClose:false,modal:true,
      render:(app,html)=>{wireSliders(html??app?.element);wirePresetDialog(html??app?.element);}
    });
    if(!response)return;
    if(before!==snapshot())throw new Error("Transportation presets changed while you were editing. Reopen and review.");
    if(scope==="world"&&preset?.id==="walking"){
      const shown=Number(response.worldSpeed);
      const numeric=sceneUnit?atlasSceneDistanceFromDisplay(shown,sceneUnit):shown;
      if(!Number.isFinite(numeric)||numeric<.1||numeric>1000)
        throw new Error("Walking fallback speed must be between 0.1 and 1000 Scene units/hour.");
      await game.settings.set(MODULE_ID,NAVIGATION_SPEED_SETTING,numeric);
    }
    const id=preset?.id??"custom-"+(
      globalThis.foundry?.utils?.randomID?.(12)??crypto.randomUUID().replaceAll("-","").slice(0,12)
    ).toLowerCase();
    const rawCapacity=response.capacity===null||response.capacity===undefined||
      response.capacity===""?null:Number(response.capacity);
    if(rawCapacity!==null&&(!Number.isInteger(rawCapacity)||rawCapacity<1||rawCapacity>1000))
      throw new Error("Passenger capacity must be a positive whole number.");
    const crewCount=Number(response.crewCount??0);
    if(!Number.isInteger(crewCount)||crewCount<0||crewCount>1000)
      throw new Error("Crew count must be a whole number between 0 and 1000.");
    const hiredOnlyChoice=["ship-passage","coach-hire"].includes(id);
    const crewWageCpPerDay=hiredOnlyChoice?(value.crewWageCpPerDay??200):
      currencyFromResponse(response,"crewWage");
    const crewWageBasis=hiredOnlyChoice?(value.crewWageBasis??"day"):
      String(response.crewWageBasis??"day");
    const includeCrewWages=!hiredOnlyChoice&&(response.includeCrewWages===true||
      response.includeCrewWages==="on"||response.includeCrewWages==="true");
    const enteredCost=hiredOnlyChoice?value.costCp:currencyFromResponse(response,"cost");
    const bool=name=>response[name]===true||response[name]==="on"||response[name]==="true";
    const canBuy=bool("purchaseEnabled")&&!hiredOnlyChoice;
    const purchaseGp=!canBuy?null:currencyFromResponse(response,"purchase")/100;
    const hireEntered=currencyFromResponse(response,"hire");
    const hireCostCp=String(response.hireBasis)==="mile"?
      atlasCostPerMileFromDisplay(hireEntered):hireEntered;
    const next={...value,id,
      name:preset&&(preset.builtIn||scope!=="world")?value.name:String(response.name??"").trim(),
      kind:preset&&(preset.builtIn||scope!=="world")?value.kind:String(response.kind??""),
      surface:preset&&(preset.builtIn||scope!=="world")?value.surface:String(response.surface??""),
      speedMph:id==="walking"?null:atlasPresetSpeedFromDisplay(Number(response.speedDisplay)),
      capacity:id==="walking"?null:rawCapacity,
      costCp:!hiredOnlyChoice&&String(response.costBasis)==="mile"?
        atlasCostPerMileFromDisplay(enteredCost):enteredCost,
      costBasis:String(response.costBasis??value.costBasis),
      costApplies:String(response.costApplies??value.costApplies),
      purchaseGp,crewCount,crewWageCpPerDay,crewWageBasis,includeCrewWages,
      hireEnabled:bool("hireEnabled"),hireCostCp,
      hireBasis:String(response.hireBasis),hireApplies:String(response.hireApplies),
      hireCrewIncluded:bool("hireCrewIncluded"),
      overtimeEnabled:bool("overtimeEnabled"),
      overtimeExtraHours:Number(response.overtimeExtraHours),
      overtimeMultiplier:Number(response.overtimeMultiplier),
      continuousEnabled:bool("continuousEnabled"),
      note:scope==="world"&&preset?.builtIn?value.note:String(response.note??"")};
    if(onSave){
      await onSave(next);
      return next;
    }
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
      content:"<p>Import all additional creature, spell, magical-item and campaign vehicle "+
        "examples from the supplied 5e workbook? These are optional planning references, "+
        "not the D&D 2024 sustained mount rules. Atlas will preserve any examples already "+
        "imported or edited, and will never replace a built-in preset.</p>"
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
      panel.appendChild(field(label,slider(name,current(key,fallback),
        {min,max,step,label:label}),
        "Applies when Rules Profile is Custom. Drag the slider or type a precise value."));
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
    const panel=element("div");panel.style.cssText="display:grid;gap:.85rem;max-width:48rem;";
    const clock=checkbox("clock",current(NAVIGATION_WORLD_CLOCK_SETTING,false));
    const clockRow=element("label");clockRow.style.cssText="display:flex;gap:.6rem;align-items:center;";
    clockRow.append(clock,element("span","Advance World time for confirmed travel and GM-approved rests"));
    panel.append(clockRow);
    const playbackControl=slider("playback",
      current(NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT),
      {min:NAVIGATION_PLAYBACK_MIN,max:NAVIGATION_PLAYBACK_MAX,step:.5,
        label:"Animation speed"});
    panel.appendChild(field("Animation speed (real seconds per in-game travel hour)",
      playbackControl,"Only changes visual playback; never travel hours or World time. "+
        "Smaller numbers make the movement animation faster."));
    const card=element("section");
    card.style.cssText="border:1px solid var(--color-border-light-primary,#666);"+
      "border-radius:.6rem;padding:.75rem;display:grid;gap:.6rem;";
    card.appendChild(element("strong","Preview: three sample trips"));
    card.appendChild(element("small","Illustrative journeys at 3 mph (normal overland pace); "+
      "real trips use the selected party and terrain. Samples stay fixed while you adjust "+
      "animation speed. Playback is capped between 2 seconds and 10 minutes."));
    const table=element("table");
    table.style.cssText="width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;";
    const header=element("tr");
    for(const label of ["Trip distance","In-game moving time","Real animation time"]){
      const th=element("th",label);th.scope="col";
      th.style.cssText="text-align:left;padding:.45rem;border-bottom:1px solid #777;";
      header.append(th);
    }
    const thead=element("thead");thead.appendChild(header);table.appendChild(thead);
    const tbody=element("tbody");
    const preview=[];
    for(const distanceMi of this.exampleDistancesMi){
      const row=element("tr"),distance=element("td",
        atlasFormatMeasure(atlasDisplayDistance(distanceMi,"mi"),1));
      const hours=element("td"),duration=element("td");
      for(const cell of [distance,hours,duration])
        cell.style.cssText="padding:.45rem;border-bottom:1px solid #555;";
      row.append(distance,hours,duration);tbody.appendChild(row);
      preview.push({distanceMi,hours,duration});
    }
    table.appendChild(tbody);card.appendChild(table);panel.appendChild(card);
    const refresh=()=>{
      const speed=Number(playbackControl.children[1]?.value);
      if(!Number.isFinite(speed)||speed<NAVIGATION_PLAYBACK_MIN||
          speed>NAVIGATION_PLAYBACK_MAX)return;
      for(const sample of preview){
        const estimate=exampleTripPlayback(sample.distanceMi,speed);
        sample.hours.textContent=estimate.travelHours.toFixed(1)+" h";
        sample.duration.textContent=formatPlaybackDuration(estimate.durationSeconds);
      }
    };
    playbackControl.children[0]?.addEventListener("input",refresh);
    playbackControl.children[1]?.addEventListener("input",refresh);
    refresh();
    panel.appendChild(button("Save journey options",async()=>{
      if(!game.user?.isGM)throw new Error("GM access required.");
      const playback=Number(playbackControl.children[1]?.value);
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

/** Opens the one World transportation editor for a non-World scope.
 * Callers own the Save callback; this helper never changes World settings.
 */
export async function openTransportationMethodEditor({method,scope,onSave}={}){
  if(!method||!["checkpoint","journey"].includes(scope)||
      typeof onSave!=="function")throw Error("Invalid transportation editor context.");
  const app=new AtlasTransportationSettings();
  return app._edit(method,method.surface,{scope,onSave});
}

