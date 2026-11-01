import { readPartyExploration, savePartyExplorationConfig }
  from "./party-exploration-storage.js";
import { revealAssignedExplorer } from "./atlas-token-exploration.js";
import { resolveNavigationTravelSpeed } from "./navigation-party-speed.js";

/**
 * GM entry point on the native placed Token configuration. Atlas's per-Scene
 * flag remains the single authority: no Actor or Token flag is added.
 * The token is never auto-assigned, even when this panel is opened.
 */
export function addAtlasExplorerToTokenConfig(app, element) {
  if (!globalThis.game?.user?.isGM) return;
  const token = app?.document ?? app?.object;
  const scene = token?.parent;
  if (!scene?.tokens?.get?.(token.id) || !scene.canUserModify?.(game.user, "update")) return;
  const root = element instanceof HTMLElement ? element :
    element?.[0] instanceof HTMLElement ? element[0] : app?.element;
  if (!(root instanceof HTMLElement) || root.querySelector("[data-atlas-explorer-config]")) return;
  let expected = readPartyExploration(scene);
  const selected = expected.enabled && expected.tokenId === token.id;
  const fieldset = document.createElement("fieldset");
  fieldset.dataset.atlasExplorerConfig = "";
  fieldset.style.cssText = "margin:1em .5em;padding:1em;border:1px solid var(--color-border-light-tertiary);border-radius:8px;display:grid;gap:.8rem;min-width:0;";
  const legend = document.createElement("legend");
  legend.textContent = "Atlas — Party Exploration";
  fieldset.append(legend);
  const description = document.createElement("p");
  description.textContent = "This placed token can explore the Atlas map as the party travels. " +
    "Exploration is separate from Foundry's Token Vision and does not change movement speeds.";
  description.style.cssText="margin:0;opacity:.8;font-size:.9em;line-height:1.35;";
  fieldset.append(description);
  const section=(title,description)=>{
    const box=document.createElement("section");
    box.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);"+
      "padding:.7rem;border-radius:6px;display:grid;gap:.55rem;min-width:0;";
    const header=document.createElement("strong");header.textContent=title;
    box.append(header);
    if(description){
      const hint=document.createElement("small");hint.textContent=description;
      hint.style.cssText="opacity:.75;line-height:1.35;";box.append(hint);
    }
    fieldset.append(box);
    return box;
  };
  const assignmentSection=section("1. Party token assignment",
    "Only one placed token is the Scene's Atlas explorer. Assignment is manual and Scene-specific.");
  const checkboxLabel = document.createElement("label");
  checkboxLabel.style.cssText = "display:flex;align-items:center;gap:.6em;";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selected;
  checkboxLabel.append(checkbox, document.createTextNode("Use this token as the party explorer"));
  assignmentSection.append(checkboxLabel);
  const status=document.createElement("p");
  status.style.cssText="margin:0;font-size:.85em;opacity:.85;";
  const currentStatus=()=>expected.tokenId===token.id&&expected.enabled?
    "Assigned: this token explores the Scene.":
    expected.tokenId&&expected.enabled?"Another token currently explores this Scene.":
      "No Atlas explorer is currently assigned to this Scene.";
  status.textContent=currentStatus();
  assignmentSection.append(status);
  const discoverySection=section("2. Discovery radius",
    "How far the party reveals map cells while moving. This is not the checkpoint reveal radius.");
  const radiusLabel = document.createElement("label");
  radiusLabel.textContent = "Survey distance (" + (scene.grid?.units || "Scene units") + ")";
  radiusLabel.style.cssText = "display:grid;gap:.35rem;";
  const radius = document.createElement("input");
  radius.type = "number";
  radius.min = "0.01";
  radius.step = "any";
  radius.value = String(expected.radius);
  radius.style.width = "100%";
  radiusLabel.append(radius);
  discoverySection.append(radiusLabel);
  const movementSection=section("3. Navigation movement (read-only)",
    "Atlas reads travel speed from the assigned D&D 5e Group Actor when available. " +
    "Configure speeds in that Actor's Movement tab; the survey radius above never changes them.");
  const movementHint=document.createElement("p");
  movementHint.style.cssText="margin:0;font-size:.87em;";
  movementSection.append(movementHint);
  const updateMovement=()=>{
    if(token.actor?.type!=="group"||game.system?.id!=="dnd5e"){
      movementHint.textContent="No D&D 5e Group Actor is attached. Navigation uses its configured fallback speed.";
      return;
    }
    if(!checkbox.checked){
      movementHint.textContent="Assign this Group Token to use its Land travel pace for Scene navigation.";
      return;
    }
    try{
      const speed=resolveNavigationTravelSpeed({token,sceneUnits:scene.grid?.units||"",
        systemId:game.system?.id,worldSpeed:1});
      movementHint.textContent=speed.source==="party"?
        "Group movement available: "+speed.pace+" pace · "+speed.speed.toLocaleString()+
        " "+(scene.grid?.units||"units")+"/hour. Speed is read from the Actor, not saved here.":
        "Group speed is unavailable; Atlas will use its World navigation default.";
    }catch{movementHint.textContent="Group speed is unavailable; Atlas will use its World navigation default.";}
  };
  checkbox.addEventListener("change",updateMovement);
  updateMovement();
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Save Atlas Party Settings";
  button.style.cssText = "width:100%;";
  fieldset.append(button);
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const assigning = checkbox.checked;
      if (!assigning && expected.tokenId !== token.id) {
        throw new Error("This token is not the currently assigned Atlas explorer.");
      }
      expected = await savePartyExplorationConfig(scene, {
        enabled: assigning,
        tokenId: assigning ? token.id : null,
        radius: Number(radius.value),
        defaultRevealRadiusCells: expected.defaultRevealRadiusCells,
        expected
      });
      status.textContent = assigning ?
        "Saved. This token is Atlas's Scene explorer." :
        "Removed this token's Atlas explorer assignment.";
      updateMovement();
      if(assigning)revealAssignedExplorer(scene,token);
      button.disabled = false;
      ui.notifications.info(status.textContent);
    } catch (error) {
      ui.notifications.error(error.message);
      button.disabled = false;
    }
  });
  // Keep these controls out of the native TokenDocument submission; only
  // the dedicated Atlas Save button changes the separate Scene flag.
  const host = root.querySelector(".tab.active") || root.querySelector("form") || root;
  host.append(fieldset);
}
