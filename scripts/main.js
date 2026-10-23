/**
 * FVTT Atlas Navigation — Foundry v14 bootstrap.
 * v0.2.13 adds GM-authored named/elevated road checkpoints without native Region mutations.
 */
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab } from "./scene-config.js";
import { RoadCanvasController } from "./road-canvas.js";
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { saveRenamedRoad, saveRemovedRoad, saveAnchoredLegacyRoads,
  saveOrganizedRoads, saveMergedRoads,
  saveEditedCheckpoint, saveRemovedCheckpoint } from "./road-storage.js";
import { getRoadMergeCandidates } from "./road-model.js";
import { sceneImageOrigin } from "./road-coordinates.js";
import { linkAtlasRegion, unlinkAtlasRegion, listSceneRegions } from "./region-atlas.js";

const STARTUP_NOTICE_SETTING = "showStartupNotice";
const roadCanvas = new RoadCanvasController();

function ensureIdle(scene) {
  if (roadCanvas.getDraft(scene)) {
    throw new Error("Save or cancel your current road edits first.");
  }
}

function actions() {
  const DialogV2 = foundry.applications.api.DialogV2;
  return {
    begin(scene, refresh) {
      roadCanvas.start(scene, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.StartNotice"));
    },
    draft: scene => roadCanvas.getDraft(scene),
    beginJunction(scene, refresh) {
      roadCanvas.startJunction(scene, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Junctions.StartNotice"));
    },
    selectJunction: (scene, nodeId) => roadCanvas.selectJunction(scene, nodeId),
    beginCheckpoint(scene, refresh) {
      roadCanvas.startCheckpoint(scene, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Checkpoints.StartNotice"));
    },
    selectCheckpoint: (scene, checkpointId) => roadCanvas.selectCheckpoint(scene, checkpointId),
    async editCheckpoint(scene, checkpoint, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const current = atlas.checkpoints?.find(c => c.id === checkpoint.id);
      if (!current) throw new Error("Checkpoint no longer exists.");
      const content = document.createElement("div");
      const nameLabel = document.createElement("label");
      nameLabel.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.Name");
      const name = document.createElement("input");
      name.name = "checkpointName";
      name.type = "text";
      name.required = true;
      name.maxLength = 120;
      name.value = current.name;
      content.appendChild(nameLabel);
      content.appendChild(name);
      const elevationLabel = document.createElement("label");
      elevationLabel.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.Elevation");
      const elevation = document.createElement("input");
      elevation.name = "checkpointElevation";
      elevation.type = "number";
      elevation.step = "any";
      elevation.value = current.elevationMeters === null
        ? "" : String(current.elevationMeters);
      content.appendChild(elevationLabel);
      content.appendChild(elevation);
      const result = await DialogV2.input({
        window: { title: game.i18n.localize("FVTTATLAS.Checkpoints.Edit") },
        content,
        ok: { label: game.i18n.localize("FVTTATLAS.Checkpoints.Save") },
        rejectClose: false
      });
      if (!result) return;
      const raw = String(result.checkpointElevation ?? "").trim();
      const elevationMeters = raw === "" ? null : Number(raw);
      await saveEditedCheckpoint(scene, {
        checkpointId: current.id, name: String(result.checkpointName ?? ""),
        elevationMeters, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Checkpoints.Updated"));
    },
    async removeCheckpoint(scene, checkpoint, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const current = atlas.checkpoints?.find(c => c.id === checkpoint.id);
      if (!current) throw new Error("Checkpoint no longer exists.");
      const content = document.createElement("div");
      const text = document.createElement("p");
      text.textContent = game.i18n.format("FVTTATLAS.Checkpoints.DeleteWarning", {
        name: current.name
      });
      content.appendChild(text);
      const approved = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Checkpoints.Delete") },
        content, rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveRemovedCheckpoint(scene, {
        checkpointId: current.id, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Checkpoints.Removed"));
    },
    beginPointEdit(scene, roadId, refresh) {
      roadCanvas.startPointEdit(scene, roadId, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.EditNotice"));
    },
    undo: () => roadCanvas.undo(),
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
    async organize(scene, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (atlas.schemaVersion !== 2) return;
      const approved = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Organize") },
        content: game.i18n.localize("FVTTATLAS.Roads.OrganizeWarning"),
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveOrganizedRoads(scene, { expectedRevision: atlas.revision });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Organized"));
    },
    async merge(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const options = getRoadMergeCandidates(atlas, road.id);
      if (!options.length) throw new Error("This road has no adjacent road to merge.");
      let otherId = options[0].id;
      if (options.length > 1) {
        const select = document.createElement("select");
        select.name = "mergeRoadId";
        for (const candidate of options) {
          const item = document.createElement("option");
          item.value = candidate.id;
          item.textContent = candidate.name;
          select.appendChild(item);
        }
        // Foundry v14 requires an outermost plain div for DOM dialog content.
        const content = document.createElement("div");
        content.appendChild(select);
        const input = await DialogV2.input({
          window: { title: game.i18n.localize("FVTTATLAS.Roads.Merge") },
          content,
          ok: { label: game.i18n.localize("FVTTATLAS.Roads.Merge") },
          rejectClose: false
        });
        if (!input) return;
        otherId = String(input.mergeRoadId ?? "");
      }
      const other = options.find(candidate => candidate.id === otherId);
      if (!other) throw new Error("Choose a connected road to merge.");
      const approved = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Merge") },
        content: game.i18n.format("FVTTATLAS.Roads.MergeWarning", {
          from: other.name, to: road.name
        }),
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveMergedRoads(scene, {
        keepRoadId: road.id, mergeRoadId: otherId, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Merged"));
    },
    async linkRegion(scene, refresh) {
      const choices = listSceneRegions(scene).filter(region => !region.linked && !region.invalidLink);
      if (!choices.length) throw new Error(game.i18n.localize("FVTTATLAS.Regions.NoAvailable"));
      const content = document.createElement("div");
      const select = document.createElement("select");
      select.name = "atlasRegionId";
      select.setAttribute("aria-label", game.i18n.localize("FVTTATLAS.Regions.Choose"));
      for (const region of choices) {
        const option = document.createElement("option");
        option.value = region.id;
        option.textContent = region.name;
        select.appendChild(option);
      }
      content.appendChild(select);
      const result = await DialogV2.input({
        window: { title: game.i18n.localize("FVTTATLAS.Regions.Link") },
        content,
        ok: { label: game.i18n.localize("FVTTATLAS.Regions.Link") },
        rejectClose: false
      });
      if (!result) return;
      const regionId = String(result.atlasRegionId ?? "");
      if (!choices.some(region => region.id === regionId)) {
        throw new Error(game.i18n.localize("FVTTATLAS.Regions.Choose"));
      }
      await linkAtlasRegion(scene, regionId);
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Regions.Linked"));
    },
    async unlinkRegion(scene, regionId, refresh) {
      const region = scene.regions?.get(regionId);
      if (!region) throw new Error(game.i18n.localize("FVTTATLAS.Regions.Missing"));
      const content = document.createElement("div");
      const warning = document.createElement("p");
      warning.textContent = game.i18n.format("FVTTATLAS.Regions.UnlinkWarning", {
        name: region.name
      });
      content.appendChild(warning);
      const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Regions.Unlink") },
        content,
        rejectClose: false,
        modal: true
      });
      if (!confirmed) return;
      await unlinkAtlasRegion(scene, regionId);
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Regions.Unlinked"));
    },
    configureRegion(scene, regionId) {
      if (!game.user?.isGM || !scene.canUserModify(game.user, "update")) {
        throw new Error("Only a GM can configure Atlas Regions.");
      }
      const region = scene.regions?.get(regionId);
      if (!region || region.parent?.id !== scene.id ||
          !region.canUserModify(game.user, "update")) {
        throw new Error(game.i18n.localize("FVTTATLAS.Regions.Missing"));
      }
      return new foundry.applications.sheets.RegionConfig({ document: region })
        .render({ force: true });
    },
    finish: () => roadCanvas.finish(),
    cancel: () => roadCanvas.cancel(),
    select: (scene, id) => roadCanvas.selectRoad(scene, id),
    async rename(scene, road, refresh) {
      ensureIdle(scene);
      const revision = readAtlas(scene).revision;
      const content = document.createElement("div");
      const input = document.createElement("input");
      input.name = "roadName";
      input.type = "text";
      input.maxLength = 120;
      input.setAttribute("value", road.name);
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
        roadId: road.id, segmentId: road.id,
        name: String(data.roadName ?? ""), expectedRevision: revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Renamed"));
    },
    async remove(scene, road, refresh) {
      ensureIdle(scene);
      const revision = readAtlas(scene).revision;
      const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Delete") },
        content: game.i18n.localize("FVTTATLAS.Roads.DeleteWarning"),
        rejectClose: false,
        modal: true
      });
      if (!confirmed) return;
      await saveRemovedRoad(scene, { roadId: road.id, segmentId: road.id, expectedRevision: revision });
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
