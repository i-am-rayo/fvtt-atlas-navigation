/**
 * Compact checkpoint offer editor shared by World templates and Scene settings.
 * Draft changes remain local until the parent Save is confirmed.
 */
import { listTransportationPresets } from "./navigation-transport-catalog.js";
import { checkpointOfferMethod,validateCheckpointTransportOffers }
  from "./checkpoint-transportation.js";
import { createSettingsIconButton } from "./settings-controls.js";
import {createTransportNumberSlider,createTransportPriceSlider}
  from "./navigation-transport-form-controls.js";

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
    [["none","No upkeep"],["day","Per day"],["mile","Per mile"]]],
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
    "Hire "+amount+" CP / "+frequency+" / "+unit:"Not offered for hire");
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
    const effective=method?checkpointOfferMethod(offer,method):null;
    const area=node("div");area.style.cssText="display:grid;gap:.7rem;margin-top:.65rem;";
    const tabs=node("div");tabs.style.cssText="display:flex;gap:.35rem;flex-wrap:wrap;";
    const pages=new Map(),buttons=new Map();
    const current=selectedTabs.get(offer.methodId)??"General";
    for(const name of ["General","Cost","Services"]){
      const tab=node("button",name);tab.type="button";
      tab.style.cssText="flex:1 1 7rem;min-height:2rem;";
      const panel=grid();
      tabs.append(tab);area.append(panel);pages.set(name,panel);buttons.set(name,tab);
      tab.addEventListener("click",()=>{selectedTabs.set(offer.methodId,name);show();});
    }
    const show=()=>{for(const [name,panel] of pages){
      const active=name===(selectedTabs.get(offer.methodId)??current);
      panel.hidden=!active;panel.style.display=active?"grid":"none";
      buttons.get(name).setAttribute("aria-pressed",String(active));
      buttons.get(name).style.background=active?"rgba(156,123,240,.22)":"";
    }};
    const numeric=(page,key,title)=>{
      const bounds=key==="speedMph"?{min:.1,max:100,step:.1,numericMax:600}:
        key==="capacity"?{min:1,max:40,step:1,numericMax:1000,numericStep:1}:
        key==="crewCount"?{min:0,max:50,step:1,numericMax:1000,numericStep:1}:
        key==="overtimeExtraHours"?{min:1,max:8,step:1,numericMax:8,numericStep:1}:
        key==="overtimeMultiplier"?{min:1,max:5,step:.1,numericMax:5}: 
        {min:0,max:100,step:1,numericMax:100000000};
      const control=createTransportNumberSlider(key,offer.overrides[key]??"",{
        ...bounds,label:title,onChange:value=>{
          if(value==="")delete offer.overrides[key];
          else offer.overrides[key]=Number(value);
        }});
      const number=control.querySelector?.('[name="'+key+'"]')??control.children?.[1];
      if(number)number.placeholder="World: "+String(method?.[key]??"not set");
      pages.get(page).append(label(title,control));
    };
    const money=(page,key,title,unit="cp")=>{
      const isPurchase=key==="purchaseGp";
      const worldCp=isPurchase?(method?.purchaseGp??0)*100:method?.[key]??0;
      const valueCp=Object.hasOwn(offer.overrides,key)?
        (isPurchase?offer.overrides[key]===null?null:offer.overrides[key]*100:
          offer.overrides[key]):(isPurchase&&method?.purchaseGp==null?null:worldCp);
      const coin=unit;
      const control=createTransportPriceSlider(key,valueCp,{
        initialCoin:coin,allowNull:isPurchase,
        onChange:cp=>{
          if(isPurchase)offer.overrides[key]=cp===null?null:cp/100;
          else offer.overrides[key]=cp;
        }});
      pages.get(page).append(label(title,control.element));
    };
    const heading=(page,title,help)=>{
      const line=node("div");line.style.cssText="grid-column:1/-1;border-bottom:1px solid #555;padding:.35rem 0;";
      line.append(node("strong",title));
      if(help){const hint=node("small",help);hint.style.cssText="display:block;opacity:.7;margin-top:.2rem;";line.append(hint);}
      pages.get(page).append(line);
    };
    const choice=(page,key,title,choices)=>{
      const select=node("select");
      const base=node("option","Use World: "+String(method?.[key]??"default"));
      base.value="";select.append(base);
      for(const [id,name] of choices){const option=node("option",name);option.value=id;select.append(option);}
      select.value=offer.overrides[key]??"";
      select.addEventListener("change",()=>{
        if(select.value==="")delete offer.overrides[key];else offer.overrides[key]=select.value;
      });
      pages.get(page).append(label(title,select));
    };
    const toggle=(page,key,title)=>{
      const wrapper=node("label");wrapper.style.cssText="display:flex;gap:.45rem;align-items:center;min-width:0;";
      const checkbox=node("input");checkbox.type="checkbox";
      checkbox.checked=effective?.[key]===true;
      checkbox.addEventListener("change",()=>{offer.overrides[key]=checkbox.checked;});
      wrapper.append(checkbox,node("span",title));pages.get(page).append(wrapper);
    };
    // General: one clear method selector and the most frequently adjusted values.
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
      const wasOpen=offer.methodId;
      offer.methodId=select.value;offer.overrides={};
      selectedTabs.delete(wasOpen);openOfferId=offer.methodId;render();
    });
    pages.get("General").append(label("World transportation method",select));
    for(const [key,title] of GENERAL_NUMBERS)numeric("General",key,title);
    numeric("General","crewCount","Crew count");
    const notes=node("textarea");notes.rows=2;notes.maxLength=240;
    notes.placeholder="Optional location-specific notes";notes.value=offer.overrides.note??"";
    notes.addEventListener("change",()=>{if(notes.value)offer.overrides.note=notes.value;
      else delete offer.overrides.note;});
    pages.get("General").append(label("GM notes",notes));
    heading("Cost","For hire / passage","The quoted fare includes its driver or crew unless the GM changes that assumption.");
    toggle("Cost","hireEnabled","Available for hire");
    toggle("Cost","hireCrewIncluded","Driver / crew included in hired fare");
    money("Cost",HIRE_COST[0],HIRE_COST[1],
      (effective?.hireCostCp??0)>=100?"gp":"cp");
    for(const [key,title,choices] of COST_CHOICES.filter(([key])=>key.startsWith("hire")))
      choice("Cost",key,title,choices);
    if(["ship-passage","coach-hire"].includes(offer.methodId)){
      heading("Cost","Hired-only service","No separate vehicle purchase or owner operating costs; crew is assumed included in the fare.");
    }else{
      heading("Cost","Purchase & upkeep","Only owned transport needs purchase, recurring upkeep, and optional crew wages.");
    const purchaseLabel=node("label");purchaseLabel.style.cssText="display:flex;gap:.45rem;align-items:center;";
    const buy=node("input");buy.type="checkbox";buy.checked=effective?.purchaseGp!=null;
    if(["ship-passage","coach-hire"].includes(offer.methodId))buy.disabled=true;
    buy.addEventListener("change",()=>{
      offer.overrides.purchaseGp=buy.checked?(method?.purchaseGp??0):null;
      selectedTabs.set(offer.methodId,"Cost");render();
    });
    purchaseLabel.append(buy,node("span","Available for purchase"));
    pages.get("Cost").append(purchaseLabel);
    if(effective?.purchaseGp!=null)money("Cost",PURCHASE_COST[0],PURCHASE_COST[1],"gp");
    for(const [key,title] of COST_NUMBERS)money("Cost",key,title,"cp");
    for(const [key,title,choices] of COST_CHOICES.filter(([key])=>key.startsWith("cost")))
      choice("Cost",key,title,choices);
    money("Cost","crewWageCpPerDay","Daily wage per crew member","gp");
    toggle("Cost","includeCrewWages","Include crew wages when operating owned transport");
    }
    heading("Services","Operating schedule","GM estimates only; real movement and rest remain explicit.");
    for(const [key,title] of OPERATIONS_NUMBERS)numeric("Services",key,title);
    for(const [key,title] of SERVICE_TOGGLES){
      if(key==="continuousEnabled"&&(offer.mode==="land"||method?.kind!=="vehicle"))continue;
      toggle("Services",key,title);
    }
    const footer=node("div");footer.style.cssText="display:flex;gap:.5rem;justify-content:space-between;flex-wrap:wrap;";
    const reset=node("button","Clear local overrides");reset.type="button";
    reset.addEventListener("click",()=>{offer.overrides={};openOfferId=offer.methodId;render();});
    footer.append(reset);
    container.append(tabs,area,footer);show();
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
