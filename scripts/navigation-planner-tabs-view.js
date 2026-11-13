/**
 * GM Navigation planner tabs. Presentation-only ApplicationV2-owned DOM:
 * none of these controls moves a token or commits a Journey.
 */
const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

export const NAVIGATION_PLANNER_TABS=Object.freeze(["travel","playback","directions"]);

export function renderNavigationPlannerTabs({active="travel",travel,playback,directions,
  onTabChange}={}){
  if(!NAVIGATION_PLANNER_TABS.includes(active)||!travel||!playback||!directions)
    throw Error("Navigation requires all three planner tabs.");
  const root=el("div");
  root.className="atlas-navigation-tabs";
  root.style.cssText="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;";
  const bar=el("div");
  bar.setAttribute?.("role","tablist");
  bar.setAttribute?.("aria-label","Navigation planning sections");
  bar.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));"+
    "gap:.3rem;padding:.65rem .7rem .25rem;";
  const panels={travel,playback,directions},buttons={};
  for(const key of NAVIGATION_PLANNER_TABS){
    const button=el("button",key==="travel"?"Travel":key==="playback"?
      "Playback":"Directions");
    button.type="button";button.id="atlas-navigation-tab-"+key;
    button.setAttribute?.("role","tab");
    button.setAttribute?.("aria-controls","atlas-navigation-panel-"+key);
    button.style.cssText="min-width:0;padding:.5rem .35rem;border-radius:7px;";
    buttons[key]=button;
    bar.appendChild(button);
    panels[key].id="atlas-navigation-panel-"+key;
    panels[key].setAttribute?.("role","tabpanel");
    panels[key].setAttribute?.("aria-labelledby",button.id);
    panels[key].style.cssText="display:flex;flex-direction:column;gap:.85rem;"+
      "padding:1rem;flex:1;min-height:0;overflow-y:auto;min-width:0;";
    root.appendChild(panels[key]);
  }
  const setActive=key=>{
    if(!NAVIGATION_PLANNER_TABS.includes(key))return;
    for(const name of NAVIGATION_PLANNER_TABS){
      panels[name].hidden=name!==key;
      // Foundry themes sometimes override [hidden] with display:flex.
      panels[name].style.display=name===key?"flex":"none";
      buttons[name].setAttribute?.("aria-selected",String(name===key));
      buttons[name].tabIndex=name===key?0:-1;
      buttons[name].style.borderColor=name===key?"#3eaf93":"";
      buttons[name].style.background=name===key?"rgba(62,175,147,.14)":"";
    }
    if(key!==active)onTabChange?.(key);
    active=key;
  };
  for(const key of NAVIGATION_PLANNER_TABS){
    buttons[key].addEventListener("click",()=>setActive(key));
    buttons[key].addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault?.();
      const index=NAVIGATION_PLANNER_TABS.indexOf(key);
      const next=event.key==="Home"?0:event.key==="End"?2:
        (index+(event.key==="ArrowRight"?1:2))%3;
      const target=NAVIGATION_PLANNER_TABS[next];
      setActive(target);buttons[target].focus?.();
    });
  }
  root.prepend?.(bar);
  // test mocks may support append only, not prepend.
  if(!root.prepend)root.children?.unshift?.(bar);
  setActive(active);
  return root;
}
