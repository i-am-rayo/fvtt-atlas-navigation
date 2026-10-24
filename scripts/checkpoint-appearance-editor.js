import { CHECKPOINT_ICONS, CHECKPOINT_ICON_ROOT, checkpointFontIcon,
  findCheckpointIcons,
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
    position: { width: 650, height: 700 }
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
    search.placeholder = "Search over 2,000 icons: bridge, ship, castle, cave…";
    search.setAttribute("aria-label", "Filter checkpoint icons");
    search.style.width = "100%";
    iconSection.appendChild(search);
    const styleFilter = select([
      ["all", "All Free icon styles"], ["solid", "Solid"],
      ["regular", "Regular"], ["brands", "Brands"]
    ], "all");
    styleFilter.setAttribute("aria-label", "Font Awesome icon style");
    styleFilter.style.cssText = "width:100%;margin-top:0.4rem;";
    iconSection.appendChild(styleFilter);
    const chosen = el("div");
    chosen.style.cssText = "display:flex;align-items:center;gap:0.5rem;margin:0.5rem 0;";
    iconSection.appendChild(chosen);
    const quickTitle = el("small", "Original quick picks (existing icons remain compatible)");
    iconSection.appendChild(quickTitle);
    const quick = el("div");
    quick.style.cssText = "display:flex;flex-wrap:wrap;gap:0.25rem;margin:0.3rem 0 0.6rem;";
    iconSection.appendChild(quick);
    const results = el("small");
    results.setAttribute("aria-live", "polite");
    iconSection.appendChild(results);
    const grid = el("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:0.35rem;margin-top:0.5rem;";
    let selected = appearance.icon;
    const choices = new Map();
    const fontGlyph = id => {
      const font = checkpointFontIcon(id);
      const glyph = el("span", font?.glyph ?? "?");
      glyph.style.cssText = "font-family:'" + font.family + "';font-weight:" + font.weight +
        ";font-size:24px;line-height:1.1;";
      glyph.setAttribute("aria-hidden", "true");
      return glyph;
    };
    const originalIcon = name => {
      const img = el("img");
      img.src = CHECKPOINT_ICON_ROOT + name + ".svg";
      img.alt = "";
      img.style.cssText = "width:24px;height:24px;";
      return img;
    };
    const syncSelection = () => {
      chosen.replaceChildren(el("strong", "Selected:"),
        CHECKPOINT_ICONS.includes(selected) ? originalIcon(selected) : fontGlyph(selected),
        el("span", selected));
      for (const [id, button] of choices) {
        button.style.borderColor = id === selected ? "#8a70c6" : "transparent";
        button.setAttribute("aria-pressed", String(id === selected));
      }
    };
    const iconButton = (id, label, glyph, compact = false) => {
      const button = el("button");
      button.type = "button";
      button.title = id + " — " + label;
      button.setAttribute("aria-label", "Use " + label + " checkpoint icon");
      button.style.cssText = "display:grid;justify-items:center;gap:0.2rem;padding:0.35rem;" +
        "border:2px solid transparent;min-height:" + (compact ? "42" : "69") + "px;";
      button.append(glyph);
      if (!compact) {
        const caption = el("small", label);
        caption.style.cssText = "max-width:100%;overflow-wrap:anywhere;line-height:1.15;";
        button.appendChild(caption);
      }
      button.addEventListener("click", () => {
        selected = id;
        syncSelection();
      });
      choices.set(id, button);
      return button;
    };
    for (const name of CHECKPOINT_ICONS) {
      quick.appendChild(iconButton(name, name, originalIcon(name), true));
    }
    iconSection.appendChild(grid);
    const more = el("button", "Show 60 more icons");
    more.type = "button";
    more.style.cssText = "display:block;margin:0.5rem auto;";
    iconSection.appendChild(more);
    let visible = 60;
    let matching = [];
    const renderIcons = (newSearch = false) => {
      if (newSearch) {
        visible = 60;
        matching = findCheckpointIcons(search.value, styleFilter.value);
      }
      for (const [id] of choices) if (!CHECKPOINT_ICONS.includes(id)) choices.delete(id);
      grid.replaceChildren();
      for (const item of matching.slice(0, visible)) {
        grid.appendChild(iconButton(item.id, item.label, fontGlyph(item.id)));
      }
      results.textContent = matching.length + " matching Free icons · showing " +
        Math.min(visible, matching.length) + ". Bundled locally; no API key needed.";
      more.hidden = visible >= matching.length;
      syncSelection();
    };
    search.addEventListener("input", () => renderIcons(true));
    styleFilter.addEventListener("change", () => renderIcons(true));
    more.addEventListener("click", () => { visible += 60; renderIcons(); });
    renderIcons(true);
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
    size.type = "range"; size.min = "12"; size.max = "64"; size.step = "1";
    size.value = String(appearance.size);
    const sizeControls = el("div");
    sizeControls.style.cssText = "display:flex;align-items:center;gap:0.6rem;flex:1;";
    size.style.width = "11rem";
    const sizeValue = el("output", appearance.size + " px");
    size.setAttribute("aria-label", "Checkpoint marker size in pixels");
    size.addEventListener("input", () => { sizeValue.textContent = size.value + " px"; });
    sizeControls.append(size, sizeValue);
    field("Marker size (12–64 px)", sizeControls);
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
