/**
 * GM World transportation settings. Pure catalog logic lives in
 * navigation-transport-catalog.js; this file owns DOM, dialogs and persistence.
 * No Scene, Region, Token, currency or Actor data is changed by editing.
 */
import { TRANSPORT_CATALOG_SETTING,TRANSPORT_SURFACES,TRANSPORT_KINDS,
  TRANSPORT_COST_BASES,TRANSPORT_HIRE_BASES,readTransportationCatalog,listTransportationPresets,
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
import { NAVIGATION_MOUNTED_SPEED_SETTING,NAVIGATION_SAILING_SPEED_SETTING,
  NAVIGATION_MOUNTED_SPEED_DEFAULT,NAVIGATION_SAILING_SPEED_DEFAULT }
  from "./navigation-travel-method.js";
import { createSettingsSelect } from "./settings-select.js";
import { atlasCurrencyChoices,coinFromCopper,copperFromCoin,dndCurrencyBreakdown }
  from "./navigation-currency.js";
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
const slider=(name,value,{min=0.1,max=100,step=0.1,
  numericMax=max,numericStep=step,label="Adjust value"}={})=>{
  const wrapper=element("div");
  wrapper.style.cssText="display:flex;gap:.65rem;align-items:center;min-width:0;";
  const range=element("input");range.type="range";range.min=String(min);
  range.setAttribute("data-atlas-range-for",name);
  range.max=String(max);range.step=String(step);range.value=String(Math.min(max,Math.max(min,value)));
  range.style.cssText="flex:1;min-width:5rem;";
  const numeric=numberInput(name,value,{min,max:numericMax,step:numericStep});
  numeric.style.width="6.5rem";
  range.setAttribute("aria-label",label);
  range.addEventListener("input",()=>{numeric.value=range.value;numeric.defaultValue=range.value;});
  numeric.addEventListener("input",()=>{
    if(Number.isFinite(Number(numeric.value)))range.value=String(Math.max(min,Math.min(max,Number(numeric.value))));
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
  const quoteRoot=root.querySelector("[data-atlas-preset-cost-preview]");
  if(!quoteRoot)return;
  const fieldValue=name=>root.querySelector('[name="'+name+'"]');
  const number=name=>Number(fieldValue(name)?.value??0);
  const costOf=name=>copperFromCoin(number(name+"Amount"),String(fieldValue(name+"Denom")?.value??"cp"));
  const formatCost=cp=>dndCurrencyBreakdown(cp,globalThis.CONFIG?.DND5E?.currencies).label;
  const update=()=>{
    try{
      const displaySpeed=number("speedDisplay")||number("worldSpeed");
      const speedMph=fieldValue("speedDisplay")?
        atlasPresetSpeedFromDisplay(displaySpeed):null;
      if(!speedMph||speedMph<=0){
        const info=root.querySelector("[data-atlas-quote-error]");
        if(info)info.textContent="Enter a positive travel speed to preview costs. Walking uses the Group Actor's pace.";
        return;
      }
      const basis=fieldValue("costBasis")?.value??"none";
      const costCp=basis==="mile"?atlasCostPerMileFromDisplay(costOf("cost")):costOf("cost");
      const item={speedMph,costCp,costBasis:basis,
        costApplies:fieldValue("costApplies")?.value??"unit",
        crewCount:number("crewCount"),crewWageCpPerDay:costOf("crewWage"),
        includeCrewWages:Boolean(fieldValue("includeCrewWages")?.checked)};
      const examples=[
        {label:"100-mile route",distanceMi:100},
        {label:"1 travel day (8h)",distanceMi:8*speedMph}
      ];
      const rows=examples.map(ex=>{
        const q=estimateTransportationTrip(item,{distanceMi:ex.distanceMi,dayHours:8});
        return {label:ex.label,distance:ex.distanceMi.toFixed(1)+" mi",
          hours:q.movingHours.toFixed(1)+"h",days:String(q.travelDays),
          recurring:formatCost(q.recurringCp),
          wages:formatCost(q.crewWagesCp),total:formatCost(q.totalCp)};
      });
      const info=root.querySelector("[data-atlas-quote-error]");
      if(info)info.textContent="";
      const cells=[...quoteRoot.querySelectorAll("[data-atlas-quote-cell]")];
      const keys=["label","distance","hours","days","recurring","wages","total"];
      for(let i=0;i<rows.length;i++)
        for(let j=0;j<keys.length;j++)
          if(cells[i*keys.length+j])cells[i*keys.length+j].textContent=rows[i][keys[j]];
    }catch(error){
      const info=root.querySelector("[data-atlas-quote-error]");
      if(info)info.textContent="Enter valid, nonnegative values to preview costs.";
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
const snapshot=()=>JSON.stringify(readTransportationCatalog(game.settings));
const nativeCoins=()=>atlasCurrencyChoices(game.system?.id,globalThis.CONFIG?.DND5E?.currencies);
const priceInput=(name,copper,initialCoin)=>{
  const wrap=element("div");
  wrap.style.cssText="display:flex;gap:.5rem;align-items:center;min-width:0;";
  const coinOptions=nativeCoins();
  const chosen=coinOptions.some(c=>c.id===initialCoin)?initialCoin:coinOptions[0]?.id??initialCoin;
  const amount=numberInput(name+"Amount",copper===null?"":coinFromCopper(copper,chosen),
    {min:0,max:100000000,step:"any"});
  if(copper===null){amount.value="";amount.defaultValue="";amount.placeholder="Not specified";}
  const options=coinOptions.map(c=>[c.id,c.label]);
  const unit=selected(options,chosen,name+"Denom");
  amount.style.cssText="min-width:0;flex:1;";unit.style.cssText="width:6.5rem;flex-shrink:0;";
  wrap.append(amount,unit);return wrap;
};
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

  async _edit(preset,surface="land"){
    if(!game.user?.isGM)throw new Error("Only a GM may edit transportation presets.");
    const existing=Boolean(preset),profile=selectedTransportationProfile(game.settings,game.system?.id);
    const before=snapshot();
    const sceneUnit=globalThis.canvas?.scene?.grid?.units??
      game.scenes?.current?.grid?.units??"";
    const body=element("div");
    body.style.cssText="display:grid;gap:.7rem;padding:.5rem;max-height:65vh;overflow-y:auto;";
    const value=preset??{name:"",kind:"vehicle",surface,speedMph:3,costCp:0,
      costBasis:"none",costApplies:"unit",capacity:null,purchaseGp:null,note:"",
      crewCount:0,crewWageCpPerDay:200,includeCrewWages:false};
    body.appendChild(heading(existing?"Edit "+value.name:"New "+names[surface]+" transportation",
      "Edit reference values for your World. Nothing is charged automatically."));
    const nav=element("nav");nav.setAttribute("role","tablist");
    nav.setAttribute("aria-label","Transportation preset editor sections");
    nav.style.cssText="display:flex;gap:.3rem;border-bottom:2px solid var(--color-border-light-tertiary,#555);";
    const panels={};
    for(const [id,label] of [["general","General"],["cost","Cost"],["services","Services"]]){
      const tab=element("button",label);tab.type="button";
      tab.setAttribute("role","tab");tab.setAttribute("data-atlas-preset-tab",id);
      tab.setAttribute("aria-selected",String(id==="general"));
      tab.style.cssText="padding:.6rem 1rem;border-radius:.45rem .45rem 0 0;";
      nav.append(tab);
      const panel=element("section");panel.setAttribute("role","tabpanel");
      panel.setAttribute("data-atlas-preset-panel",id);
      panel.style.cssText="display:"+(id==="general"?"grid":"none")+";gap:.75rem;min-width:0;";
      panels[id]=panel;
    }
    body.append(nav,panels.general,panels.cost,panels.services);
    const name=element("input");name.name="name";name.type="text";
    name.maxLength=80;name.required=true;name.placeholder="e.g. Wind-powered skiff";
    name.value=value.name;name.defaultValue=value.name;
    if(preset?.builtIn){name.readOnly=true;name.title="A built-in reference name cannot be renamed.";}
    panels.general.append(field("Name",name));
    const kind=selected(TRANSPORT_KINDS.map(k=>[k,names[k]]),value.kind,"kind");
    const route=selected(TRANSPORT_SURFACES.map(k=>[k,names[k]]),value.surface,"surface");
    if(preset?.builtIn){kind.disabled=true;route.disabled=true;}
    const identity=element("div");
    identity.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.65rem;";
    identity.append(field("Type",kind),field("Route surface",route));
    panels.general.append(identity);
    if(preset?.id==="walking"){
      const fallbackSpeed=current(NAVIGATION_SPEED_SETTING,DEFAULT_NAVIGATION_SPEED);
      const display=sceneUnit?atlasDisplaySpeed(fallbackSpeed,sceneUnit):
        {value:fallbackSpeed,unit:"Scene units/hour"};
      const shown=Number(display.value.toFixed(2));
      panels.general.append(field("Fallback walking speed ("+display.unit+")",
        slider("worldSpeed",shown,{min:.1,max:resolveAtlasMeasuringUnits()==="metric"?32:20,
          step:.1,numericStep:.01,label:"Fallback walking pace"}),
        "Uses the Group Actor's pace first; this is a fallback, not a vehicle speed."));
    }else{
      const display=atlasDisplayPresetSpeed(value.speedMph);
      panels.general.append(field("Planning speed ("+display.unit+")",
        slider("speedDisplay",Number(display.value.toFixed(2)),{min:.1,
          max:resolveAtlasMeasuringUnits()==="metric"?600*1.609344:600,
          step:.1,label:"Transportation travel speed",numericStep:.01}),
        "Sustained overland planning speed, not a creature's tactical speed."));
    }
    const capacity=numberInput("capacity",value.capacity??"",{min:1,max:1000,step:1});
    if(value.capacity===null||value.capacity===undefined){
      capacity.value="";capacity.defaultValue="";capacity.placeholder="Unspecified";
    }
    if(preset?.id==="walking"){capacity.disabled=true;capacity.placeholder="Not applicable";}
    panels.general.append(field("Passenger capacity per unit",capacity,
      "Seats per transport unit, excluding crew. Unknown seats may be left blank."));
    panels.general.append(field("Crew required (#)",
      numberInput("crewCount",value.crewCount??0,{min:0,max:1000,step:1}),
      "Operating crew, excluding paying passengers. Defaults follow published vessel entries when available."));
    const note=element("textarea");note.name="note";note.maxLength=240;
    note.rows=2;note.value=value.note??"";note.defaultValue=value.note??"";
    if(preset?.builtIn){note.readOnly=true;note.title="Reference notes are read-only.";}
    panels.general.append(field("GM note",note,preset?.builtIn?
      "Reference note is read-only; create a custom transport for your own notes.":
      "Optional travel and availability details."));

    const costs=element("div");
    costs.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.65rem;";
    costs.append(field("Recurring cost",
      priceInput("cost",value.costBasis==="mile"?
        atlasDisplayCostPerDistance(value.costCp):value.costCp,"cp"),
      "Feed, upkeep or fare. No currency is ever deducted."));
    costs.append(field("Cost frequency",selected(TRANSPORT_COST_BASES.map(k=>[
      k,k==="none"?"No recurring cost":k==="day"?"Per travel day":
        "Per traveled "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile")
    ]),value.costBasis,"costBasis")));
    costs.append(field("Charge for each",selected([
      ["unit","Transport unit (mount or vehicle)"],["passenger","Passenger"]
    ],value.costApplies??"unit","costApplies"),
    "Per passenger for passage; per unit for feed and upkeep."));
    costs.append(field("Purchase price",
      priceInput("purchase",value.purchaseGp===null?null:value.purchaseGp*100,"gp"),
      "One-time acquisition, excluded from the recurring trip quote."));
    panels.cost.append(costs);
    const wages=element("div");
    wages.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.65rem;";
    wages.append(field("Crew wage per person per day",
      priceInput("crewWage",value.crewWageCpPerDay??200,"gp"),
      "Default example: 2 GP/day (skilled hireling); edit to match your crew and setting."));
    const wageToggle=checkbox("includeCrewWages",value.includeCrewWages??false);
    if(wageToggle.checked)wageToggle.setAttribute("checked","checked");
    const wageLabel=element("label");
    wageLabel.style.cssText="display:flex;gap:.6rem;align-items:center;align-self:center;";
    wageLabel.append(wageToggle,element("span","Include crew wages in estimated trip costs"));
    wages.append(wageLabel);
    panels.cost.append(wages);
    panels.cost.append(heading("Example journey costs",
      "Illustrative quotes for ONE transport unit and ONE passenger, using an 8h reference travel day. "+
      "The real navigation schedule may differ; purchase price, drivers, overtime and special services are excluded."));
    const table=element("table");table.style.cssText="width:100%;border-collapse:collapse;font-size:.88em;";
    const headers=["Scenario","Distance","Moving","Travel days","Recurring","Crew wages","Total"];
    const thead=element("thead");const titleRow=element("tr");
    for(const label of headers){const th=element("th",label);th.style.cssText="text-align:left;padding:.35rem;border-bottom:1px solid #777";titleRow.append(th);}
    thead.append(titleRow);table.append(thead);
    const tbody=element("tbody");
    for(let i=0;i<2;i++){
      const tr=element("tr");
      for(let col=0;col<headers.length;col++){
        const td=element("td","—");td.setAttribute("data-atlas-quote-cell",String(i)+"-"+col);
        td.style.cssText="padding:.35rem;border-bottom:1px solid #555;";
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
    const quote=element("div");quote.setAttribute("data-atlas-preset-cost-preview","");
    quote.style.cssText="overflow-x:auto;";quote.append(table);
    panels.cost.append(quote);
    const error=element("small","");error.setAttribute("data-atlas-quote-error","");
    panels.cost.append(error);
    panels.services.append(heading("Optional transport services",
      "GM-only planning. Hire previews do not prove a town or checkpoint offers the service; checkpoint supply comes in beta.4c."));
    const serviceToggle=(name,checked,label,description)=>{
      const input=checkbox(name,checked);
      if(input.checked)input.setAttribute("checked","checked");
      const wrapper=element("label");wrapper.style.cssText="display:flex;gap:.6rem;align-items:center;";
      wrapper.append(input,element("strong",label));
      const box=element("div");box.style.cssText="display:grid;gap:.3rem;";
      box.append(wrapper,element("small",description));return box;
    };
    if(value.kind==="vehicle")panels.services.append(serviceToggle("hireEnabled",value.hireEnabled??false,
      "Offer for-hire / paid passage quote",
      "GM may preview a hired service in Navigation; no actual hire or payment occurs."));
    else panels.services.append(element("small","For-hire quotes currently apply to vehicles and paid passage. Mount hire remains a future service."));
    const hireFields=element("div");
    hireFields.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.65rem;";
    const hireAmount=value.hireCostCp??0;
    hireFields.append(field("Hired service fare",
      priceInput("hire",value.hireBasis==="mile"?
        atlasDisplayCostPerDistance(hireAmount):hireAmount,hireAmount<100?"cp":"gp")));
    hireFields.append(field("Fare frequency",selected(TRANSPORT_HIRE_BASES.map(k=>[
      k,k==="trip"?"Flat per trip":k==="day"?"Per operating day":
        "Per traveled "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile")
    ]),value.hireBasis??"day","hireBasis")));
    hireFields.append(field("Charge per",selected([
      ["unit","Transport unit"],["passenger","Passenger"]
    ],value.hireApplies??"unit","hireApplies")));
    panels.services.append(hireFields);
    panels.services.append(serviceToggle("hireCrewIncluded",value.hireCrewIncluded??true,
      "Driver / crew included in hired fare",
      "Do not double-count labor already covered by a hired operator."));
    panels.services.append(serviceToggle("overtimeEnabled",value.overtimeEnabled??false,
      "Allow overtime travel",
      "8h regular travel plus up to 8h extra; requires explicit GM selection."));
    const overtime=element("div");
    overtime.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.65rem;";
    overtime.append(field("Extra hours per day (1–8)",
      numberInput("overtimeExtraHours",value.overtimeExtraHours??8,{min:1,max:8,step:1})));
    overtime.append(field("Overtime multiplier (1–5)",
      numberInput("overtimeMultiplier",value.overtimeMultiplier??1.5,{min:1,max:5,step:.1}),
      "Premium applies to overtime hours, not all travel."));
    panels.services.append(overtime);
    const continuous=serviceToggle("continuousEnabled",
      value.kind==="vehicle"&&["water","air"].includes(value.surface)?
        value.continuousEnabled??false:false,
      "Allow continuous 24h operation",
      "Only ships or aircraft with appropriate staff or magic; excludes overtime mode.");
    if(value.kind==="vehicle"&&["water","air"].includes(value.surface))
      panels.services.append(continuous);
    else panels.services.append(element("small",
      "Continuous travel can only be enabled for water or air vehicles. Save a custom vehicle's surface first."));
    // DialogV2 requires a plain outer HTMLDivElement with no attributes.
    const shell=element("div");shell.appendChild(body);
    const response=await foundry.applications.api.DialogV2.input({
      window:{title:existing?"Edit "+preset.name:"Add "+names[surface]+" transportation"},
      content:shell,ok:{label:"Save preset"},rejectClose:false,modal:true,
      render:(app,html)=>{wireSliders(html??app?.element);wirePresetDialog(html??app?.element);}
    });
    if(!response)return;
    if(before!==snapshot())throw new Error("Transportation presets changed while you were editing. Reopen and review.");
    if(preset?.id==="walking"){
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
    const crewWageCpPerDay=copperFromCoin(Number(response.crewWageAmount),
      String(response.crewWageDenom??"gp"));
    const includeCrewWages=response.includeCrewWages===true||
      response.includeCrewWages==="on"||response.includeCrewWages==="true";
    const costAmount=Number(response.costAmount);
    const enteredCost=copperFromCoin(costAmount,String(response.costDenom??"cp"));
    const purchaseGp=response.purchaseAmount===""||response.purchaseAmount==null?
      null:copperFromCoin(Number(response.purchaseAmount),
        String(response.purchaseDenom??"gp"))/100;
    const bool=name=>response[name]===true||response[name]==="on"||response[name]==="true";
    const hireEntered=copperFromCoin(Number(response.hireAmount),String(response.hireDenom??"cp"));
    const hireCostCp=String(response.hireBasis)==="mile"?
      atlasCostPerMileFromDisplay(hireEntered):hireEntered;
    const next={...value,id,
      name:preset?.builtIn?value.name:String(response.name??"").trim(),
      kind:preset?.builtIn?value.kind:String(response.kind??""),
      surface:preset?.builtIn?value.surface:String(response.surface??""),
      speedMph:id==="walking"?null:atlasPresetSpeedFromDisplay(Number(response.speedDisplay)),
      capacity:id==="walking"?null:rawCapacity,
      costCp:String(response.costBasis)==="mile"?
        atlasCostPerMileFromDisplay(enteredCost):enteredCost,
      costBasis:String(response.costBasis),
      costApplies:String(response.costApplies),
      purchaseGp,crewCount,crewWageCpPerDay,includeCrewWages,
      hireEnabled:bool("hireEnabled"),hireCostCp,
      hireBasis:String(response.hireBasis),hireApplies:String(response.hireApplies),
      hireCrewIncluded:bool("hireCrewIncluded"),
      overtimeEnabled:bool("overtimeEnabled"),
      overtimeExtraHours:Number(response.overtimeExtraHours),
      overtimeMultiplier:Number(response.overtimeMultiplier),
      continuousEnabled:bool("continuousEnabled"),
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
