/**
 * FVTT Atlas Navigation — Foundry v14 bootstrap.
 * Phase 2c: image-anchored road geometry, junctions and bend editing.
 */
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab } from "./scene-config.js";
import { RoadCanvasController } from "./road-canvas.js";
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { saveRenamedRoad, saveRemovedRoad, saveAnchoredLegacyRoads } from "./road-storage.js";
import { sceneImageOrigin } from "./road-coordinates.js";

const STARTUP_NOTICE_SETTING = "showStartupNotice";
const roadCanvas = new RoadCanvasController();

function actions() {
  const DialogV2 = foundry.applications.api.DialogV2;
  return {
    begin(scene, refresh) {
      roadCanvas.start(scene, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.StartNotice"));
    },
    draft: scene => roadCanvas.getDraft(scene),
    reshape(scene, segmentId, refresh) {
      roadCanvas.startReshape(scene, segmentId, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.ReshapeNotice"));
    },
    async anchor(scene, refresh) {
      const atlas = readAtlas(scene);
      if (atlas.schemaVersion !== 1) return;
      if (!globalThis.canvas?.ready || canvas.scene?.id !== scene.id) {
        throw new Error("Open this Scene on the canvas before anchoring legacy roads.");
      }
      const origin = sceneImageOrigin(canvas);
      const approved = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Anchor") },
        content: game.i18n.localize("FVTTATLAS.Roads.AnchorWarning"),
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveAnchoredLegacyRoads(scene, { origin, expectedRevision: atlas.revision });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Anchored"));
    },
    finish: () => roadCanvas.finish(),
    cancel: () => roadCanvas.cancel(),
    select: (scene, id) => roadCanvas.selectRoad(scene, id),
    async rename(scene, segment, refresh) {
      const revision = readAtlas(scene).revision;
      const content = document.createElement("div");
      const input = document.createElement("input");
      input.name = "roadName";
      input.type = "text";
      input.maxLength = 120;
      input.setAttribute("value", segment.name);
      input.setAttribute("maxlength", "120");
      input.setAttribute("required", "");
      content.appendChild(input);
      const data = await DialogV2.input({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Rename") },
        content,
        ok: { label: game.i18n.localize("FVTTATLAS.Roads.SaveName") },
        rejectClose: false
      });
      if (!data) return;
      await saveRenamedRoad(scene, {
        segmentId: segment.id, name: String(data.roadName ?? ""), expectedRevision: revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Renamed"));
    },
    async remove(scene, segment, refresh) {
      const revision = readAtlas(scene).revision;
      const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Delete") },
        content: game.i18n.localize("FVTTATLAS.Roads.DeleteWarning"),
        rejectClose: false,
        modal: true
      });
      if (!confirmed) return;
      await saveRemovedRoad(scene, { segmentId: segment.id, expectedRevision: revision });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Deleted"));
    }
  };
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, STARTUP_NOTICE_SETTING, {
    name: "FVTTATLAS.Settings.ShowStartupNotice.Name",
    hint: "FVTTATLAS.Settings.ShowStartupNotice.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  const roadActions = actions();
  Hooks.on("renderSceneConfig", (app, element) => {
    addAtlasRoadsToSceneConfig(app, element, roadActions);
  });
  Hooks.on("closeSceneConfig", app => roadCanvas.endEditor(app?.document));
  Hooks.on("canvasReady", () => roadCanvas.refresh());
  Hooks.on("canvasTearDown", () => roadCanvas.tearDown());
  Hooks.on("updateScene", scene => {
    if (globalThis.canvas?.ready && canvas.scene?.id === scene.id) roadCanvas.refresh();
  });
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  try {
    const installed = registerAtlasSceneTab(foundry.applications.sheets.SceneConfig);
    if (!installed) console.warn("[" + MODULE_ID + "] Scene Atlas tab registration unavailable; using in-sheet fallback.");
  } catch (error) {
    console.warn("[" + MODULE_ID + "] Scene Atlas tab unavailable; using in-sheet fallback.", error);
  }
  console.info("[" + MODULE_ID + "] Module ready");
  if (game.settings.get(MODULE_ID, STARTUP_NOTICE_SETTING)) {
    ui.notifications.info(game.i18n.localize("FVTTATLAS.Notifications.Ready"));
  }
});
