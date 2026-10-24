/**
 * FVTT Atlas Navigation — Foundry v14 bootstrap.
 * v0.2.16 adds separately confirmed native movement cost to generated corridors.
 */
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab } from "./scene-config.js";
import { RoadCanvasController } from "./road-canvas.js";
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { saveRenamedRoad, saveRemovedRoad, saveAnchoredLegacyRoads,
  saveOrganizedRoads, saveMergedRoads,
  saveEditedCheckpoint, saveRemovedCheckpoint, saveRoadTravelPreset } from "./road-storage.js";
import { getRoadMergeCandidates } from "./road-model.js";
import { sceneImageOrigin } from "./road-coordinates.js";
import { linkAtlasRegion, unlinkAtlasRegion, listSceneRegions } from "./region-atlas.js";
import { planSceneGeneratedRegion, saveGeneratedNativeRegion,
  setGeneratedRegionTravelPreset, applyGeneratedRegionMovementCost } from "./generated-region.js";
import { availableMovementActions, readPreset }
  from "./native-movement-cost.js";
import { registerWorldTravelPresets, readWorldTravelPresets }
  from "./travel-preset-settings.js";

const roadCanvas = new RoadCanvasController();

function ensureIdle(scene) {
  if (roadCanvas.getDraft(scene)) {
    throw new Error("Save or cancel your current road edits first.");
  }
}


async function previewAndSaveRegion(scene, settings, { regenerate = false } = {}) {
  ensureIdle(scene);
  const plan = planSceneGeneratedRegion(scene, settings);
  const summary = document.createElement("div");
  const nativeOptIn = !regenerate && plan.kind === "corridor" && !!settings.applyNativeCost;
  const selectedPreset = !regenerate && settings.presetId ? readPreset(settings.presetId) : null;
  const action = nativeOptIn ? availableMovementActions().find(a => a.id === settings.movementAction) : null;
  if (nativeOptIn && !action) throw new Error("Choose a supported movement action to apply this native cost.");
  const multiplier = nativeOptIn ? selectedPreset?.movementCostMultiplier : null;
  for (const message of [
    plan.name,
    plan.kind === "checkpoint"
      ? "A native Region around this one checkpoint."
      : "A native corridor following the connected road geometry.",
    "Half-width: " + plan.generatedRegion.widthCells + " grid cells (" +
      Math.round(plan.radius * 100) / 100 + " px). " +
      plan.shapes.length + " native shape(s).",
    regenerate
      ? "Regenerate only if its native geometry was not manually edited. Existing name, Levels, Behaviors, visibility and travel preset are preserved."
      : nativeOptIn
        ? "Create one linked native Region WITH one native Modify Movement Cost Behavior, after this confirmation. No other Region is changed."
        : "Create one linked native Region without native Behaviors. Its travel preset stays descriptive metadata until explicitly applied.",
    ...(selectedPreset ? ["Travel preset: " + selectedPreset.name + " (cost ×" +
      selectedPreset.movementCostMultiplier + ")."] : []),
    ...(nativeOptIn ? ["Native movement action: " +
      (game.i18n.localize(action.label) || action.label) + " (" + action.id + "). " +
      "Foundry validates the value for this system before saving."] : []),
    "The tinted map overlay is a preview only. Region geometry will be saved only after confirmation."
  ]) {
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    summary.appendChild(paragraph);
  }
  roadCanvas.showRegionPreview(scene, plan);
  try {
    const approved = await foundry.applications.api.DialogV2.confirm({
      window: { title: regenerate ? "Regenerate native road Region" : "Create native road Region" },
      content: summary,
      yes: { label: regenerate ? "Regenerate Region" : "Create Region" },
      rejectClose: false, modal: true
    });
    if (!approved) return;
    if (!roadCanvas.isRegionPreviewActive(scene, plan)) {
      throw new Error("The Scene or Atlas editor changed while the Region preview was open. Nothing was created.");
    }
    const result = await saveGeneratedNativeRegion(scene, plan, {
      regenerate, presetId: regenerate ? null : (settings.presetId ?? null),
      movementAction: nativeOptIn ? settings.movementAction : null,
      expectedMultiplier: nativeOptIn ? multiplier : null
    });
    ui.notifications.info(result.created
      ? nativeOptIn
        ? "Atlas created one native corridor Region with the selected movement-cost Behavior."
        : "Atlas created one linked native Region without Behaviors; preset metadata was saved."
      : "Atlas regenerated the Region geometry; native Behaviors were preserved.");
  } finally {
    roadCanvas.clearRegionPreview();
  }
}


/** Native DialogV2 picker shared by road defaults and generated Region overrides. */
async function promptTravelPreset(title, currentId = null) {
  const chooser = document.createElement("select");
  chooser.name = "atlasTravelPresetId";
  const options = [["", "None (no Atlas travel preset)"],
    ...readWorldTravelPresets().presets.map(p => [
      p.id, p.mode.toUpperCase() + " — " + p.name +
        " (cost ×" + p.movementCostMultiplier + ")"
    ])];
  for (const [id, name] of options) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    chooser.appendChild(option);
  }
  chooser.value = currentId ?? "";
  const container = document.createElement("div");
  const hint = document.createElement("p");
  hint.textContent = "References a world Atlas preset. Native Behaviors are never changed by assignment; apply them separately.";
  container.append(hint, chooser);
  const input = await foundry.applications.api.DialogV2.input({
    window: { title }, content: container,
    ok: { label: "Save Travel Preset" }, rejectClose: false, modal: true
  });
  if (!input) return undefined;
  const presetId = String(input.atlasTravelPresetId ?? "");
  if (presetId && !readWorldTravelPresets().presets.some(p => p.id === presetId)) {
    throw new Error("The selected travel preset was removed; reopen the picker.");
  }
  return presetId || null;
}

function actions() {
  const DialogV2 = foundry.applications.api.DialogV2;
  return {
    begin(scene, refresh) {
      roadCanvas.start(scene, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.StartNotice"));
    },
    draft: scene => roadCanvas.getDraft(scene),
    async generateRegion(scene, settings, refresh) {
      await previewAndSaveRegion(scene, settings);
      refresh();
    },
    async assignRoadTravelPreset(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (!atlas.roads?.some(r => r.id === road.id)) {
        throw new Error("This named road no longer exists.");
      }
      const presetId = await promptTravelPreset("Default travel preset — " + road.name,
        atlas.roads.find(r => r.id === road.id).travelPresetId ?? null);
      if (presetId === undefined) return;
      await saveRoadTravelPreset(scene, {
        roadId: road.id, presetId, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas named-road default travel preset saved.");
    },
    async assignGeneratedRegionTravelPreset(scene, entry, refresh) {
      ensureIdle(scene);
      const presetId = await promptTravelPreset("Corridor travel preset — " + entry.name,
        entry.presetId);
      if (presetId === undefined) return;
      await setGeneratedRegionTravelPreset(scene, entry.id, presetId);
      refresh();
      ui.notifications.info("Atlas generated Region travel preset saved. Native Behaviors were not changed.");
    },
    async applyGeneratedRegionCost(scene, entry, refresh) {
      ensureIdle(scene);
      if (entry.metadata?.kind !== "corridor" || !entry.presetId) {
        throw new Error("Choose an Atlas-generated corridor with a saved travel preset.");
      }
      const preset = readPreset(entry.presetId);
      const actions = availableMovementActions();
      if (!actions.length) throw new Error("This system exposes no supported native movement actions.");
      const content = document.createElement("div");
      const description = document.createElement("p");
      description.textContent = "Add one native Modify Movement Cost Behavior to " +
        entry.name + " using " + preset.name + " (cost ×" +
        preset.movementCostMultiplier + "). Native Behaviors already present are never replaced.";
      const select = document.createElement("select");
      select.name = "atlasMovementAction";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choose movement action…";
      placeholder.setAttribute("selected", "");
      select.appendChild(placeholder);
      for (const action of actions) {
        const option = document.createElement("option");
        option.value = action.id;
        option.textContent = game.i18n.localize(action.label) || action.label;
        select.appendChild(option);
      }
      content.append(description, select);
      const choice = await DialogV2.input({
        window: { title: "Apply native movement cost — " + entry.name },
        content, ok: { label: "Review Cost" }, rejectClose: false, modal: true
      });
      if (!choice) return;
      const chosen = actions.find(a => a.id === choice.atlasMovementAction);
      if (!chosen) throw new Error("Choose a valid movement action before applying.");
      const confirm = document.createElement("div");
      const notice = document.createElement("p");
      notice.textContent = "Apply " + preset.name + " at cost ×" +
        preset.movementCostMultiplier + " to movement action " +
        (game.i18n.localize(chosen.label) || chosen.label) +
        " on this Region only? No existing native Behavior will be changed.";
      confirm.appendChild(notice);
      const approved = await DialogV2.confirm({
        window: { title: "Confirm native movement-cost Behavior" },
        content: confirm, yes: { label: "Apply Native Behavior" },
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await applyGeneratedRegionMovementCost(scene, entry.id, {
        movementAction: chosen.id, expectedPresetId: preset.id,
        expectedMultiplier: preset.movementCostMultiplier
      });
      refresh();
      ui.notifications.info("Native Modify Movement Cost Behavior added. Review it in Foundry's Region editor.");
    },
    async regenerateRegion(scene, entry, refresh) {
      if (!entry.metadata || entry.modified) {
        throw new Error("Manual Region geometry must be preserved; regeneration is unavailable.");
      }
      const meta = entry.metadata;
      await previewAndSaveRegion(scene, {
        kind: meta.kind, roadId: meta.roadId,
        checkpointId: meta.checkpointIds[0],
        endCheckpointId: meta.kind === "corridor" ? meta.checkpointIds[1] : null,
        widthCells: meta.widthCells
      }, { regenerate: true });
      refresh();
    },
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
  registerWorldTravelPresets();
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
});
