import { readAtlas, saveAtlasSetup } from "./atlas-storage.js";
import { differsFromSceneGrid, readSceneGridScale } from "./scene-grid.js";

const label = key => game.i18n.localize(key);

function field(root, title, input, hintKey) {
  const group = document.createElement("div");
  group.className = "form-group";
  const heading = document.createElement("label");
  heading.textContent = title;
  heading.appendChild(input);
  group.appendChild(heading);
  if (hintKey) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = label(hintKey);
    group.appendChild(hint);
  }
  root.appendChild(group);
}

function paragraph(root, text, className = "") {
  const p = document.createElement("p");
  p.textContent = text;
  if (className) p.className = className;
  root.appendChild(p);
}

function buildContent(scene, atlas, error) {
  const root = document.createElement("div");
  if (!scene || error) {
    paragraph(root, error ?? label("FVTTATLAS.Atlas.NoScene"));
    return root;
  }

  const grid = readSceneGridScale(scene);
  paragraph(root, label("FVTTATLAS.Atlas.Introduction") + " " + scene.name);

  const enabled = document.createElement("input");
  enabled.name = "atlasEnabled";
  enabled.type = "checkbox";
  // DialogV2 serializes constructed HTMLElement to HTML: use attributes.
  if (atlas.enabled) enabled.setAttribute("checked", "");
  field(root, label("FVTTATLAS.Atlas.Enabled"), enabled, "FVTTATLAS.Atlas.EnabledHint");

  paragraph(root, label("FVTTATLAS.Atlas.Measurement"), "atlas-measurement-heading");
  if (grid) {
    paragraph(root,
      `${label("FVTTATLAS.Atlas.NativeGrid")}: ${grid.unitsPerSpace} ${grid.unit} /
      ${grid.pixelsPerSpace} px (≈ ${Number(grid.unitsPerPixel.toPrecision(7))} ${grid.unit}/px)`
        .replace(/\s+/g, " ").trim(),
      "hint");
  } else {
    paragraph(root, label("FVTTATLAS.Atlas.GridUnavailable"), "hint");
  }

  const source = document.createElement("select");
  source.name = "measurementSource";
  const initial = atlas.calibration || !grid ? "manual" : "scene-grid";
  for (const [value, key] of [
    ["scene-grid", "FVTTATLAS.Atlas.SourceGrid"],
    ["manual", "FVTTATLAS.Atlas.SourceManual"]
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.setAttribute("value", value);
    option.textContent = label(key);
    if (value === initial) option.setAttribute("selected", "");
    if (value === "scene-grid" && !grid) option.setAttribute("disabled", "");
    source.appendChild(option);
  }
  field(root, label("FVTTATLAS.Atlas.MeasurementSource"), source,
    "FVTTATLAS.Atlas.MeasurementSourceHint");

  const scale = document.createElement("input");
  scale.name = "unitsPerPixel";
  scale.type = "number";
  scale.min = "0";
  scale.step = "any";
  scale.placeholder = "0.05";
  scale.setAttribute("value", atlas.calibration ? String(atlas.calibration.unitsPerPixel) : "");
  field(root, label("FVTTATLAS.Atlas.UnitsPerPixel"), scale, "FVTTATLAS.Atlas.ManualScaleHint");

  const unit = document.createElement("input");
  unit.name = "unit";
  unit.type = "text";
  unit.maxLength = 12;
  unit.placeholder = "km";
  unit.setAttribute("value", atlas.calibration?.unit ?? grid?.unit ?? "");
  field(root, label("FVTTATLAS.Atlas.Unit"), unit, "FVTTATLAS.Atlas.ManualUnitHint");

  if (atlas.calibration && grid) {
    paragraph(root, label("FVTTATLAS.Atlas.SwitchToGridWarning"), "hint");
    if (differsFromSceneGrid(atlas.calibration, grid)) {
      paragraph(root, label("FVTTATLAS.Atlas.ScaleDifference"), "hint");
    }
  }
  paragraph(root, label("FVTTATLAS.Atlas.OneEditor"), "hint");
  return root;
}

/** Delay Foundry ApplicationV2 class access until the init hook. */
export function createAtlasSetupDialogClass(DialogV2) {
  return class AtlasSetupDialog extends DialogV2 {
    constructor(scene = globalThis.canvas?.scene ?? game.scenes?.viewed ?? null, onSaved) {
      let atlas;
      let error = null;
      try {
        atlas = readAtlas(scene);
      } catch (err) {
        error = err.message;
      }
      const content = buildContent(scene, atlas, error);
      const buttons = [{ action: "cancel", label: label("FVTTATLAS.Atlas.Cancel") }];

      if (scene && atlas && !error) {
        buttons.unshift({
          action: "save",
          label: label("FVTTATLAS.Atlas.Save"),
          default: true,
          callback: async (_event, button) => {
            try {
              const form = button.form;
              const enabled = form.elements.namedItem("atlasEnabled").checked;
              const source = form.elements.namedItem("measurementSource").value;
              let calibration;
              if (source === "scene-grid") {
                if (!readSceneGridScale(scene)) {
                  throw new Error(label("FVTTATLAS.Atlas.GridUnavailable"));
                }
                // Explicitly selecting Grid removes a prior v1 manual override.
                calibration = null;
              } else if (source === "manual") {
                const scaleText = form.elements.namedItem("unitsPerPixel").value.trim();
                calibration = scaleText === "" ? null : {
                  source: "manual",
                  unitsPerPixel: Number(scaleText),
                  unit: form.elements.namedItem("unit").value.trim()
                };
              } else {
                throw new Error("Unsupported Atlas measurement source");
              }

              await saveAtlasSetup(scene, {
                enabled,
                calibration,
                expectedRevision: atlas.revision
              });
              ui.notifications.info(label("FVTTATLAS.Atlas.Saved"), { permanent: true });
              if (typeof onSaved === "function") onSaved();
              return true;
            } catch (err) {
              ui.notifications.error(err.message);
              return false;
            }
          }
        });
      }

      super({ window: { title: label("FVTTATLAS.Atlas.MenuName") }, content, buttons });
    }
  };
}
