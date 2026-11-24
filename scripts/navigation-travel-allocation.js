/** Draft allocation of Group travelers. No Foundry documents or writes.
 * Personal mount ownership supplies a default, never a permanent restriction.
 */
export function suggestedTravelAssignments(travelers,methods,overrides={},resources={}){
  const keys=methods.map(m=>m.key);
  if(!keys.length)return {};
  const fallback=keys.includes("owned|walking")?"owned|walking":keys[0];
  const defaults=Object.fromEntries(travelers.map(t=>[t.id,fallback]));
  for(const method of methods){
    if(!method.key.startsWith("owned|")||method.key==="owned|walking")continue;
    for(const resource of resources[method.key]??[]){
      if(resource.assignedTo&&Object.hasOwn(defaults,resource.assignedTo))
        defaults[resource.assignedTo]=method.key;
    }
  }
  for(const [id,key] of Object.entries(overrides)){
    if(Object.hasOwn(defaults,id)&&keys.includes(key))defaults[id]=key;
  }
  return defaults;
}

export function remainingTravelSeats(travelers,methods,assignments){
  return methods.map(method=>{
    const assigned=travelers.filter(t=>assignments[t.id]===method.key);
    const seats=assigned.reduce((n,t)=>n+t.seats,0);
    return {...method,passengers:assigned.length,seatsUsed:seats};
  });
}
