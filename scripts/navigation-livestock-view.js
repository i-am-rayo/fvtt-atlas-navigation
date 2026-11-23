/** Native DOM-only mount boarding draft; never commits Group or Token state. */
export function renderJourneyLivestockBoarding({resources=[],decisions={},
  method=null,planned=null,disabled=false,onChange}={}){
  if(!resources.length)return null;
  const node=(tag,text)=>{const el=document.createElement(tag);
    if(text!==undefined)el.textContent=text;return el;};
  const root=node("section");
  root.className="atlas-journey-livestock";
  root.style.cssText="display:grid;gap:.45rem;border:1px solid var(--color-border-light-tertiary,#555);"+
    "border-radius:.45rem;padding:.65rem;min-width:0;";
  root.append(node("h3","Physical mounts — Embark or Stay behind"));
  const capacity=method?.livestockCapacity;
  root.append(node("small","Every physical animal requires a separate boarding decision. "+
    "Animal accommodation is independent of passenger seats. "+
    (Number.isInteger(capacity)?
      capacity+" animal stalls per vessel.":"Animal stalls unverified — boarding is blocked until configured.")+
    " No Group, Actor or currency changes."));
  const grid=node("div");grid.style.cssText="display:grid;gap:.35rem;";
  for(const animal of resources){
    const row=node("label");row.style.cssText="display:flex;align-items:center;"+
      "justify-content:space-between;flex-wrap:wrap;gap:.5rem;min-width:0;";
    const title=node("span",animal.name+" · "+animal.quantity+
      " physical "+(animal.quantity===1?"mount":"mounts"));
    const choice=node("select");choice.setAttribute?.("aria-label",
      "Number of "+animal.name+" to embark");
    for(const [value,label] of [["","Choose boarding"],...Array.from(
      {length:animal.quantity+1},(_,n)=>[String(n),n===0?"Stay behind":
        "Embark "+n+" of "+animal.quantity])]){
      const option=node("option",label);option.value=value;choice.append(option);
    }
    choice.value=Object.hasOwn(decisions,animal.actorId)?
      String(decisions[animal.actorId]):"";
    choice.disabled=disabled;
    choice.addEventListener("change",()=>{
      if(choice.value!=="")onChange?.(animal.actorId,Number(choice.value));
    });
    row.append(title,choice);grid.append(row);
  }
  root.append(grid);
  if(planned){
    root.append(node("small","Approved draft: "+planned.resources.reduce(
      (n,m)=>n+m.aboard,0)+" mounts embarking · "+planned.units+
      " vessel(s) · animal fare "+planned.estimatedFareCp+
      " CP (included in total estimate, never deducted)."));
  }
  return root;
}
