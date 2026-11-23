/** Physical mounts are Journey-only draft allocations; native Group inventory is never edited. */
export function renderJourneyLivestockBoarding({resources=[],decisions={},
  method=null,planned=null,surface="water",disabled=false,onChange}={}){
  if(!resources.length)return null;
  const el=(tag,text)=>{const n=document.createElement(tag);
    if(text!==undefined)n.textContent=String(text);return n;};
  const land=surface==="land";
  const action=land?"accompanying":"embarking";
  const root=el("div");
  root.className="atlas-journey-livestock";
  root.style.cssText="display:grid;gap:.4rem;min-width:0;margin-top:.25rem;";
  const count=resources.reduce((sum,r)=>sum+r.quantity,0);
  const aboard=resources.reduce((sum,r)=>sum+(decisions[r.actorId]??0),0);
  const undecided=resources.filter(r=>!Object.hasOwn(decisions,r.actorId)).length;
  const heading=el("div");
  heading.style.cssText="display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;justify-content:space-between;";
  const title=el("strong","Physical mounts");
  title.style.cssText="font-size:.87em;";
  const summary=el("small",aboard+"/"+count+" "+action+
    (undecided?" · "+undecided+" undecided":" · all decided"));
  summary.style.cssText="opacity:.85;font-size:.77em;";
  heading.append(title,summary);root.append(heading);

  const names=new Map(resources.map(r=>[r.actorId,r]));
  const setCount=(id,n)=>{
    const animal=names.get(id);
    if(!disabled&&animal&&Number.isInteger(n)&&n>=0&&n<=animal.quantity)
      onChange?.(id,n);
  };
  const card=animal=>{
    const has=Object.hasOwn(decisions,animal.actorId);
    const number=has?decisions[animal.actorId]:null;
    const item=el("div");
    item.className="atlas-journey-mount-card";
    item.style.cssText="display:flex;gap:.4rem;align-items:center;padding:.4rem .5rem;"+
      "min-width:0;border:1px solid var(--color-border-light-tertiary,#555);"+
      "border-radius:5px;background:var(--color-bg-option,#23212b);";
    item.draggable=!disabled;
    item.setAttribute("aria-label",animal.name+", "+animal.quantity+" physical mounts");
    item.addEventListener("dragstart",event=>{
      if(disabled){event.preventDefault();return;}
      event.dataTransfer?.setData("text/plain","atlas-mount:"+animal.actorId);
      if(event.dataTransfer)event.dataTransfer.effectAllowed="move";
    });
    const details=el("div");
    details.style.cssText="min-width:0;flex:1;display:grid;gap:.05rem;";
    const name=el("span",animal.name+" ×"+animal.quantity);
    name.style.cssText="font-size:.83em;overflow-wrap:anywhere;";
    const state=el("small",!has?"Boarding undecided":number===0?
      "Staying behind":number+" "+action);
    state.style.cssText="font-size:.73em;opacity:.8;";
    details.append(name,state);
    const quantity=el("input");
    quantity.type="number";quantity.step="1";quantity.min="0";
    quantity.max=String(animal.quantity);
    quantity.placeholder="—";quantity.value=has?String(number):"";
    quantity.disabled=disabled;
    quantity.style.cssText="width:3.6rem;min-width:0;";
    quantity.setAttribute("aria-label","Number of "+animal.name+" "+action+
      " (0 to "+animal.quantity+")");
    quantity.title="Set a partial quantity; zero means staying behind";
    quantity.addEventListener("change",()=>{
      const value=Number(quantity.value);
      if(quantity.value!==""&&Number.isInteger(value)&&value>=0&&
        value<=animal.quantity)setCount(animal.actorId,value);
      else quantity.value=has?String(number):"";
    });
    const move=el("button","↔");move.type="button";move.disabled=disabled;
    move.title="Move "+animal.name+(number>0?" to stay behind":" to "+action);
    move.setAttribute("aria-label",move.title);
    move.style.cssText="min-width:1.6rem;padding:.1rem .25rem;";
    move.addEventListener("click",()=>setCount(animal.actorId,
      number>0?0:animal.quantity));
    item.append(details,quantity,move);
    return item;
  };
  const board=el("div");
  board.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,"+
    "minmax(min(100%,11rem),1fr));gap:.5rem;min-width:0;";
  const column=(label,boarding)=>{
    const zone=el("div");
    zone.className="atlas-navigation-travel-column atlas-journey-mount-column";
    zone.style.cssText="display:grid;align-content:start;gap:.3rem;min-width:0;"+
      "min-height:3.6rem;border:1px dashed var(--color-border-light-tertiary,#555);"+
      "border-radius:8px;padding:.5rem;";
    zone.setAttribute("aria-label",label+" mounts");
    const available=resources.filter(m=>boarding?decisions[m.actorId]>0:
      !(decisions[m.actorId]>0));
    const header=el("strong",label);
    header.style.cssText="font-size:.83em;";
    zone.append(header);
    for(const m of available)zone.append(card(m));
    if(!available.length)zone.append(el("small","Drop mounts here"));
    zone.addEventListener("dragover",event=>{
      if(disabled)return;
      event.preventDefault();
      if(event.dataTransfer)event.dataTransfer.dropEffect="move";
    });
    zone.addEventListener("drop",event=>{
      event.preventDefault();
      const raw=event.dataTransfer?.getData("text/plain")??"";
      const id=raw.startsWith("atlas-mount:")?raw.slice(12):null;
      const animal=names.get(id);
      if(animal)setCount(id,boarding?(decisions[id]>0?
        decisions[id]:animal.quantity):0);
    });
    return zone;
  };
  board.append(column(land?"Accompanying":"Embarking",true),
    column("Staying behind / undecided",false));
  root.append(board);
  if(!land){
    const capacity=method?.livestockCapacity;
    const note=el("small",capacity==null?
      "Animal accommodation is unlimited by default (no stall limit configured). "+
      "Passenger seating and available vessel quantities remain separate.":
      capacity===0?"Mount boarding is prohibited: this vessel has 0 animal stalls.":
      capacity+" animal stalls per vessel; passenger seats are separate.");
    note.style.cssText="font-size:.76em;opacity:.85;";
    root.append(note);
  }
  if(planned){
    const note=el("small","Draft estimate: "+planned.units+" vessel(s) · animal fare "+
      planned.estimatedFareCp+" CP; no currency is deducted.");
    note.style.cssText="font-size:.75em;opacity:.8;";
    root.append(note);
  }
  return root;
}
