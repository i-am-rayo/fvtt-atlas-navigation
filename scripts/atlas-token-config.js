import { readPartyExploration, savePartyExplorationConfig }
  from "./party-exploration-storage.js";
import { revealAssignedExplorer } from "./atlas-token-exploration.js";

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
  fieldset.style.cssText = "margin:1em .5em;padding:.8em;border:1px solid var(--color-border-light-tertiary);";
  const legend = document.createElement("legend");
  legend.textContent = "Atlas — Party Exploration";
  fieldset.append(legend);
  const description = document.createElement("p");
  description.textContent =
    "Manual Scene explorer assignment; uses Atlas exploration, not token vision. " +
    "Moves reveal and permanently save traveled terrain while a GM views this Scene. " +
    "Native token vision remains independent; checkpoint discovery is shared.";
  fieldset.append(description);
  const checkboxLabel = document.createElement("label");
  checkboxLabel.style.cssText = "display:flex;align-items:center;gap:.6em;";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selected;
  checkboxLabel.append(checkbox, document.createTextNode("Use this placed token as Atlas explorer"));
  fieldset.append(checkboxLabel);
  const radiusLabel = document.createElement("label");
  radiusLabel.textContent = "Survey Radius (" + (scene.grid?.units || "Scene units") + ")";
  radiusLabel.style.cssText = "display:block;margin-top:.7em;";
  const radius = document.createElement("input");
  radius.type = "number";
  radius.min = "0.01";
  radius.step = "any";
  radius.value = String(expected.radius);
  radius.style.width = "100%";
  radiusLabel.append(radius);
  fieldset.append(radiusLabel);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Save Atlas Explorer";
  button.style.cssText = "width:100%;margin-top:.7em;";
  fieldset.append(button);
  const status = document.createElement("p");
  status.textContent = expected.tokenId === token.id ? "Currently assigned to this Scene." :
    expected.tokenId ? "Another placed token is currently selected." :
      "No Atlas explorer is assigned.";
  fieldset.append(status);
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
