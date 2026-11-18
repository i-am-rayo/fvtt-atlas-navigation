/**
 * D&D5e Group preview only. Native Group Actor and its assigned explorer Token
 * own the full party; a subset cannot authorize that Token to move.
 */
const validId=value=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(value);

export function partyCharacterRoster(roster){
  if(!Array.isArray(roster?.members))return [];
  return roster.members.filter(m=>m.actorType==="character"&&
    m.role==="passenger"&&validId(m.actorId)).map(m=>({
    id:m.actorId,name:String(m.actorName??"Unnamed PC").slice(0,120)
  })).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}

export function projectPartyTravelSelection(roster,{mode="all",ids=[]}={}){
  if(!roster||!Number.isSafeInteger(roster.travelers)||roster.travelers<0)
    throw Error("Travel needs a validated Group roster.");
  if(!["all","selected"].includes(mode)||!Array.isArray(ids)||
      ids.length>150||ids.some(x=>!validId(x))||
      new Set(ids).size!==ids.length)
    throw Error("Invalid GM party-member selection.");
  const members=partyCharacterRoster(roster),known=new Set(members.map(x=>x.id));
  const selected=mode==="all"?members.map(x=>x.id):
    ids.filter(id=>known.has(id));
  const additionalPassengers=Math.max(0,roster.travelers-members.length);
  const count=mode==="all"?roster.travelers:selected.length+additionalPassengers;
  const partial=mode==="selected"&&selected.length<members.length;
  return {
    members,selectedIds:selected,pcCount:members.length,travelerCount:count,
    additionalPassengers,partial,empty:count===0,
    // Only the preview count differs; never mutate native Group/Actor state.
    previewRoster:{...roster,travelers:count}
  };
}

export function describeTravelMethodCapacity({choice,roster=null,capacity=null}={}){
  if(!choice||typeof choice.value!=="string")return "";
  if(choice.value==="owned|walking")return "";
  if(choice.value.startsWith("owned|")){
    if(!capacity)return "Capacity not configured";
    const units=capacity.quantity??0,seats=capacity.unknown?
      "? seats":(capacity.seats??0)+" seats";
    return units+" available · "+seats;
  }
  if(choice.value.startsWith("hire|")){
    const perUnit=Number(choice.methodCapacity);
    return Number.isFinite(perUnit)&&perUnit>0?
      "Offered · "+perUnit+" seats/unit":"Service offered · seats unverified";
  }
  return "";
}
