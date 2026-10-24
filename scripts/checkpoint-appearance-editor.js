import { CHECKPOINT_ICONS, CHECKPOINT_ICON_ROOT,
  resolveCheckpointAppearance, validateCheckpointAppearance } from "./checkpoint-appearance.js";
import { readAtlas } from "./atlas-storage.js";
import { saveCheckpointAppearance } from "./road-storage.js";

const el = (tag, label) => {
  const item = document.createElement(tag);
  if (label !== undefined) item.textContent = label;
  return item;
};

/** Explicit GM editor. Icon choice and search never modify the Scene before Save. */
export class AtlasCheckpointAppearanceEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-checkpoint-appearance",
    window: { title: "Atlas — Checkpoint Icon & Label", resizable: true },
    position: { width: 590, height: 680 }
  };

  constructor({ scene, checkpointId, expectedRevision, onSaved }) {
    super();
    this.scene = scene;
    this.checkpointId = checkpointId;
    this.expectedRevision = expectedRevision;
    this.onSaved = onSaved;
  }

  async _renderHTML() {
    if (!game.user?.isGM || !this.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM with Scene update permission may style checkpoints.");
    }
    const current = readAtlas(this.scene).checkpoints?.find(c => c.id === this.checkpointId);
    if (!current) throw new Error("Checkpoint no longer exists.");
    const appearance = resolveCheckpointAppearance(current.appearance);
    const root = el("div");
    root.style.cssText = "padding:0.85rem;display:grid;gap:0.6rem;overflow:auto;height:100%;";
    root.appendChild(el("p", "CHECKPOINT OVERLAY — " + current.name +
      ". The icon and labels are Atlas graphics, not native Regions. " +
      "Existing checkpoints keep their original purple dot unless customized."));
    const fields = el("div");
    fields.style.cssText = "display:grid;gap:0.55rem;";
    const field = (title, control) => {
      const row = el("label");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:1rem;";
      row.append(el("span", title), control);
      control.style.maxWidth = "16rem";
      fields.appendChild(row);
      return control;
    };
    const select = (choices, value) => {
      const box = el("select");
      for (const [key, title] of choices) {
        const option = el("option", title);
        option.value = key;
        box.appendChild(option);
      }
      box.value = value;
      return box;
    };
    const type = field("Checkpoint marker", select([
      ["dot", "Default dot"], ["fa", "Font Awesome Free icon"],
      ["image", "Custom Foundry image"]
    ], appearance.type));
    const iconSection = el("fieldset");
    const legend = el("legend", "Font Awesome Free — searchable icon selection");
    iconSection.appendChild(legend);
    const search = el("input");
    search.type = "search";
    search.placeholder = "Filter icons (e.g. ship, house, flag)";
    search.setAttribute("aria-label", "Filter checkpoint icons");
    search.style.width = "100%";
    iconSection.appendChild(search);
    const grid = el("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:0.4rem;margin-top:0.5rem;";
    let selected = appearance.icon;
    const choices = new Map();
    for (const name of CHECKPOINT_ICONS) {
      const button = el("button");
      button.type = "button";
      button.title = name;
      button.setAttribute("aria-label", "Use " + name + " icon");
      button.style.cssText = "display:grid;justify-items:center;gap:0.25rem;padding:0.5rem;" +
        "border:2px solid transparent;min-height:69px;";
      const icon = el("img");
      icon.src = CHECKPOINT_ICON_ROOT + name + ".svg";
      icon.alt = "";
      icon.style.cssText = "width:25px;height:25px;filter:invert(0.4);";
      button.append(icon, el("small", name));
      button.addEventListener("click", () => {
        selected = name;
        for (const [id, item] of choices) {
          item.style.borderColor = id === selected ? "#8a70c6" : "transparent";
          item.setAttribute("aria-pressed", String(id === selected));
        }
      });
      choices.set(name, button);
      grid.appendChild(button);
    }
    iconSection.appendChild(grid);
    const filterIcons = () => {
      const term = search.value.trim().toLowerCase();
      for (const [name, button] of choices) {
        button.style.display = name.includes(term) ? "grid" : "none";
      }
    };
    search.addEventListener("input", filterIcons);
    choices.get(selected)?.click();
    root.appendChild(fields);
    root.appendChild(iconSection);
    const imageSection = el("div");
    imageSection.style.cssText = "display:flex;gap:0.4rem;align-items:center;";
    const image = el("input");
    image.type = "text"; image.value = appearance.image;
    image.placeholder = "worlds/…/checkpoint.webp";
    image.setAttribute("aria-label", "Custom image path");
    image.style.cssText = "flex:1;min-width:0;";
    const browse = el("button", "Browse…");
    browse.type = "button";
    browse.addEventListener("click", () => {
      const Picker = foundry.applications.apps?.FilePicker;
      if (!Picker) {
        ui.notifications.error("Foundry File Picker is unavailable.");
        return;
      }
      new Picker({ type: "image", callback: path => { image.value = path; } }).render(true);
    });
    imageSection.append(image, browse);
    root.appendChild(imageSection);
    const size = el("input");
    size.type = "number"; size.min = "12"; size.max = "64"; size.step = "1";
    size.value = String(appearance.size);
    field("Marker size (12–64 px)", size);
    const color = el("input");
    color.type = "color"; color.value = appearance.color;
    field("Dot / Font Awesome color", color);
    const mode = field("Checkpoint label", select([
      ["off", "Off"], ["hover", "On hover"], ["always", "Always"]
    ], appearance.labelMode));
    const showRoad = el("input");
    showRoad.type = "checkbox"; showRoad.checked = appearance.showRoadName;
    field("Include road name with label", showRoad);
    const textColor = el("input");
    textColor.type = "color"; textColor.value = appearance.textColor;
    field("Checkpoint / road label text color", textColor);
    const updateType = () => {
      iconSection.hidden = type.value !== "fa";
      imageSection.hidden = type.value !== "image";
    };
    type.addEventListener("change", updateType);
    updateType();
    const controls = el("div");
    controls.style.cssText = "display:flex;gap:0.5rem;justify-content:flex-end;";
    const reset = el("button", "Reset to default dot");
    reset.type = "button";
    reset.addEventListener("click", () => void saveValue(null));
    const cancel = el("button", "Cancel");
    cancel.type = "button"; cancel.addEventListener("click", () => this.close());
    const save = el("button", "Save Checkpoint Appearance");
    save.type = "button";
    const saveValue = async value => {
      if (save.disabled) return;
      save.disabled = true; reset.disabled = true;
      try {
        if (readAtlas(this.scene).revision !== this.expectedRevision) {
          throw new Error("Scene Atlas changed. Close and reopen this checkpoint editor.");
        }
        const next = value === null ? null : validateCheckpointAppearance({
          type: type.value, icon: selected, image: image.value.trim(),
          size: Number(size.value), color: color.value,
          labelMode: mode.value, showRoadName: showRoad.checked,
          textColor: textColor.value
        });
        await saveCheckpointAppearance(this.scene, {
          checkpointId: this.checkpointId, appearance: next,
          expectedRevision: this.expectedRevision
        });
        this.onSaved?.();
        await this.close();
        ui.notifications.info("Atlas checkpoint appearance saved.");
      } catch (error) {
        ui.notifications.error(error.message || String(error));
        save.disabled = false; reset.disabled = false;
      }
    };
    save.addEventListener("click", () => void saveValue(undefined));
    controls.append(reset, cancel, save);
    root.appendChild(controls);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}
