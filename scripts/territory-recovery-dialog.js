/** Construct safe native recovery confirmation content for Foundry v14.
 * DialogV2 requires a string or a plain HTMLDivElement as its content root.
 * The user's selection is reviewed here but cannot write a native Region.
 */
export function createTerritoryRecoveryConfirmationContent(mode,regionCount,
  {createElement=tag=>globalThis.document.createElement(tag)}={}){
  if(!["resume","rollback"].includes(mode))
    throw Error("Choose a supported native Territory recovery operation.");
  if(!Number.isSafeInteger(regionCount)||regionCount<1)
    throw Error("Recovery must have at least one native Region snapshot.");
  const content=createElement("div");
  const message=createElement("p");
  message.textContent=mode==="resume"?
    "Complete the interrupted transfer using the saved recovery record?":
    `Restore all ${regionCount} Regions to their pre-transfer Shapes and Atlas controls?`;
  content.appendChild(message);
  return content;
}
