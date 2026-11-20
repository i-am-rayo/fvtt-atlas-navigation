/**
 * D&D5e Group preview only. Native Group Actor and its assigned explorer Token
 * own the full party; a subset cannot authorize that Token to move.
 */
const validId=value=>typeof value==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(value);

/** NPC companions remain listed even when they share a seat with a traveler. */
export function partyTravelerRoster(roster){
  if(!Array.isArray(roster?.members))return [];
  return roster.members.filter(m=>m.role==="passenger"&&
    ["character","npc"].includes(m.actorType)&&validId(m.actorId))
    .map(m=>({id:m.actorId,name:String(m.actorName??"Unnamed traveler").slice(0,120),
      type:m.actorType,seats:m.actorType==="character"||m.needsSeat!==false?
        (Number.isInteger(m.quantity)&&m.quantity>0?m.quantity:1):0}))
    .sort((a,b)=>a.type===b.type?
      a.name.localeCompare(b.name)||a.id.localeCompare(b.id):
      a.type==="character"?-1:1);
}
export function partyCharacterRoster(roster){
  return partyTravelerRoster(roster).filter(m=>m.type==="character")
    .map(({id,name})=>({id,name}));
}

export function projectPartyTravelSelection(roster,{mode="all",ids=[]}={}){
  if(!roster||!Number.isSafeInteger(roster.travelers)||roster.travelers<0)
    throw Error("Travel needs a validated Group roster.");
  if(!["all","selected"].includes(mode)||!Array.isArray(ids)||
      ids.length>150||ids.some(x=>!validId(x))||
      new Set(ids).size!==ids.length)
    throw Error("Invalid GM party-member selection.");
  const members=partyTravelerRoster(roster),known=new Set(members.map(x=>x.id));
  const selected=mode==="all"?members.map(x=>x.id):
    ids.filter(id=>known.has(id));
  const chosen=new Set(selected);
  const count=members.reduce((sum,m)=>sum+(chosen.has(m.id)?m.seats:0),0);
  const pcCount=members.filter(m=>m.type==="character").length;
  const npcCount=members.length-pcCount;
  const partial=mode==="selected"&&selected.length<members.length;
  return {
    members,selectedIds:selected,pcCount,npcCount,travelerCount:count,
    selectedPcCount:members.filter(m=>m.type==="character"&&chosen.has(m.id)).length,
    selectedNpcCount:members.filter(m=>m.type==="npc"&&chosen.has(m.id)).length,
    partial,empty:selected.length===0,
    // Only previews change. Native Group/Token movement cannot split a party.
    previewRoster:{...roster,travelers:count,selectedTravelerIds:selected}
  };
}

export function describeTravelMethodCapacity({choice,roster=null,capacity=null}={}){
  if(!choice||typeof choice.value!=="string")return "";
  if(choice.value==="owned|walking")return "";
  if(choice.value.startsWith("owned|")){
    if(!capacity)return "Capacity not configured";
    const units=capacity.quantity??0,seats=capacity.unknown?
      "? seats":(capacity.seats??0)+" seats";
    return units+" available · "+seats+
      (roster?.travelers!=null?" · "+roster.travelers+" seats needed":"");
  }
  if(choice.value.startsWith("hire|")){
    const perUnit=Number(choice.methodCapacity);
    if(!Number.isFinite(perUnit)||perUnit<=0)
      return "Service offered · seats unverified";
    const stock=choice.methodUnlimited!==false?"Unlimited":
      String(choice.methodQuantity??0)+" available";
    const required=roster?.travelers!=null?Math.ceil(roster.travelers/perUnit):null;
    return "Offered · "+perUnit+" seats/unit · "+stock+
      (required!==null?" · "+roster.travelers+" seats needed ("+
        required+" unit(s) required)":"");
  }
  return "";
}
