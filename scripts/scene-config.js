import { readAtlas } from "./atlas-storage.js";
import { differsFromSceneGrid, readSceneGridScale, resolveAtlasScale } from "./scene-grid.js";

const TAB_ID = "atlas";
const ROOT_SELECTOR = "[data-fvtt-atlas-scene-root]";

/**
 * Extend Foundry v14's documented public TABS/PARTS configuration.
 * Do this once, before Scene Configuration is first rendered.
 * Do not override private SceneConfig handlers or core templates.
 */
export function registerAtlasSceneTab(SceneConfig) {
  const group = SceneConfig?.TABS?.sheet;
  const parts = SceneConfig?.PARTS;
  if (!group || !Array.isArray(group.tabs) || !parts) return false;
  if (group.tabs.some(tab => tab.id === TAB_ID)) return true;

  const tabs = [...group.tabs];
  const after = tabs.findIndex(tab => tab.id === "levels");
  tabs.splice(after < 0 ? tabs.length : after + 1, 0, {
    id: TAB_ID,
    icon: "fa-solid fa-route",
    label: "FVTTATLAS.Atlas.Tab"
  });

  const entries = Object.entries(parts);
  const footerIndex = entries.findIndex(([key]) => key === "footer");
  entries.splice(footerIndex < 0 ? entries.length : footerIndex, 0, [
    TAB_ID,
    {
      template: "modules/fvtt-atlas-navigation/templates/scene-atlas-tab.hbs",
      scrollable: [".scrollable"]
    }
  ]);

  SceneConfig.PARTS = Object.fromEntries(entries);
  SceneConfig.TABS = { ...SceneConfig.TABS, sheet: { ...group, tabs } };
  return true;
}

const label = key => game.i18n.localize(key);

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function format(value) {
  return Number(value.toPrecision(7)).toLocaleString(game.i18n.lang || "en");
}

function summary(scene, atlas) {
  const grid = readSceneGridScale(scene);
  const effective = resolveAtlasScale(scene, atlas);
  const section = node("section");
  section.setAttribute("data-fvtt-atlas-setup", "");

  section.appendChild(node("h3", label("FVTTATLAS.Atlas.Tab")));
  section.appendChild(node("p", atlas.enabled ?
    label("FVTTATLAS.Atlas.Active") : label("FVTTATLAS.Atlas.Inactive")));

  section.appendChild(node("h4", label("FVTTATLAS.Atlas.Measurement")));
  if (grid) {
    section.appendChild(node("p",
      `${label("FVTTATLAS.Atlas.NativeGrid")}: ${format(grid.unitsPerSpace)} ${grid.unit} /
      ${format(grid.pixelsPerSpace)} px (${format(grid.unitsPerPixel)} ${grid.unit}/px)`
        .replace(/\s+/g, " ").trim()));
  } else {
    section.appendChild(node("p", label("FVTTATLAS.Atlas.GridUnavailable"), "hint"));
  }

  if (effective) {
    const source = atlas.calibration ?
      label("FVTTATLAS.Atlas.SourceManual") : label("FVTTATLAS.Atlas.SourceGrid");
    section.appendChild(node("p",
      `${source}: ${format(effective.unitsPerPixel)} ${effective.unit}/px`));
  } else {
    section.appendChild(node("p", label("FVTTATLAS.Atlas.Uncalibrated"), "hint"));
  }

  if (differsFromSceneGrid(atlas.calibration, grid)) {
    section.appendChild(node("p", label("FVTTATLAS.Atlas.ScaleDifference"), "hint"));
  }
  section.appendChild(node("p", label("FVTTATLAS.Atlas.SceneGridSaveHint"), "hint"));
  return section;
}

/**
 * Populate the native Atlas tab. If a custom sheet does not expose our PART,
 * fall back to a form-group INSIDE its Grid/Misc tab, never above native tabs.
 * The control opens a separate DialogV2 so only our Scene flag is submitted.
 */
export function addAtlasSetupToSceneConfig(app, element, openAtlasSetup) {
  const scene = app?.document;
  if (!globalThis.game?.user?.isGM ||
      !scene?.id ||
      !scene?.canUserModify?.(game.user, "update")) return;

  const form = element?.matches?.("form") ? element : element?.querySelector?.("form");
  const nativeRoot = element?.querySelector?.(ROOT_SELECTOR);
  const fallback = !nativeRoot && (
    element?.querySelector?.('[data-tab="misc"]') ||
    element?.querySelector?.('[data-tab="grid"]') ||
    form
  );
  const target = nativeRoot || fallback;
  if (!target) return;

  const old = target.querySelector?.("[data-fvtt-atlas-setup]");
  if (old) old.remove();

  const panel = summary(scene, readAtlas(scene));
  const fields = node("div");
  fields.className = "form-fields";
  const button = node("button", label("FVTTATLAS.Atlas.SceneSettingsButton"));
  button.type = "button";
  button.addEventListener("click", async event => {
    event.preventDefault();
    try {
      await openAtlasSetup(scene, () => addAtlasSetupToSceneConfig(app, element, openAtlasSetup));
    } catch (error) {
      ui.notifications.error(error.message);
    }
  });
  fields.appendChild(button);
  panel.appendChild(fields);
  panel.appendChild(node("p", label("FVTTATLAS.Atlas.SceneSettingsHint"), "hint"));

  // The 2c/2d authoring lists will go into this native tab, not the dialog.
  target.appendChild(panel);
}
