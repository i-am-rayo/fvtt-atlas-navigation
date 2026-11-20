/** Preview-only GM selection of hired cargo that accompanies walkers. */
const el=(tag,text)=>{const n=document.createElement(tag);
  if(text!==undefined)n.textContent=String(text);return n;};
export function renderWalkingCargoControls({enabled=false,choices=[],quantities={},
  pace=null,sceneUnits="",plan=null,error=null,disabled=false,
  onEnabled,onQuantity,onPace}={}){
  const root=el("fieldset");root.className="atlas-navigation-cargo-convoy";
  root.style.cssText="display:grid;gap:.6rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:9px;padding:.7rem;margin:0;min-width:0;";
  root.append(el("legend","Travel together — walking + cargo"));
  const toggleLabel=el("label");toggleLabel.style.cssText="display:flex;align-items:center;gap:.45rem;cursor:pointer;";
  const toggle=el("input");toggle.type="checkbox";toggle.checked=enabled;toggle.disabled=disabled;
  toggle.addEventListener("change",()=>onEnabled?.(toggle.checked));
  toggleLabel.append(toggle,el("span","Hire cargo vehicles while everyone walks"));
  root.append(toggleLabel);
  if(!enabled)return root;
  const help=el("small","Cargo-only: no passenger seats are occupied. Every traveler walks. "+
    "The slowest participant determines the suggested speed. No booking or payment occurs.");
  help.style.opacity=".85";root.append(help);
  if(!choices.length){root.append(el("small","No eligible hired cargo vehicles at departure."));return root;}
  for(const choice of choices){
    const row=el("div");row.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;";
    const label=el("label");label.style.cssText="display:flex;gap:.45rem;align-items:center;flex:1 1 12rem;";
    const check=el("input");check.type="checkbox";
    check.checked=Number.isInteger(quantities[choice.id])&&quantities[choice.id]>0;
    check.disabled=disabled||choice.available===0;
    check.addEventListener("change",()=>onQuantity?.(choice.id,check.checked?1:0));
    label.append(check,el("span",choice.name+" · "+
      (choice.unlimited?"Unlimited":choice.available+" available")+" · "+
      choice.speedMph+" mph"));
    const count=el("input");count.type="number";count.min="1";
    count.max=String(choice.unlimited?100:choice.available);
    count.step="1";count.value=String(quantities[choice.id]||1);
    count.disabled=disabled||!check.checked;
    count.style.cssText="width:5.5rem;max-width:100%;";
    count.setAttribute?.("aria-label","Number of hired "+choice.name+" cargo vehicles");
    count.addEventListener("change",()=>onQuantity?.(choice.id,Number(count.value)));
    row.append(label,count);root.append(row);
  }
  const paceRow=el("label","GM slower pace (optional, "+sceneUnits+"/h)");
  paceRow.style.cssText="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;";
  const paceInput=el("input");paceInput.type="number";
  paceInput.min="0.1";paceInput.step="0.1";
  paceInput.value=pace===null?"":String(pace);
  paceInput.placeholder="Use suggested slowest";
  paceInput.disabled=disabled;paceInput.style.cssText="max-width:13rem;flex:1;";
  paceInput.addEventListener("change",()=>
    onPace?.(paceInput.value===""?null:Number(paceInput.value)));
  paceRow.append(paceInput);root.append(paceRow);
  const detail=el("small",plan?
    "Suggested "+plan.suggestedSpeedPerHour.toFixed(2)+" "+sceneUnits+
    "/h · Chosen "+plan.speedPerHour.toFixed(2)+" "+sceneUnits+
    "/h · "+plan.movingHours.toFixed(2)+" moving hours · "+
    plan.hires.length+" cargo type(s) · Estimated "+plan.totalCp+
    " CP (not charged).":error??"Choose cargo vehicles to calculate convoy travel.");
  detail.style.cssText="line-height:1.45;opacity:.9;";root.append(detail);
  return root;
}
