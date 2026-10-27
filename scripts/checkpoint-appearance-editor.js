import { CHECKPOINT_ICONS, CHECKPOINT_ICON_ROOT, CHECKPOINT_FREE_ICONS, checkpointFontIcon,
  findCheckpointIcons,
  resolveCheckpointAppearance, validateCheckpointAppearance } from "./checkpoint-appearance.js";
import { readAtlas } from "./atlas-storage.js";
import { readCheckpointDiscoveryMethods, checkpointDiscoveryMethod }
  from "./checkpoint-discovery-method.js";
import { saveCheckpointPresentation } from "./road-storage.js";
import { readPartyExploration, saveCheckpointKnowledge }
  from "./party-exploration-storage.js";
import { checkpointKnowledge, checkpointRevealRadiusCells }
  from "./party-exploration-model.js";

const el = (tag, label) => {
  const item = document.createElement(tag);
  if (label !== undefined) item.textContent = label;
  return item;
};
const ICON_DETAILS = new Map(CHECKPOINT_FREE_ICONS.map(icon => [icon.id, icon]));

/** Explicit GM editor. Icon choice and search never modify the Scene before Save. */
export class AtlasCheckpointAppearanceEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-checkpoint-appearance",
    window: { title: "Atlas — Checkpoint Settings", resizable: true },
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
    const exploration = readPartyExploration(this.scene);
    const discoveryMethods = readCheckpointDiscoveryMethods(this.scene);
    const root = el("div");
    root.style.cssText = "padding:0.85rem;display:grid;gap:0.6rem;overflow:auto;height:100%;";
    root.appendChild(el("p", "CHECKPOINT — " + current.name +
      ". Edit the name, elevation, appearance and " +
      (exploration.enabled ? "discovery status. " : "player visibility. ") +
      "The underlying graph point and native Regions never move."));
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
    const name = el("input");
    name.type = "text"; name.maxLength = 120; name.required = true; name.value = current.name;
    name.setAttribute("aria-label", "Checkpoint name");
    field("Checkpoint name", name);
    const elevation = el("input");
    elevation.type = "number"; elevation.step = "any";
    elevation.value = current.elevationMeters === null ? "" : String(current.elevationMeters);
    elevation.setAttribute("aria-label", "Checkpoint elevation in meters");
    field("Elevation (meters; optional)", elevation);
    const playerVisibility = el("input");
    playerVisibility.type = "checkbox";
    playerVisibility.checked = current.playerVisible === true;
    playerVisibility.setAttribute("aria-label", "Checkpoint visible to players");
    let discovery = null;
    let revealRadius = null;
    let discoveryMethod = null;
    if (exploration.enabled) {
      const state = checkpointKnowledge(exploration, this.checkpointId);
      discovery = field("Discovery status", select([
        ["unknown", "Undiscovered"],
        ["visited", "Seen / Visited"],
        ["lore", "Known through Lore"]
      ], state));
      discovery.setAttribute("aria-label", "Checkpoint discovery status");
      discoveryMethod = field("Discovery method", select([
        ["automatic", "Automatic — explorer proximity"],
        ["gm", "GM Only — manual reveal"],
        ["lore", "Lore Only — story discovery"]
      ], checkpointDiscoveryMethod(discoveryMethods,this.checkpointId)));
      fields.appendChild(el("small",
        "Automatic marks the checkpoint Seen/Visited when an explorer approaches. " +
        "GM Only and Lore Only never reveal through proximity; the GM sets its status " +
        "when appropriate. Journal-based lore triggers will be handled separately."));
      revealRadius = el("input");
      revealRadius.type = "number";
      revealRadius.min = "0"; revealRadius.max = "100"; revealRadius.step = "0.25";
      revealRadius.value = String(checkpointRevealRadiusCells(exploration, this.checkpointId));
      revealRadius.setAttribute("aria-label", "Checkpoint terrain reveal radius in grid cells");
      field("Terrain reveal radius (grid cells; 0 = none)", revealRadius);
      fields.appendChild(el("small",
        "Seen / Visited and Known through Lore reveal the checkpoint to players. " +
        "Road visibility remains independent."));
    } else {
      field("Visible to players (visual only)", playerVisibility);
      fields.appendChild(el("small",
        "Player visibility does not hide Scene flag data from technical inspection. " +
        "This checkpoint can be shown even if its road remains hidden."));
    }
    const type = field("Checkpoint marker", select([
      ["dot", "Default dot"], ["fa", "Font Awesome Free icon"],
      ["image", "Custom Foundry image"]
    ], appearance.type));
    const iconSection = el("fieldset");
    iconSection.style.cssText = "min-width:0;padding:0.6rem;border:1px solid var(--color-border-light-tertiary,#666);";
    const legend = el("legend", "ICON LIBRARY — browse, filter & preview");
    iconSection.appendChild(legend);
    const browser = el("div");
    browser.style.cssText = "display:grid;grid-template-columns: minmax(180px,1fr) minmax(280px,2fr);gap:0.8rem;min-width:0;align-items:start;";
    const sidebar = el("div");
    sidebar.style.cssText = "display:grid;gap:0.5rem;min-width:0;";
    const gallery = el("div");
    gallery.style.cssText = "display:grid;gap:0.45rem;min-width:0;";
    browser.append(sidebar, gallery);
    iconSection.appendChild(browser);
    const search = el("input");
    search.type = "search";
    search.placeholder = "Search fantasy icons: bridge, ship, castle, cave…";
    search.setAttribute("aria-label", "Filter checkpoint icons");
    search.style.width = "100%";
    sidebar.appendChild(el("strong", "Search"));
    sidebar.appendChild(search);
    const categoryFilter = select([
      ["rpg", "RPG & fantasy (recommended)"],
      ["settlements", "Settlements & structures"],
      ["travel", "Roads & travel"],
      ["nature", "Nature & terrain"],
      ["danger", "Combat & danger"],
      ["magic", "Magic & mystery"],
      ["creatures", "Characters & creatures"],
      ["all", "Advanced — all icons, including modern brands"]
    ], "rpg");
    categoryFilter.setAttribute("aria-label", "RPG icon category");
    categoryFilter.style.cssText = "width:100%;margin-top:0.4rem;";
    sidebar.appendChild(el("small", "Theme / category"));
    sidebar.appendChild(categoryFilter);
    const styleFilter = select([
      ["all", "All Free icon styles"], ["solid", "Solid"],
      ["regular", "Regular"], ["brands", "Brands"]
    ], "all");
    styleFilter.setAttribute("aria-label", "Font Awesome icon style");
    styleFilter.style.cssText = "width:100%;margin-top:0.4rem;";
    sidebar.appendChild(el("small", "Icon style"));
    sidebar.appendChild(styleFilter);
    const preview = el("section");
    preview.style.cssText = "display:grid;justify-items:center;gap:0.3rem;padding:0.65rem;" +
      "border:1px solid #8a70c6;border-radius:0.5rem;min-width:0;";
    preview.setAttribute("aria-label", "Selected icon preview");
    const previewImage = el("div");
    previewImage.style.cssText = "height:56px;min-width:56px;display:grid;place-items:center;";
    const previewName = el("strong");
    const previewDetails = el("small");
    previewDetails.style.cssText = "text-align:center;overflow-wrap:anywhere;";
    preview.append(previewImage, previewName, previewDetails);
    sidebar.appendChild(preview);
    const chosen = el("div");
    chosen.style.cssText = "display:flex;align-items:center;gap:0.5rem;margin:0.5rem 0;";
    sidebar.appendChild(chosen);
    const tabs = el("div");
    tabs.style.cssText = "display:flex;gap:0.25rem;flex-wrap:wrap;";
    const categoryTabs = [
      ["rpg", "RPG picks"], ["settlements", "Places"], ["travel", "Travel"],
      ["nature", "Nature"], ["danger", "Danger"], ["magic", "Magic"],
      ["creatures", "Creatures"], ["all", "All / Advanced"]
    ];
    const tabButtons = [];
    for (const [id, name] of categoryTabs) {
      const tab = el("button", name);
      tab.type = "button";
      tab.setAttribute("aria-label", `Browse ${name} checkpoint icons`);
      tab.style.cssText = "padding:0.25rem 0.45rem;border-radius:0.35rem;";
      tab.addEventListener("click", () => {
        categoryFilter.value = id;
        renderIcons(true);
      });
      tabButtons.push([id, tab]);
      tabs.appendChild(tab);
    }
    gallery.appendChild(tabs);
    const quickTitle = el("small", "Original quick picks (existing icons remain compatible)");
    gallery.appendChild(quickTitle);
    const quick = el("div");
    quick.style.cssText = "display:flex;flex-wrap:wrap;gap:0.25rem;margin:0.3rem 0 0.6rem;";
    gallery.appendChild(quick);
    const results = el("small");
    results.setAttribute("aria-live", "polite");
    gallery.appendChild(results);
    const grid = el("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));" +
      "gap:0.35rem;max-height:325px;overflow-y:auto;padding:0.2rem;";
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
      const details = ICON_DETAILS.get(selected);
      const largeGlyph = CHECKPOINT_ICONS.includes(selected)
        ? originalIcon(selected) : fontGlyph(selected);
      largeGlyph.style.fontSize = "46px";
      if (CHECKPOINT_ICONS.includes(selected)) {
        largeGlyph.style.width = "44px";
        largeGlyph.style.height = "44px";
      }
      previewImage.replaceChildren(largeGlyph);
      previewName.textContent = details?.label ?? selected;
      previewDetails.textContent = (details
        ? `${selected.split(":")[0]} · ${details.terms || "Font Awesome Free"}`
        : "Classic Atlas icon · existing save compatible");
      chosen.replaceChildren(el("strong", "Selected:"),
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
    gallery.appendChild(grid);
    const pageSize = 36;
    const more = el("button", "Show 36 more icons");
    more.type = "button";
    more.style.cssText = "display:block;margin:0.5rem auto;";
    gallery.appendChild(more);
    let visible = pageSize;
    let matching = [];
    const renderIcons = (newSearch = false) => {
      if (newSearch) {
        visible = pageSize;
        matching = findCheckpointIcons(search.value, styleFilter.value,
          categoryFilter.value);
      }
      for (const [id] of choices) if (!CHECKPOINT_ICONS.includes(id)) choices.delete(id);
      grid.replaceChildren();
      for (const item of matching.slice(0, visible)) {
        grid.appendChild(iconButton(item.id, item.label, fontGlyph(item.id)));
      }
      results.textContent = matching.length + " matching Free icons · showing " +
        Math.min(visible, matching.length) + ". Bundled locally; no API key needed.";
      if (!matching.length) results.textContent += " Try another category or Advanced.";
      for (const [id, tab] of tabButtons) {
        tab.style.borderColor = id === categoryFilter.value ? "#9c7bf0" : "transparent";
        tab.setAttribute("aria-pressed", String(id === categoryFilter.value));
      }
      more.hidden = visible >= matching.length;
      syncSelection();
    };
    search.addEventListener("input", () => renderIcons(true));
    categoryFilter.addEventListener("change", () => renderIcons(true));
    styleFilter.addEventListener("change", () => renderIcons(true));
    more.addEventListener("click", () => { visible += pageSize; renderIcons(); });
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
    const borderColor = el("input");
    borderColor.type = "color"; borderColor.value = appearance.borderColor;
    field("Checkpoint border color", borderColor);
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
    const save = el("button", "Save Checkpoint Settings");
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
          borderColor: borderColor.value,
          labelMode: mode.value, showRoadName: showRoad.checked,
          textColor: textColor.value
        });
        const raw = elevation.value.trim();
        if (discovery && JSON.stringify(readPartyExploration(this.scene)) !==
            JSON.stringify(exploration)) {
          throw new Error("Party discovery changed. Reopen checkpoint settings.");
        }
        await saveCheckpointPresentation(this.scene, {
          checkpointId: this.checkpointId, name: name.value,
          elevationMeters: raw === "" ? null : Number(raw),
          playerVisible: playerVisibility.checked, appearance: next,
          expectedRevision: this.expectedRevision
        });
        if (discovery && (discovery.value !==
            checkpointKnowledge(exploration, this.checkpointId) ||
            Number(revealRadius.value) !==
              checkpointRevealRadiusCells(exploration, this.checkpointId) ||
            discoveryMethod.value !==
              checkpointDiscoveryMethod(discoveryMethods,this.checkpointId))) {
          await saveCheckpointKnowledge(this.scene, {
            checkpointId: this.checkpointId, knowledge: discovery.value,
            revealRadiusCells: Number(revealRadius.value),
            expected: exploration,
            method: discoveryMethod.value, expectedMethods: discoveryMethods
          });
        }
        this.onSaved?.();
        await this.close();
        ui.notifications.info("Atlas checkpoint settings saved.");
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
