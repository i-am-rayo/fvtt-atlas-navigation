/**
 * Compact checkpoint offer editor shared by World templates and Scene settings.
 * Draft changes remain local until the parent Save is confirmed.
 */
import { listTransportationPresets } from "./navigation-transport-catalog.js";
import { checkpointOfferMethod,validateCheckpointTransportOffers }
  from "./checkpoint-transportation.js";
import { createSettingsIconButton } from "./settings-controls.js";

const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const GROUPS=[["land","Land Travel","land"],["water","Water Travel (rivers & lakes)","water"],
  ["sea","Sea Travel (coastal & ocean)","water"],["air","Air Travel","air"]];
const GENERAL_NUMBERS=[["speedMph","Travel speed (mph)"],["capacity","Passengers per unit"]];
const COST_NUMBERS=[["costCp","Recurring upkeep (CP)"],
  ["hireCostCp","Hired service fare (CP)"],["purchaseGp","Purchase price (GP)"]];
const OPERATIONS_NUMBERS=[["crewCount","Crew count"],
  ["crewWageCpPerDay","Daily wage per crew member (CP)"],
  ["overtimeExtraHours","Overtime hours/day"],
  ["overtimeMultiplier","Overtime multiplier"]];
const COST_CHOICES=[["costBasis","Upkeep frequency",
    [["none","No upkeep"],["day","Per day"],["mile","Per mile"]]],
  ["costApplies","Upkeep charge per",[["unit","Transport unit"],["passenger","Passenger"]]],
  ["hireBasis","Hire fare frequency",
    [["trip","Per trip"],["day","Per operating day"],["mile","Per mile"]]],
  ["hireApplies","Hire charge per",[["unit","Transport unit"],["passenger","Passenger"]]]];
const SERVICE_TOGGLES=[["hireEnabled","Offer for hire / passage"],
  ["hireCrewIncluded","Hire includes driver / crew"],
  ["includeCrewWages","Include estimated crew wages"],
  ["overtimeEnabled","Allow overtime travel"],
  ["continuousEnabled","Allow continuous travel"]];
const label=(title,control)=>{
  const l=node("label");l.style.cssText="display:grid;gap:.3rem;min-width:0;align-content:start;";
  l.append(node("span",title),control);return l;
};
const grid=()=>{
  const e=node("div");e.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.7rem;align-items:start;";
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
      const input=node("input");input.type="number";input.min="0";
      input.step=["capacity","crewCount","overtimeExtraHours"].includes(key)?"1":"any";
      input.placeholder="World: "+String(method?.[key]??"not set");
      input.value=offer.overrides[key]??"";
      input.addEventListener("change",()=>{
        if(input.value.trim()==="")delete offer.overrides[key];
        else offer.overrides[key]=Number(input.value);
      });
      pages.get(page).append(label(title,input));
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
    const notes=node("textarea");notes.rows=2;notes.maxLength=240;
    notes.placeholder="Optional location-specific notes";notes.value=offer.overrides.note??"";
    notes.addEventListener("change",()=>{if(notes.value)offer.overrides.note=notes.value;
      else delete offer.overrides.note;});
    pages.get("General").append(label("GM notes",notes));
    for(const [key,title] of COST_NUMBERS)numeric("Cost",key,title);
    for(const [key,title,choices] of COST_CHOICES)choice("Cost",key,title,choices);
    for(const [key,title] of OPERATIONS_NUMBERS)numeric("Services",key,title);
    for(const [key,title] of SERVICE_TOGGLES){
      if(key==="continuousEnabled"&&(offer.mode==="land"||method?.kind!=="vehicle"))continue;
      toggle("Services",key,title);
    }
    const footer=node("div");footer.style.cssText="display:flex;gap:.5rem;justify-content:space-between;flex-wrap:wrap;";
    const reset=node("button","Clear local overrides");reset.type="button";
    reset.addEventListener("click",()=>{offer.overrides={};openOfferId=offer.methodId;render();});
    const remove=node("button","Remove offer");remove.type="button";
    remove.addEventListener("click",()=>{draft=draft.filter(x=>x!==offer);
      selectedTabs.delete(offer.methodId);render();});
    footer.append(reset,remove);
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
        const card=node("details");card.style.cssText="border-bottom:1px solid var(--color-border-light-tertiary,#666);padding:.4rem 0;min-width:0;";
        card.open=openOfferId===offer.methodId;
        const summary=node("summary");
        summary.style.cssText="cursor:pointer;display:grid;gap:.15rem;";
        const heading=node("strong",world?.name??"Missing World method");
        const subtitle=node("small",fareSummary(current));subtitle.style.opacity=".8";
        summary.append(heading,subtitle);card.append(summary);
        card.addEventListener("toggle",()=>{if(card.open)openOfferId=offer.methodId;
          else if(openOfferId===offer.methodId)openOfferId=null;});
        drawFields(offer,world,card);
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
