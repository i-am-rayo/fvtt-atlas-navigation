/**
 * Read-only GM Navigation directions display.
 *
 * The controller supplies permitted, formatted directions and event labels.
 * This view owns only DOM. It cannot calculate a route, approve a rest,
 * access Foundry data or write token, World-time or Journal state.
 */
import {NAVIGATION_ARROWS} from "./navigation-instructions.js";

const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

/**
 * @param {object} model
 * @param {string} model.calculation Already resolved explanatory text.
 * @param {boolean} model.transfer Whether this is the next transfer leg.
 * @param {string|null} model.arrivalCheckpointName
 * @param {Array<object>} model.rows Preformatted directions and Journey events.
 * @returns {HTMLElement[]} Original details, heading and list order.
 */
export function renderNavigationDirections({
  calculation,transfer=false,arrivalCheckpointName=null,rows=[]
}){
  const details=el("details");
  const summaryText=el("summary","How Atlas calculated this journey");
  summaryText.style.cursor="pointer";
  details.appendChild(summaryText);
  const note=el("p",calculation);
  note.style.cssText="font-size:.85em;opacity:.85;line-height:1.4;margin:.4rem 0;";
  details.appendChild(note);

  const heading=el("h3",transfer?"Directions to next decision point":"Directions");
  heading.style.cssText="margin:.2rem 0 0;";
  const list=el("div");
  list.style.cssText="display:flex;flex-direction:column;gap:.4rem;";
  const endpoint=atStart=>{
    const item=el("div");
    item.style.cssText="display:flex;align-items:center;gap:.8rem;padding:.8rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:8px;";
    const marker=el("span",atStart?"●":"◆");
    marker.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;font-weight:bold;color:white;background:"+
      (atStart?"#16a765":"#d83c49")+";";
    const content=el("div");
    const name=el("strong",atStart?"Depart from starting point":
      transfer?"Reach "+(arrivalCheckpointName??"the next decision point"):
        "Arrive at destination");
    const detail=el("div",atStart?"Starting location":
      transfer?"Decide whether to stop, replan or continue":"Final destination");
    detail.style.cssText="opacity:.7;font-size:.8em;margin-top:.2rem;";
    content.append(name,detail);
    item.append(marker,content);
    return item;
  };
  list.appendChild(endpoint(true));
  for(const row of rows){
    if(row.kind==="journey-event"){
      const item=el("div");
      item.style.cssText="display:flex;align-items:center;gap:.8rem;padding:.8rem;border:1px solid #b18b54;border-radius:8px;background:rgba(177,139,84,.08);";
      const badge=el("span",row.marker);
      badge.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;background:#5c482c;";
      const content=el("div");
      const name=el("strong",row.label);
      const detail=el("div",row.detail);
      detail.style.cssText="opacity:.75;font-size:.85em;margin-top:.2rem;";
      content.append(name,detail);
      item.append(badge,content);
      list.appendChild(item);
      continue;
    }
    const item=el("div");
    item.style.cssText="display:flex;align-items:flex-start;gap:.8rem;padding:.8rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:8px;";
    const marker=el("span",NAVIGATION_ARROWS[row.direction]??"•");
    marker.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;background:var(--color-cool-4,#333);font-weight:bold;";
    marker.title=row.direction||"Route";
    const content=el("div");
    content.style.minWidth="0";
    const instruction=el("strong",row.instruction);
    instruction.style.display="block";
    const info=el("div",row.info);
    info.style.cssText="opacity:.75;font-size:.85em;margin-top:.3rem;";
    const surface=el("div",row.surface);
    surface.style.cssText="opacity:.55;font-size:.72em;margin-top:.18rem;";
    content.append(instruction,info);
    if(surface.textContent)content.appendChild(surface);
    item.append(marker,content);
    list.appendChild(item);
  }
  list.appendChild(endpoint(false));
  return [details,heading,list];
}
