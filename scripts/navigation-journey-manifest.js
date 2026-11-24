/** Human-readable approved assignments, derived only from validated saved
 * Journey snapshots. Older records without names keep aggregate-only text.
 */
export function describeConfirmedTravelers(convoy){
  if(convoy?.schemaVersion!==2||!Array.isArray(convoy.travelers)||
      !Array.isArray(convoy.methods))return [];
  return convoy.methods.flatMap(method=>{
    const people=convoy.travelers.filter(t=>t.methodKey===method.key);
    if(!people.length||people.some(t=>!t.name))return [];
    const travelers=people.map(t=>t.name+
      (t.passengers>1?" ×"+t.passengers:"")).join(", ");
    return [{key:method.key,travelers,
      label:method.methodName+": "+travelers}];
  });
}
