/** Canonical checkpoint form options; editors may style the DOM differently. */
export const CHECKPOINT_MARKER_TYPES=Object.freeze([
  ["dot","Default dot"],["fa","Font Awesome Free icon"],
  ["image","Custom Foundry image"]
]);
export const CHECKPOINT_LABEL_MODES=Object.freeze([
  ["off","Off"],["hover","On hover"],["always","Always"]
]);
export const CHECKPOINT_DISCOVERY_STATES=Object.freeze([
  ["unknown","Undiscovered"],["visited","Seen / Visited"],
  ["lore","Known through Lore"]
]);
export const CHECKPOINT_DISCOVERY_METHODS=Object.freeze([
  ["automatic","Automatic — explorer proximity"],
  ["gm","GM Only — manual reveal"],["lore","Lore Only — story discovery"]
]);
export const CHECKPOINT_REGION_RADIUS=Object.freeze({min:.25,max:3,step:.25});
