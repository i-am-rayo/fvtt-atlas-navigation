/** Read-only party-member selection view; this never changes Group members. */
import {partyCharacterRoster,projectPartyTravelSelection}
  from "./navigation-party-selection.js";

const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

export function renderNavigationPartySelection({roster,mode="all",ids=[],
  disabled=false,onChange}={}){
  const members=partyCharacterRoster(roster);
  if(!members.length)return null;
  const preview=projectPartyTravelSelection(roster,{mode,ids});
  const root=el("fieldset");
  root.className="atlas-navigation-party-selection";
  root.style.cssText="display:grid;gap:.5rem;margin:0;min-width:0;"+
    "padding:.65rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:9px;";
  root.appendChild(el("legend","Traveling party"));
  const options=el("div");
  options.style.cssText="display:flex;flex-wrap:wrap;gap:1rem;";
  for(const [value,title] of [["all","All party · "+members.length+" PCs"],
    ["selected","Select party members"]]){
    const label=el("label");
    label.style.cssText="display:flex;align-items:center;gap:.35rem;cursor:pointer;";
    const radio=el("input");
    radio.type="radio";radio.name="atlas-navigation-party-scope";radio.value=value;
    radio.checked=mode===value;radio.disabled=disabled;
    radio.addEventListener("change",()=>{
      if(!disabled&&radio.checked)onChange?.({
        mode:value,ids:value==="all"?[]:members.map(x=>x.id)
      });
    });
    label.append(radio,el("span",title));
    options.appendChild(label);
  }
  root.appendChild(options);
  if(mode==="selected"){
    const list=el("div");
    list.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.35rem;";
    const selected=new Set(preview.selectedIds);
    for(const member of members){
      const label=el("label");
      label.style.cssText="display:flex;align-items:center;gap:.35rem;min-width:0;cursor:pointer;";
      const input=el("input");
      input.type="checkbox";input.value=member.id;
      input.checked=selected.has(member.id);input.disabled=disabled;
      input.addEventListener("change",()=>{
        if(disabled)return;
        const next=new Set(selected);
        if(input.checked)next.add(member.id);
        else next.delete(member.id);
        onChange?.({mode:"selected",ids:[...next]});
      });
      label.append(input,el("span",member.name));
      list.appendChild(label);
    }
    root.appendChild(list);
    const count=el("small",preview.selectedIds.length+" / "+members.length+
      " PCs selected"+(preview.additionalPassengers?
      " · "+preview.additionalPassengers+" other Group passenger(s) retained":""));
    root.appendChild(count);
    if(preview.partial){
      const warning=el("small","Subset capacity is preview-only. Atlas moves "+
        "the complete assigned explorer token: select All party or configure "+
        "a separate Group/explorer token before starting this trip.");
      warning.style.cssText="color:var(--color-text-warning,#d7a85a);line-height:1.45;";
      root.appendChild(warning);
    }
  }
  return root;
}
