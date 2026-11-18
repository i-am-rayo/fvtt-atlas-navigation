/** Bounded slider + numeric editor. Presentation only; never persists data.
 * The number is authoritative when submitting a draft: invalid/empty input
 * cannot quietly fall back to an older slider value.
 */
export function parseBoundedRangeDraft(raw,{min,max,step="any"}={}){
  const value=String(raw??"").trim();
  const low=Number(min),high=Number(max);
  if(!value||!Number.isFinite(low)||!Number.isFinite(high)||low>high)
    throw Error("Enter a valid number within the permitted range.");
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<low||amount>high)
    throw Error("Enter a number between "+min+" and "+max+".");
  if(step!=="any"){
    const increment=Number(step);
    if(!Number.isFinite(increment)||increment<=0)
      throw Error("Invalid numeric control step.");
    const multiples=(amount-low)/increment;
    if(Math.abs(multiples-Math.round(multiples))>1e-6)
      throw Error("Enter a value in increments of "+step+".");
  }
  return amount;
}

/** Both directions update in memory. Host actions choose whether change is
 * committed immediately, on Apply, or at a GM-confirmed Save boundary. */
export function createSettingsNumberRange(initial,{min,max,step=1,
  numberStep=step,label="Numeric setting",
  onInput=null,onInvalid=null,unit=null}={}){
  const wrap=document.createElement("div");
  wrap.className="atlas-number-range";
  const slider=document.createElement("input");
  slider.type="range";slider.min=String(min);slider.max=String(max);
  slider.step=String(step);slider.value=String(initial);
  slider.setAttribute?.("aria-label",label+" slider");
  const number=document.createElement("input");
  number.type="number";number.min=String(min);number.max=String(max);
  number.step=String(numberStep);number.value=String(initial);
  number.defaultValue=number.value;
  number.setAttribute?.("aria-label",label+" number");
  const getValue=()=>parseBoundedRangeDraft(number.value,{
    min,max,step:numberStep});
  const error=message=>{
    number.setCustomValidity?.(message);
    if(message)number.setAttribute?.("aria-invalid","true");
    else number.removeAttribute?.("aria-invalid");
    return message;
  };
  const setValue=value=>{
    const n=parseBoundedRangeDraft(value,{min,max,step:numberStep});
    slider.value=String(n);number.value=String(n);
    number.defaultValue=number.value;error("");
    return n;
  };
  slider.addEventListener("input",()=>{
    number.value=slider.value;number.defaultValue=number.value;
    error("");onInput?.(Number(slider.value));
  });
  number.addEventListener("input",()=>{
    try{
      const value=getValue();
      slider.value=String(Math.min(Number(max),Math.max(Number(min),value)));
      number.defaultValue=number.value;
      error("");onInput?.(value);
    }catch(e){error(e.message);onInvalid?.(e.message);}
  });
  wrap.append(slider,number);
  if(unit){
    const suffix=document.createElement("span");
    suffix.className="atlas-number-range-unit";suffix.textContent=unit;
    wrap.appendChild(suffix);
  }
  return {element:wrap,slider,number,getValue,setValue};
}
