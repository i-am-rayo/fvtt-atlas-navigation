/**
 * FVTT Atlas Navigation — Foundry VTT v14 Phase 1 module shell.
 *
 * No Scene data, canvas layers, sockets, or actor/system APIs are touched here.
 * Later features will be introduced in separate, reviewable milestones.
 */
const MODULE_ID = "fvtt-atlas-navigation";
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
});

Hooks.once("ready", () => {
  // Registration runs for all clients; the diagnostic is GM-facing only.
  if (!game.user?.isGM) return;

  console.info("[" + MODULE_ID + "] Phase 1 initialized");

  if (game.settings.get(MODULE_ID, STARTUP_NOTICE_SETTING)) {
    ui.notifications.info(game.i18n.localize("FVTTATLAS.Notifications.Ready"));
  }
});
