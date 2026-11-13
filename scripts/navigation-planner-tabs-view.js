/**
 * Accessible, modeless Navigation section tabs. State lives in the
 * ApplicationV2 controller; render never changes gameplay.
 */
const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};
export const NAVIGATION_PLANNER_TABS=Object.freeze(["travel","playback","directions"]);
export const NAVIGATION_JOURNEY_TABS=Object.freeze(["journey","directions","speed"]);

function renderSections({active,sections,onTabChange,title}){
  const keys=Object.keys(sections);
  if(!keys.includes(active)||keys.length!==3||keys.some(key=>!sections[key]?.panel))
    throw Error("Navigation requires all three planner tabs.");
  const root=el("div");
  root.className="atlas-navigation-tabs";
  root.style.cssText="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;";
  const bar=el("div");
  bar.setAttribute?.("role","tablist");
  bar.setAttribute?.("aria-label",title);
  bar.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));"+
    "gap:.3rem;padding:.65rem .7rem .25rem;";
  const buttons={};
  for(const key of keys){
    const {label,panel}=sections[key];
    const button=el("button",label);
    button.type="button";button.id="atlas-navigation-tab-"+key;
    button.setAttribute?.("role","tab");
    button.setAttribute?.("aria-controls","atlas-navigation-panel-"+key);
    button.style.cssText="min-width:0;padding:.5rem .35rem;border-radius:7px;";
    buttons[key]=button;
    bar.appendChild(button);
    panel.id="atlas-navigation-panel-"+key;
    panel.setAttribute?.("role","tabpanel");
    panel.setAttribute?.("aria-labelledby",button.id);
    panel.style.cssText="display:flex;flex-direction:column;gap:.85rem;"+
      "padding:1rem;flex:1;min-height:0;overflow-y:auto;min-width:0;";
    root.appendChild(panel);
  }
  const setActive=key=>{
    if(!keys.includes(key))return;
    for(const name of keys){
      const panel=sections[name].panel;
      panel.hidden=name!==key;
      panel.style.display=name===key?"flex":"none";
      buttons[name].setAttribute?.("aria-selected",String(name===key));
      buttons[name].tabIndex=name===key?0:-1;
      buttons[name].style.borderColor=name===key?"#3eaf93":"";
      buttons[name].style.background=name===key?"rgba(62,175,147,.14)":"";
    }
    if(key!==active)onTabChange?.(key);
    active=key;
  };
  for(const key of keys){
    buttons[key].addEventListener("click",()=>setActive(key));
    buttons[key].addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault?.();
      const index=keys.indexOf(key);
      const next=event.key==="Home"?0:event.key==="End"?keys.length-1:
        (index+(event.key==="ArrowRight"?1:keys.length-1))%keys.length;
      const target=keys[next];
      setActive(target);buttons[target].focus?.();
    });
  }
  root.prepend?.(bar);
  if(!root.prepend)root.children?.unshift?.(bar);
  setActive(active);
  return root;
}

export function renderNavigationPlannerTabs({active="travel",travel,playback,
  directions,onTabChange}={}){
  return renderSections({active,onTabChange,title:"Navigation planning sections",
    sections:{
      travel:{label:"Travel",panel:travel},
      playback:{label:"Playback",panel:playback},
      directions:{label:"Directions",panel:directions}
    }});
}

export function renderNavigationJourneyTabs({active="journey",journey,directions,
  speed,onTabChange}={}){
  return renderSections({active,onTabChange,title:"Active Journey sections",
    sections:{
      journey:{label:"Journey",panel:journey},
      directions:{label:"Directions",panel:directions},
      speed:{label:"Journey Speed",panel:speed}
    }});
}
