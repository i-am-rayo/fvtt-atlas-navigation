/**
 * Read-only GM transportation advisories, capacity and cost breakdowns.
 *
 * Transport rules, Group resources, fare calculations and edit authorization
 * stay outside this presentation layer. Render-only never charges currency.
 */
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

/** Shared read-only GM confirmation. All rows and metrics come from a
 * previously validated current-leg plan; this view never approves travel. */
export function renderNavigationTransportApproval({
  heading="Transportation summary",destination=null,rows=[],metrics=[],notes=[]
}={}){
  if(!rows.length||metrics.length!==4)
    throw Error("A transportation approval needs a complete leg summary.");
  // Foundry v14 DialogV2.content accepts HTMLDivElement, not HTMLElement.
  const root=el("div");
  root.className="atlas-transport-approval";
  root.append(el("h3",heading));
  if(destination)root.append(el("p",destination));
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
    for(const value of [data.method,data.travelers,data.units,data.cost])
      row.append(el("td",String(value??"—")));
    body.append(row);
  }
  table.append(body);root.append(table);
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
  return root;
}
