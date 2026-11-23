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
import { resolveNavigationTravelRules,NAVIGATION_RULES_PROFILE_SETTING,
  NAVIGATION_RULES_PROFILES,CUSTOM_DAY_HOURS_SETTING,CUSTOM_OVERNIGHT_HOURS_SETTING,
  CUSTOM_SHORT_REST_HOURS_SETTING,CUSTOM_LONG_REST_HOURS_SETTING }
  from "./navigation-rules-profile.js";
import { NAVIGATION_WORLD_CLOCK_SETTING } from "./navigation-world-clock.js";
import {readPartyExploration} from "./party-exploration-storage.js";
import {projectGroupTransportation,readGroupTransportation} from "./navigation-group-transport.js";
import { NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING,
  NAVIGATION_MOUNTED_SPEED_DEFAULT,NAVIGATION_SAILING_SPEED_DEFAULT }
  from "./navigation-travel-method.js";
import { createSettingsSelect,createSettingsGroupedSelect } from "./settings-select.js";
import {LIVESTOCK_FARE_PERCENT_SETTING,LIVESTOCK_FARE_PERCENT_DEFAULT,
  readLivestockFarePercent,validLivestockFarePercent}
  from "./navigation-transport-service.js";
import { createSettingsCategoryTabs } from "./settings-category-tabs.js";
import { createAtlasIconButton } from "./ui-action-button.js";
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
  const control=createAtlasIconButton({icon,label});
  control.addEventListener("click",async()=>{
    control.disabled=true;
    try{await action();}
    catch(error){
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
  const tabs=[...root.querySelectorAll("[data-atlas-preset-tab]")].filter(tab=>!tab.disabled);
  if(!tabs.length)return;
  const panels=[...root.querySelectorAll("[data-atlas-preset-panel]")];
  const activate=id=>{
    for(const tab of tabs){
      const chosen=tab.dataset.atlasPresetTab===id;
      tab.setAttribute("aria-selected",String(chosen));
      tab.tabIndex=chosen?0:-1;
    }
    for(const panel of panels){
      const chosen=panel.dataset.atlasPresetPanel===id;
      panel.hidden=!chosen;
      panel.style.display=chosen?"grid":"none";
    }
  };
  for(const [index,tab] of tabs.entries()){
    if(tab.dataset.atlasWired==="true")continue;
    tab.dataset.atlasWired="true";
    tab.addEventListener("click",()=>activate(tab.dataset.atlasPresetTab));
    tab.addEventListener("keydown",event=>{
      const next=event.key==="ArrowRight"?(index+1)%tabs.length:
        event.key==="ArrowLeft"?(index+tabs.length-1)%tabs.length:
        event.key==="Home"?0:event.key==="End"?tabs.length-1:-1;
      if(next<0)return;
      event.preventDefault();
      activate(tabs[next].dataset.atlasPresetTab);
      tabs[next].focus();
    });
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
      const animalMode=fieldValue("livestockFareMode")?.value??"global";
      for(const input of root.querySelectorAll(
        '[name="livestockFarePercent"],[data-atlas-range-for="livestockFarePercent"]'))
        input.disabled=animalMode!=="percent";
      for(const input of root.querySelectorAll(
        '[name="livestockAmount"],[name="livestockDenom"],[data-atlas-range-for="livestockAmount"]'))
        input.disabled=animalMode!=="fixed";
      const crewOption=root.querySelector("[data-atlas-hire-crew-option]");
      if(crewOption){crewOption.style.opacity=hireOn?"1":".42";
        crewOption.style.pointerEvents=hireOn?"auto":"none";}
      const unlimited=fieldValue("hireUnlimited")?.checked!==false;
      for(const control of root.querySelectorAll(
        '[name="hireQuantity"],[data-atlas-range-for="hireQuantity"]'))
        control.disabled=!hireOn||unlimited;
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
/** Keep owned Party values on the shared transport form without editing World data. */
function wireGroupOwnedTransport(root,profiles) {
  if(!root?.querySelector)return;
  const get=name=>root.querySelector('[name="'+name+'"]');
  const custom=["groupSpeedCustom","groupCapacityCustom","groupCostCustom",
    "groupBasisCustom","groupAppliesCustom","groupNoteCustom"];
  for(const input of root.querySelectorAll?.(
    '[data-atlas-preset-panel="services"] input, [data-atlas-preset-panel="services"] select, [data-atlas-preset-panel="services"] button')??[])
    input.disabled=true;
  const put=(name,value)=>{
    const input=get(name);if(input)input.value=String(value??"");
    const range=root.querySelector?.('[data-atlas-range-for="'+name+'"]');
    if(range&&value!=null&&value!=="")range.value=String(value);
  };
  const money=(prefix,cp)=>{
    let rest=Math.max(0,Math.round(Number(cp)||0));
    for(const [unit,ratio] of [["pp",1000],["gp",100],["ep",50],["sp",10],["cp",1]]){
      const n=Math.floor(rest/ratio);rest-=n*ratio;put(prefix+"_"+unit,n);
    }
  };
  const populate=()=>{
    const method=profiles.find(p=>p.id===get("groupProfileId")?.value);
    if(!method)return;
    if(!get("groupSpeedCustom")?.checked)
      put("speedDisplay",Number(atlasDisplayPresetSpeed(method.speedMph).value.toFixed(2)));
    if(!get("groupCapacityCustom")?.checked)put("capacity",method.capacity??"");
    if(!get("groupCostCustom")?.checked)
      money("cost",method.costBasis==="mile"?
        atlasDisplayCostPerDistance(method.costCp):method.costCp);
    if(!get("groupBasisCustom")?.checked)put("costBasis",method.costBasis);
    if(!get("groupAppliesCustom")?.checked)put("costApplies",method.costApplies);
    if(!get("groupNoteCustom")?.checked)put("note",method.note??"");
  };
  root.querySelector?.("[data-atlas-scope-reset]")?.addEventListener("click",()=>{
    for(const name of custom){const flag=get(name);if(flag)flag.checked=false;}
    populate();
  });
  // No second set of visible Customize controls. Editing an existing field
  // explicitly overrides its inherited value until Reset; initial saved
  // overrides remain selected for the lifetime of this draft.
  const groupFields={
    speedDisplay:"groupSpeedCustom",capacity:"groupCapacityCustom",
    costBasis:"groupBasisCustom",costApplies:"groupAppliesCustom",
    note:"groupNoteCustom"
  };
  const mark=event=>{
    const name=event?.target?.getAttribute?.("data-atlas-range-for")||
      event?.target?.name||"";
    const override=groupFields[name]||
      (name.startsWith("cost_")?"groupCostCustom":null);
    if(override){const input=get(override);if(input)input.checked=true;}
  };
  root.addEventListener("input",mark);
  root.addEventListener("change",mark);
  get("groupProfileId")?.addEventListener("change",populate);
  populate();
}
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
  async _renderHTML(){
    const root=element("section");
    root.style.cssText="padding:1rem;display:flex;flex-direction:column;gap:.75rem;"+
      "height:100%;overflow:hidden;box-sizing:border-box;";
    const top=heading("Transportation Presets",
      "Manage travel speeds and transport costs for this Foundry World. "+
      "Changes affect future estimates; no Actor resources or currency are changed.");
    root.appendChild(top);
    this._renderMethods(root);
    return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}

  _renderMethods(root){
    const profile=selectedTransportationProfile(game.settings,game.system?.id);
    root.appendChild(element("p","World mount boarding fare: "+
      readLivestockFarePercent(game.settings)+"% of each passenger fare by default. "+
      "Change the World slider in Foundry Module Settings (Atlas — Mount Boarding Fare); "+
      "override per vehicle in Services or for this Journey. Explicit fixed animal fares remain valid."));
    root.appendChild(element("p","Reference: "+(
      profile==="dnd5e2024"?"D&D 2024 / 5.5e":
      profile==="dnd5e2014"?"D&D 2014 / 5e":
      profile==="custom"?"Custom (2024 starting values)":"System-neutral (2024 examples)")+
      ". Changing the Rules Profile changes built-in reference values. GM edits are saved separately for each profile."));
    const toolbar=element("div");toolbar.style.cssText="display:flex;gap:.5rem;flex-wrap:wrap;";
    toolbar.append(button("＋ Import optional workbook examples",()=>this._importExamples()));
    root.appendChild(toolbar);
    const methods=listTransportationPresets(game.settings,game.system?.id);
    const tabs=createSettingsCategoryTabs({id:"atlas-transport-catalog",
      modes:[["land","Land"],["water","Water"],["air","Air"]],
      active:this.activeCategory??"land",onChange:id=>{this.activeCategory=id;}});
    root.appendChild(tabs.nav);
    const scroll=element("div");
    scroll.className="atlas-world-category-scroll";
    scroll.style.cssText="flex:1 1 auto;min-height:0;overflow:auto;";
    root.appendChild(scroll);
    for(const surface of TRANSPORT_SURFACES){
      const group=methods.filter(p=>p.surface===surface);
      const section=element("fieldset");
      section.style.cssText="display:grid;gap:.65rem;min-width:0;border-radius:.5rem;";
      const legend=element("legend");legend.style.cssText="display:flex;align-items:center;gap:.5rem;font-weight:700;";
      legend.appendChild(element("span",names[surface]+" travel"));
      const add=iconButton("plus","Add "+names[surface].toLowerCase()+" transport",()=>this._edit(null,surface));

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
      scroll.appendChild(tabs.addPanel(surface,section));
    }
    scroll.appendChild(element("p",
      "All non-walking methods are distance/time previews until checkpoint embark/disembark "+
      "transfers and method-specific travel-day rules are implemented. A compatible road does "+
      "not yet authorize guided movement. Costs are reference estimates only."));
  }

  async _edit(preset,surface="land",{scope="world",onSave=null,onReset=null,
    onSaveCheckpoint=null,checkpointName=null,journeyOperation=null,
    groupAssignment=null,profiles=[],groupActorName="",groupKind="vehicle",
    groupRiders=[]}={}){
    if(!game.user?.isGM)throw new Error("Only a GM may edit transportation presets.");
    const group=scope==="group";
    if(group&&(typeof onSave!=="function"||!["mount","vehicle"].includes(groupKind)))
      throw Error("Invalid Party transportation editor context.");
    const existing=Boolean(preset),profile=selectedTransportationProfile(game.settings,game.system?.id);
    const before=snapshot();
    const initialWalkingSpeed=preset?.id==="walking"?
      current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED):null;
    const sceneUnit=globalThis.canvas?.scene?.grid?.units??
      game.scenes?.current?.grid?.units??"";
    const body=element("div");
    body.className="atlas-transport-edit-dialog";
    body.style.cssText="display:grid;gap:.7rem;padding:.5rem;max-height:min(54vh,540px);overflow-y:auto;";
    const baseline=groupAssignment??{};
    const baseValue=preset??{name:groupActorName,kind:groupKind,surface,
      speedMph:3,costCp:0,costBasis:"none",costApplies:"unit",capacity:null,
      purchaseGp:null,note:"",crewCount:0,crewWageCpPerDay:0,crewWageBasis:"day",
      includeCrewWages:false};
    const value=group?{...baseValue,name:groupActorName||baseValue.name,
      kind:groupKind,
      speedMph:baseline.speedMphOverride??baseValue.speedMph,
      capacity:baseline.capacity??baseValue.capacity,
      costCp:baseline.costCpOverride??baseValue.costCp,
      costBasis:baseline.costBasisOverride??baseValue.costBasis,
      costApplies:baseline.costAppliesOverride??baseValue.costApplies,
      purchaseGp:baseline.purchaseGpOverride==="none"?null:
        baseline.purchaseGpOverride??baseValue.purchaseGp,
      note:baseline.noteOverride??baseValue.note}:baseValue;
    const travelers=currentTravelers();
    body.setAttribute("data-atlas-travelers",String(travelers.count));
    body.appendChild(heading(group?"Edit "+(groupActorName||value.name):existing?
      "Edit "+value.name:"New "+names[surface]+" transportation",
      group?"Edit this Party-owned resource using the shared transportation settings. "+
        "Unchecked customizations inherit the linked World profile. Apply changes only the Party draft.":
      scope==="checkpoint"?"Change local Map Marker settings; unchanged values continue to inherit World presets. Nothing is charged.":
      scope==="journey"?(onSaveCheckpoint?"Save explicitly for this trip or to this Map Marker. World and Actor data will not change.":"Save this journey estimate only. World, Map Marker and Actor data will not change."):
      "Edit reference values for your World. Nothing is charged automatically."));
    const nav=element("nav");nav.setAttribute("role","tablist");
    nav.setAttribute("aria-label","Transportation preset editor sections");
    nav.style.cssText="display:flex;gap:.3rem;border-bottom:2px solid var(--color-border-light-tertiary,#555);";
    const panels={};
    for(const [id,label] of [["general","General"],["services","Services"],["cost","Ownership"]]){
      const tab=element("button",label);tab.type="button";
      tab.setAttribute("role","tab");tab.setAttribute("data-atlas-preset-tab",id);
      tab.setAttribute("aria-selected",String(id==="general"));
      if(group&&id==="services"){
        tab.disabled=true;tab.setAttribute("aria-disabled","true");
        tab.title="Party-owned transportation is not a hired service.";
      }
      tab.tabIndex=id==="general"?0:-1;
      tab.style.cssText="padding:.6rem 1rem;border-radius:.45rem .45rem 0 0;";
      nav.append(tab);
      const panel=element("section");panel.setAttribute("role","tabpanel");
      panel.setAttribute("aria-label",label);
      panel.setAttribute("data-atlas-preset-panel",id);
      panel.hidden=id!=="general";
      panel.style.cssText="display:"+(id==="general"?"grid":"none")+";gap:.85rem;min-width:0;";
      panels[id]=panel;
    }
    body.append(nav,panels.general,panels.services,panels.cost);
    if(group){
      panels.services.setAttribute("inert","");
      panels.services.setAttribute("aria-disabled","true");
      const options=profiles.filter(item=>item.kind===groupKind);
      const selectedId=String(baseline.profileId??"");
      const groups=[{label:null,options:[["","No linked World profile"]]}];
      for(const surface of TRANSPORT_SURFACES){
        const members=options.filter(item=>item.surface===surface)
          .sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"})||
            a.id.localeCompare(b.id));
        if(members.length)groups.push({label:names[surface],
          options:members.map(item=>[item.id,item.name])});
      }
      if(selectedId&&!options.some(item=>item.id===selectedId))
        groups.push({label:null,options:[[selectedId,"Unavailable profile: "+selectedId]]});
      const profileSelect=createSettingsGroupedSelect(groups,{
        selectedId,name:"groupProfileId",ariaLabel:"Transportation profile"});
      profileSelect.style.cssText="width:100%;min-width:0;";
      const groupFields=element("div");
      groupFields.className="atlas-transport-row";
      groupFields.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:.75rem;";
      groupFields.append(
        field("Transportation profile",profileSelect,
          "Choose a World profile by ID; changing the profile never modifies the catalog."),
        field("Quantity Available",slider("groupQuantity",baseline.quantity??1,
          {min:1,max:100,step:1,numericStep:1,label:"Quantity Available"}),
          "Number of owned mounts or vehicles represented by this Actor.")
      );
      if(groupKind==="mount"){
        const riders=[["","None — shared mount"],...groupRiders.map(rider=>
          [rider.id,rider.name+" · "+rider.id])];
        const assignedId=String(baseline.assignedTo??"");
        if(assignedId&&!groupRiders.some(rider=>rider.id===assignedId))
          riders.push([assignedId,"Unavailable party member: "+assignedId]);
        const assigned=createSettingsSelect(riders,{selectedId:assignedId,
          name:"groupAssignedTo",ariaLabel:"Assigned To"});
        groupFields.append(field("Assigned To",assigned,
          "Optional exclusive personal mount for one current party member. "+
          "A shared pool must have no assignee. Does not board an Actor."));
      }
      panels.general.appendChild(groupFields);
      panels.general.appendChild(element("p",
        "Changing a value creates a Party-only override. Reset to inherit World defaults."));
    }
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
    if(group||preset&&(preset.builtIn||scope!=="world")){
      name.readOnly=true;name.title="Transportation method identity is World-owned.";}
    const kind=selected(TRANSPORT_KINDS.map(k=>[k,names[k]]),value.kind,"kind");
    if(group||preset&&(preset.builtIn||scope!=="world"))kind.disabled=true;
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
    const groupOverride=(name,isOverridden)=>{
      const flag=checkbox(name,isOverridden);
      flag.hidden=true;
      flag.style.display="none";
      return flag;
    };
    if(group)panels.general.append(groupOverride("groupSpeedCustom",
      baseline.speedMphOverride!=null));
    const capacity=slider("capacity",value.capacity??"",{min:1,max:1000,step:1,
      numericStep:1,label:"Passenger capacity"});
    const capNumber=capacity.querySelector?.('[name="capacity"]')??capacity.children?.[1];
    if(capNumber&&value.capacity==null)capNumber.placeholder="Unspecified";
    if(preset?.id==="walking"){
      for(const input of capacity.querySelectorAll?.("input")??capacity.children??[])
        input.disabled=true;
    }
    const operations=row("13rem");
    const crewControl=slider("crewCount",value.crewCount??0,
      {min:0,max:1000,step:1,numericStep:1,label:"Required crew count"});
    if(group)for(const input of crewControl.querySelectorAll?.("input")??crewControl.children??[])
      input.disabled=true;
    operations.append(field("Passenger capacity",capacity,
      "Passenger seats excluding required crew."));
    if(!group)operations.append(field("Required crew",crewControl,
      "Crew separate from paying passengers; native ship values are reference counts."));
    panels.general.append(operations);
    if(group)panels.general.append(groupOverride("groupCapacityCustom",
      baseline.capacity!=null));
    const note=element("textarea");note.name="note";note.maxLength=240;
    note.rows=2;note.value=value.note??"";note.defaultValue=value.note??"";
    if(preset?.builtIn&&scope==="world"){note.readOnly=true;note.title="Reference note is read-only.";}
    if(group)panels.general.append(groupOverride("groupNoteCustom",
      baseline.noteOverride!=null));
    panels.general.append(field("GM note",note,preset?.builtIn&&scope==="world"?
      "Reference note is read-only; use a custom transport for your own notes.":
      "Optional setting and world-building details."));
    // Per-Journey schedule is a trip decision, not a World transport preset.
    // Keep it in the shared editor to avoid a second, contradictory selector.
    if(scope==="journey"&&journeyOperation!==null){
      const daily=resolveNavigationTravelRules({
        settings:game.settings,systemId:game.system?.id,actorHoursPerDay:null});
      const regularHours=daily.dailyHours??8;
      const choices=[["normal","Standard — "+regularHours+"h/day"]];
      if(value.overtimeEnabled)choices.push(["overtime",
        "Overtime — up to "+(8+(value.overtimeExtraHours??8))+"h/day"]);
      if(value.continuousEnabled&&value.kind==="vehicle")
        choices.push(["continuous","Continuous — 24h/day"]);
      panels.general.append(field("Operating schedule for this journey",
        selected(choices,journeyOperation,"atlasJourneyOperation"),
        "Saved with this trip only. The World method determines which schedules are available."));
    }

    // Services — hired quotes and optional operating schedules.
    panels.services.append(heading("Hired transportation",
      "Rates are GM estimates unless noted as published D&D references. No booking or payment occurs."));
    const toggles=row("16rem");
    const hireControl=serviceToggle("hireEnabled",value.hireEnabled??false,
      "Available for hire / passage","Single-rider mounts are not offered for hire by default.");
    const crewOption=serviceToggle("hireCrewIncluded",value.hireCrewIncluded??true,
      "Driver / crew included in fare","Included by default; never charge the same crew twice.");
    crewOption.setAttribute("data-atlas-hire-crew-option","");
    toggles.append(hireControl);
    if(scope==="checkpoint"||scope==="journey"&&checkpointName){
      toggles.append(serviceToggle("hireUnlimited",value.hireUnlimited??true,
        "Unlimited availability","Enough units may always be hired at this Map Marker."),
        field("Quantity available",
          slider("hireQuantity",value.hireQuantity??1,
            {min:0,max:100,step:1,numericStep:1,label:"Vehicles available"}),
          "Finite number of mounts or vehicles at this location."));
    }
    toggles.append(crewOption);
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
    if(value.kind==="vehicle"&&["land","water","air"].includes(value.surface)){
      const livestock=row("13rem");
      livestock.append(field("Animal spaces per vehicle",
        numberInput("livestockCapacity",value.livestockCapacity??"",
          {min:0,max:1000,step:1}),
        "Blank = unlimited (default); 0 = prohibited; positive = animal spaces per vehicle. Passenger seats stay separate."),
        field("Mount boarding fare policy",
          selected([["global","Inherit World default (%)"],
            ["percent","Custom percentage of passenger fare"],
            ["fixed","Custom fixed fare per mount"]],
          value.livestockFareCp!=null?"fixed":
            value.livestockFarePercent!=null?"percent":"global","livestockFareMode"),
          "Applies to passenger-priced hired transport; flat fares replace the percentage."),
        field("Mount fare (% of passenger)",
          slider("livestockFarePercent",value.livestockFarePercent??
            current(LIVESTOCK_FARE_PERCENT_SETTING,LIVESTOCK_FARE_PERCENT_DEFAULT),
            {min:0,max:200,step:5,numericStep:5,label:"Mount fare as passenger percentage"}),
          "0–200%; used only when Custom percentage is selected."),
        field("Fare per physical mount",priceInput("livestock",
          value.livestockFareBasis==="mile"?
            atlasDisplayCostPerDistance(value.livestockFareCp??0):
            value.livestockFareCp??0)),
        field("Animal fare basis",selected(TRANSPORT_HIRE_BASES.map(k=>[
          k,k==="trip"?"Once per trip":k==="day"?"Per operating day":
            "Per "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile")
        ]),value.livestockFareBasis??"trip","livestockFareBasis")));
      // Owned and hired vehicles both need animal accommodation even when hire
      // is disabled. This must not inherit the hire-only pointer-events lock.
      panels.services.append(heading("Animal accommodation",
        "Separate from passenger seats, for owned and hired land, water, and air vehicles."));
      panels.services.append(livestock);
    }
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
    if(value.kind==="vehicle")
      hireControls.append(serviceToggle("continuousEnabled",value.continuousEnabled??false,
        "Allow continuous travel",
        "Vehicles with rotating drivers, crew, magic or equivalent; never assumed for a normal trip."));
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
    if(group)panels.cost.append(element("small",
      "Purchase offers and crew wages are configured in World transportation presets."));
    if(hiredOnly)panels.cost.append(element("p",
      "Hired-only passage is not a vehicle for sale. Crew and operating costs are part of the service."));
    else{
      const purchaseToggle=purchase.children?.[0];
      const buyRow=row("14rem",3);
      buyRow.append(purchaseToggle,priceWrap);
      if(!group)panels.cost.append(buyRow);
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
      if(!group)panels.cost.append(wageRow);
      if(!group)panels.cost.append(preview(["Example journey","Crew","Wage each","Total crew pay"],
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
      if(group)upkeepSection.append(
        groupOverride("groupCostCustom",baseline.costCpOverride!=null),
        groupOverride("groupBasisCustom",baseline.costBasisOverride!=null),
        groupOverride("groupAppliesCustom",baseline.costAppliesOverride!=null));
      upkeepSection.append(upkeep,preview(["Example journey","Total upkeep"],
        ["scenario","total"],"data-atlas-upkeep-preview"));
      panels.cost.append(upkeepSection);
    }
    const error=element("small","");error.setAttribute("data-atlas-quote-error","");
    panels.cost.append(error);
    if(scope!=="world"&&(onReset||group)){
      const reset=element("button",scope==="checkpoint"?
        "Clear Map Marker overrides (inherit World)":scope==="group"?
        "Reset Party customizations (inherit World)":"Reset journey overrides");
      reset.type="button";reset.setAttribute("data-atlas-scope-reset","");
      reset.style.cssText="justify-self:start;";
      body.append(reset);
    }
    // DialogV2 requires a plain outer HTMLDivElement with no attributes.
    const shell=element("div");shell.appendChild(body);
    const response=await foundry.applications.api.DialogV2.input({
      window:{title:group?"Atlas — Edit "+(groupActorName||value.name)+" Transportation":
        existing?"Edit "+preset.name:"Add "+names[surface]+" transportation"},
      position:{width:Math.max(360,Math.min(860,(globalThis.window?.innerWidth??980)-60)),
        height:Math.max(400,Math.min(680,(globalThis.window?.innerHeight??850)-110))},
      content:shell,ok:{label:group?"Apply to Party draft":
        scope==="checkpoint"?"Apply Map Marker overrides":
        scope==="journey"?"Save for this trip":"Save preset"},
      buttons:scope==="journey"&&onSaveCheckpoint?[{
        action:"checkpoint",label:"Save to "+(checkpointName??"Map Marker"),
        callback:(_event,button)=>({
          ...new foundry.applications.ux.FormDataExtended(button.form).object,
          __atlasSaveScope:"checkpoint"
        })
      }]:[],rejectClose:false,modal:true,
      render:(app,html)=>{
        const root=html??app?.element;
        wireSliders(root);wirePresetDialog(root);
        if(group)wireGroupOwnedTransport(root,profiles);
        const reset=root?.querySelector?.("[data-atlas-scope-reset]");
        if(reset&&onReset&&!reset.dataset?.atlasResetWired){
          if(reset.dataset)reset.dataset.atlasResetWired="true";
          reset.addEventListener("click",async()=>{
            reset.disabled=true;
            try{await onReset();await app.close();}
            catch(error){reset.disabled=false;
              globalThis.ui?.notifications?.error?.(error.message??String(error));}
          });
        }
      }
    });
    if(!response)return;
    if(group){
      if(before!==snapshot())
        throw Error("World transportation presets changed. Reopen the Party editor.");
      const chosen=String(response.groupProfileId??"");
      if(chosen&&!profiles.some(item=>item.id===chosen&&item.kind===groupKind))
        throw Error("Choose an available compatible World transportation profile.");
      const integer=(label,value,min,max,optional=false)=>{
        if(optional&&(value===null||value===undefined||value===""))return null;
        const n=Number(value);
        if(!Number.isInteger(n)||n<min||n>max)
          throw Error(label+" must be a whole number between "+min+" and "+max+".");
        return n;
      };
      const active=name=>response[name]===true||response[name]==="on"||
        response[name]==="true";
      const noteOverride=active("groupNoteCustom")?String(response.note??"").trim():null;
      if(noteOverride!==null&&noteOverride.length>240)
        throw Error("GM note must not exceed 240 characters.");
      const speed=active("groupSpeedCustom")?
        atlasPresetSpeedFromDisplay(Number(response.speedDisplay)):null;
      if(!chosen&&speed!==null)
        throw Error("Link a World profile before customizing Party travel speed.");
      if(speed!==null&&(!Number.isFinite(speed)||speed<.1||speed>600))
        throw Error("Party speed override must be between 0.1 and 600 mph.");
      const costBasis=active("groupBasisCustom")?String(response.costBasis??""):null;
      const costApplies=active("groupAppliesCustom")?String(response.costApplies??""):null;
      if(costBasis!==null&&!TRANSPORT_COST_BASES.includes(costBasis)||
         costApplies!==null&&!["unit","passenger"].includes(costApplies))
        throw Error("Invalid Party recurring-cost policy.");
      const groupCost=active("groupCostCustom")?
        currencyFromResponse(response,"cost"):null;
      const convertedCost=groupCost!==null&&
        (costBasis??profiles.find(p=>p.id===chosen)?.costBasis??"none")==="mile"?
        atlasCostPerMileFromDisplay(groupCost):groupCost;
      if(convertedCost!==null&&(!Number.isFinite(convertedCost)||
        convertedCost<0||convertedCost>100000000))
        throw Error("Party upkeep must be a valid nonnegative amount.");
      // Existing v4/v5 purchase overrides survive unrelated Party edits.
      // Purchase offers belong to World presets, not already-owned resources.
      const purchase=baseline.purchaseGpOverride??null;
      if(typeof purchase==="number"&&(!Number.isFinite(purchase)||
        purchase<0||purchase>100000000))
        throw Error("Invalid Party purchase price.");
      const quantity=integer("Quantity Available",response.groupQuantity,1,100);
      const assignedTo=group&&groupKind==="mount"?
        String(response.groupAssignedTo??"")||null:null;
      if(assignedTo&&(quantity!==1||
          !groupRiders.some(rider=>rider.id===assignedTo)))
        throw Error("Assigned To requires one mount and a current eligible Party member. "+
          "Choose None before increasing Quantity Available.");
      const next={
        profileId:chosen||null,quantity,assignedTo,
        capacity:active("groupCapacityCustom")?
          integer("Passenger seats",response.capacity,1,1000,true):null,
        speedMphOverride:speed,
        costCpOverride:convertedCost,
        costBasisOverride:costBasis,costAppliesOverride:costApplies,
        purchaseGpOverride:purchase,noteOverride
      };
      await onSave(next);
      return next;
    }
    if(scope==="world"&&!onSave){
      if(selectedTransportationProfile(game.settings,game.system?.id)!==profile)
        throw Error("Transportation rules profile changed. Reopen and review.");
      const live=preset?listTransportationPresets(game.settings,game.system?.id)
        .find(item=>item.id===preset.id):null;
      if(preset&&JSON.stringify(live??null)!==JSON.stringify(preset))
        throw Error("This transportation method changed elsewhere. Reopen it before saving.");
      if(preset?.id==="walking"&&
          current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED)!==initialWalkingSpeed)
        throw Error("Walking speed changed elsewhere. Reopen and review.");
    }else if(before!==snapshot()){
      throw Error("Transportation presets changed while you were editing. Reopen and review.");
    }
    let walkingSpeed=null;
    if(scope==="world"&&preset?.id==="walking"){
      const shown=Number(response.worldSpeed);
      walkingSpeed=sceneUnit?atlasSceneDistanceFromDisplay(shown,sceneUnit):shown;
      if(!Number.isFinite(walkingSpeed)||walkingSpeed<.1||walkingSpeed>1000)
        throw new Error("Walking fallback speed must be between 0.1 and 1000 Scene units/hour.");
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
    const vessel=value.kind==="vehicle"&&["land","water","air"].includes(value.surface);
    const animalRaw=String(response.livestockCapacity??"");
    const livestockCapacity=!vessel?undefined:animalRaw===""?null:Number(animalRaw);
    if(vessel&&livestockCapacity!==null&&(!Number.isInteger(livestockCapacity)||
      livestockCapacity<0||livestockCapacity>1000))
      throw Error("Animal spaces must be a whole number from 0 to 1000.");
    const livestockMode=String(response.livestockFareMode??"global");
    if(vessel&&!["global","percent","fixed"].includes(livestockMode))
      throw Error("Choose a valid mount fare policy.");
    const livestockFarePercent=vessel&&livestockMode==="percent"?
      Number(response.livestockFarePercent):null;
    if(livestockFarePercent!==null&&!validLivestockFarePercent(livestockFarePercent))
      throw Error("Mount fare percentage must be a whole number from 0 to 200.");
    const livestockFareBasis=String(response.livestockFareBasis??"trip");
    const livestockFareValue=vessel&&livestockMode==="fixed"?
      currencyFromResponse(response,"livestock"):null;
    const livestockFareCp=livestockFareValue!=null&&livestockFareBasis==="mile"?
      atlasCostPerMileFromDisplay(livestockFareValue):livestockFareValue;
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
      ...(vessel?{livestockCapacity,livestockFareCp,livestockFareBasis,
        livestockFarePercent}:{}),
      ...(scope==="checkpoint"||scope==="journey"&&checkpointName?{
        hireUnlimited:bool("hireUnlimited"),
        hireQuantity:Number(response.hireQuantity??value.hireQuantity??1)
      }:{}),
      overtimeEnabled:bool("overtimeEnabled"),
      overtimeExtraHours:Number(response.overtimeExtraHours),
      overtimeMultiplier:Number(response.overtimeMultiplier),
      continuousEnabled:bool("continuousEnabled"),
      note:scope==="world"&&preset?.builtIn?value.note:String(response.note??"")};
    if((scope==="checkpoint"||scope==="journey"&&checkpointName)&&
        (!Number.isInteger(next.hireQuantity)||next.hireQuantity<0||next.hireQuantity>100))
      throw Error("Available transport quantity must be a whole number between 0 and 100.");
    if(scope==="journey"&&response.__atlasSaveScope!=="checkpoint"&&
        (next.hireUnlimited!==undefined&&next.hireUnlimited!==(value.hireUnlimited??true)||
         next.hireQuantity!==undefined&&next.hireQuantity!==(value.hireQuantity??1)))
      throw Error("Checkpoint inventory must be saved to the Map Marker, not this trip.");
    if(onSave){
      const requested=journeyOperation===null?null:
        String(response.atlasJourneyOperation??journeyOperation);
      if(requested!==null&&!["normal","overtime","continuous"].includes(requested))
        throw Error("Unknown Journey operating schedule.");
      // This editor is the authority: its continuous toggle takes effect
      // without a second Navigation schedule picker. Eligible explicit
      // overtime remains available when continuous is not chosen.
      const operation=requested===null?null:
        requested==="overtime"&&next.overtimeEnabled?"overtime":
        next.kind==="vehicle"&&next.continuousEnabled?"continuous":"normal";
      const journey={operation};
      if(response.__atlasSaveScope==="checkpoint"){
        if(typeof onSaveCheckpoint!=="function")
          throw Error("Checkpoint saving is not available for this method.");
        await onSaveCheckpoint(next,journey);
      }else await onSave(next,journey);
      return next;
    }
    const liveCatalog=readTransportationCatalog(game.settings);
    if(!preset&&liveCatalog.customs.some(item=>item.id===id))
      throw Error("Transportation method ID already exists. Try creating again.");
    const updated=setTransportationPreset(liveCatalog,profile,next);
    // Validate the entire preset before either legacy walking-speed or catalog
    // World setting is touched; Foundry settings have no multi-key transaction.
    if(walkingSpeed!==null)
      await game.settings.set(MODULE_ID,NAVIGATION_SPEED_SETTING,walkingSpeed);
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
    if(selectedTransportationProfile(game.settings,game.system?.id)!==profile||
        JSON.stringify(listTransportationPresets(game.settings,game.system?.id)
          .find(item=>item.id===preset.id)??null)!==JSON.stringify(preset))
      throw Error("This transportation method changed elsewhere. Reopen before resetting.");
    const updated=resetTransportationPreset(readTransportationCatalog(game.settings),profile,preset.id);
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
    if(JSON.stringify(listTransportationPresets(game.settings,game.system?.id)
      .find(item=>item.id===preset.id)??null)!==JSON.stringify(preset))
      throw Error("This transportation method changed elsewhere. Reopen before deleting.");
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


}

/** Opens the one World transportation editor for a non-World scope.
 * Callers own the Save callback; this helper never changes World settings.
 */
export async function openTransportationMethodEditor({method,scope,onSave,onReset=null,
  onSaveCheckpoint=null,checkpointName=null,journeyOperation=null,
  groupAssignment=null,profiles=[],groupActorName="",groupKind="vehicle",
  groupRiders=[]}={}){
  if((!method&&scope!=="group")||!["checkpoint","journey","group"].includes(scope)||
      typeof onSave!=="function"||
      (onSaveCheckpoint!==null&&typeof onSaveCheckpoint!=="function"))
    throw Error("Invalid transportation editor context.");
  const app=new AtlasTransportationSettings();
  return app._edit(method,method?.surface??"land",{scope,onSave,onReset,
    onSaveCheckpoint,checkpointName,journeyOperation,groupAssignment,profiles,
    groupActorName,groupKind,groupRiders});
}


export function renderTravelRules(root){
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
    const baselineRules=[
      current(NAVIGATION_RULES_PROFILE_SETTING,"system"),
      ...fields.map(([,key,,fallback])=>current(key,fallback))
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
      if(JSON.stringify([
        current(NAVIGATION_RULES_PROFILE_SETTING,"system"),
        ...fields.map(([,key,,fallback])=>current(key,fallback))
      ])!==JSON.stringify(baselineRules))
        throw Error("World travel rules changed elsewhere. Reopen and review.");
      for(const [key,val] of values)await game.settings.set(MODULE_ID,key,val);
      await game.settings.set(MODULE_ID,NAVIGATION_RULES_PROFILE_SETTING,profile);
      ui.notifications.info("Atlas travel rules saved.");
    }));
    root.appendChild(panel);
  }
export function renderJourneyPlayback(root,exampleDistancesMi=[6,30,90]){
    root.appendChild(heading("Journey and playback",
      "World time and visual playback are independent. Atlas never applies Actor rests, exhaustion or transport fares."));
    const panel=element("div");panel.style.cssText="display:grid;gap:.85rem;max-width:48rem;";
    const baselineJourney=[
      current(NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT),
      current(NAVIGATION_WORLD_CLOCK_SETTING,false)
    ];
    const clock=checkbox("clock",baselineJourney[1]);
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
    for(const distanceMi of exampleDistancesMi){
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
      if(JSON.stringify([
        current(NAVIGATION_PLAYBACK_SETTING,NAVIGATION_PLAYBACK_DEFAULT),
        current(NAVIGATION_WORLD_CLOCK_SETTING,false)
      ])!==JSON.stringify(baselineJourney))
        throw Error("World journey options changed elsewhere. Reopen and review.");
      await game.settings.set(MODULE_ID,NAVIGATION_PLAYBACK_SETTING,playback);
      await game.settings.set(MODULE_ID,NAVIGATION_WORLD_CLOCK_SETTING,clock.checked);
      ui.notifications.info("Atlas journey options saved.");
    }));
    root.appendChild(panel);
  }
