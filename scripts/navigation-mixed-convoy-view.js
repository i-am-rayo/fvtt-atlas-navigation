/** Read-only multi-method pace comparison. All selection authority is in the controller. */
const el=(tag,text)=>{const node=document.createElement(tag);
  if(text!==undefined)node.textContent=String(text);return node;};
export function renderWalkingCargoControls({participants=[],quantities={},
  recommendedSpeed,customPace=null,unit="mph",plan=null,error=null,
  disabled=false,onQuantity,onPace}={}){
  const root=el("section");
  root.className="atlas-navigation-convoy-pace";
  root.style.cssText="display:grid;gap:.55rem;padding:.7rem 0 0;border-top:1px solid var(--color-border-light-tertiary,#555);";
  const title=el("strong","Together: compare travel pace");
  root.append(title);
  const help=el("small","All Group travelers walk; hired vehicles carry cargo only. "+
    "A shared party cannot move faster than its slowest participant. "+
    "No booking, boarding or payment occurs.");
  help.style.opacity=".85";root.append(help);
  const summary=el("div");
  summary.style.cssText="display:grid;gap:.3rem;";
  for(const p of participants){
    const line=el("div");
    line.style.cssText="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.35rem;";
    line.append(el("span",p.label),el("strong",p.speed+" "+unit));
    if(p.methodId){
      const quantity=el("input");
      quantity.type="number";quantity.min="1";
      quantity.max=String(p.available===null?100:p.available);
      quantity.step="1";quantity.value=String(quantities[p.methodId]??1);
      quantity.disabled=disabled;
      quantity.style.cssText="width:5rem;";
      quantity.setAttribute?.("aria-label","Cargo units for "+p.label);
      quantity.addEventListener("change",()=>
        onQuantity?.(p.methodId,Number(quantity.value)));
      line.append(quantity);
    }
    summary.append(line);
  }
  root.append(summary);
  const pace=el("div");
  pace.style.cssText="display:grid;gap:.35rem;";
  const standard=el("label");
  standard.style.cssText="display:flex;gap:.4rem;align-items:center;";
  const normal=el("input");normal.type="radio";normal.name="atlas-convoy-pace";
  normal.value="slowest";normal.checked=customPace===null;normal.disabled=disabled;
  normal.addEventListener("change",()=>{if(normal.checked)onPace?.(null);});
  standard.append(normal,el("span","Slowest participant (recommended): "+
    recommendedSpeed+" "+unit));
  pace.append(standard);
  const slower=el("label");
  slower.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;";
  const choice=el("input");choice.type="radio";choice.name="atlas-convoy-pace";
  choice.value="custom";choice.checked=customPace!==null;choice.disabled=disabled;
  choice.addEventListener("change",()=>{
    if(choice.checked)onPace?.("custom");
  });
  const field=el("input");field.type="number";field.step="any";field.min="0.01";
  field.value=customPace===null?"":String(customPace);
  field.disabled=disabled||customPace===null;
  field.style.cssText="width:7rem;max-width:100%;";
  field.setAttribute?.("aria-label","Custom slower convoy speed in "+unit);
  field.addEventListener("change",()=>onPace?.(Number(field.value)));
  slower.append(choice,el("span","Custom slower pace"),field,el("span",unit));
  pace.append(slower);root.append(pace);
  const output=el("small",error??
    (plan?"Shared pace: "+plan.speed+" "+unit+" · "+
      plan.moving+" moving · Estimated hire "+plan.cost+" (not charged).":
      "Choose a valid pace to preview travel time and cost."));
  output.style.cssText="line-height:1.45;opacity:.9;";
  root.append(output);
  return root;
}
