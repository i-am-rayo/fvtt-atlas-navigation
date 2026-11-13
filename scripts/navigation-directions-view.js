/**
 * Accessible collapsible GM Navigation route explanation.
 * Display-only: no Scene mutation, movement, Journal or permission decisions.
 */
import {NAVIGATION_ARROWS} from "./navigation-instructions.js";
import {compactNavigationDirectionRows} from "./navigation-direction-summary.js";

const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

export function renderNavigationDirections({
  calculation,transfer=false,arrivalCheckpointName=null,rows=[],
  markers=[],expanded=false,onExpandedChange=null,
  formatDistance=null,formatHours=null
}={}){
  const condensed=compactNavigationDirectionRows(rows,{
    markers,formatDistance,formatHours});
  const directionCount=condensed.filter(r=>r.kind==="direction").length;
  const eventCount=condensed.filter(r=>r.kind==="route-marker").length;
  const root=el("details");
  root.className="atlas-navigation-directions";
  root.open=Boolean(expanded);
  root.style.cssText="border:1px solid var(--color-border-light-tertiary,#555);border-radius:9px;padding:.65rem .8rem;";
  const headline=el("summary",
    (transfer?"Directions to next decision":"Directions")+" · "+
    directionCount+" step(s)"+
    (eventCount?" · "+eventCount+" landmark(s)":""));
  headline.style.cssText="cursor:pointer;font-weight:700;font-size:1.05em;";
  root.appendChild(headline);
  root.addEventListener("toggle",()=>onExpandedChange?.(Boolean(root.open)));
  const explanation=el("details");
  explanation.style.cssText="margin:.5rem 0;font-size:.8em;opacity:.8;";
  explanation.appendChild(el("summary","How Atlas calculated this trip"));
  const description=el("p",calculation);
  description.style.margin=".4rem 0";
  explanation.appendChild(description);
  root.appendChild(explanation);

  const list=el("ol");
  list.className="atlas-navigation-direction-list";
  list.style.cssText="display:grid;gap:.35rem;list-style:none;margin:.55rem 0 0;padding:0;";
  const endpoint=(start)=>{
    const item=el("li");
    item.style.cssText="display:flex;gap:.65rem;padding:.4rem .35rem;align-items:center;";
    const icon=el("span",start?"●":"◆");
    icon.style.cssText="width:1.6rem;text-align:center;color:"+(start?"#16a765":"#d83c49")+";";
    const text=el("strong",start?"Depart with the party":
      transfer?"Reach "+(arrivalCheckpointName??"the next decision point"):
        "Arrive at destination");
    item.append(icon,text);return item;
  };
  list.appendChild(endpoint(true));
  for(const row of condensed){
    const item=el("li");
    item.style.cssText="display:flex;gap:.65rem;align-items:flex-start;"+
      "padding:.55rem .35rem;border-top:1px solid var(--color-border-light-tertiary,#444);";
    let marker,label,info;
    if(row.kind==="journey-event"){
      marker=row.marker||"☕";label=row.label;info=row.detail;
    }else if(row.kind==="route-marker"){
      marker=row.kind==="checkpoint"?"⚑":"↱";
      marker=row.checkpointId?"⚑":"↱";
      label=row.label;info=null;
    }else{
      marker=NAVIGATION_ARROWS[row.direction]??"•";
      label=row.instruction;info=row.info;
    }
    const symbol=el("span",marker);
    symbol.style.cssText="width:1.6rem;flex:0 0 1.6rem;text-align:center;font-size:1.2em;";
    const content=el("div");
    content.style.minWidth="0";
    content.appendChild(el("strong",label));
    if(info){
      const fine=el("div",info);
      fine.style.cssText="font-size:.8em;opacity:.73;margin-top:.2rem;";
      content.appendChild(fine);
    }
    if(row.kind==="direction"&&row.segments?.length>1){
      const nested=el("details");
      nested.style.cssText="margin-top:.3rem;font-size:.78em;opacity:.8;";
      nested.appendChild(el("summary",
        "Show "+row.segments.length+" terrain / road segments"));
      const breakdown=el("ul");
      breakdown.style.cssText="padding-left:1.2rem;margin:.2rem 0;";
      for(const part of row.segments)
        breakdown.appendChild(el("li",[part.info,part.surface].filter(Boolean).join(" · ")));
      nested.appendChild(breakdown);
      content.appendChild(nested);
    }else if(row.kind==="direction"&&row.surface){
      const surface=el("small",row.surface);
      surface.style.cssText="display:block;opacity:.65;margin-top:.2rem;";
      content.appendChild(surface);
    }
    item.append(symbol,content);
    list.appendChild(item);
  }
  list.appendChild(endpoint(false));
  root.appendChild(list);
  return [root];
}
