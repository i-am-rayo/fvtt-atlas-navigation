import { MODULE_ID } from "./atlas-storage.js";
import { DEFAULT_WORLD_ROAD_APPEARANCE, ROAD_APPEARANCE_SETTING, readWorldRoadAppearance,
  ROAD_LINE_PATTERNS, ROAD_LABEL_VISIBILITY, ROAD_APPEARANCE_MODES,
  ROAD_CURVE_SETTING, ROAD_CURVE_PRESETS, DEFAULT_ROAD_CURVE_PRESET,
  validateRoadAppearance, validateWorldRoadAppearance }
  from "./road-appearance.js";

const element = (tag, value = "") => {
  const result = document.createElement(tag);
  if (value) result.textContent = value;
  return result;
};

/** Reused by the world editor and one-road override; plain DOM for DialogV2. */
export function roadAppearanceForm(appearance) {
  const current = validateRoadAppearance(appearance);
  const root = element("div");
  root.style.cssText = "display:grid;gap:0.65rem;min-width:0;";
  const input = (label, name, type, value, options = {}) => {
    const row = element("label");
    row.className = "form-group";
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:1rem;";
    row.appendChild(element("span", label));
    let field;
    if (type === "select") {
      field = element("select");
      for (const optionName of options.choices) {
        const option = element("option", optionName.charAt(0).toUpperCase() + optionName.slice(1));
        option.value = optionName;
        option.defaultSelected = optionName === value;
        field.appendChild(option);
      }
      field.value = value;
    } else {
      field = element("input");
      field.type = type;
      field.value = String(value);
      field.defaultValue = String(value);
      if (type === "number") {
        field.min = String(options.min); field.max = String(options.max);
        field.step = String(options.step);
      }
    }
    field.name = name;
    field.style.maxWidth = "13rem";
    if (type === "color") field.style.cssText = "width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
    if (name === "atlasRoadWidth" || name === "atlasRoadOpacity") {
      field.type = "range";
      field.style.width = "10rem";
      const wrap = element("div");
      wrap.style.cssText = "display:flex;align-items:center;gap:.35rem;";
      const output = element("output", name === "atlasRoadWidth" ? value + " px" : Math.round(value * 100) + "%");
      output.style.minWidth = "3rem";
      output.dataset.atlasRangeValue = name;
      wrap.append(field,output);
      row.appendChild(wrap);
    } else row.appendChild(field);
    root.appendChild(row);
  };
  input("Road color", "atlasRoadColor", "color", current.color);
  input("Road border color", "atlasRoadBorderColor", "color", current.borderColor);
  input("Road name text color", "atlasRoadTextColor", "color", current.textColor);
  input("Line width (px)", "atlasRoadWidth", "number", current.width,
    { min: 1, max: 16, step: 0.5 });
  input("Opacity", "atlasRoadOpacity", "number", current.opacity,
    { min: 0.1, max: 1, step: 0.05 });
  input("Line pattern", "atlasRoadPattern", "select", current.pattern,
    { choices: ROAD_LINE_PATTERNS });
  input("Road name labels", "atlasRoadLabels", "select", current.labelVisibility,
    { choices: ROAD_LABEL_VISIBILITY });
  return root;
}

export function roadAppearanceFromForm(values) {
  return validateRoadAppearance({
    color: String(values.atlasRoadColor ?? ""),
    borderColor: String(values.atlasRoadBorderColor ?? ""),
    textColor: String(values.atlasRoadTextColor ?? ""),
    width: Number(values.atlasRoadWidth),
    opacity: Number(values.atlasRoadOpacity),
    pattern: String(values.atlasRoadPattern ?? ""),
    labelVisibility: String(values.atlasRoadLabels ?? "")
  });
}

export class AtlasRoadAppearanceSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-road-appearance",
    window: { title: "Atlas — Road Overlay Appearance (Land / Air / Water)", resizable: true },
    position: { width: 560, height: 670 }
  };

  async _renderHTML() {
    const root = element("div");
    root.style.cssText = "padding:1rem;display:grid;gap:0.75rem;overflow:auto;height:100%;";
    root.appendChild(element("p", "ROAD OVERLAY APPEARANCE — Land, Air and Water " +
      "share category defaults across Scenes. A named road takes the category of its assigned " +
      "travel surface preset (or Land when unassigned). These visuals do not alter native " +
      "Region colors, geometry or movement costs."));
    const catalog = readWorldRoadAppearance();
    const forms = new Map();
    for (const mode of ROAD_APPEARANCE_MODES) {
      const fieldset = element("fieldset");
      const title = mode.charAt(0).toUpperCase() + mode.slice(1);
      const legend = element("legend", title + " Road Overlay");
      legend.style.fontWeight = "bold";
      fieldset.appendChild(legend);
      const form = roadAppearanceForm(catalog.profiles[mode]);
      form.dataset.atlasRoadAppearance = mode;
      form.style.padding = "0.5rem";
      fieldset.appendChild(form);
      root.appendChild(fieldset);
      forms.set(mode, form);
    }
    const save = element("button", "Save Appearance Defaults");
    save.type = "button";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        if (!game.user?.isGM) throw new Error("Only a GM may edit road appearance defaults.");
        const profiles = Object.fromEntries([...forms].map(([mode, form]) => {
          const values = Object.fromEntries([...form.querySelectorAll("[name]")]
            .map(field => [field.name, field.value]));
          return [mode, roadAppearanceFromForm(values)];
        }));
        await game.settings.set(MODULE_ID, ROAD_APPEARANCE_SETTING,
          validateWorldRoadAppearance({ schemaVersion: 2, profiles }));
        ui.notifications.info("Atlas world road appearance defaults saved.");
        this.close();
      } catch (error) {
        ui.notifications.error(error.message);
        save.disabled = false;
      }
    });
    root.appendChild(save);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}

export function registerWorldRoadAppearance(onChange = () => {}) {
  game.settings.register(MODULE_ID, ROAD_CURVE_SETTING, {
    name: "Atlas — Global Road Curvature",
    hint: "Visual-only smoothing for existing and new Land, Air and Water roads in all Scenes. " +
      "Off keeps straight segments; Strong is the default. Changes do not alter nodes, " +
      "distances, native Regions, or movement costs. Two-point roads remain straight.",
    scope: "world", config: true, type: String,
    choices: Object.fromEntries(Object.keys(ROAD_CURVE_PRESETS).map(preset =>
      [preset, preset.charAt(0).toUpperCase() + preset.slice(1)])),
    default: DEFAULT_ROAD_CURVE_PRESET, onChange
  });
  game.settings.register(MODULE_ID, ROAD_APPEARANCE_SETTING, {
    name: "Atlas Road Overlay Appearance Profiles",
    hint: "Land / Air / Water World-shared line and road-name styles; separate from native Regions.",
    scope: "world", config: false, type: Object,
    default: structuredClone(DEFAULT_WORLD_ROAD_APPEARANCE), onChange
  });
  game.settings.registerMenu(MODULE_ID, "atlasRoadAppearanceMenu", {
    name: "Atlas — Road Overlay Appearance", label: "Configure Land / Air / Water Road Styles",
    hint: "Atlas-drawn line and text colors only. Region surface colors and movement cost presets are separate.",
    icon: "fa-solid fa-palette", type: AtlasRoadAppearanceSettings, restricted: true
  });
}
