/**
 * Compact checkpoint offer editor shared by World templates and Scene settings.
 * Draft changes remain local until the parent Save is confirmed.
 */
import { listTransportationPresets } from "./navigation-transport-catalog.js";
import { checkpointOfferMethod,validateCheckpointTransportOffers }
  from "./checkpoint-transportation.js";
import { createSettingsIconButton } from "./settings-controls.js";
import {createTransportNumberSlider,createTransportCurrencyPool}
  from "./navigation-transport-form-controls.js";
import {dndCurrencyBreakdown} from "./navigation-currency.js";
import {readPartyExploration} from "./party-exploration-storage.js";
import {projectGroupTransportation,readGroupTransportation} from "./navigation-group-transport.js";
import {atlasDisplayCostPerDistance,atlasCostPerMileFromDisplay,
  resolveAtlasMeasuringUnits} from "./navigation-measure-units.js";

const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const GROUPS=[["land","Land Travel","land"],["water","Water Travel (rivers & lakes)","water"],
  ["sea","Sea Travel (coastal & ocean)","water"],["air","Air Travel","air"]];
const GENERAL_NUMBERS=[["speedMph","Travel speed (mph)"],["capacity","Passengers per unit"]];
const COST_NUMBERS=[["costCp","Recurring upkeep"]];
const HIRE_COST=["hireCostCp","Hired service fare"];
const PURCHASE_COST=["purchaseGp","Purchase price"];
const OPERATIONS_NUMBERS=[["overtimeExtraHours","Overtime hours/day"],
  ["overtimeMultiplier","Overtime multiplier"]];
const COST_CHOICES=[["costBasis","Upkeep frequency",
    [["none","No upkeep"],["day","Per day"],["mile","Per "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile")]]],
  ["costApplies","Upkeep charge per",[["unit","Transport unit"],["passenger","Passenger"]]],
  ["hireBasis","Hire fare frequency",
    [["trip","Per trip"],["day","Per operating day"],["mile","Per mile"]]],
  ["hireApplies","Hire charge per",[["unit","Transport unit"],["passenger","Passenger"]]]];
const SERVICE_TOGGLES=[["overtimeEnabled","Allow overtime travel"],
  ["continuousEnabled","Allow continuous travel"]];
const label=(title,control)=>{
  const l=node("label");l.style.cssText="display:grid;gap:.3rem;min-width:0;align-content:start;";
  l.append(node("span",title),control);return l;
};
const grid=()=>{
  const e=node("div");e.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;align-items:start;";
  return e;
};
const fareSummary=method=>{
  if(!method)return "World transportation preset missing";
  const seats=method.capacity==null?"capacity unknown":method.capacity+" seat(s)";
  const amount=method.hireCostCp??0;
  const unit=method.hireApplies==="passenger"?"passenger":"unit";
  const frequency=method.hireBasis==="day"?"day":method.hireBasis;
  return method.speedMph+" mph · "+seats+" · "+(method.hireEnabled?
    "Hire "+dndCurrencyBreakdown(amount,globalThis.CONFIG?.DND5E?.currencies).label+" / "+frequency+" / "+unit:"Not offered for hire");
};

const currentTravelers=()=>{
  try{
    const scene=globalThis.game?.scenes?.current;
    const assignment=readPartyExploration(scene);
    const token=scene?.tokens?.get?.(assignment.tokenId);
    const group=token?.actor;
    if(group?.type!=="group")return {count:1,note:"1 example passenger; no assigned Group Actor"};
    const roster=projectGroupTransportation(group,readGroupTransportation(game.settings),[]);
    return {count:Math.max(1,roster.travelers),
      note:roster.travelers+" player character(s) in the assigned Group Actor"};
  }catch{return {count:1,note:"1 example passenger; no assigned Group Actor"};}
};
export function createCheckpointTransportationEditor({offers=[],settings=game.settings,
  systemId=game.system?.id}={}){
  const methods=listTransportationPresets(settings,systemId).filter(m=>m.kind!=="foot");
  const catalog=new Map(methods.map(m=>[m.id,m]));
  let draft=validateCheckpointTransportOffers(offers);
  let openOfferId=null;
  const selectedTabs=new Map(),adding=new Set();
  const root=node("div");root.style.cssText="display:grid;gap:.8rem;min-width:0;";
  const help=node("p","Choose transport available at this checkpoint. Each offer inherits World values unless overridden here; no booking or payment occurs.");
  help.style.cssText="margin:.2rem 0 .4rem;opacity:.8;";
  root.append(help);
  const host=node("div");host.style.cssText="display:grid;gap:.8rem;";root.append(host);

  const drawFields=(offer,method,container)=>{
    if(!method){container.append(node("small","World transportation preset is missing."));return;}
    const effective=checkpointOfferMethod(offer,method);
    const area=node("div");area.style.cssText="display:grid;gap:.65rem;margin-top:.6rem;";
    const tabs=node("div");tabs.style.cssText="display:flex;gap:.35rem;flex-wrap:wrap;";
    const pages=new Map(),buttons=new Map();
    const current=selectedTabs.get(offer.methodId)??"General";
    for(const name of ["General","Services","Ownership"]){
      const tab=node("button",name);tab.type="button";
      tab.style.cssText="flex:1 1 7rem;min-height:2rem;";
      const panel=node("div");panel.style.cssText="display:grid;gap:.7rem;min-width:0;";
      tabs.append(tab);area.append(panel);pages.set(name,panel);buttons.set(name,tab);
      tab.addEventListener("click",()=>{selectedTabs.set(offer.methodId,name);show();});
    }
    const show=()=>{for(const [name,panel] of pages){
      const active=name===(selectedTabs.get(offer.methodId)??current);
      panel.hidden=!active;panel.style.display=active?"grid":"none";
      buttons.get(name).setAttribute("aria-pressed",String(active));
      buttons.get(name).style.background=active?"rgba(156,123,240,.22)":"";
    }};
    const two=()=>{
      const e=node("div");
      e.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));"+
        "gap:.65rem;min-width:0;align-items:start;";
      return e;
    };
    const help=(text)=>{
      const n=node("small",text);n.style.opacity=".75";return n;
    };
    const toggle=(key,title,group)=>{
      const wrapper=node("label");wrapper.style.cssText="display:flex;gap:.45rem;align-items:center;";
      const checkbox=node("input");checkbox.type="checkbox";
      checkbox.checked=(checkpointOfferMethod(offer,method)?.[key]??false)===true;
      checkbox.addEventListener("change",()=>{
        offer.overrides[key]=checkbox.checked;update();
      });
      wrapper.append(checkbox,node("span",title));(group??pages.get("Services")).append(wrapper);
      return checkbox;
    };
    const numeric=(key,title,group,bounds={})=>{
      const control=createTransportNumberSlider(key,offer.overrides[key]??"",{
        min:0,max:100,step:1,numericMax:1000,...bounds,label:title,
        onChange:value=>{
          if(value==="")delete offer.overrides[key];
          else offer.overrides[key]=Number(value);
          update();
        }});
      const number=control.querySelector?.('[name="'+key+'"]')??control.children?.[1];
      if(number)number.placeholder="World: "+String(method?.[key]??"not set");
      group.append(label(title,control));return control;
    };
    const money=(key,title,group,isPurchase=false)=>{
      const initial=Object.hasOwn(offer.overrides,key)?offer.overrides[key]:method?.[key];
      const canonicalCp=isPurchase?(initial==null?0:initial*100):initial??0;
      const basisKey=key==="hireCostCp"?"hireBasis":key==="costCp"?"costBasis":null;
      const perDistance=basisKey&&(offer.overrides[basisKey]??method?.[basisKey])==="mile";
      const displayedCp=perDistance?atlasDisplayCostPerDistance(canonicalCp):canonicalCp;
      const control=createTransportCurrencyPool(key,displayedCp,{
        onChange:amount=>{
          const stored=perDistance?atlasCostPerMileFromDisplay(amount):amount;
          offer.overrides[key]=isPurchase?stored/100:stored;
          update();
        }});
      group.append(label(title,control.element));
    };
    const choice=(key,title,choices,group)=>{
      const select=node("select");
      const base=node("option","Use World: "+String(method?.[key]??"default"));
      base.value="";select.append(base);
      for(const [id,name] of choices){const option=node("option",name);option.value=id;select.append(option);}
      select.value=offer.overrides[key]??"";
      select.addEventListener("change",()=>{
        if(select.value==="")delete offer.overrides[key];
        else offer.overrides[key]=select.value;
        update();
      });
      group.append(label(title,select));return select;
    };
    const preview=(headers,keys)=>{
      const table=node("table");table.style.cssText="width:100%;font-size:.85em;border-collapse:collapse;";
      const head=node("tr");
      for(const title of headers){const th=node("th",title);th.style.cssText="text-align:left;padding:.3rem;border-bottom:1px solid #777";head.append(th);}
      const thead=node("thead");thead.append(head);table.append(thead);
      const tr=node("tr"),cells=new Map();
      for(const key of keys){const cell=node("td","—");cell.style.cssText="padding:.35rem;border-bottom:1px solid #555";
        tr.append(cell);cells.set(key,cell);}
      const tbody=node("tbody");tbody.append(tr);table.append(tbody);
      return {table,cells};
    };
    const traveler=currentTravelers();
    const hireSummary=preview(["Scenario","Charged to","Fare","Estimated cost"],
      ["scenario","count","fare","total"]);
    const wageSummary=preview(["Example journey","Crew","Wage each","Total"],
      ["scenario","crew","wage","total"]);
    let hireDependents=null,purchaseDependents=null,hireCrewOption=null;
    const currency=cp=>dndCurrencyBreakdown(Math.max(0,cp??0),
      globalThis.CONFIG?.DND5E?.currencies).label;
    const fill=(cells,values)=>{for(const [k,cell] of cells)cell.textContent=String(values[k]??"—");};
    const update=()=>{
      if(!method)return;
      try{
        const value=checkpointOfferMethod(offer,method);
        const hireOn=Boolean(value.hireEnabled);
        if(hireCrewOption){hireCrewOption.style.opacity=hireOn?"1":".42";
          hireCrewOption.style.pointerEvents=hireOn?"auto":"none";}
        if(hireDependents){
          hireDependents.style.opacity=hireOn?"1":".42";
          hireDependents.style.pointerEvents=hireOn?"auto":"none";
          hireDependents.setAttribute("aria-disabled",String(!hireOn));
        }
        if(purchaseDependents){
          const enabled=value.purchaseGp!==null&&value.purchaseGp!==undefined;
          purchaseDependents.style.opacity=enabled?"1":".42";
          purchaseDependents.style.pointerEvents=enabled?"auto":"none";
        }
        const capacity=Math.max(1,value.capacity??1);
        const units=Math.ceil(traveler.count/capacity);
        const charge=value.hireApplies==="passenger"?traveler.count:units;
        const distance=8*Math.max(.1,value.speedMph??3);
        const periods=value.hireBasis==="mile"?distance:1;
        const fare=Number(value.hireCostCp??0);
        fill(hireSummary.cells,{
          scenario:value.hireBasis==="mile"?distance.toFixed(1)+" mi (8h)":
            value.hireBasis==="trip"?"1 trip (8h)":"8h × 1 operating day",
          count:charge+" "+(value.hireApplies==="passenger"?"passenger(s)":"mount(s)/vehicle(s)"),
          fare:currency(fare),
          total:hireOn?currency(fare*periods*charge):"Hire unavailable"
        });
        const wagePeriods=value.crewWageBasis==="trip"?1:value.crewWageBasis==="mile"?10:3;
        fill(wageSummary.cells,{
          scenario:value.crewWageBasis==="trip"?"1 trip":
            value.crewWageBasis==="mile"?"10 miles":"3 operating days",
          crew:String(value.crewCount??0),wage:currency(value.crewWageCpPerDay??200),
          total:currency(wagePeriods*(value.crewCount??0)*(value.crewWageCpPerDay??200))
        });
      }catch{/* Preserve the prior preview while a GM is mid-edit. */}
    };
    // General
    const general=pages.get("General");
    const select=node("select");
    for(const item of methods.filter(m=>m.surface===(offer.mode==="land"?"land":
      offer.mode==="air"?"air":"water"))){
      if(item.id!==offer.methodId&&draft.some(x=>x.methodId===item.id))continue;
      const option=node("option",item.name);option.value=item.id;select.append(option);
    }
    if(!methods.some(m=>m.id===offer.methodId)){
      const missing=node("option","Missing: "+offer.methodId);
      missing.value=offer.methodId;select.prepend(missing);
    }
    select.value=offer.methodId;
    select.addEventListener("change",()=>{
      const previous=offer.methodId;offer.methodId=select.value;offer.overrides={};
      selectedTabs.delete(previous);openOfferId=offer.methodId;render();
    });
    const first=two();
    first.append(label("World transportation method",select),
      label("Type",node("strong",method?.kind??"unknown")));
    general.append(first);
    const counts=two();
    numeric("speedMph","Planning speed (mph)",counts,{min:.1,max:100,step:.1,numericMax:600,numericStep:.1});
    numeric("capacity","Passenger capacity",counts,{min:1,max:40,step:1,numericMax:1000});
    numeric("crewCount","Required crew",counts,{min:0,max:50,step:1,numericMax:1000});
    general.append(counts);
    const notes=node("textarea");notes.rows=2;notes.maxLength=240;
    notes.placeholder="Optional location-specific notes";notes.value=offer.overrides.note??"";
    notes.addEventListener("change",()=>{
      if(notes.value)offer.overrides.note=notes.value;else delete offer.overrides.note;
    });
    general.append(label("GM note",notes));

    // Services: hire quote
    const services=pages.get("Services");
    const top=two();
    toggle("hireEnabled","Available for hire / passage",top);
    toggle("hireCrewIncluded","Driver / crew included in the fare",top);
    hireCrewOption=top.children?.[1];
    services.append(top);
    hireDependents=node("div");hireDependents.style.cssText="display:grid;gap:.7rem;";
    const hireRow=two();
    money("hireCostCp","Hired service fare",hireRow);
    for(const [key,title,choices] of COST_CHOICES.filter(([key])=>key.startsWith("hire")))
      choice(key,key==="hireBasis"?"Fare frequency":"Charge per",choices.map(([id,name])=>[
        id,id==="unit"?"Whole mount or vehicle":id==="mile"?
          "Per "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile"):name]),hireRow);
    hireDependents.append(hireRow,
      help("Frequency: once per trip, every operating day, or each mile/km traveled. "+
        "Charge per: one fare for each whole vehicle/mount or for each passenger."));
    const overtime=two();
    toggle("overtimeEnabled","Allow overtime travel",overtime);
    numeric("overtimeExtraHours","Extra hours/day",overtime,{min:1,max:8,numericMax:8});
    numeric("overtimeMultiplier","Overtime multiplier",overtime,
      {min:1,max:5,step:.1,numericMax:5,numericStep:.1});
    hireDependents.append(overtime);
    if(offer.mode!=="land"&&method?.kind==="vehicle")
      toggle("continuousEnabled","Allow continuous travel",hireDependents);
    hireDependents.append(help(traveler.note+"; 8h reference day. Nothing is charged."),
      hireSummary.table);
    services.append(hireDependents);

    // Ownership: separate purchase, wages and operating upkeep.
    const ownership=pages.get("Ownership");
    if(["ship-passage","coach-hire"].includes(offer.methodId)){
      ownership.append(help("Hired-only service: no sale price or separately owned crew/upkeep."));
    }else{
      const purchase=two();
      const buy=node("label");buy.style.cssText="display:flex;gap:.45rem;align-items:center;";
      const check=node("input");check.type="checkbox";check.checked=effective?.purchaseGp!=null;
      check.addEventListener("change",()=>{
        offer.overrides.purchaseGp=check.checked?(method?.purchaseGp??0):null;
        selectedTabs.set(offer.methodId,"Ownership");render();
      });
      buy.append(check,node("span","Available for purchase"));purchase.append(buy);
      purchaseDependents=two();
      money("purchaseGp","Purchase price",purchaseDependents,true);
      purchase.append(purchaseDependents);ownership.append(purchase);
      const staff=two();
      money("crewWageCpPerDay","Crew wage per person",staff);
      choice("crewWageBasis","Wage frequency",
        [["day","Per operating day"],["trip","Per trip"],["mile","Per mile"]],staff);
      toggle("includeCrewWages","Include crew wages in owned-trip estimate",staff);
      ownership.append(staff,wageSummary.table);
      const details=node("details");
      const summary=node("summary","Additional upkeep: feed, supplies and maintenance");
      details.append(summary);
      const upkeep=two();upkeep.style.marginTop=".5rem";
      money("costCp","Recurring upkeep",upkeep);
      for(const [key,title,choices] of COST_CHOICES.filter(([key])=>key.startsWith("cost")))
        choice(key,title,choices.map(([id,name])=>[
          id,id==="unit"?"Whole mount or vehicle":id==="mile"?
          "Per "+(resolveAtlasMeasuringUnits()==="metric"?"kilometer":"mile"):name]),upkeep);
      details.append(upkeep);ownership.append(details);
    }
    const footer=node("div");footer.style.cssText="display:flex;gap:.5rem;justify-content:flex-start;";
    const reset=node("button","Clear local overrides");reset.type="button";
    reset.addEventListener("click",()=>{offer.overrides={};openOfferId=offer.methodId;render();});
    footer.append(reset);container.append(tabs,area,footer);show();update();
  };
  const render=()=>{
    host.replaceChildren();
    for(const [mode,title,surface] of GROUPS){
      const section=node("fieldset");
      section.style.cssText="display:grid;gap:.45rem;min-width:0;border-radius:.5rem;";
      const legend=node("legend");legend.style.cssText="display:flex;align-items:center;gap:.5rem;font-weight:700;";
      legend.append(node("span",title));
      const candidates=methods.filter(m=>m.surface===surface&&
        !draft.some(o=>o.methodId===m.id));
      const add=createSettingsIconButton({icon:"plus",label:"Add "+title+" method"});
      add.style.cssText="min-width:2.3rem;min-height:2.3rem;padding:.35rem;";
      add.disabled=!candidates.length;
      add.addEventListener("click",()=>{if(adding.has(mode))adding.delete(mode);
        else adding.add(mode);render();});
      legend.append(add);section.append(legend);
      if(adding.has(mode)&&candidates.length){
        const addRow=node("div");
        addRow.style.cssText="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;";
        const chooser=node("select");chooser.style.cssText="flex:1 1 11rem;min-width:0;";
        for(const item of candidates){
          const option=node("option",item.name);option.value=item.id;chooser.append(option);
        }
        const confirm=node("button","Add selected method");confirm.type="button";
        confirm.addEventListener("click",()=>{
          if(!chooser.value)return;
          const methodId=chooser.value;
          draft.push({methodId,mode,overrides:{}});
          openOfferId=methodId;selectedTabs.set(methodId,"General");
          adding.delete(mode);render();
        });
        addRow.append(chooser,confirm);section.append(addRow);
      }
      const matches=draft.filter(offer=>offer.mode===mode);
      if(!matches.length)section.append(node("small","No services configured."));
      for(const offer of matches){
        const world=catalog.get(offer.methodId);
        const current=world?checkpointOfferMethod(offer,world):null;
        const card=node("div");
        card.style.cssText="border-bottom:1px solid var(--color-border-light-tertiary,#666);padding:.4rem 0;min-width:0;";
        const row=node("div");row.style.cssText="display:flex;align-items:center;gap:.4rem;min-width:0;";
        const info=node("div");info.style.cssText="flex:1 1 auto;min-width:0;display:grid;gap:.18rem;";
        info.append(node("strong",world?.name??"Missing World method"));
        const subtitle=node("small",fareSummary(current));subtitle.style.opacity=".8";
        info.append(subtitle);
        const edit=createSettingsIconButton({icon:"pen-to-square",
          label:"Edit "+(world?.name??offer.methodId)+" at this checkpoint",
          onClick:()=>{openOfferId=openOfferId===offer.methodId?null:offer.methodId;render();}});
        const remove=createSettingsIconButton({icon:"trash",danger:true,
          label:"Remove "+(world?.name??offer.methodId)+" from checkpoint",
          onClick:()=>{draft=draft.filter(x=>x!==offer);
            selectedTabs.delete(offer.methodId);if(openOfferId===offer.methodId)openOfferId=null;render();}});
        row.append(info,edit,remove);card.append(row);
        if(openOfferId===offer.methodId){
          const pane=node("div");pane.style.cssText="margin-top:.5rem;";
          drawFields(offer,world,pane);card.append(pane);
        }
        section.append(card);
      }
      host.append(section);
    }
  };
  render();
  return {element:root,getOffers:()=>validateCheckpointTransportOffers(draft),
    setOffers:offers=>{draft=validateCheckpointTransportOffers(offers);
      selectedTabs.clear();openOfferId=null;adding.clear();render();}};
}
