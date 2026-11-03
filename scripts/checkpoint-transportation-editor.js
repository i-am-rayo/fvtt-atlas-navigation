/**
 * Checkpoint transportation list. The full edit form is shared with World
 * transportation presets and Navigation, so no independent field UI can drift.
 * Edits stay in this local draft until the parent checkpoint/preset is saved.
 */
import {listTransportationPresets} from "./navigation-transport-catalog.js";
import {checkpointOfferMethod,validateCheckpointTransportOffers,
  transportationMethodOverrideDelta} from "./checkpoint-transportation.js";
import {openTransportationMethodEditor} from "./navigation-transport-settings.js";
import {createSettingsIconButton} from "./settings-controls.js";
import {dndCurrencyBreakdown} from "./navigation-currency.js";

const node=(tag,text)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;return el;};
const GROUPS=[["land","Land Travel","land"],
  ["water","Water Travel (rivers & lakes)","water"],
  ["sea","Sea Travel (coastal & ocean)","water"],
  ["air","Air Travel","air"]];
const fareSummary=method=>{
  if(!method)return "World transportation preset missing";
  const seats=method.capacity==null?"capacity unknown":method.capacity+" seat(s)";
  const amount=method.hireCostCp??0;
  const unit=method.hireApplies==="passenger"?"passenger":"unit";
  const frequency=method.hireBasis==="day"?"day":method.hireBasis;
  return method.speedMph+" mph · "+seats+" · "+(method.hireEnabled?
    "Hire "+dndCurrencyBreakdown(amount,globalThis.CONFIG?.DND5E?.currencies).label+
    " / "+frequency+" / "+unit:"Not offered for hire");
};

/** Edits do not save a Scene/World document until the parent dialog saves. */
export function createCheckpointTransportationEditor({offers=[],
  settings=game.settings,systemId=game.system?.id}={}){
  let draft=validateCheckpointTransportOffers(offers);
  const adding=new Set();
  const root=node("div");
  root.className="atlas-transport-checkpoint-editor";
  root.style.cssText="display:grid;gap:.8rem;min-width:0;";
  const help=node("p","Choose transportation available here. Each offer inherits the "+
    "latest World preset unless specifically overridden. Nothing is booked or charged.");
  help.style.cssText="margin:.2rem 0 .4rem;opacity:.8;";root.append(help);
  const host=node("div");host.style.cssText="display:grid;gap:.8rem;";root.append(host);

  const currentCatalog=()=>listTransportationPresets(settings,systemId)
    .filter(method=>method.kind!=="foot");

  const editOffer=async methodId=>{
    const offer=draft.find(item=>item.methodId===methodId);
    const world=currentCatalog().find(method=>method.id===methodId);
    if(!offer||!world)throw Error("The checkpoint method is no longer available.");
    await openTransportationMethodEditor({
      method:checkpointOfferMethod(offer,world),scope:"checkpoint",
      onSave:async edited=>{
        const live=currentCatalog().find(method=>method.id===methodId);
        if(!live||JSON.stringify(live)!==JSON.stringify(world))
          throw Error("World transportation settings changed. Reopen the editor.");
        const updated=draft.map(item=>item.methodId===methodId?
          {...item,overrides:transportationMethodOverrideDelta(world,edited)}:item);
        draft=validateCheckpointTransportOffers(updated);
        render();
      }
    });
  };
  const safeEdit=id=>editOffer(id).catch(error=>{
    globalThis.ui?.notifications?.error?.(error?.message??String(error));
  });
  const render=()=>{
    host.replaceChildren();
    const methods=currentCatalog();
    const catalog=new Map(methods.map(method=>[method.id,method]));
    for(const [mode,title,surface] of GROUPS){
      const section=node("fieldset");
      section.style.cssText="display:grid;gap:.45rem;min-width:0;border-radius:.5rem;";
      const legend=node("legend");legend.style.cssText="display:flex;align-items:center;gap:.5rem;font-weight:700;";
      legend.append(node("span",title));
      const candidates=methods.filter(method=>method.surface===surface&&
        !draft.some(offer=>offer.methodId===method.id));
      const add=createSettingsIconButton({icon:"plus",label:"Add "+title+" method"});
      add.style.cssText="min-width:2.3rem;min-height:2.3rem;padding:.35rem;";
      add.disabled=!candidates.length;
      add.addEventListener("click",()=>{
        if(adding.has(mode))adding.delete(mode);else adding.add(mode);
        render();
      });
      legend.append(add);section.append(legend);
      if(adding.has(mode)&&candidates.length){
        const addRow=node("div");
        addRow.style.cssText="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;";
        const chooser=node("select");chooser.style.cssText="flex:1 1 11rem;min-width:0;";
        for(const method of candidates){
          const option=node("option",method.name);option.value=method.id;
          chooser.append(option);
        }
        const confirm=node("button","Add selected method");confirm.type="button";
        confirm.addEventListener("click",()=>{
          const methodId=chooser.value;if(!methodId)return;
          draft=validateCheckpointTransportOffers([...draft,
            {methodId,mode,overrides:{}}]);
          adding.delete(mode);render();safeEdit(methodId);
        });
        addRow.append(chooser,confirm);section.append(addRow);
      }
      const matches=draft.filter(offer=>offer.mode===mode);
      if(!matches.length)section.append(node("small","No services configured."));
      for(const offer of matches){
        const world=catalog.get(offer.methodId);
        const method=world?checkpointOfferMethod(offer,world):null;
        const card=node("div");
        card.style.cssText="border-bottom:1px solid var(--color-border-light-tertiary,#666);padding:.4rem 0;min-width:0;";
        const row=node("div");
        row.style.cssText="display:flex;align-items:center;gap:.4rem;min-width:0;";
        const info=node("div");
        info.style.cssText="flex:1 1 auto;min-width:0;display:grid;gap:.18rem;";
        info.append(node("strong",world?.name??"Missing World method"));
        const subtitle=node("small",fareSummary(method));subtitle.style.opacity=".8";
        info.append(subtitle);
        const edit=createSettingsIconButton({icon:"pen-to-square",
          label:"Edit "+(world?.name??offer.methodId)+" at this checkpoint",
          onClick:()=>safeEdit(offer.methodId)});
        const remove=createSettingsIconButton({icon:"trash",danger:true,
          label:"Remove "+(world?.name??offer.methodId)+" from checkpoint",
          onClick:()=>{draft=draft.filter(item=>item!==offer);render();}});
        row.append(info,edit,remove);card.append(row);section.append(card);
      }
      host.append(section);
    }
  };
  render();
  return {element:root,getOffers:()=>validateCheckpointTransportOffers(draft),
    setOffers:value=>{draft=validateCheckpointTransportOffers(value);adding.clear();render();}};
}
