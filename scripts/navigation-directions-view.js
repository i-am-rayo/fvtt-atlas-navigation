/**
 * Standalone Directions tab: compact, read-only instructions with an
 * approximate confirmed-Journey position. Never edits itinerary or Journal.
 */
import {NAVIGATION_ARROWS} from "./navigation-instructions.js";
import {compactNavigationDirectionRows} from "./navigation-direction-summary.js";

const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};
const validProgress=value=>Number.isFinite(value)&&value>=0&&value<=100;

export function renderNavigationDirections({
  calculation=null,transfer=false,arrivalCheckpointName=null,rows=[],
  markers=[],formatDistance=null,formatHours=null,progressPercent=null
}={}){
  const condensed=compactNavigationDirectionRows(rows,{markers,formatDistance,formatHours});
  const directionCount=condensed.filter(r=>r.kind==="direction").length;
  const eventCount=condensed.filter(r=>r.kind==="route-marker").length;
  const root=el("section");
  root.className="atlas-navigation-directions";
  root.style.cssText="display:grid;gap:.7rem;min-width:0;";
  const headline=el("h3",
    (transfer?"Directions to next decision":"Directions")+" · "+
    directionCount+" step(s)"+
    (eventCount?" · "+eventCount+" landmark(s)":""));
  headline.style.cssText="margin:0;font-size:1.05em;font-weight:700;";
  root.appendChild(headline);
  const progress=validProgress(progressPercent)?progressPercent:null;
  if(progress!==null){
    const estimate=el("small",
      "Approximate position: "+Math.floor(progress)+"% of confirmed Journey route");
    estimate.style.cssText="opacity:.8;";
    root.appendChild(estimate);
  }
  const list=el("ol");
  list.className="atlas-navigation-direction-list";
  list.style.cssText="display:grid;gap:.35rem;list-style:none;position:relative;"+
    "margin:0;padding:0 0 0 1rem;border-left:3px solid "+
    "var(--color-border-light-tertiary,#555);";
  if(progress!==null){
    list.style.borderImage="linear-gradient(to bottom,#16a765 0%,#16a765 "+
      progress+"%,var(--color-border-light-tertiary,#555) "+
      progress+"%,var(--color-border-light-tertiary,#555) 100%) 1";
    list.setAttribute?.("aria-label",
      "Directions position is approximate, based on verified native movement");
  }
  const endpoint=start=>{
    const item=el("li");
    item.style.cssText="display:flex;gap:.65rem;padding:.4rem .35rem;align-items:center;";
    const icon=el("span",start?"●":"◆");
    icon.style.cssText="width:1.6rem;text-align:center;color:"+
      (start?"#16a765":"#d83c49")+";";
    const text=el("strong",start?"Depart with the party":
      arrivalCheckpointName?"Arrive to "+arrivalCheckpointName:
      transfer?"Arrive at the next decision point":"Arrive at selected location");
    item.append(icon,text);
    return item;
  };
  list.appendChild(endpoint(true));
  const total=condensed.reduce((sum,row)=>sum+(row.kind==="direction"&&
    Number.isFinite(row.distanceValue)?Math.max(0,row.distanceValue):0),0);
  const target=progress===null?null:total*progress/100;
  let walked=0,marked=false;
  for(const row of condensed){
    const item=el("li");
    item.style.cssText="display:flex;gap:.65rem;align-items:flex-start;"+
      "padding:.55rem .35rem;border-top:1px solid var(--color-border-light-tertiary,#444);";
    let marker,label,info;
    if(row.kind==="journey-event"){
      marker=row.marker||"☕";label=row.label;info=row.detail;
    }else if(row.kind==="route-marker"){
      marker=row.checkpointId?"⚑":"↱";label=row.label;info=null;
    }else{
      marker=NAVIGATION_ARROWS[row.direction]??"•";
      label=row.instruction;info=row.info;
      const distance=Number.isFinite(row.distanceValue)?
        Math.max(0,row.distanceValue):0;
      if(!marked&&target!==null&&total>0&&
          target>=walked-1e-6&&target<=walked+distance+1e-6){
        item.setAttribute?.("aria-current","step");
        item.title="Approximate current direction, based on confirmed Journey distance";
        item.style.borderLeft="3px solid #16a765";
        marked=true;
      }
      walked+=distance;
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
      nested.appendChild(el("summary","Show "+row.segments.length+" terrain / road segments"));
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
