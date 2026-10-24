import { MODULE_ID } from "./atlas-storage.js";
import { DEFAULT_ROAD_APPEARANCE, ROAD_APPEARANCE_SETTING, readWorldRoadAppearance,
  ROAD_LINE_PATTERNS, ROAD_LABEL_VISIBILITY, validateRoadAppearance }
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
    row.appendChild(field);
    root.appendChild(row);
  };
  input("Road color", "atlasRoadColor", "color", current.color);
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
    width: Number(values.atlasRoadWidth),
    opacity: Number(values.atlasRoadOpacity),
    pattern: String(values.atlasRoadPattern ?? ""),
    labelVisibility: String(values.atlasRoadLabels ?? "")
  });
}

export class AtlasRoadAppearanceSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-road-appearance",
    window: { title: "Atlas Settings — Road Appearance Defaults", resizable: true },
    position: { width: 490, height: 440 }
  };

  async _renderHTML() {
    const root = element("div");
    root.style.cssText = "padding:1rem;display:grid;gap:0.75rem;overflow:auto;height:100%;";
    root.appendChild(element("p", "World defaults for named roads without a custom appearance. " +
      "These styles are visual only: no road geometry, native Regions, or movement costs change."));
    const form = roadAppearanceForm(readWorldRoadAppearance());
    form.dataset.atlasRoadAppearance = "";
    root.appendChild(form);
    const save = element("button", "Save Appearance Defaults");
    save.type = "button";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        if (!game.user?.isGM) throw new Error("Only a GM may edit road appearance defaults.");
        const values = Object.fromEntries([...form.querySelectorAll("[name]")]
          .map(field => [field.name, field.value]));
        await game.settings.set(MODULE_ID, ROAD_APPEARANCE_SETTING,
          roadAppearanceFromForm(values));
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
  game.settings.register(MODULE_ID, ROAD_APPEARANCE_SETTING, {
    name: "Atlas Road Appearance Defaults",
    hint: "Shared colors, line patterns and road-label preferences for all Scenes.",
    scope: "world", config: false, type: Object,
    default: { ...DEFAULT_ROAD_APPEARANCE }, onChange
  });
  game.settings.registerMenu(MODULE_ID, "atlasRoadAppearanceMenu", {
    name: "Atlas Appearance Defaults", label: "Configure Road Appearance",
    hint: "Edit World-wide named-road drawing defaults (not Region surface colors).",
    icon: "fa-solid fa-palette", type: AtlasRoadAppearanceSettings, restricted: true
  });
}
