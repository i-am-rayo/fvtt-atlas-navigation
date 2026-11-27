/**
 * Read-only GM transportation advisories, capacity and cost breakdowns.
 *
 * Transport rules, Group resources, fare calculations and edit authorization
 * stay outside this presentation layer. Render-only never charges currency.
 */
import {formatExactTransportationFare} from "./navigation-currency.js";

const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

export function renderTransportAdvisory(message){
  const advisory=el("p",message);
  advisory.style.cssText="margin:0;padding:.5rem;border:1px solid #b18b54;border-radius:6px;font-size:.83em;";
  return advisory;
}

export function renderTransportCapacity({description,needsReview=false,warning=false,
  onReview,onRefresh}={}){
  const box=el("div");
  box.style.cssText="display:grid;gap:.4rem;";
  const note=el("p",description);
  note.style.cssText="margin:0;padding:.5rem;border:1px solid "+
    (warning?"#b18b54":"var(--color-border-light-tertiary,#666)")+
    ";border-radius:6px;font-size:.83em;";
  box.appendChild(note);
  if(needsReview){
    const controls=el("div");
    controls.style.cssText="display:flex;gap:.5rem;flex-wrap:wrap;";
    const review=el("button","Review mounts & NPC roles");
    review.type="button";
    review.addEventListener("click",()=>onReview());
    const refresh=el("button","Refresh seats");
    refresh.type="button";
    refresh.addEventListener("click",()=>onRefresh());
    controls.append(review,refresh);
    box.appendChild(controls);
    box.appendChild(el("small","In the Group sheet's Travel Pace header, open Manage Party Transportation, "+
      "set a mount NPC's Role to Mount, specify its quantity and rider capacity, "+
      "then Save assignments. Refresh seats after saving."));
  }
  return box;
}

export function renderTransportQuote({worldEstimate=null,currentEstimate,
  breakdown,operatingSummary,overrides=false,disabled=false,onReset}={}){
  const block=el("section");
  block.style.cssText="display:grid;gap:.55rem;border:1px solid var(--color-border-light-tertiary,#777);border-radius:8px;padding:.65rem;";
  if(worldEstimate!==null){
    const initial=el("div",worldEstimate);
    initial.style.cssText="opacity:.78;font-size:.9em;";
    block.append(initial);
  }
  block.append(el("strong",currentEstimate));
  block.append(el("small",breakdown));
  const timetable=el("small",operatingSummary);
  timetable.style.cssText="opacity:.8;";
  block.append(timetable);
  if(overrides){
    const helper=el("small","Journey-only settings are active. "+
      "Use the pencil beside Travel method to edit them.");
    helper.style.opacity=".85";
    block.append(helper);
    const reset=el("button","Reset journey overrides");
    reset.type="button";
    reset.disabled=disabled;
    reset.style.cssText="justify-self:start;";
    reset.addEventListener("click",()=>{if(!disabled)onReset();});
    block.append(reset);
  }
  return block;
}

/** Owned staffing is a World profile reference, not a roster assignment. */
export function describeOwnedCrewProfile(method,quantity=1){
  if(!method)return "Not configured — link a World profile.";
  const count=method.crewCount??0;
  const total=Number.isInteger(quantity)&&quantity>0&&quantity<=100?
    " · "+count*quantity+" required across "+quantity+(quantity===1?" unit":" units"):"";
  const basis=method.crewWageBasis??"day";
  const period=basis==="day"?"operating day":basis;
  return count+" required crew per unit (World profile)"+total+
    " · "+(method.includeCrewWages?
      "Crew wage rate: "+formatExactTransportationFare(method.crewWageCpPerDay??200,
        globalThis.CONFIG?.DND5E?.currencies)+" per crew member / "+period:
      "Crew wages excluded from estimates");
}

/** The current quote already owns the arithmetic; display counts, never reprice. */
export function describeJourneyCrewEstimate(quote){
  if(!quote||quote.requiredCrew==null||quote.paidCrew==null)return null;
  return "Required crew: "+quote.requiredCrew+" · Separately paid crew: "+quote.paidCrew+
    (quote.requiredCrew>0&&quote.driverIncluded?" (crew included in hire fare)":
      quote.requiredCrew>0&&quote.paidCrew===0?" (separate wages excluded)":"")+
    ". Staffing is an estimate; Group crew are not automatically allocated.";
}

/** Report the *effective* current-leg mount fare without changing the World catalog. */
export function describeJourneyMountFare(manifest,{method=null,worldPercent=50,
  arrangement=null,formatMoney=value=>value+" CP",approved=false,showFare=true}={}){
  const aboard=manifest?.resources?.filter(item=>item.aboard>0)??[];
  if(!aboard.length)return null;
  const quantity=aboard.reduce((sum,item)=>sum+item.aboard,0);
  const names=aboard.map(item=>item.name+" ×"+item.aboard).join(", ");
  const policy=approved?"Previously approved fare":
    arrangement==="owned"?"No boarding fee on party-owned transport":
    method?.livestockFareCp!=null?"Fixed mount fare override":
    method?.livestockFarePercent!=null?
      "Method override "+method.livestockFarePercent+"% of passenger fare":
    method?.hireApplies==="unit"?
      "No automatic percentage on unit-priced service":
      "World default "+worldPercent+"% of passenger fare";
  const description=names+" ("+quantity+" mounts · "+policy+")";
  if(approved)return description+(showFare?": "+formatMoney(manifest.estimatedFareCp):"")+
    " (not quoted again; not charged)";
  return description+(showFare?": "+formatMoney(manifest.estimatedFareCp)+
    " (included in total; not charged)":"");
}

/** Consistent owned unit evidence across ordinary, checkpoint and mixed review. */
export function describeOwnedUnitStaffing(unit){
  return unit.name+" — Unit "+unit.unitIndex+": "+
    (unit.configured?unit.staffedCrew+"/"+unit.requiredCrew+" crew · "+unit.tier:
      "Roster unconfigured · "+unit.requiredCrew+" reference crew")+
    " · "+unit.paidCrew+" paid"+(unit.namedCrew.length?" · "+
      unit.namedCrew.map(c=>c.name+(c.duty?" ("+c.duty+")":"")).join(", "):"");
}

export {describeTransportationFareRows} from "./navigation-currency.js";

/** Reusable route context for the planner and the GM approval. */
export function renderNavigationRouteContext(context,{nextLabel="Next stop"}={}){
  const list=el("dl");
  list.className="atlas-navigation-route-context";
  list.style.cssText="display:grid;gap:.3rem;margin:.35rem 0;padding:.6rem;border:1px solid var(--color-border-light-tertiary,#666);border-radius:6px;";
  for(const [label,value] of [["From",context.from],[nextLabel,context.next],["Final destination",context.final]]){
    const row=el("div");
    row.style.cssText="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;";
    const term=el("dt",label);term.style.opacity=".8";
    const detail=el("dd",value);detail.style.cssText="margin:0;font-weight:600;overflow-wrap:anywhere;min-width:0;";
    row.append(term,detail);list.append(row);
  }
  return list;
}

/** Shared read-only GM confirmation. All rows and metrics come from a
 * previously validated current-leg plan; this view never approves travel. */
export function renderNavigationTransportApproval({
  heading="Transportation summary",destination=null,routeContext=null,overview=null,rows=[],metrics=[],notes=[],fareRows=[]
}={}){
  if(!rows.length||metrics.length!==4)
    throw Error("A transportation approval needs a complete leg summary.");
  // DialogV2 requires a plain, attribute-free outer div.
  const wrapper=el("div");
  const root=el("div");
  root.className="atlas-transport-approval";
  root.append(el("h3",heading));
  if(routeContext)root.append(renderNavigationRouteContext(routeContext));
  else if(destination)root.append(el("p",destination));
  if(overview){
    const counts=el("p",overview);
    counts.className="atlas-transport-approval-overview";
    root.append(counts);
  }
  const table=el("table");
  table.className="atlas-transport-approval-table";
  const head=el("thead"),labels=el("tr");
  for(const label of ["Method","Travelers","Units","Cost"]){
    const cell=el("th",label);
    cell.scope="col";
    labels.append(cell);
  }
  head.append(labels);table.append(head);
  const body=el("tbody");
  for(const data of rows){
    const row=el("tr");
    row.append(el("td",String(data.method??"—")));
    const travelers=el("td");
    if(Number.isInteger(data.travelerCount)&&data.travelerCount>1){
      const detail=el("details");
      detail.className="atlas-transport-approval-roster";
      detail.append(el("summary",data.travelerCount+" travelers"),
        el("div",String(data.travelers??"—")));
      travelers.append(detail);
    }else travelers.textContent=String(data.travelers??"—");
    row.append(travelers,el("td",String(data.units??"—")),el("td",String(data.cost??"—")));
    body.append(row);
  }
  table.append(body);root.append(table);
  if(fareRows.length){
    root.append(el("h4","Fare breakdown"));
    const fares=el("dl");
    fares.className="atlas-transport-approval-fares";
    for(const [label,value] of fareRows){
      const item=el("div");
      item.append(el("dt",String(label)),el("dd",String(value)));
      fares.append(item);
    }
    root.append(fares);
  }
  const totals=el("dl");
  totals.className="atlas-transport-approval-metrics";
  for(const [label,value] of metrics){
    const tile=el("div");
    tile.className="atlas-transport-approval-metric";
    tile.append(el("dt",label),el("dd",String(value)));
    totals.append(tile);
  }
  root.append(totals);
  for(const note of notes){
    if(note)root.append(el("p",note));
  }
  wrapper.append(root);
  return wrapper;
}

/** Counts come from the approved unit and livestock manifests, never from
 * parsing display names or estimating the Group again. */
export function describeOwnedApprovalOverview(travelers,approval,livestock){
  if(!approval)return null;
  const mounts=livestock?.resources?.reduce((n,item)=>n+item.aboard,0)??0;
  const count=approval.units.length,unit=approval.surface==="water"?"vessel":"vehicle";
  return travelers+" "+(travelers===1?"traveler":"travelers")+" · "+
    approval.passengerSeats+" "+(approval.passengerSeats===1?"seat":"seats")+" · "+
    mounts+" "+(mounts===1?"mount":"mounts")+" · "+count+" "+unit+(count===1?"":"s");
}

export function navigationApprovalPosition(){
  return {width:Math.min(720,Math.max(280,(globalThis.window?.innerWidth??800)-40))};
}
