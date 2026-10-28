/**
 * FVTT Atlas Navigation — Foundry v14 bootstrap.
 * v0.2.22 adds GM-only authoring shortcuts and a floating road editor.
 */
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab,
  getAtlasSceneConfig, refreshAtlasSceneConfig, forgetAtlasSceneConfig } from "./scene-config.js";
import { RoadCanvasController } from "./road-canvas.js";
import { addAtlasExplorerToTokenConfig } from "./atlas-token-config.js";
import { observeAtlasTokenMovement } from "./atlas-token-exploration.js";
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { savePartyExplorationConfig,
  saveCheckpointKnowledge } from "./party-exploration-storage.js";
import { readManualFog, setManualFogEnabled }
  from "./atlas-manual-fog-storage.js";
import { AtlasManualFogController } from "./atlas-manual-fog-renderer.js";
import { AtlasManualFogPalette, registerManualBrushSettings }
  from "./atlas-manual-fog-panel.js";
import { saveRenamedRoad, saveRemovedRoad, saveAnchoredLegacyRoads,
  saveOrganizedRoads, saveMergedRoads,
  saveEditedCheckpoint, saveRemovedCheckpoint, saveRoadTravelPreset,
  saveRoadAppearance, saveRoadPresentation, saveRoadPlayerVisibility,
  saveCheckpointPlayerVisibility } from "./road-storage.js";
import { getRoadMergeCandidates } from "./road-model.js";
import { sceneImageOrigin } from "./road-coordinates.js";
import { linkAtlasRegion, unlinkAtlasRegion, listSceneRegions } from "./region-atlas.js";
import { planSceneGeneratedRegion, saveGeneratedNativeRegion,
  setGeneratedRegionTravelPreset, applyGeneratedRegionMovementCost,
  applyGeneratedRegionPresetColor, updateGeneratedRegionMovementCost } from "./generated-region.js";
import { availableMovementActions, readPreset, previewNativeMovementCost }
  from "./native-movement-cost.js";
import { presetCostSummary } from "./travel-preset-model.js";
import { registerWorldTravelPresets, readWorldTravelPresets }
  from "./travel-preset-settings.js";
import { roadAppearanceForm, roadAppearanceFromForm, registerWorldRoadAppearance }
  from "./road-appearance-settings.js";
import { readWorldRoadAppearance, resolveRoadAppearance, roadAppearanceMode }
  from "./road-appearance.js";
import { AtlasCheckpointAppearanceEditor } from "./checkpoint-appearance-editor.js";
import { readAtlasJournalLinks, journalUuidFor, saveAtlasJournalLink,
  validJournalUuid } from "./atlas-journal-links.js";
import { journalLinkFields, journalUuidFromForm } from "./atlas-journal-fields.js";
import { AtlasRoadEditorDock } from "./road-editor-dock.js";

const roadCanvas = new RoadCanvasController();
const manualFog = new AtlasManualFogController();
const fogPalette = new AtlasManualFogPalette(manualFog);
let roadDock = null;

function syncRoadDock(scene, refresh) {
  refresh();
  if (roadDock?.scene?.id !== scene.id) return;
  if (!roadCanvas.getDraft(scene)) {
    roadDock.finished = true;
    void roadDock.close();
  } else if (roadDock.rendered) void roadDock.render(true);
}

/** Keep the full Scene sheet out of the map while transient point tools run. */
function openRoadDock(scene, refresh) {
  const previous = roadDock;
  if (previous) {
    previous.finished = true;
    void previous.close();
    roadDock = null;
  }
  const sceneSheet = getAtlasSceneConfig(scene);
  const dock = new AtlasRoadEditorDock({
    scene, controller: roadCanvas, sceneSheet,
    onFinish: () => roadCanvas.finish(),
    onCancel: () => roadCanvas.cancel(),
    onClosed: () => {
      if (roadDock === dock) roadDock = null;
      refresh();
    }
  });
  roadDock = dock;
  void Promise.resolve(dock.render(true)).then(() => {
    if (roadDock === dock && sceneSheet?.rendered) void sceneSheet.minimize?.();
  }).catch(error => {
    if (roadDock === dock) roadDock = null;
    roadCanvas.cancel();
    ui.notifications.error(error.message || String(error));
  });
}

function beginRoadDock(scene, refresh, start) {
  start(() => syncRoadDock(scene, refresh));
  openRoadDock(scene, refresh);
}

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
  const perMode = nativeOptIn && selectedPreset?.movementCosts !== null;
  const action = nativeOptIn && !perMode
    ? availableMovementActions().find(a => a.id === settings.movementAction) : null;
  if (nativeOptIn && !selectedPreset) throw new Error("Choose a world travel preset first.");
  if (nativeOptIn && !perMode && !action) {
    throw new Error("Choose a supported movement action to apply this native cost.");
  }
  const preflight = nativeOptIn
    ? previewNativeMovementCost(selectedPreset.id, perMode ? null : settings.movementAction)
    : null;
  if (preflight && !preflight.ok) throw new Error(preflight.message);
  const multiplier = nativeOptIn && !perMode ? selectedPreset.movementCostMultiplier : null;
  const expectedCosts = nativeOptIn && perMode ? {...selectedPreset.movementCosts} : null;
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
    ...(selectedPreset ? ["Travel preset: " + selectedPreset.name + " (" +
      presetCostSummary(selectedPreset) + "). Native Region color: " + selectedPreset.color + "."] : []),
    ...(nativeOptIn ? [perMode
      ? "Native movement costs: " + presetCostSummary(selectedPreset) +
        ". One Behavior will contain all explicitly selected actions."
      : "Native movement action: " +
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
      applyNativeCost: nativeOptIn,
      movementAction: nativeOptIn && !perMode ? settings.movementAction : null,
      expectedMultiplier: multiplier, expectedCosts,
      expectedColor: regenerate ? undefined : selectedPreset?.color
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
        " (" + presetCostSummary(p) + ")"
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
      beginRoadDock(scene, refresh, onChange => roadCanvas.start(scene, onChange));
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
    async editRoadAppearance(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const actual = atlas.roads?.find(item => item.id === road.id);
      if (!actual) throw new Error("The named road no longer exists.");
      const content = document.createElement("div");
      const hint = document.createElement("p");
      const mode = roadAppearanceMode(actual, readWorldTravelPresets().presets);
      hint.textContent = "Edit this road's name, player visibility and line appearance. " +
        "Unchanged World-default appearance continues to inherit Land / Air / Water settings. " +
        "Native Region colors, geometry and movement rules are not affected.";
      const nameRow = document.createElement("label");
      nameRow.className = "form-group";
      const nameLabel = document.createElement("span");
      nameLabel.textContent = "Road name";
      const name = document.createElement("input");
      name.type = "text"; name.name = "atlasRoadName"; name.maxLength = 120;
      name.required = true; name.value = actual.name; name.defaultValue = actual.name;
      nameRow.append(nameLabel, name);
      const visibilityRow = document.createElement("label");
      visibilityRow.className = "form-group";
      const visibilityLabel = document.createElement("span");
      visibilityLabel.textContent = "Visible to players (visual only)";
      const visibility = document.createElement("input");
      visibility.type = "checkbox"; visibility.name = "atlasRoadVisible";
      visibility.value = "true"; visibility.checked = actual.playerVisible === true;
      visibility.defaultChecked = visibility.checked;
      visibilityRow.append(visibilityLabel, visibility);
      const baseline = resolveRoadAppearance(actual, readWorldRoadAppearance(), mode);
      const journalLinks = readAtlasJournalLinks(scene);
      const journalControls = journalLinkFields(journalLinks,"road",road.id);
      content.append(hint, nameRow, visibilityRow, roadAppearanceForm(baseline),journalControls);
      const result = await DialogV2.input({
        window: { title: "Road Settings — " + actual.name },
        content, ok: { label: "Save Road Settings" },
        rejectClose: false, modal: true
      });
      if (!result) return;
      const nextJournal=journalUuidFromForm(result.atlasJournalUuid);
      if(nextJournal&&!validJournalUuid(nextJournal))
        throw Error("Choose a valid Journal Entry or Journal Page UUID.");
      const selected = roadAppearanceFromForm(result);
      const inherits = actual.appearance == null &&
        Object.keys(selected).every(key => selected[key] === baseline[key]);
      await saveRoadPresentation(scene, {
        roadId: road.id, name: String(result.atlasRoadName ?? ""),
        playerVisible: result.atlasRoadVisible === true ||
          result.atlasRoadVisible === "true" || result.atlasRoadVisible === "on",
        appearance: inherits ? null : selected, expectedRevision: atlas.revision
      });
      if(nextJournal!==journalUuidFor(journalLinks,"road",road.id)) {
        await saveAtlasJournalLink(scene,{
          kind:"road",id:road.id,uuid:nextJournal,expected:journalLinks
        });
      }
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas road settings saved.");
    },
    async resetRoadAppearance(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (!atlas.roads?.some(item => item.id === road.id && item.appearance)) {
        throw new Error("This road has no custom appearance to reset.");
      }
      const approved = await DialogV2.confirm({
        window: { title: "Reset Road Appearance" },
        content: "Use the current World appearance defaults for " + road.name + "?",
        yes: { label: "Reset to Defaults" }, rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveRoadAppearance(scene, {
        roadId: road.id, appearance: null, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas road now uses World appearance defaults.");
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
    async applyGeneratedRegionColor(scene, entry, refresh) {
      ensureIdle(scene);
      if (entry.metadata?.kind !== "corridor" || !entry.presetId) {
        throw new Error("Choose a generated corridor with a surface preset.");
      }
      const preset = readPreset(entry.presetId);
      const dialog = document.createElement("div");
      const warning = document.createElement("p");
      warning.textContent = "Apply " + preset.name + "'s native Region color " +
        preset.color + " to " + entry.name + "? This changes only this Region's color. " +
        "Any manual color will be replaced; native Behaviors, geometry and Levels remain unchanged.";
      dialog.appendChild(warning);
      const approved = await DialogV2.confirm({
        window: { title: "Apply surface preset color" },
        content: dialog, yes: { label: "Apply Color" },
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await applyGeneratedRegionPresetColor(scene, entry.id, {
        expectedPresetId: preset.id, expectedColor: preset.color,
        expectedCurrentColor: entry.color
      });
      refresh();
      ui.notifications.info("Atlas corridor Region color updated. Native Behaviors were untouched.");
    },
    async applyGeneratedRegionCost(scene, entry, refresh) {
      ensureIdle(scene);
      if (entry.metadata?.kind !== "corridor" || !entry.presetId) {
        throw new Error("Choose an Atlas-generated corridor with a saved travel preset.");
      }
      const preset = readPreset(entry.presetId);
      const perMode = preset.movementCosts !== null;
      const registered = availableMovementActions();
      if (!registered.length) throw new Error("This system exposes no supported native movement actions.");
      let action = null;
      if (!perMode) {
        const content = document.createElement("div");
        const description = document.createElement("p");
        description.textContent = "Legacy preset: choose one native movement action for " +
          preset.name + " (" + presetCostSummary(preset) + ").";
        const select = document.createElement("select");
        select.name = "atlasMovementAction";
        const placeholder = document.createElement("option");
        placeholder.value = ""; placeholder.textContent = "Choose movement action…";
        placeholder.defaultSelected = true;
        select.appendChild(placeholder);
        for (const available of registered) {
          const option = document.createElement("option");
          option.value = available.id;
          option.textContent = game.i18n.localize(available.label) || available.label;
          select.appendChild(option);
        }
        content.append(description, select);
        const choice = await DialogV2.input({
          window: { title: "Apply native movement cost — " + entry.name },
          content, ok: { label: "Review Cost" }, rejectClose: false, modal: true
        });
        if (!choice) return;
        action = registered.find(available => available.id === choice.atlasMovementAction);
        if (!action) throw new Error("Choose a valid movement action before applying.");
      }
      const preflight = previewNativeMovementCost(preset.id, action?.id ?? null);
      if (!preflight.ok) throw new Error(preflight.message);
      const multiplier = perMode ? null : preset.movementCostMultiplier;
      const expectedCosts = perMode ? { ...preset.movementCosts } : null;
      const confirm = document.createElement("div");
      const notice = document.createElement("p");
      notice.textContent = "Apply " + preset.name + " (" + presetCostSummary(preset) +
        (action ? "; action " + (game.i18n.localize(action.label) || action.label) : "") +
        ") as ONE native Modify Movement Cost Behavior on " + entry.name +
        "? No existing native Behavior will be changed.";
      confirm.appendChild(notice);
      const approved = await DialogV2.confirm({
        window: { title: "Confirm native movement-cost Behavior" },
        content: confirm, yes: { label: "Apply Native Behavior" },
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await applyGeneratedRegionMovementCost(scene, entry.id, {
        movementAction: action?.id ?? null, expectedPresetId: preset.id,
        expectedMultiplier: multiplier, expectedCosts
      });
      refresh();
      ui.notifications.info("Native Modify Movement Cost Behavior added. Review it in Foundry's Region editor.");
    },
    async updateGeneratedRegionCost(scene, entry, refresh) {
      ensureIdle(scene);
      if (entry.metadata?.kind !== "corridor" || !entry.presetId ||
          !entry.nativeCost?.managed || !entry.nativeCost.behaviorId) {
        throw new Error("Choose a corridor with one Atlas-authored native cost Behavior.");
      }
      const preset = readPreset(entry.presetId);
      const perMode = preset.movementCosts !== null;
      let action = null;
      if (!perMode) {
        const content = document.createElement("div");
        const description = document.createElement("p");
        description.textContent = "Legacy preset: choose one supported movement action for " +
          preset.name + " (" + presetCostSummary(preset) + ").";
        const select = document.createElement("select");
        select.name = "atlasMovementAction";
        const placeholder = document.createElement("option");
        placeholder.value = ""; placeholder.textContent = "Choose movement action…";
        placeholder.defaultSelected = true;
        select.appendChild(placeholder);
        for (const available of availableMovementActions()) {
          const option = document.createElement("option");
          option.value = available.id;
          option.textContent = game.i18n.localize(available.label) || available.label;
          select.appendChild(option);
        }
        content.append(description, select);
        const choice = await DialogV2.input({
          window: { title: "Refresh native movement cost — " + entry.name },
          content, ok: { label: "Review Cost" }, rejectClose: false, modal: true
        });
        if (!choice) return;
        action = availableMovementActions().find(item =>
          item.id === choice.atlasMovementAction);
        if (!action) throw new Error("Choose a supported native movement action.");
      }
      const preflight = previewNativeMovementCost(preset.id, action?.id ?? null);
      if (!preflight.ok) throw new Error(preflight.message);
      const authored = entry.nativeCost.detail;
      const oldCosts = authored.schemaVersion === 1
        ? { [authored.action]: authored.multiplier }
        : { ...authored.movementCosts };
      const expectedCosts = perMode ? { ...preset.movementCosts } : null;
      const expectedMultiplier = perMode ? null : preset.movementCostMultiplier;
      const content = document.createElement("div");
      const notice = document.createElement("p");
      notice.textContent = "Refresh ONE existing Atlas-authored Modify Movement Cost Behavior in place on " +
        entry.name + " using " + preset.name + " (" + presetCostSummary(preset) + "). " +
        "Modes no longer selected by the preset become neutral ×1. " +
        "The Region, shapes, Levels, other Behaviors, color and travel preset assignment remain unchanged. " +
        "Atlas refuses manually edited, disabled, or duplicated native costs.";
      content.appendChild(notice);
      const approved = await DialogV2.confirm({
        window: { title: "Refresh Atlas native corridor costs" },
        content, yes: { label: "Refresh Native Costs" },
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await updateGeneratedRegionMovementCost(scene, entry.id, {
        expectedPresetId: preset.id,
        expectedBehaviorId: entry.nativeCost.behaviorId,
        expectedPreviousCosts: oldCosts,
        expectedCosts, expectedMultiplier,
        movementAction: action?.id ?? null
      });
      refresh();
      ui.notifications.info("Atlas refreshed the existing native cost Behavior in place. No Region was deleted or recreated.");
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
      roadCanvas.startJunction(scene, () => {
        refresh();
        if (roadCanvas.getDraft(scene)?.mode === "points" && !roadDock) {
          openRoadDock(scene, refresh);
        }
        if (roadDock?.scene?.id === scene.id) {
          if (!roadCanvas.getDraft(scene)) {
            roadDock.finished = true;
            void roadDock.close();
          } else if (roadDock.rendered) void roadDock.render(true);
        }
      });
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Junctions.StartNotice"));
    },
    selectJunction: (scene, nodeId) => roadCanvas.selectJunction(scene, nodeId),
    beginCheckpoint(scene, refresh) {
      roadCanvas.startCheckpoint(scene, refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Checkpoints.StartNotice"));
    },
    selectCheckpoint: (scene, checkpointId) => roadCanvas.selectCheckpoint(scene, checkpointId),
    async savePartyExploration(scene, settings, refresh) {
      ensureIdle(scene);
      await savePartyExplorationConfig(scene, settings);
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas party exploration saved for this Scene.");
    },
    async saveManualFog(scene,enabled,refresh) {
      ensureIdle(scene);
      await setManualFogEnabled(scene,enabled);
      manualFog.refresh();roadCanvas.refresh();refresh();
      ui.notifications.info(enabled ? "Atlas manual fog enabled." : "Atlas manual fog disabled.");
    },
    openManualBrushPalette() { fogPalette.show(); },
    async setCheckpointKnowledge(scene, settings, refresh) {
      ensureIdle(scene);
      await saveCheckpointKnowledge(scene, settings);
      manualFog.refresh();
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(settings.knowledge === "lore"
        ? "Checkpoint marked known through lore." :
        settings.knowledge === "visited" ? "Checkpoint marked visited." :
          "Checkpoint knowledge revoked.");
    },
    async toggleCheckpointPlayerVisibility(scene, checkpoint, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const actual = atlas.checkpoints?.find(c => c.id === checkpoint.id);
      if (!actual) throw new Error("Checkpoint no longer exists.");
      await saveCheckpointPlayerVisibility(scene, {
        checkpointId: checkpoint.id, visible: actual.playerVisible !== true,
        expectedRevision: atlas.revision
      });
      roadCanvas.refresh(); refresh();
      ui.notifications.info(actual.playerVisible === true
        ? "Checkpoint hidden from players." : "Checkpoint now visible to players.");
    },
    async toggleRoadPlayerVisibility(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const actual = atlas.roads?.find(item => item.id === road.id);
      if (!actual) throw new Error("Road no longer exists.");
      await saveRoadPlayerVisibility(scene, {
        roadId: road.id, visible: actual.playerVisible !== true,
        expectedRevision: atlas.revision
      });
      roadCanvas.refresh(); refresh();
      ui.notifications.info(actual.playerVisible === true
        ? "Road hidden from players." : "Road now visible to players.");
    },
    editCheckpointAppearance(scene, checkpoint, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (!atlas.checkpoints?.some(c => c.id === checkpoint.id)) {
        throw new Error("Checkpoint no longer exists.");
      }
      new AtlasCheckpointAppearanceEditor({
        scene, checkpointId: checkpoint.id, expectedRevision: atlas.revision,
        onSaved: () => { roadCanvas.refresh(); refresh(); }
      }).render(true);
    },
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
      beginRoadDock(scene, refresh, onChange => roadCanvas.startPointEdit(scene, roadId, onChange));
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

/** Confirm grid remapping before an edit can strand existing image-relative cell centers. */
function atlasGridChangeNotice(scene, change, options) {
  if (!game.user?.isGM || options?.atlasGridChangeConfirmed === true) return;
  const nextType = change?.grid?.type ?? change?.["grid.type"];
  const nextSize = change?.grid?.size ?? change?.["grid.size"];
  const typeChanged = nextType !== undefined && Number(nextType) !== Number(scene.grid?.type);
  const sizeChanged = nextSize !== undefined && Number(nextSize) !== Number(scene.grid?.size);
  if (!typeChanged && !sizeChanged) return;
  const state = readManualFog(scene);
  if (!state.revealed.length && !state.hidden.length) return;
  const expectedType = scene.grid?.type, expectedSize = scene.grid?.size;
  const updated = foundry.utils.deepClone(change);
  // Hooks are synchronous: cancel this attempt and initiate a confirmed update later.
  void Promise.resolve().then(async () => {
    const content = document.createElement("div");
    const warning = document.createElement("p");
    warning.textContent =
      "Atlas has " + state.revealed.length + " revealed and " +
      state.hidden.length + " manually hidden cells saved on the current grid. " +
      "Changing its type or cell size changes the cell centers: existing Atlas " +
      "exploration will remain saved, but it may no longer appear revealed. " +
      "There is no automatic hex/square conversion in this version. " +
      "Cancel to preserve the current visible exploration; proceed only after making a backup.";
    content.appendChild(warning);
    const approved = await foundry.applications.api.DialogV2.confirm({
      window:{title:"Atlas exploration — grid change warning"},
      content, yes:{label:"Change Grid Anyway"}, rejectClose:false, modal:true
    });
    if (!approved) return;
    if (scene.grid?.type !== expectedType || scene.grid?.size !== expectedSize) {
      ui.notifications.warn("The Scene grid changed while the warning was open. Review it again.");
      return;
    }
    await scene.update(updated, {...options, atlasGridChangeConfirmed:true});
  }).catch(error => ui.notifications.error("Atlas grid warning: " + (error.message || String(error))));
  return false;
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "hiddenOverlayHatching", {
    name: "GM Hidden-Item Hatching",
    hint: "Draw subtle burgundy diagonal hatching over GM-visible roads and checkpoints that players have not discovered. Never shown to players.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => roadCanvas.refresh()
  });
  registerManualBrushSettings();
  registerWorldTravelPresets();
  registerWorldRoadAppearance(() => roadCanvas.refresh());
  const roadActions = actions();
  roadCanvas.setShortcutHandler((scene, target) => {
    ensureIdle(scene);
    const atlas = readAtlas(scene);
    const refresh = () => refreshAtlasSceneConfig(scene);
    if (target.kind === "checkpoint") {
      const checkpoint = atlas.checkpoints?.find(c => c.id === target.id);
      if (checkpoint) roadActions.editCheckpointAppearance(scene, checkpoint, refresh);
    } else if (target.kind === "road") {
      const road = atlas.roads?.find(r => r.id === target.id);
      if (road) return roadActions.editRoadAppearance(scene, road, refresh);
    }
  });
  Hooks.on("getSceneControlButtons", controls => {
    if(!game.user?.isGM)return;
    controls.atlasManualFog={
      name:"atlasManualFog",title:"Atlas Exploration",
      icon:"fa-solid fa-map",order:Object.keys(controls).length,
      visible:true,
      onChange:(_event,active)=>{if(active)fogPalette.show();},
      tools:{
        atlasBrushPalette:{
          name:"atlasBrushPalette",title:"Open Atlas Exploration Brushes",
          icon:"fa-solid fa-paintbrush",order:0,button:true,visible:true,
          onChange:()=>fogPalette.toggle()
        },
        atlasGMFogPreview:{
          name:"atlasGMFogPreview",title:"Toggle GM Fog Preview",
          icon:"fa-solid fa-eye",order:1,button:true,visible:true,
          onChange:()=>{
            manualFog.setPreview(!manualFog.preview);
            if(fogPalette.open)fogPalette.draw();
          }
        }
      }
    };
  });
  Hooks.on("preUpdateScene", atlasGridChangeNotice);
  Hooks.on("renderTokenConfig", addAtlasExplorerToTokenConfig);
  Hooks.on("renderSceneConfig", (app, element) => {
    addAtlasRoadsToSceneConfig(app, element, roadActions);
  });
  Hooks.on("closeSceneConfig", app => {
    if (roadDock?.sceneSheet === app) {
      roadDock.finished = true;
      void roadDock.close();
    }
    roadCanvas.endEditor(app?.document);
    forgetAtlasSceneConfig(app);
  });
  Hooks.on("canvasReady", () => { roadCanvas.refresh(); manualFog.refresh(); });
  // Foundry v14 movement includes origin, passed waypoints and destination.
  Hooks.on("moveToken", observeAtlasTokenMovement);
  Hooks.on("canvasTearDown", () => {
    if (roadDock) {
      roadDock.finished = true;
      void roadDock.close();
    }
    fogPalette.close();
    roadCanvas.tearDown();
    manualFog.tearDown();
  });
  Hooks.on("canvasPan", view => roadCanvas.onCanvasPan(view));
  Hooks.on("sightRefresh", () => roadCanvas.onFogRefresh());
  Hooks.on("updateFogExploration", () => roadCanvas.onFogRefresh());
  Hooks.on("deleteFogExploration", () => roadCanvas.onFogRefresh());
  Hooks.on("updateScene", scene => {
    if (globalThis.canvas?.ready && canvas.scene?.id === scene.id) {
      roadCanvas.refresh();manualFog.refresh();
      if(fogPalette.open)fogPalette.draw();
    }
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
