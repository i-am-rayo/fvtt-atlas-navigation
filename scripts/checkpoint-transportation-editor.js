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
import {compareAtlasLabels} from "./settings-select.js";
import {dndCurrencyBreakdown} from "./navigation-currency.js";
import {atlasDisplayCostPerDistance,atlasDisplayPresetSpeed,atlasFormatMeasure,
  resolveAtlasMeasuringUnits} from "./navigation-measure-units.js";
import {readLivestockFarePercent} from "./navigation-transport-service.js";

const node=(tag,text)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;return el;};
const GROUPS=[["land","Land Travel","land"],
  ["water","Water Travel (rivers & lakes)","water"],
  ["sea","Sea Travel (coastal & ocean)","water"],
  ["air","Air Travel","air"]];
// Rates are reference amounts, not payable journey quotes. Never round a
// fractional rate up to a whole coin just to display it.
const rateLabel=cp=>{
  const coins=dndCurrencyBreakdown(cp,globalThis.CONFIG?.DND5E?.currencies);
  return coins.roundedUp?Number(cp.toFixed(4))+" CP":coins.label;
};
function offerDetails(method,overrides,settings,systemId){
  const metric=resolveAtlasMeasuringUnits(settings,systemId)==="metric";
  const basis=value=>value==="mile"?(metric?"km":"mile"):value==="day"?"travel day":"trip";
  const rate=(amount,frequency)=>rateLabel(frequency==="mile"?
    atlasDisplayCostPerDistance(amount,settings,systemId):amount);
  const source=(keys,fallback="World preset")=>{
    const count=keys.filter(key=>Object.hasOwn(overrides,key)).length;
    return count?"Local override"+(count<keys.length?" + inherited defaults":""):fallback;
  };
  const line=(label,value,keys,fallback)=>label+": "+value+" · "+source(keys,fallback);
  const hireUnit=method.hireApplies==="passenger"?"passenger":method.kind==="mount"?"mount":"vehicle";
  const lines=[
    line("Hire rate",method.hireEnabled?
      rate(method.hireCostCp??0,method.hireBasis)+" / "+basis(method.hireBasis)+" / "+hireUnit:
      "Not offered for hire",["hireEnabled","hireCostCp","hireBasis","hireApplies"]),
    line("Availability",!method.hireEnabled?"Not offered":method.hireUnlimited!==false?"Unlimited":
      method.hireQuantity+" "+(method.kind==="mount"?"mount(s)":"vehicle(s)")+
        (method.hireQuantity===0?" — unavailable":" available"),
      ["hireEnabled","hireUnlimited","hireQuantity"],"World preset + Map Marker defaults"),
    line("Passenger seats",method.capacity==null?"Unknown":method.capacity+" per "+(method.kind==="mount"?"mount":"vehicle"),["capacity"]),
  ];
  if(method.kind==="vehicle"){
    lines.push(line("Animal spaces",method.livestockCapacity==null?"Unlimited":
      method.livestockCapacity===0?"0 — not permitted":method.livestockCapacity+" per vehicle",
      ["livestockCapacity"]));
    const mountFare=method.livestockFareCp!=null?
      rate(method.livestockFareCp,method.livestockFareBasis)+" / "+basis(method.livestockFareBasis)+" / mount":
      (method.livestockFarePercent??readLivestockFarePercent(settings))+"% of passenger fare";
    lines.push(line("Mount fare",mountFare,["livestockFareCp","livestockFarePercent","livestockFareBasis"],
      method.livestockFareCp!=null||method.livestockFarePercent!=null?"World preset":"World default"));
  }
  lines.push(line("Speed",atlasFormatMeasure(atlasDisplayPresetSpeed(method.speedMph,settings,systemId)),["speedMph"]));
  if(method.kind==="vehicle"||method.crewCount>0)
    lines.push(line("Crew",(method.crewCount??0)+" required"+
      (method.hireEnabled?(method.hireCrewIncluded!==false?" · Included in hire":" · Not included in hire"):""),
      ["crewCount","hireCrewIncluded"]));
  lines.push(line("Operating schedules",["Standard",...(method.overtimeEnabled?["Overtime"]:[]),
    ...(method.kind==="vehicle"&&method.continuousEnabled?["Continuous"]:[])].join(" / "),
    ["overtimeEnabled","continuousEnabled"]));
  return lines;
}

/** Edits do not save a Scene/World document until the parent dialog saves. */
export function createCheckpointTransportationEditor({offers=[],
  settings=game.settings,systemId=game.system?.id,
  draftTarget="Map Marker",saveLabel="Save Map Marker"}={}){
  let draft=validateCheckpointTransportOffers(offers);
  const initial=JSON.stringify(draft);
  const adding=new Set();
  const root=node("div");
  root.className="atlas-transport-checkpoint-editor";
  root.style.cssText="display:grid;gap:.8rem;min-width:0;";
  const help=node("p","Choose transportation available here. Each offer inherits the "+
    "latest World preset unless specifically overridden. Nothing is booked or charged.");
  help.style.cssText="margin:.2rem 0 .4rem;opacity:.8;";root.append(help);
  const status=node("small");
  status.className="atlas-marker-offer-status";
  status.setAttribute("role","status");status.setAttribute("aria-live","polite");
  root.append(status);
  const host=node("div");host.style.cssText="display:grid;gap:.8rem;";root.append(host);

  const currentCatalog=()=>listTransportationPresets(settings,systemId)
    .filter(method=>method.kind!=="foot");

  const editOffer=async methodId=>{
    const offer=draft.find(item=>item.methodId===methodId);
    const world=currentCatalog().find(method=>method.id===methodId);
    if(!offer||!world)throw Error("The Map Marker method is no longer available.");
    await openTransportationMethodEditor({
      method:checkpointOfferMethod(offer,world),scope:"checkpoint",inheritedMethod:world,
      checkpointDraftTarget:draftTarget,checkpointOverrides:offer.overrides,
      onReset:async()=>{
        draft=validateCheckpointTransportOffers(draft.map(item=>
          item.methodId===methodId?{...item,overrides:{}}:item));
        render();
      },
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
    status.textContent=(JSON.stringify(draft)===initial?"Transportation draft unchanged.":
      "Unsaved transportation changes.")+" Use "+saveLabel+" to keep changes; Cancel discards them.";
    host.replaceChildren();
    const methods=currentCatalog();
    const catalog=new Map(methods.map(method=>[method.id,method]));
    for(const [mode,title,surface] of GROUPS){
      const section=node("fieldset");
      section.style.cssText="display:grid;gap:.45rem;min-width:0;border-radius:.5rem;";
      const legend=node("legend");legend.style.cssText="display:flex;align-items:center;gap:.5rem;font-weight:700;";
      legend.append(node("span",title));
      const candidates=methods.filter(method=>method.surface===surface&&
        !draft.some(offer=>offer.methodId===method.id))
        .sort((a,b)=>compareAtlasLabels(a.name,b.name)||compareAtlasLabels(a.id,b.id));
      const add=createSettingsIconButton({icon:"plus",label:"Add "+title+" method"});
      // Shared Atlas icon primitive owns the target and glyph size.
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
          adding.delete(mode);render();
        });
        addRow.append(chooser,confirm);section.append(addRow);
      }
      const matches=draft.filter(offer=>offer.mode===mode);
      if(!matches.length)section.append(node("small","No services configured."));
      for(const offer of matches){
        const world=catalog.get(offer.methodId);
        const method=world?checkpointOfferMethod(offer,world):null;
        const card=node("div");
        card.className="atlas-marker-offer-card";
        card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:.4rem;padding:.5rem;min-width:0;";
        const row=node("div");
        row.style.cssText="display:flex;align-items:start;flex-wrap:wrap;gap:.4rem;min-width:0;";
        const info=node("div");
        info.style.cssText="flex:1 1 auto;min-width:0;display:grid;gap:.18rem;";
        info.append(node("strong",world?.name??"Missing World method"));
        info.append(node("small",!world?"Missing World preset — review this offer before saving":
          Object.keys(offer.overrides??{}).length?"Local overrides":"Inherits World preset"));
        if(method){
          for(const [index,detail] of offerDetails(method,offer.overrides,settings,systemId).entries()){
            const subtitle=node(index===0?"strong":"small",detail);
            subtitle.className=index===0?"atlas-marker-offer-rate":"atlas-marker-offer-detail";
            subtitle.style.cssText="overflow-wrap:anywhere;line-height:1.35;";
            info.append(subtitle);
          }
        }
        const edit=createSettingsIconButton({icon:"pen-to-square",
          label:"Edit "+(world?.name??offer.methodId)+" offer"+(draftTarget==="Map Marker preset"?" in this Map Marker preset":" at this Map Marker"),
          onClick:()=>safeEdit(offer.methodId)});
        edit.disabled=!world;
        const remove=createSettingsIconButton({icon:"trash",danger:true,
          label:"Remove "+(world?.name??offer.methodId)+" from Map Marker",
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
