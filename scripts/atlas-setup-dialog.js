import { readAtlas, saveAtlasSetup } from "./atlas-storage.js";

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

function buildContent(scene, atlas, error) {
  const root = document.createElement("div");
  if (!scene || error) {
    const message = document.createElement("p");
    message.textContent = error ?? label("FVTTATLAS.Atlas.NoScene");
    root.appendChild(message);
    return root;
  }

  const introduction = document.createElement("p");
  introduction.textContent = label("FVTTATLAS.Atlas.Introduction") + " " + scene.name;
  root.appendChild(introduction);

  const enabled = document.createElement("input");
  enabled.name = "atlasEnabled";
  enabled.type = "checkbox";
  enabled.checked = atlas.enabled;
  field(root, label("FVTTATLAS.Atlas.Enabled"), enabled, "FVTTATLAS.Atlas.EnabledHint");

  const scale = document.createElement("input");
  scale.name = "unitsPerPixel";
  scale.type = "number";
  scale.min = "0";
  scale.step = "any";
  scale.placeholder = "0.05";
  scale.value = atlas.calibration ? String(atlas.calibration.unitsPerPixel) : "";
  field(root, label("FVTTATLAS.Atlas.UnitsPerPixel"), scale, "FVTTATLAS.Atlas.ScaleHint");

  const unit = document.createElement("input");
  unit.name = "unit";
  unit.type = "text";
  unit.maxLength = 12;
  unit.placeholder = "mi";
  unit.value = atlas.calibration?.unit ?? "mi";
  field(root, label("FVTTATLAS.Atlas.Unit"), unit, "FVTTATLAS.Atlas.UnitHint");

  const caution = document.createElement("p");
  caution.className = "hint";
  caution.textContent = label("FVTTATLAS.Atlas.OneEditor");
  root.appendChild(caution);
  return root;
}

/**
 * Factory delays access to Foundry's ApplicationV2 classes until the init hook.
 * The registered settings-menu type is a DialogV2 subclass, per the v14 API.
 */
export function createAtlasSetupDialogClass(DialogV2) {
  return class AtlasSetupDialog extends DialogV2 {
    constructor() {
      const scene = globalThis.canvas?.scene ?? game.scenes?.viewed ?? null;
      let atlas;
      let error = null;
      try {
        atlas = readAtlas(scene);
      } catch (err) {
        error = err.message;
      }
      const content = buildContent(scene, atlas, error);
      const buttons = [{
        action: "cancel",
        label: label("FVTTATLAS.Atlas.Cancel")
      }];
      if (scene && atlas && !error) {
        buttons.unshift({
          action: "save",
          label: label("FVTTATLAS.Atlas.Save"),
          default: true,
          callback: async (_event, button) => {
            try {
              const form = button.form;
              const enabled = form.elements.namedItem("atlasEnabled").checked;
              const scaleText = form.elements.namedItem("unitsPerPixel").value.trim();
              const calibration = scaleText === "" ? null : {
                source: "manual",
                unitsPerPixel: Number(scaleText),
                unit: form.elements.namedItem("unit").value.trim()
              };
              await saveAtlasSetup(scene, {
                enabled,
                calibration,
                expectedRevision: atlas.revision
              });
              ui.notifications.info(label("FVTTATLAS.Atlas.Saved"));
              return true;
            } catch (err) {
              ui.notifications.error(err.message);
              return false;
            }
          }
        });
      }
      super({
        window: { title: label("FVTTATLAS.Atlas.MenuName") },
        content,
        buttons
      });
    }
  };
}
