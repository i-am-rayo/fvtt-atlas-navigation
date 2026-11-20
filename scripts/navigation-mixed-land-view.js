/** GM-only mixed transport assignments. Presentation does not approve movement. */
const el=(tag,text)=>{const node=document.createElement(tag);
  if(text!==undefined)node.textContent=String(text);return node;};

export function renderNavigationMixedLandControls({travelers=[],methods=[],
  assignments={},units={},pace=null,recommended=null,maximum=null,
  unit="mph",preview=null,error=null,disabled=false,
  onAssignment,onUnits,onPace}={}){
  const root=el("section");
  root.className="atlas-navigation-mixed-assignments";
  root.style.cssText="display:grid;gap:.6rem;padding:.65rem 0 0;"+
    "border-top:1px solid var(--color-border-light-tertiary,#555);";
  root.append(el("strong","Mixed party — assign each traveler"));
  const help=el("small","Assign each Group member to exactly one selected method. "+
    "A traveler without a separate seat may accompany their chosen vehicle. "+
    "A hired per-unit vehicle with no passengers carries cargo only. "+
    "Atlas never books vehicles or changes Actors.");
  help.style.opacity=".85";root.append(help);
  const people=el("div");people.style.cssText="display:grid;gap:.4rem;";
  for(const member of travelers){
    const row=el("label");row.style.cssText="display:flex;flex-wrap:wrap;"+
      "gap:.45rem;align-items:center;justify-content:space-between;";
    const description=el("span",member.name+" · "+member.seatsNeeded+
      " seat(s)"+(member.passengers>1?" · "+member.passengers+" travelers":""));
    description.style.cssText="flex:1 1 10rem;";
    const selector=el("select");
    selector.style.cssText="min-width:10rem;max-width:100%;flex:1 1 11rem;";
    selector.disabled=disabled;
    selector.setAttribute?.("aria-label","Travel method for "+member.name);
    const first=el("option","Choose method…");first.value="";
    selector.append(first);
    for(const method of methods){
      const option=el("option",method.name);
      option.value=method.key;
      selector.append(option);
    }
    selector.value=assignments[member.actorId]??"";
    selector.addEventListener("change",()=>onAssignment?.(member.actorId,selector.value));
    row.append(description,selector);people.append(row);
  }
  root.append(people);
  const inventory=el("div");inventory.style.cssText="display:grid;gap:.4rem;";
  for(const method of methods){
    const row=el("div");
    row.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;";
    const label=el("span",method.name+" · "+method.speedLabel+
      " · "+(method.arrangement==="hire"?
        method.available===null?"Unlimited local units":method.available+" local units":
        method.key==="owned|walking"?"On foot":
        method.available+" owned units"));
    label.style.cssText="flex:1 1 12rem;";
    row.append(label);
    if(method.arrangement==="hire"){
      const counter=el("input");counter.type="number";counter.min="1";
      counter.max=String(method.available===null?100:method.available);
      counter.step="1";
      counter.value=String(units[method.key]??method.minimumUnits??1);
      counter.disabled=disabled;
      counter.style.cssText="width:5.5rem;max-width:100%;";
      counter.setAttribute?.("aria-label","Hire units for "+method.name);
      counter.addEventListener("change",()=>
        onUnits?.(method.key,Number(counter.value)));
      row.append(counter);
    }
    inventory.append(row);
  }
  root.append(inventory);
  const paceGroup=el("div");
  paceGroup.style.cssText="display:grid;gap:.35rem;";
  const recommendedLabel=el("label");
  recommendedLabel.style.cssText="display:flex;gap:.4rem;align-items:center;";
  const defaultRadio=el("input");defaultRadio.type="radio";
  defaultRadio.name="atlas-mixed-pace";defaultRadio.value="recommended";
  defaultRadio.checked=pace===null;defaultRadio.disabled=disabled;
  defaultRadio.addEventListener("change",()=>{if(defaultRadio.checked)onPace?.(null);});
  recommendedLabel.append(defaultRadio,el("span","Slowest participating method (recommended)"+
    (recommended===null?"":": "+recommended+" "+unit)));
  paceGroup.append(recommendedLabel);
  const customLabel=el("label");customLabel.style.cssText=
    "display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;";
  const customRadio=el("input");customRadio.type="radio";
  customRadio.name="atlas-mixed-pace";customRadio.value="override";
  customRadio.checked=pace!==null;customRadio.disabled=disabled;
  customRadio.addEventListener("change",()=>{
    if(customRadio.checked)onPace?.("custom");
  });
  const value=el("input");value.type="number";value.step="any";value.min="0.01";
  value.value=pace===null?"":String(pace);value.disabled=disabled||pace===null;
  value.style.cssText="width:7rem;max-width:100%;";
  value.setAttribute?.("aria-label","GM mixed travel pace in "+unit);
  value.addEventListener("change",()=>onPace?.(Number(value.value)));
  customLabel.append(customRadio,el("span","GM pace override"),value,el("span",unit));
  paceGroup.append(customLabel);
  if(maximum!==null)paceGroup.append(el("small",
    "Maximum without changing selected mount/vehicle speeds: "+
      maximum+" "+unit+". Raising walking pace requires explicit GM confirmation."));
  root.append(paceGroup);
  const message=el("small",error??
    (preview?"Travel pace "+preview.speed+" "+unit+" · "+
      preview.moving+" moving · "+
      preview.passengers+" riding passenger(s), "+preview.walking+
      " walking · Estimated total "+preview.cost+" (no booking or payment).":
      "Assign every traveler to preview available seats, route time and fares."));
  message.style.cssText="line-height:1.45;opacity:.9;";
  root.append(message);
  return root;
}
