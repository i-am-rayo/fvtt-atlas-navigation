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
export function projectedGroupFare(preset,{quantity=1,passengers=1,distanceMi=0,hours=0}={}){
  if(!Number.isInteger(quantity)||quantity<0||
      !Number.isInteger(passengers)||passengers<0||
      !Number.isFinite(distanceMi)||distanceMi<0||
      !Number.isFinite(hours)||hours<0)throw Error("Invalid transportation cost factors.");
  const count=preset.costApplies==="passenger"?passengers:quantity;
  const basis=preset.costBasis==="day"?Math.ceil(hours/24):
    preset.costBasis==="mile"?distanceMi:0;
  const amount=Number(preset.costCp)*basis*count;
  if(!Number.isFinite(amount)||amount<0)throw Error("Invalid transportation cost.");
  return amount;
}
