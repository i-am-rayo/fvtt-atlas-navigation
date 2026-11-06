/** An explicitly GM-approved public name for a native Region.
 * This flag is only presentation metadata; native Region shapes, elevation,
 * Behaviors, visibility and document name remain Foundry-owned. */
export const PUBLIC_TERRITORY_FLAG="publicTerritory";
export const PUBLIC_TERRITORY_SCHEMA=1;

export function validatedPublicTerritoryLabel(value){
  if(typeof value!=="string"||!value.trim()||value.trim()!==value||
      value.length>120||/[\u0000-\u001f\u007f]/.test(value))
    throw Error("A public territory label must be 1–120 printable characters.");
  return value;
}

export function validatePublicTerritoryFlag(value){
  if(value==null)return null;
  if(!value||Array.isArray(value)||typeof value!=="object"||
      Object.keys(value).sort().join(",")!=="enabled,label,schemaVersion"||
      value.schemaVersion!==PUBLIC_TERRITORY_SCHEMA||value.enabled!==true)
    throw Error("Unsupported Atlas public territory flag; no changes were made.");
  return Object.freeze({schemaVersion:PUBLIC_TERRITORY_SCHEMA,enabled:true,
    label:validatedPublicTerritoryLabel(value.label)});
}

/** Overlapping public territories are ambiguous until an explicit precedence
 * policy is approved. Return no name rather than guessing by ID or insertion. */
export function uniquePublicTerritoryLabel(labels){
  if(!Array.isArray(labels)||labels.length!==1)return null;
  try{return validatedPublicTerritoryLabel(labels[0]);}
  catch{return null;}
}
