/**
 * Foundry v14 world-scoped Travel Preset configuration submenu.
 * No native Region Behavior is created or modified by this editor.
 */
import { MODULE_ID, readAtlas } from "./atlas-storage.js";
import { TRAVEL_PRESET_SETTING, REGION_TRAVEL_PRESET_FLAG, TRAVEL_TYPES,
  defaultTravelPresets, validateTravelPresets, upsertTravelPreset,
  removeTravelPreset, presetCostSummary, defaultTravelPresetColor } from "./travel-preset-model.js";
import { availableMovementActions, unavailableMovementActions } from "./native-movement-cost.js";

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
      "World presets share movement costs and native Region highlight colors across Scenes. Colors are used for new generated corridors; existing Region colors and Behaviors change only through separate GM actions. No override never blocks movement."));
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
        const swatch = node("span");
        swatch.style.cssText = "display:inline-block;width:1.25rem;height:1.25rem;" +
          "border:1px solid currentColor;border-radius:0.2rem;flex:0 0 auto;" +
          "background:" + preset.color + ";";
        swatch.title = "Native Region color " + preset.color;
        row.appendChild(swatch);
        const details = node("span", preset.name + " (" + preset.color + ")");
        details.style.flex = "1 1 12rem";
        row.appendChild(details);
        const cost = node("span", presetCostSummary(preset));
        cost.style.cssText = "font-variant-numeric:tabular-nums;flex:1 1 12rem;";
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
    container.appendChild(node("label", "Native Region highlight color"));
    const color = node("input");
    color.type = "color"; color.name = "presetColor";
    color.defaultValue = existing?.color ??
      defaultTravelPresetColor(existing?.id ?? "", existing?.mode ?? initialMode);
    container.appendChild(color);
    container.appendChild(node("p",
      "New generated corridors use this color. Editing a global preset never recolors existing Regions. Existing corridors offer an explicitly confirmed Apply Color action."));
    const originalCost = existing?.movementCostMultiplier ?? 1;
    const quarterStep = originalCost >= 0.25 &&
      Math.abs(originalCost * 4 - Math.round(originalCost * 4)) < 1e-8;
    if (quarterStep) {
      container.appendChild(node("label", "Suggested movement-cost multiplier (×0.25–×10.00)"));
      // Foundry v14's own range-picker includes a linked editable number box.
      // Set reflected HTML attributes: DialogV2.input serializes this subtree.
      const cost = node("range-picker");
      cost.setAttribute("name", "presetCost");
      cost.setAttribute("min", "0.25");
      cost.setAttribute("max", "10");
      cost.setAttribute("step", "0.25");
      cost.setAttribute("value", String(originalCost));
      container.appendChild(cost);
    } else {
      // Preserve older fractional preset suggestions such as ×1.10 or ×1.15.
      // Merely opening/editing their name must never snap existing World data.
      container.appendChild(node("label", "Existing custom movement-cost multiplier (0.10–10.00)"));
      const cost = node("input");
      cost.type = "number"; cost.step = "0.05"; cost.min = "0.1"; cost.max = "10";
      cost.required = true; cost.name = "presetCost";
      cost.defaultValue = String(originalCost);
      container.appendChild(cost);
      container.appendChild(node("p",
        "This older cost is not on a 0.25 step. It remains unchanged unless you edit it; " +
        "you can enter a compatible value such as ×1.00 or ×1.25, save, then reopen to use the slider."));
    }
    const perMode = existing?.movementCosts !== null && existing?.movementCosts !== undefined || !existing;
    const toggle = node("label");
    toggle.style.cssText = "display:flex;align-items:center;gap:0.4rem;margin-top:0.5rem;";
    const perModeCheckbox = node("input");
    perModeCheckbox.type = "checkbox"; perModeCheckbox.name = "atlasPerMode";
    perModeCheckbox.defaultChecked = perMode;
    toggle.append(perModeCheckbox, node("span", "Use per-movement costs (one native Behavior)"));
    container.appendChild(toggle);
    container.appendChild(node("p",
      "Checked: choose which movement actions this preset modifies. Unchecked: legacy single cost, with a movement action chosen later when applying. No override leaves an action untouched; it never prohibits travel."));
    const supported = availableMovementActions();
    const oldCosts = existing?.movementCosts ?? {};
    for (const action of supported) {
      const row = node("div");
      row.style.cssText = "display:grid;grid-template-columns:minmax(8rem,1fr) minmax(12rem,2fr);gap:0.5rem;align-items:center;";
      const entry = node("label");
      const checked = node("input");
      checked.type = "checkbox"; checked.name = "atlasAction_" + action.id;
      checked.defaultChecked = Object.hasOwn(oldCosts, action.id);
      entry.append(checked, node("span", " " +
        (game.i18n.localize(action.label) || action.label) + " (otherwise No override)"));
      row.appendChild(entry);
      const current = oldCosts[action.id] ?? 1;
      const quarterStep = current >= 0.25 &&
        Math.abs(current * 4 - Math.round(current * 4)) < 1e-8;
      if (quarterStep) {
        const slider = node("range-picker");
        slider.setAttribute("name", "atlasCost_" + action.id);
        slider.setAttribute("min", "0.25");
        slider.setAttribute("max", "10");
        slider.setAttribute("step", "0.25");
        slider.setAttribute("value", String(current));
        row.appendChild(slider);
      } else {
        // Preserve values authored under another system without snapping them.
        const numeric = node("input");
        numeric.type = "number"; numeric.name = "atlasCost_" + action.id;
        numeric.step = "any"; numeric.min = "0.1"; numeric.max = "10";
        numeric.defaultValue = String(current);
        row.appendChild(numeric);
      }
      container.appendChild(row);
    }
    const unavailable = unavailableMovementActions();
    if (unavailable.length) {
      container.appendChild(node("p", "System movement actions not independently configurable by Foundry's native Region Behavior: " +
        unavailable.map(action => game.i18n.localize(action.label) || action.label).join(", ") + "."));
    }
    if (!supported.length) container.appendChild(node("p",
      "No independently configurable movement actions are currently available. Save descriptive metadata or a legacy cost; native costs will remain unavailable."));
    const retained = Object.keys(oldCosts).filter(id => !supported.some(action => action.id === id));
    if (retained.length) container.appendChild(node("p",
      "Existing costs for currently unavailable movement actions (" + retained.join(", ") +
      ") will be preserved, but cannot be applied to this game's native Region Behaviors."));
    container.appendChild(node("p",
      "The sliders use quarter steps observed in Foundry v14, up to ×10. Other systems may impose different limits. Atlas validates the entire set in the native model before saving any Behavior. Editing presets never updates already-created Regions."));
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
    const selectedPerMode = result.atlasPerMode === "on" ||
      result.atlasPerMode === true;
    // Preserve configured actions hidden by the current system, including
    // those from other game systems. They remain unapplyable until supported.
    const movementCosts = selectedPerMode ? { ...(existing?.movementCosts ?? {}) } : null;
    if (selectedPerMode) {
      for (const action of supported) {
        if (result["atlasAction_" + action.id] === "on" ||
            result["atlasAction_" + action.id] === true) {
          const cost = Number(result["atlasCost_" + action.id]);
          if (!Number.isFinite(cost) || cost < 0.1 || cost > 10) {
            throw new Error("Choose a movement cost between ×0.10 and ×10.00 for " +
              action.id + ".");
          }
          movementCosts[action.id] = cost;
        } else delete movementCosts[action.id];
      }
    }
    const preset = {
      id: existing?.id ?? "custom-" + foundry.utils.randomID(16),
      mode: String(result.presetMode ?? ""),
      name: String(result.presetName ?? ""),
      movementCostMultiplier: Number(raw), movementCosts,
      color: String(result.presetColor ?? "")
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
