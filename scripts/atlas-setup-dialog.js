import { readAtlas, saveAtlasSetup } from "./atlas-storage.js";
import { readSceneGridScale } from "./scene-grid.js";

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
      `${label("FVTTATLAS.Atlas.NativeGrid")}: ${grid.unitsPerSpace} ${grid.unit} / ${grid.pixelsPerSpace} px`,
      "hint");
  } else {
    paragraph(root, label("FVTTATLAS.Atlas.GridUnavailable"), "hint");
  }

  paragraph(root, label("FVTTATLAS.Atlas.NativeOnly"), "hint");
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
              await saveAtlasSetup(scene, {
                enabled,
                expectedRevision: atlas.revision
              });
              ui.notifications.info(label("FVTTATLAS.Atlas.Saved"), { permanent: true });
              try {
                if (typeof onSaved === "function") onSaved();
              } catch (refreshError) {
                // The flag was saved already: a sheet refresh failure must not
                // present the successful persistence as a failed save.
                console.warn("[fvtt-atlas-navigation] Could not refresh Atlas tab", refreshError);
              }
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
