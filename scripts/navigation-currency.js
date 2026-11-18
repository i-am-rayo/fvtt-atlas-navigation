/**
 * D&D 5e currency presentation adapter. Atlas keeps its existing canonical
 * storage (recurring cost CP, purchase GP) so older World presets still load.
 * No Group/Actor currency values are ever written here.
 */
export const DND5E_COIN_COPPER=Object.freeze({cp:1,sp:10,ep:50,gp:100,pp:1000});
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
export function atlasCurrencyChoices(systemId="dnd5e",currencyConfig){
  if(systemId!=="dnd5e")return [{id:"cp",label:"CP"},{id:"gp",label:"GP"}];
  const active=currencyConfig&&typeof currencyConfig==="object"?
    Object.keys(DND5E_COIN_COPPER).filter(id=>own(currencyConfig,id)):
    Object.keys(DND5E_COIN_COPPER);
  return active.map(id=>({id,
    label:id.toUpperCase(),
    icon:currencyConfig?.[id]?.icon??null}));
}
export function copperFromCoin(amount,denomination){
  const rate=DND5E_COIN_COPPER[denomination];
  if(!rate||!Number.isFinite(amount)||amount<0)throw Error("Invalid Atlas currency value.");
  return Math.round((amount*rate+Number.EPSILON)*100)/100;
}
export function coinFromCopper(copper,denomination){
  const rate=DND5E_COIN_COPPER[denomination];
  if(!rate||!Number.isFinite(copper)||copper<0)throw Error("Invalid Atlas currency value.");
  return Math.round((copper/rate+Number.EPSILON)*10000)/10000;
}
/** Repeated unit cost and passenger fare use separate multiplicities. */
export function projectedGroupFare(preset,{quantity=1,passengers=1,distanceMi=0,hours=0,
  dayHours=24}={}){
  if(!Number.isInteger(quantity)||quantity<0||
      !Number.isInteger(passengers)||passengers<0||
      !Number.isFinite(distanceMi)||distanceMi<0||
      !Number.isFinite(hours)||hours<0||
      !Number.isFinite(dayHours)||dayHours<=0||dayHours>24)
    throw Error("Invalid transportation cost factors.");
  const count=preset.costApplies==="passenger"?passengers:quantity;
  // "Per day" means one billable travel day, not necessarily 24 moving hours.
  // A method-specific schedule supplies dayHours; legacy callers retain 24.
  const basis=preset.costBasis==="day"&&hours>0?
      Math.ceil(Math.max(0,hours-1e-7)/dayHours):
    preset.costBasis==="mile"?distanceMi:0;
  const amount=Number(preset.costCp)*basis*count;
  if(!Number.isFinite(amount)||amount<0)throw Error("Invalid transportation cost.");
  return amount;
}

/**
 * Display-only coin breakdown. D&D5e config declares denominations as the
 * number of coins equivalent to 1 GP; 100 CP = 1 GP by the standard model.
 * Round a fractional fare upward to the smallest available coin once, then
 * decompose using integer CP to avoid floating-point coin loss.
 */
export function dndCurrencyBreakdown(copper,currencyConfig){
  if(!Number.isFinite(copper)||copper<0)throw Error("Invalid Atlas currency estimate.");
  const ids=atlasCurrencyChoices("dnd5e",currencyConfig).map(entry=>entry.id);
  const denominations=ids.map(id=>{
    const nativeRate=currencyConfig?.[id]?.conversion;
    const rate=nativeRate===undefined?DND5E_COIN_COPPER[id]:100/nativeRate;
    return {id,rate};
  }).filter(({rate})=>Number.isSafeInteger(rate)&&rate>0)
    .sort((a,b)=>b.rate-a.rate);
  if(!denominations.length)throw Error("No usable D&D 5e coin denominations.");
  const smallest=denominations.at(-1).rate;
  // The display quote may contain fractions of a CP; coins cannot.
  const payableCopper=Math.ceil(copper/smallest-1e-10)*smallest;
  if(!Number.isSafeInteger(payableCopper))throw Error("Currency estimate exceeds safe coin limits.");
  let remaining=payableCopper;
  const coins=[];
  for(const denomination of denominations){
    const quantity=Math.floor(remaining/denomination.rate);
    if(quantity>0){
      coins.push({id:denomination.id,quantity});
      remaining-=quantity*denomination.rate;
    }
  }
  if(remaining!==0)throw Error("Selected currencies cannot represent the rounded fare.");
  return {
    exactCopper:copper,
    payableCopper,
    roundedUp:payableCopper>copper+1e-8,
    coins,
    label:coins.length?
      coins.map(({id,quantity})=>quantity.toLocaleString()+" "+id.toUpperCase()).join(" · "):
      "0 "+denominations.at(-1).id.toUpperCase()
  };
}
