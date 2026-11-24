/** Compact GM-only aggregate travel-mode manifest. Never assigns named riders in the UI. */
const el=(tag,text)=>{const node=document.createElement(tag);
  if(text!==undefined)node.textContent=String(text);return node;};
export function renderNavigationMixedLandControls({methods=[],
  riderCounts={},units={},pace=null,recommended=null,maximum=null,
  unit="mph",preview=null,error=null,disabled=false,
  onRiders,onUnits,onPace}={}){
  const root=el("section");
  root.className="atlas-navigation-mixed-assignments";
  root.style.cssText="display:grid;gap:.6rem;padding:.65rem 0 0;"+
    "border-top:1px solid var(--color-border-light-tertiary,#555);";
  root.append(el("strong","Mixed travel — party overview"));
  const help=el("small","Personal mounts use their existing Party-owned rider "+
    "assignments automatically. No individual travel choices are needed: "+
    "the GM decides who uses shared seats in theater of the mind. "+
    "Set aggregate passenger counts only where seating or fares require it. "+
    "No boarding, booking, payment or Actor change occurs automatically.");
  help.style.opacity=".85";root.append(help);
  const list=el("div");
  list.style.cssText="display:grid;gap:.45rem;";
  for(const method of methods){
    const row=el("div");
    row.style.cssText="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;";
    const label=el("span",method.name+" · "+method.speedLabel+
      (method.arrangement==="hire"?
        " · "+(method.available===null?"Unlimited units":
          method.available+" available"):
        method.key==="owned|walking"?" · Remaining party walks":
          " · "+method.available+" owned unit(s)"));
    label.style.cssText="flex:1 1 13rem;line-height:1.4;";
    row.append(label);
    if(method.personalAssignments?.length){
      const assignment=el("small","Preassigned: "+
        method.personalAssignments.join(", "));
      assignment.style.cssText="flex-basis:100%;opacity:.85;";
      row.append(assignment);
    }
    if(method.key!=="owned|walking"){
      if(method.canAdjustRiders){
        const ridersLabel=el("label","Riders");
        ridersLabel.style.cssText="display:flex;gap:.4rem;align-items:center;";
        const count=el("input");count.type="number";count.min="0";
        count.max=String(method.maximumRiders??100);
        count.step="1";count.value=String(riderCounts[method.key]??
          method.suggestedRiders??0);
        count.disabled=disabled;
        count.style.cssText="width:5rem;max-width:100%;";
        count.setAttribute?.("aria-label","Passenger count for "+method.name);
        count.addEventListener("change",()=>
          onRiders?.(method.key,Number(count.value)));
        ridersLabel.append(count);row.append(ridersLabel);
      }
      if(method.arrangement==="hire"){
        const unitsLabel=el("label","Units");
        unitsLabel.style.cssText="display:flex;gap:.4rem;align-items:center;";
        const counter=el("input");counter.type="number";counter.min="1";
        counter.max=String(method.available===null?100:method.available);
        counter.step="1";counter.value=String(units[method.key]??1);
        counter.disabled=disabled;counter.style.cssText="width:5rem;max-width:100%;";
        counter.setAttribute?.("aria-label","Hire units for "+method.name);
        counter.addEventListener("change",()=>
          onUnits?.(method.key,Number(counter.value)));
        unitsLabel.append(counter);row.append(unitsLabel);
      }
    }
    list.append(row);
  }
  root.append(list);
  const paceGroup=el("div");paceGroup.style.cssText="display:grid;gap:.35rem;";
  const standard=el("label");standard.style.cssText=
    "display:flex;gap:.4rem;align-items:center;";
  const normal=el("input");normal.type="radio";normal.name="atlas-mixed-pace";
  normal.value="recommended";normal.checked=pace===null;normal.disabled=disabled;
  normal.addEventListener("change",()=>{if(normal.checked)onPace?.(null);});
  standard.append(normal,el("span","Slowest participating method (recommended)"+
    (recommended===null?"":": "+recommended+" "+unit)));
  paceGroup.append(standard);
  const override=el("label");override.style.cssText=
    "display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;";
  const custom=el("input");custom.type="radio";custom.name="atlas-mixed-pace";
  custom.value="override";custom.checked=pace!==null;custom.disabled=disabled;
  custom.addEventListener("change",()=>{if(custom.checked)onPace?.("custom");});
  const field=el("input");field.type="number";field.step="any";field.min="0.01";
  field.value=pace===null?"":String(pace);field.disabled=disabled||pace===null;
  field.style.cssText="width:7rem;max-width:100%;";
  field.setAttribute?.("aria-label","GM mixed travel pace in "+unit);
  field.addEventListener("change",()=>onPace?.(Number(field.value)));
  override.append(custom,el("span","GM pace override"),field,el("span",unit));
  paceGroup.append(override);
  if(maximum!==null)paceGroup.append(el("small",
    "Maximum without changing selected mount/vehicle speeds: "+
    maximum+" "+unit+". A faster walking pace requires GM approval."));
  root.append(paceGroup);
  const summary=el("small",error??(preview?
    "Pooled allocation: "+preview.passengers+" riding, "+preview.walking+
    " walking · "+preview.seats+" seats used · "+
    preview.speed+" "+unit+" · "+preview.moving+
    " moving · Estimated "+preview.cost+" (not charged).":
    "Travel is available when configured seats and passenger counts cover "+
    "the Group. Any others walk if Walking is selected."));
  summary.style.cssText="line-height:1.45;opacity:.9;";root.append(summary);
  return root;
}
