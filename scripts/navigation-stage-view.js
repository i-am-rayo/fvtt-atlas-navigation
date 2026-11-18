/**
 * Independent, read-only stage layouts. The controller supplies validated,
 * display-ready projections and the existing action footer owns GM commands.
 * No Foundry documents or Journey records are accessed or modified here.
 */
const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

export function createNavigationStageShell(){
  const root=el("section");
  root.style.cssText="display:flex;flex-direction:column;height:100%;max-height:100%;min-height:0;overflow:hidden;";
  const body=el("div");
  body.style.cssText="display:flex;flex-direction:column;gap:.85rem;padding:1rem;flex:1;min-height:0;overflow-y:auto;";
  return {root,body};
}

export function renderNavigationStageIntro({title,description=null,notice=null}){
  const heading=el("h2",title);
  heading.style.cssText="margin:0;font-size:1.3rem;";
  const nodes=[heading];
  if(description){
    const hint=el("p",description);
    hint.style.cssText="margin:0;opacity:.8;font-size:.86em;line-height:1.4;";
    nodes.push(hint);
  }
  if(notice){
    const status=el("p",notice);
    status.style.cssText="margin:0;padding:.65rem;border:1px solid var(--color-border-light-tertiary,#666);border-radius:6px;";
    nodes.push(status);
  }
  return nodes;
}

/** No active controls or planned fare quotes may appear on a finished Journey. */
export function renderNavigationCompletedOverview({title,departed,arrived,
  moving,downtime,elapsed,legs=[]}){
  const section=el("section");
  section.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:8px;padding:.85rem;display:grid;gap:.65rem;";
  section.appendChild(el("h3",title||"Completed Journey"));
  for(const [label,value] of [["Departed",departed],["Arrived",arrived],
    ["Confirmed movement",moving],["Confirmed downtime",downtime],
    ["Total elapsed",elapsed]]){
    const row=el("div");
    row.style.cssText="display:flex;gap:.75rem;justify-content:space-between;flex-wrap:wrap;";
    const key=el("span",label);key.style.opacity=".75";
    row.append(key,el("strong",value));section.appendChild(row);
  }
  const heading=el("h3","Confirmed legs");
  heading.style.cssText="margin:.5rem 0 0;";
  section.appendChild(heading);
  for(const leg of legs){
    const card=el("section");
    card.style.cssText="border-top:1px solid var(--color-border-light-tertiary,#555);padding-top:.6rem;display:grid;gap:.2rem;";
    card.append(el("strong",leg.label),el("span",leg.details));
    section.appendChild(card);
  }
  return section;
}
