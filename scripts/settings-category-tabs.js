/** Client-only World catalog tab navigation. Panels and their live draft controls
 * stay mounted; callers own authorization, validation and persistence. */
export function createSettingsCategoryTabs({id, modes, active="land", onChange=()=>{}}){
  const nav=document.createElement("nav");
  nav.className="atlas-world-category-tabs";
  nav.setAttribute?.("role","tablist");
  nav.setAttribute?.("aria-label","World preset category");
  const tabs=new Map(),panels=new Map();
  let selected=modes.some(([key])=>key===active)?active:modes[0][0];
  const activate=key=>{
    if(!tabs.has(key))return;
    selected=key;
    for(const [mode,tab] of tabs){
      const chosen=mode===key;
      tab.setAttribute?.("aria-selected",String(chosen));
      tab.tabIndex=chosen?0:-1;
      const panel=panels.get(mode);
      if(panel){panel.hidden=!chosen;panel.style.display=chosen?"grid":"none";}
    }
    onChange(key);
  };
  for(const [key,label] of modes){
    const tab=document.createElement("button");
    tab.type="button";
    tab.textContent=label;
    tab.id=id+"-"+key+"-tab";
    tab.setAttribute?.("role","tab");
    tab.setAttribute?.("aria-controls",id+"-"+key+"-panel");
    tab.addEventListener("click",()=>activate(key));
    tabs.set(key,tab);
    nav.appendChild(tab);
  }
  nav.addEventListener("keydown",event=>{
    const keys=[...tabs.keys()],index=[...tabs.values()].indexOf(event.target);
    if(index<0)return;
    const next=event.key==="ArrowRight"?(index+1)%keys.length:
      event.key==="ArrowLeft"?(index+keys.length-1)%keys.length:
      event.key==="Home"?0:event.key==="End"?keys.length-1:-1;
    if(next<0)return;
    event.preventDefault?.();
    activate(keys[next]);
    tabs.get(keys[next]).focus?.();
  });
  // New renders must announce the selected category before any interaction.
  activate(selected);
  return {nav,activate,
    addPanel(key,panel){
      panel.id=id+"-"+key+"-panel";
      panel.setAttribute?.("role","tabpanel");
      panel.setAttribute?.("aria-labelledby",id+"-"+key+"-tab");
      panels.set(key,panel);
      panel.hidden=key!==selected;
      panel.style.display=key===selected?"grid":"none";
      return panel;
    },
    get selected(){return selected;}
  };
}
