import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { readWorldRoadAppearance, resolveRoadAppearance,
  ROAD_APPEARANCE_MODES } from "./road-appearance.js";

const element = (tag, content) => {
  const item = document.createElement(tag);
  if (content !== undefined) item.textContent = content;
  return item;
};

/**
 * Modeless, transient authoring controls. No Scene write occurs until Finish;
 * closing the dock discards active road point/creation edits just like Cancel.
 */
export class AtlasRoadEditorDock extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-road-editor-dock",
    window: { title: "Atlas — Road Editor", resizable: true },
    position: { width: 360, height: 300 }
  };

  constructor({ scene, controller, sceneSheet, onFinish, onCancel, onClosed }) {
    super();
    this.scene = scene;
    this.controller = controller;
    this.sceneSheet = sceneSheet;
    this.onFinish = onFinish;
    this.onCancel = onCancel;
    this.onClosed = onClosed;
    this.finished = false;
    this.busy = false;
  }

  async _renderHTML() {
    if (!game.user?.isGM || !this.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may use the Atlas road editor.");
    }
    const draft = this.controller.getDraft(this.scene);
    if (!draft) throw new Error("The road-editing session ended.");
    const root = element("div");
    root.style.cssText = "padding:0.8rem;display:grid;gap:0.55rem;overflow:auto;height:100%;";
    const status = draft.mode === "points" ? "Edit points" :
      draft.mode === "new" ? "Draw road" :
      draft.mode === "checkpoint" ? "Place checkpoint" : "Add connection";
    root.appendChild(element("strong", status));
    root.appendChild(element("small", draft.mode === "points"
      ? `${draft.points} points · ${draft.dirty ? "Unsaved" : "No changes"}`
      : draft.mode === "checkpoint" ? "Click a road on the map."
      : draft.mode === "junction" ? "Click a road to connect."
      : `${draft.points} points · Click the map to draw.`));

    const row = (title, input) => {
      const wrapper = element("label");
      wrapper.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:0.5rem;";
      wrapper.append(element("span", title), input);
      input.style.maxWidth = "12.5rem";
      root.appendChild(wrapper);
      return input;
    };
    const dropdown = (options, current, changed) => {
      const select = element("select");
      for (const [value, label] of options) {
        const option = element("option", label);
        option.value = value;
        select.appendChild(option);
      }
      select.value = current;
      select.addEventListener("change", () => changed(select.value));
      return select;
    };

    if (draft.mode === "new") {
      const options = this.controller.getNewRoadOptions(this.scene);
      const presets = readWorldTravelPresets().presets;
      const current = presets.find(p => p.id === options.presetId);
      const mode = current?.mode ?? "land";
      const update = patch => this.controller.setNewRoadOptions(this.scene, patch);
      const name = element("input");
      name.type = "text";
      name.maxLength = 120;
      name.value = options.name;
      name.setAttribute("aria-label", "New road name");
      name.addEventListener("input", () => update({ name: name.value }));
      row("Road name", name);
      row("Road type", dropdown(ROAD_APPEARANCE_MODES.map(value => [value,
        value[0].toUpperCase() + value.slice(1)]), mode, selected => {
        const preset = presets.find(p => p.mode === selected);
        // Each named-road type derives from a real World travel preset.
        update({ presetId: preset?.id ?? null, appearance: null });
        void this.render(true);
      }));
      row("Surface preset", dropdown([
        ["", "None (Land fallback)"],
        ...presets.filter(p => p.mode === mode).map(p => [p.id, p.name])
      ], options.presetId ?? "", value => update({ presetId: value || null })));
      const custom = element("input");
      custom.type = "checkbox";
      custom.checked = options.appearance !== null;
      custom.addEventListener("change", () => {
        update({ appearance: custom.checked ? resolveRoadAppearance(null,
          readWorldRoadAppearance(), mode) : null });
        void this.render(true);
      });
      row("Override line appearance", custom);
      if (options.appearance) {
        const updateAppearance = changes => update({ appearance: {
          ...this.controller.getNewRoadOptions(this.scene).appearance, ...changes
        } });
        const color = element("input");
        color.type = "color";
        color.value = options.appearance.color;
        color.addEventListener("input", () => updateAppearance({ color: color.value }));
        row("Line color", color);
        row("Line type", dropdown([
          ["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]
        ], options.appearance.pattern, pattern => updateAppearance({ pattern })));
        const width = element("input");
        width.type = "range"; width.min = "1"; width.max = "16";
        width.step = "1"; width.value = String(options.appearance.width);
        const widthValue = element("output", options.appearance.width + " px");
        width.addEventListener("input", () => {
          widthValue.textContent = width.value + " px";
          updateAppearance({ width: Number(width.value) });
        });
        const control = element("div");
        control.style.cssText = "display:flex;align-items:center;gap:0.4rem;";
        control.append(width, widthValue);
        row("Line width", control);
        row("Road name label", dropdown([
          ["off", "Off"], ["hover", "On hover"], ["always", "Always"]
        ], options.appearance.labelVisibility,
        labelVisibility => updateAppearance({ labelVisibility })));
      }
      root.appendChild(element("small", "World appearance is inherited unless overridden. " +
        "Changing this draft does not alter existing roads or native Regions."));
    }

    const buttons = element("div");
    buttons.style.cssText = "display:flex;gap:0.35rem;justify-content:flex-end;flex-wrap:wrap;";
    const makeButton = (title, callback) => {
      const button = element("button", title);
      button.type = "button";
      button.addEventListener("click", () => void callback());
      buttons.appendChild(button);
      return button;
    };
    const needsSave = draft.mode === "new" || draft.mode === "points";
    const save = needsSave ? makeButton(draft.mode === "new" ? "Finish Road" : "Save Points", async () => {
      if (this.busy) return;
      this.busy = true;
      save.disabled = true;
      try {
        const successful = await this.onFinish();
        if (successful && !this.controller.getDraft(this.scene)) {
          this.finished = true;
          await this.close();
        }
      } catch (error) { ui.notifications.error(error.message || String(error)); }
      finally { this.busy = false; save.disabled = false; }
    }) : null;
    if (draft.mode === "points" && draft.canUndo) {
      makeButton("Undo", () => { this.controller.undo(); void this.render(true); });
    }
    makeButton("Cancel", async () => {
      if (this.busy) return;
      this.onCancel();
      this.finished = true;
      await this.close();
    });
    root.appendChild(buttons);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  _onClose(options) {
    super._onClose?.(options);
    if (!this.finished && this.controller.getDraft(this.scene)) this.onCancel();
    if (this.sceneSheet?.rendered) void this.sceneSheet.maximize?.();
    this.onClosed?.();
  }
}
