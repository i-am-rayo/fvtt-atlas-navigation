/**
 * Put the per-Scene atlas editor in native Scene Configuration.
 *
 * Foundry v14's renderSceneConfig hook supplies an HTMLElement, not a jQuery
 * object. Keep the launcher outside the Scene form submission: this button
 * opens a separate dialog that writes only our namespaced Scene flag.
 */
export function addAtlasSetupToSceneConfig(app, element, openAtlasSetup) {
  const scene = app?.document;
  if (!globalThis.game?.user?.isGM ||
      !scene?.id ||
      !scene?.canUserModify?.(game.user, "update")) return;

  const form = element?.matches?.("form") ? element : element?.querySelector?.("form");
  if (!form || form.querySelector("[data-fvtt-atlas-setup]")) return;

  const panel = document.createElement("div");
  panel.className = "form-group";
  panel.setAttribute("data-fvtt-atlas-setup", "");

  const title = document.createElement("label");
  title.textContent = game.i18n.localize("FVTTATLAS.Atlas.SceneSettingsLabel");

  const controls = document.createElement("div");
  controls.className = "form-fields";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = game.i18n.localize("FVTTATLAS.Atlas.SceneSettingsButton");
  button.addEventListener("click", async event => {
    event.preventDefault();
    try {
      await openAtlasSetup(scene);
    } catch (error) {
      ui.notifications.error(error.message);
    }
  });
  controls.appendChild(button);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = game.i18n.localize("FVTTATLAS.Atlas.SceneSettingsHint");

  panel.appendChild(title);
  panel.appendChild(controls);
  panel.appendChild(hint);
  form.prepend(panel);
}
