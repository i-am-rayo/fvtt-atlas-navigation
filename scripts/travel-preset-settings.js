/**
 * Foundry v14 world-scoped Travel Preset configuration submenu.
 * No native Region Behavior is created or modified by this editor.
 */
import { MODULE_ID, readAtlas } from "./atlas-storage.js";
import { TRAVEL_PRESET_SETTING, REGION_TRAVEL_PRESET_FLAG, TRAVEL_TYPES,
  defaultTravelPresets, validateTravelPresets, upsertTravelPreset,
  removeTravelPreset } from "./travel-preset-model.js";

const TYPE_LABELS = { land: "Land", air: "Air", water: "Water" };

export function readWorldTravelPresets() {
  return validateTravelPresets(game.settings.get(MODULE_ID, TRAVEL_PRESET_SETTING));
}

export function registerWorldTravelPresets() {
  game.settings.register(MODULE_ID, TRAVEL_PRESET_SETTING, {
    name: "Atlas Corridor Travel Presets",
    hint: "World-wide movement-cost suggestions for Atlas roads and corridors.",
    scope: "world",
    config: false,
    type: Object,
    default: defaultTravelPresets()
  });
  game.settings.registerMenu(MODULE_ID, "atlasTravelPresetsMenu", {
    name: "Atlas Presets",
    label: "Configure Corridor Travel Presets",
    hint: "Manage reusable Land, Air and Water travel conditions for all Scenes in this World.",
    icon: "fa-solid fa-route",
    type: AtlasTravelPresetSettings,
    restricted: true
  });
}

function node(tag, content = null) {
  const element = document.createElement(tag);
  if (content !== null) element.textContent = content;
  return element;
}

function button(label, callback, title = label) {
  const element = node("button", label);
  element.type = "button";
  element.title = title;
  element.addEventListener("click", async () => {
    element.disabled = true;
    try { await callback(); }
    catch (error) {
      console.error("[" + MODULE_ID + "] " + label, error);
      ui.notifications.error(error.message || String(error));
    } finally { element.disabled = false; }
  });
  return element;
}

function worldPresetUses(presetId) {
  const users = [];
  for (const scene of game.scenes ?? []) {
    try {
      const atlas = readAtlas(scene);
      for (const road of atlas.roads ?? []) {
        if (road.travelPresetId === presetId) users.push(scene.name + " / " + road.name);
      }
    } catch {
      // A corrupt or future-schema Scene is not rewritten by the preset editor.
    }
    for (const region of scene.regions?.values?.() ?? []) {
      const flag = region.getFlag(MODULE_ID, REGION_TRAVEL_PRESET_FLAG);
      if (flag?.presetId === presetId) users.push(scene.name + " / " + region.name);
    }
  }
  return users;
}

export class AtlasTravelPresetSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-travel-presets",
    window: { title: "Atlas Presets — Corridor Travel", resizable: true },
    position: { width: 690, height: 630 }
  };

  async _renderHTML() {
    const presets = readWorldTravelPresets();
    const root = node("div");
    root.style.cssText = "padding:0.8rem 1rem;display:grid;gap:1rem;overflow:auto;height:100%;";
    root.appendChild(node("p",
      "These world presets are available to every Scene. Values are movement COST multipliers: above 1 costs more movement, below 1 costs less. In v0.2.15 Atlas records choices but does NOT create or edit native Region Behaviors."));
    for (const mode of TRAVEL_TYPES) {
      const fieldset = node("fieldset");
      fieldset.style.cssText = "display:grid;gap:0.45rem;min-width:0;";
      const legend = node("legend", TYPE_LABELS[mode]);
      legend.style.fontWeight = "bold";
      fieldset.appendChild(legend);
      const group = presets.presets.filter(p => p.mode === mode);
      if (!group.length) fieldset.appendChild(node("p", "No presets configured."));
      for (const preset of group) {
        const row = node("div");
        row.style.cssText = "display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;";
        const details = node("span", preset.name);
        details.style.flex = "1 1 12rem";
        row.appendChild(details);
        const cost = node("span", "Cost ×" + preset.movementCostMultiplier.toFixed(2));
        cost.style.cssText = "font-variant-numeric:tabular-nums;min-width:5.5rem;";
        row.appendChild(cost);
        row.appendChild(button("Edit", () => this._editPreset(preset)));
        row.appendChild(button("Delete", () => this._deletePreset(preset)));
        fieldset.appendChild(row);
      }
      fieldset.appendChild(button("＋ Add " + TYPE_LABELS[mode] + " Preset",
        () => this._editPreset(null, mode)));
      root.appendChild(fieldset);
    }
    root.appendChild(node("p",
      "Presets are shared within this Foundry World, not across different Worlds. Existing road or Region assignments retain their stable preset ID if a name or cost changes. Deleting a preset in use is blocked."));
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  async _editPreset(existing, initialMode = "land") {
    if (!game.user?.isGM) throw new Error("Only a GM can configure Atlas presets.");
    const container = node("div");
    container.style.cssText = "display:grid;gap:0.4rem";
    const nameLabel = node("label", "Preset name");
    const name = node("input");
    name.name = "presetName"; name.required = true; name.maxLength = 120;
    // DialogV2 serializes its content element, so use reflected HTML defaults.
    name.defaultValue = existing?.name ?? "";
    container.append(nameLabel, name);
    container.appendChild(node("label", "Travel type"));
    const mode = node("select");
    mode.name = "presetMode";
    for (const [key, label] of Object.entries(TYPE_LABELS)) {
      const option = node("option", label);
      option.value = key; option.defaultSelected = key === (existing?.mode ?? initialMode);
      mode.appendChild(option);
    }
    container.appendChild(mode);
    container.appendChild(node("label", "Native movement-cost multiplier (0.10–10.00)"));
    const cost = node("input");
    cost.type = "number"; cost.step = "0.05"; cost.min = "0.1"; cost.max = "10";
    cost.required = true; cost.name = "presetCost";
    cost.defaultValue = String(existing?.movementCostMultiplier ?? 1);
    container.appendChild(cost);
    container.appendChild(node("p",
      "This value is a preset suggestion only in v0.2.15. Region Behaviors remain unchanged."));
    // Foundry v14 requires a plain, attribute-free outer div for HTMLElement dialog content.
    const dialogContent = node("div");
    dialogContent.appendChild(container);
    const result = await foundry.applications.api.DialogV2.input({
      window: { title: existing ? "Edit Atlas Travel Preset" : "Add Atlas Travel Preset" },
      content: dialogContent,
      ok: { label: existing ? "Save Preset" : "Add Preset" },
      rejectClose: false, modal: true
    });
    if (!result) return;
    const raw = String(result.presetCost ?? "").trim();
    if (!raw) throw new Error("Enter a movement cost.");
    const preset = {
      id: existing?.id ?? "custom-" + foundry.utils.randomID(16),
      mode: String(result.presetMode ?? ""),
      name: String(result.presetName ?? ""),
      movementCostMultiplier: Number(raw)
    };
    const next = upsertTravelPreset(readWorldTravelPresets(), preset);
    await game.settings.set(MODULE_ID, TRAVEL_PRESET_SETTING, next);
    ui.notifications.info("Atlas travel preset saved.");
    await this.render();
  }

  async _deletePreset(preset) {
    if (!game.user?.isGM) throw new Error("Only a GM can configure Atlas presets.");
    const uses = worldPresetUses(preset.id);
    if (uses.length) {
      throw new Error("Preset is in use by " + uses.slice(0, 3).join(", ") +
        (uses.length > 3 ? " and " + (uses.length - 3) + " more." : ".") +
        " Reassign those roads/Regions before deleting it.");
    }
    const approved = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Atlas Travel Preset" },
      content: "Delete " + preset.name + "? Existing native Regions and Behaviors will not be touched.",
      rejectClose: false, modal: true
    });
    if (!approved) return;
    const next = removeTravelPreset(readWorldTravelPresets(), preset.id);
    await game.settings.set(MODULE_ID, TRAVEL_PRESET_SETTING, next);
    ui.notifications.info("Atlas travel preset deleted.");
    await this.render();
  }
}
