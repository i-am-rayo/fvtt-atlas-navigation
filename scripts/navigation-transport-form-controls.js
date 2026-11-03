/** Shared World and checkpoint transportation number / money controls.
 * All monetary values are displayed in a chosen 5e coin denomination but
 * persisted in Atlas's canonical CP-equivalent; no Actor currency is touched.
 */
import {atlasCurrencyChoices,coinFromCopper,copperFromCoin} from "./navigation-currency.js";
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function createTransportNumberSlider(name,value,{
  min=0,max=1000,step=.1,numericMax=max,numericStep=step,label="Adjust value",onChange=null
}={}){
  const wrap=el("div");wrap.style.cssText="display:flex;gap:.5rem;align-items:center;min-width:0;";
  const range=el("input");range.type="range";range.min=String(min);
  range.max=String(Math.max(min,max));range.step=String(step);
  range.value=String(Math.min(max,Math.max(min,Number(value)||min)));
  range.setAttribute("data-atlas-range-for",name);
  range.setAttribute("aria-label",label);range.style.cssText="flex:1 1 40%;min-width:3.5rem;";
  const number=el("input");number.type="number";number.name=name;
  number.min=String(min);number.max=String(numericMax);number.step=String(numericStep);
  number.value=value===null||value===undefined?"":String(value);
  number.defaultValue=number.value;
  number.style.cssText="flex:0 1 6rem;width:6rem;min-width:4rem;box-sizing:border-box;";
  range.addEventListener("input",()=>{number.value=range.value;});
  range.addEventListener("change",()=>onChange?.(number.value));
  number.addEventListener("input",()=>{
    if(number.value!==""&&Number.isFinite(Number(number.value)))
      range.value=String(Math.max(min,Math.min(Number(range.max),Number(number.value))));
  });
  number.addEventListener("change",()=>onChange?.(number.value));
  wrap.append(range,number);return wrap;
}

/** One compact coin-aware cost editor with a slider and direct numeric entry.
 * A denomination selection is explicit, mirroring native PP/GP/EP/SP/CP options.
 * World DialogV2 serializes the amount and denomination controls by name.
 */
export function createTransportPriceSlider(name,copper,{
  initialCoin="cp",onChange=null,allowNull=false,maxCoins=1000
}={}){
  const options=atlasCurrencyChoices(globalThis.game?.system?.id,
    globalThis.CONFIG?.DND5E?.currencies);
  const coin=options.some(c=>c.id===initialCoin)?initialCoin:options[0]?.id??"cp";
  const wrap=el("div");wrap.style.cssText="display:grid;gap:.35rem;min-width:0;";
  const coins=el("div");coins.style.cssText="display:flex;align-items:center;gap:.3rem;min-width:0;";
  const select=el("select");select.name=name+"Denom";select.title="Choose PP, GP, EP, SP or CP";
  select.style.cssText="flex:0 0 5.5rem;width:5.5rem;";
  for(const choice of options){
    const opt=el("option",choice.label);opt.value=choice.id;select.append(opt);
  }
  select.value=coin;
  const current=copper===null||copper===undefined?null:coinFromCopper(copper,coin);
  const numeric=createTransportNumberSlider(name+"Amount",current,{
    min:0,max:Math.max(100,maxCoins,current??0),step:1,
    numericMax:100000000,numericStep:"any",label:name+" fare amount",
    onChange:()=>emit()
  });
  const amount=numeric.querySelector?.('[name="'+name+'Amount"]')??
    numeric.children?.[1];
  if(current===null&&amount){amount.placeholder="Not specified";}
  const emit=()=>{
    if(amount?.value===""&&allowNull){onChange?.(null);return;}
    const n=Number(amount?.value??0);
    if(Number.isFinite(n)&&n>=0){
      try{onChange?.(copperFromCoin(n,select.value));}catch{/* Validate at Save. */}
    }
  };
  // Changing the displayed denomination is a conversion, not a new quote.
  // Preserve the underlying copper value across PP/GP/EP/SP/CP switches.
  let priorCoin=coin;
  select.addEventListener("change",()=>{
    if(!amount)return;
    if(amount.value===""&&allowNull){priorCoin=select.value;emit();return;}
    const originalCp=copperFromCoin(Number(amount.value||0),priorCoin);
    const converted=coinFromCopper(originalCp,select.value);
    amount.value=String(converted);
    const range=numeric.querySelector?.('[data-atlas-range-for="'+name+'Amount"]')??
      numeric.children?.[0];
    if(range)range.value=String(Math.max(Number(range.min),Math.min(Number(range.max),converted)));
    priorCoin=select.value;
    emit();
  });
  coins.append(numeric,select);
  const hint=el("small","PP · GP · EP · SP · CP");hint.style.opacity=".66";
  wrap.append(coins,hint);
  return {element:wrap,getCopper:()=>amount?.value===""&&allowNull?null:
    copperFromCoin(Number(amount?.value??0),select.value)};
}
