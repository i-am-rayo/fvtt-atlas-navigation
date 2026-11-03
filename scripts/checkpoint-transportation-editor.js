/**
 * Shared checkpoint transportation tab, for World templates and placed Scene
 * checkpoints. All changes stay in memory until the parent form is saved.
 */
import { listTransportationPresets } from "./navigation-transport-catalog.js";
import { checkpointOfferMethod,validateCheckpointTransportOffers }
  from "./checkpoint-transportation.js";

const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const GROUPS=[["land","Land Travel"],["water","Water Travel (rivers & lakes)"],
  ["sea","Sea Travel (coastal & ocean)"]];
const CURRENCY_FIELDS=[["costCp","Recurring upkeep (CP)"],["hireCostCp","Hired fare (CP)"],
  ["crewWageCpPerDay","Daily wage per crew member (CP)"],["purchaseGp","Purchase price (GP)"]];
const NUMBERS=[["speedMph","Travel speed (mph)"],["capacity","Passenger capacity per unit"],
  ["crewCount","Crew count"],["overtimeExtraHours","Overtime hours/day"],
  ["overtimeMultiplier","Overtime fare multiplier"],...CURRENCY_FIELDS];
const CHOICES=[["costBasis","Upkeep frequency",[["none","None"],["day","Per day"],["mile","Per mile"]]],
  ["costApplies","Upkeep charged per",[["unit","Unit"],["passenger","Passenger"]]],
  ["hireBasis","Hire fare frequency",[["trip","Per trip"],["day","Per operating day"],["mile","Per mile"]]],
  ["hireApplies","Hire charged per",[["unit","Transport unit"],["passenger","Passenger"]]]];
const CHECKS=[["hireEnabled","Available for hire"],["hireCrewIncluded","Hire includes driver / crew"],
  ["includeCrewWages","Estimate crew wages"],["overtimeEnabled","Permit overtime"],
  ["continuousEnabled","Permit continuous (water/sea) travel"]];
const label=(title,control)=>{
  const l=node("label");l.style.cssText="display:grid;gap:.2rem;min-width:0;";
  l.append(node("span",title),control);return l;
};
export function createCheckpointTransportationEditor({offers=[],settings=game.settings,
  systemId=game.system?.id}={}){
  const methods=listTransportationPresets(settings,systemId).filter(m=>m.kind!=="foot");
  const catalog=new Map(methods.map(m=>[m.id,m]));
  let draft=validateCheckpointTransportOffers(offers);
  const root=node("div");root.style.cssText="display:grid;gap:1rem;";
  const help=node("p","Offers are location-specific GM estimates. Land, inland water and sea are distinct service categories; water and sea still use Atlas water routes. Nothing is booked, purchased or deducted.");
  root.append(help);
  const host=node("div");host.style.cssText="display:grid;gap:1rem;";root.append(host);
  const render=()=>{
    host.replaceChildren();
    for(const [mode,title] of GROUPS){
      const section=node("fieldset");section.style.cssText="display:grid;gap:.6rem;min-width:0;";
      const legend=node("legend");legend.textContent=title;section.append(legend);
      const matches=draft.filter(o=>o.mode===mode);
      for(const offer of matches){
        const method=catalog.get(offer.methodId);
        const card=node("details");card.style.cssText="border:1px solid var(--color-border-light-tertiary,#655);border-radius:6px;padding:.6rem;";
        card.open=false;
        const summary=node("summary",method?.name??"Missing World method: "+offer.methodId);
        summary.style.cssText="font-weight:650;cursor:pointer;";
        card.append(summary);
        const fields=node("div");
        fields.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem;margin-top:.6rem;";
        const available=methods.filter(m=>m.surface===(mode==="land"?"land":"water"));
        const methodSelect=node("select");
        for(const m of available){
          if(draft.some(x=>x!==offer&&x.methodId===m.id))continue;
          const opt=node("option",m.name);opt.value=m.id;methodSelect.append(opt);
        }
        if(!methodSelect.querySelector('option[value="'+offer.methodId+'"]')){
          const opt=node("option",method?.name??offer.methodId);
          opt.value=offer.methodId;methodSelect.prepend(opt);
        }
        methodSelect.value=offer.methodId;
        methodSelect.addEventListener("change",()=>{
          offer.methodId=methodSelect.value;offer.overrides={};render();
        });
        fields.append(label("Transportation preset",methodSelect));
        const effective=method?checkpointOfferMethod(offer,method):null;
        for(const [key,title] of NUMBERS){
          const input=node("input");input.type="number";
          input.step=["capacity","crewCount","overtimeExtraHours"].includes(key)?"1":"any";
          if(key!=="purchaseGp")input.min="0";
          input.placeholder="World: "+String(effective?.[key]??"not set");
          input.value=offer.overrides[key]??"";
          input.addEventListener("change",()=>{
            if(input.value.trim()==="")delete offer.overrides[key];
            else offer.overrides[key]=Number(input.value);
          });
          fields.append(label(title,input));
        }
        for(const [key,title,choices] of CHOICES){
          const select=node("select");
          const inherit=node("option","World: "+String(effective?.[key]??"default"));
          inherit.value="";select.append(inherit);
          for(const [value,name] of choices){const opt=node("option",name);opt.value=value;select.append(opt);}
          select.value=offer.overrides[key]??"";
          select.addEventListener("change",()=>{
            if(select.value==="")delete offer.overrides[key];
            else offer.overrides[key]=select.value;
          });
          fields.append(label(title,select));
        }
        for(const [key,title] of CHECKS){
          if(key==="continuousEnabled"&&(mode==="land"||method?.kind!=="vehicle"))continue;
          const wrapper=node("label");wrapper.style.cssText="display:flex;align-items:center;gap:.35rem;";
          const toggle=node("input");toggle.type="checkbox";
          toggle.checked=effective?.[key]===true;
          toggle.addEventListener("change",()=>{offer.overrides[key]=toggle.checked;});
          wrapper.append(toggle,node("span",title));fields.append(wrapper);
        }
        const note=node("textarea");note.rows=2;note.maxLength=240;
        note.placeholder="Local GM note (optional)";note.value=offer.overrides.note??"";
        note.addEventListener("change",()=>{if(note.value)offer.overrides.note=note.value;
          else delete offer.overrides.note;});
        fields.append(label("Location notes",note));
        const remove=node("button","Remove from checkpoint");remove.type="button";
        remove.addEventListener("click",()=>{draft=draft.filter(x=>x!==offer);render();});
        card.append(fields,remove);section.append(card);
      }
      const candidates=methods.filter(m=>m.surface===(mode==="land"?"land":"water")&&
        !draft.some(o=>o.methodId===m.id));
      const add=node("button","+ Add "+title);add.type="button";
      add.disabled=!candidates.length;
      add.addEventListener("click",()=>{
        const method=candidates[0];
        draft.push({methodId:method.id,mode,overrides:{}});
        render();
        // Expand the newly added offer for immediate configuration.
        const cards=section.querySelectorAll("details");
        cards[cards.length-1].open=true;
      });
      section.append(add);host.append(section);
    }
  };
  render();
  return {element:root,getOffers:()=>validateCheckpointTransportOffers(draft),
    setOffers:offers=>{draft=validateCheckpointTransportOffers(offers);render();}};
}
