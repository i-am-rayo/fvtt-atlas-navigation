/**
 * FVTT Atlas Navigation — Foundry VTT v14 bootstrap.
 * Phase 2b: native Scene Atlas tab and Scene Grid-first distance measurement.
 */
import { createAtlasSetupDialogClass } from "./atlas-setup-dialog.js";
import { addAtlasSetupToSceneConfig, registerAtlasSceneTab } from "./scene-config.js";
import { MODULE_ID } from "./atlas-storage.js";

const STARTUP_NOTICE_SETTING = "showStartupNotice";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, STARTUP_NOTICE_SETTING, {
    name: "FVTTATLAS.Settings.ShowStartupNotice.Name",
    hint: "FVTTATLAS.Settings.ShowStartupNotice.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  const AtlasSetupDialog = createAtlasSetupDialogClass(foundry.applications.api.DialogV2);
  Hooks.on("renderSceneConfig", (app, element) => {
    const open = (scene, onSaved) => new AtlasSetupDialog(scene, onSaved).render(true);
    addAtlasSetupToSceneConfig(app, element, open);
  });
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  try {
    const installed = registerAtlasSceneTab(foundry.applications.sheets.SceneConfig);
    if (!installed) console.warn("[" + MODULE_ID + "] Scene Atlas tab registration unavailable; using in-sheet fallback.");
  } catch (error) {
    // Keep SceneConfig usable if another package customizes its public tab configuration.
    console.warn("[" + MODULE_ID + "] Scene Atlas tab unavailable; using in-sheet fallback.", error);
  }
  console.info("[" + MODULE_ID + "] Module ready");
  if (game.settings.get(MODULE_ID, STARTUP_NOTICE_SETTING)) {
    ui.notifications.info(game.i18n.localize("FVTTATLAS.Notifications.Ready"));
  }
});
