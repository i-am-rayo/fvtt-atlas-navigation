import { readPartyExploration, savePartyExplorationConfig }
  from "./party-exploration-storage.js";
import { revealAssignedExplorer } from "./atlas-token-exploration.js";
import { MODULE_ID } from "./atlas-storage.js";
import { createSettingsInput } from "./settings-input.js";

/** Shared placed and prototype explorer controls; Scene assignment remains authoritative. */
export function addAtlasExplorerToTokenConfig(app, element) {
  if (!globalThis.game?.user?.isGM) return;
  const token = app?.token ?? app?.document ?? app?.object;
  const prototype = app?.isPrototype === true;
  const actor = app?.actor ?? token?.parent;
  const scene = prototype ? null : token?.parent;
  if (prototype ? !actor?.canUserModify?.(game.user,"update") :
    !scene?.tokens?.get?.(token.id) || !scene.canUserModify?.(game.user,"update")) return;
  const root = element instanceof HTMLElement ? element :
    element?.[0] instanceof HTMLElement ? element[0] : app?.element;
  if (!(root instanceof HTMLElement) || root.querySelector("[data-atlas-explorer-config]")) return;
  let expected = prototype ? null : readPartyExploration(scene);
  const selected = prototype ? token?.flags?.[MODULE_ID]?.partyExplorer === true :
    expected.enabled && expected.tokenId === token.id;
  const fieldset = document.createElement("fieldset");
  fieldset.dataset.atlasExplorerConfig = "";
  fieldset.style.cssText = "margin:1em .5em;padding:1em;border:1px solid var(--color-border-light-tertiary);border-radius:8px;display:grid;gap:.8rem;min-width:0;";
  const legend = document.createElement("legend");
  legend.textContent = "Atlas — Party Exploration";
  fieldset.append(legend);
  const description = document.createElement("p");
  description.textContent = "Use this token to explore the Atlas map as the party travels. " +
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
  const assignmentSection=section("Party explorer", prototype ?
    "Newly placed tokens use this default when the Scene has no assigned explorer." :
    "Only one token explores this Scene. Set survey distance in Atlas Workspace → Settings.");
  const checkboxLabel = document.createElement("label");
  checkboxLabel.style.cssText = "display:flex;align-items:center;gap:.6em;";
  const checkbox = createSettingsInput("checkbox",selected,
    {ariaLabel:"Use this token as the party explorer"});
  checkboxLabel.append(checkbox, document.createTextNode("Use this token as the party explorer"));
  assignmentSection.append(checkboxLabel);
  const status=document.createElement("p");
  status.setAttribute("role","status"); // Announce the dedicated Save outcome.
  status.style.cssText="margin:0;font-size:.85em;opacity:.85;";
  const currentStatus=()=>prototype ? "Saved with the Actor’s prototype token." : expected.tokenId===token.id&&expected.enabled?
    "Assigned: this token explores the Scene.":
    expected.tokenId&&expected.enabled?"Another token currently explores this Scene.":
      "No Atlas explorer is currently assigned to this Scene.";
  status.textContent=currentStatus();
  assignmentSection.append(status);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Save Atlas Party Settings";
  button.style.cssText = "width:100%;";
  fieldset.append(button);
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const assigning = checkbox.checked;
      if (!game.user?.isGM) throw Error("Only a GM can configure party exploration.");
      if (prototype) {
        if (!actor.canUserModify?.(game.user,"update")) throw Error("Actor update permission required.");
        await actor.update({["prototypeToken.flags."+MODULE_ID+".partyExplorer"]:assigning});
        status.textContent="Prototype explorer default saved.";
        return;
      }
      if (!assigning && expected.tokenId !== token.id) {
        throw new Error("This token is not the currently assigned Atlas explorer.");
      }
      expected = await savePartyExplorationConfig(scene, {
        enabled: assigning,
        tokenId: assigning ? token.id : null,
        radius: expected.radius,
        defaultRevealRadiusCells: expected.defaultRevealRadiusCells,
        expected
      });
      status.textContent = assigning ?
        "Saved. This token is Atlas's Scene explorer." :
        "Removed this token's Atlas explorer assignment.";
      if(assigning)revealAssignedExplorer(scene,token);
      ui.notifications.info(status.textContent);
    } catch (error) {
      ui.notifications.error(error.message);
    } finally { button.disabled = false; }
  });
  // Keep these controls out of the native TokenDocument submission; only
  // the dedicated Atlas Save button updates the Scene or prototype default.
  const host = root.querySelector(".tab.active") || root.querySelector("form") || root;
  host.append(fieldset);
}

const pendingAssignments=new Map();

/** Inherited prototype intent fills only an empty (or deleted-token) Scene slot. */
export async function assignCreatedAtlasExplorer(token) {
  const scene=token?.parent;
  const activeGMs=[...(globalThis.game?.users??[])].filter(user=>user.active&&user.isGM)
    .map(user=>user.id).sort();
  if(!game.user?.isGM || activeGMs[0]!==game.user.id ||
      token?.flags?.[MODULE_ID]?.partyExplorer!==true ||
      !scene?.tokens?.get?.(token.id) || !scene.canUserModify?.(game.user,"update")) return;
  const previous=pendingAssignments.get(scene.id)??Promise.resolve();
  const pending=previous.catch(()=>{}).then(async()=>{
    const expected=readPartyExploration(scene);
    if(expected.tokenId && scene.tokens.get(expected.tokenId)) return;
    await savePartyExplorationConfig(scene,{...expected,enabled:true,tokenId:token.id,expected});
  });
  pendingAssignments.set(scene.id,pending);
  try{await pending;}finally{if(pendingAssignments.get(scene.id)===pending)pendingAssignments.delete(scene.id);}
}
