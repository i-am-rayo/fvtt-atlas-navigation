/**
 * FVTT Atlas Navigation — Foundry VTT v14 bootstrap.
 * Atlas setup is GM-only and stores validated Scene flags.
 */
import { createAtlasSetupDialogClass } from "./atlas-setup-dialog.js";
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

  game.settings.registerMenu(MODULE_ID, "atlasSetup", {
    name: "FVTTATLAS.Atlas.MenuName",
    label: "FVTTATLAS.Atlas.MenuLabel",
    hint: "FVTTATLAS.Atlas.MenuHint",
    icon: "fa-solid fa-map",
    type: createAtlasSetupDialogClass(foundry.applications.api.DialogV2),
    restricted: true
  });
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  console.info("[" + MODULE_ID + "] Module ready");
  if (game.settings.get(MODULE_ID, STARTUP_NOTICE_SETTING)) {
    ui.notifications.info(game.i18n.localize("FVTTATLAS.Notifications.Ready"));
  }
});
