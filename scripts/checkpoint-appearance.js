/**
 * Optional checkpoint overlay styling. Null means the old purple GM dot.
 * Font Awesome Free 7 webfonts/catalog are bundled locally; no API calls.
 */
import { CHECKPOINT_FREE_ICONS } from "./checkpoint-icon-catalog.js";

export const CHECKPOINT_ICON_ROOT = "modules/fvtt-atlas-navigation/assets/checkpoint-icons/";
// Preserve old bare IDs: v0.2.21 Scene checkpoints still use the original SVGs.
export const CHECKPOINT_ICONS = Object.freeze([
  "location-dot", "flag", "house", "mountain", "anchor", "ship",
  "tree", "campground", "landmark", "water", "skull", "map-pin"
]);
const FREE_ICON_MAP = new Map(CHECKPOINT_FREE_ICONS.map(icon => [icon.id, icon]));
const FONT_FAMILIES = Object.freeze({
  solid: { family: "Atlas FA 7 Solid", weight: 900 },
  regular: { family: "Atlas FA 7 Regular", weight: 400 },
  brands: { family: "Atlas FA 7 Brands", weight: 400 }
});

/** Exact metadata-backed glyph; never render arbitrary markup or font names. */
export function checkpointFontIcon(id) {
  const match = FREE_ICON_MAP.get(id);
  if (!match) return null;
  const style = id.split(":", 1)[0];
  const font = FONT_FAMILIES[style];
  return { glyph: String.fromCodePoint(Number.parseInt(match.unicode, 16)),
    family: font.family, weight: font.weight };
}

export { CHECKPOINT_FREE_ICONS };

/** Search metadata locally. The editor renders only a small window of matches. */
export function findCheckpointIcons(query = "", style = "all") {
  const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return CHECKPOINT_FREE_ICONS.filter(icon =>
    (style === "all" || icon.id.startsWith(style + ":")) &&
    words.every(word => (icon.id + " " + icon.label + " " + icon.terms)
      .toLowerCase().includes(word)));
}
export const DEFAULT_CHECKPOINT_APPEARANCE = Object.freeze({
  type: "dot", icon: "location-dot", image: "",
  size: 24, color: "#9c7bf0", labelMode: "off",
  showRoadName: false, textColor: "#ffffff"
});

const KEYS = Object.keys(DEFAULT_CHECKPOINT_APPEARANCE);
const TYPES = ["dot", "fa", "image"];
const LABEL_MODES = ["off", "hover", "always"];

export function validateCheckpointAppearance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Checkpoint appearance must be an object.");
  }
  if (Object.keys(value).length !== KEYS.length ||
      Object.keys(value).some(key => !KEYS.includes(key))) {
    throw new Error("Checkpoint appearance has missing or unsupported fields.");
  }
  if (!TYPES.includes(value.type)) throw new Error("Unknown checkpoint icon type.");
  if (!CHECKPOINT_ICONS.includes(value.icon) && !FREE_ICON_MAP.has(value.icon)) {
    throw new Error("Unknown Font Awesome Free icon.");
  }
  if (typeof value.image !== "string" || value.image.length > 300 ||
      (value.image && (!/^[a-zA-Z0-9_/.\- ]+\.(png|jpe?g|webp|svg)$/i.test(value.image) ||
        value.image.startsWith("/") || value.image.split("/").includes("..")))) {
    throw new Error("Select a local Foundry image file (PNG, JPG, WebP or SVG).");
  }
  if (value.type === "image" && !value.image) {
    throw new Error("Choose an image using Foundry's File Picker.");
  }
  if (!Number.isInteger(value.size) || value.size < 12 || value.size > 64) {
    throw new Error("Checkpoint icon size must be 12–64 pixels.");
  }
  for (const [key, text] of [["color", "icon"], ["textColor", "label"]]) {
    if (typeof value[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value[key])) {
      throw new Error("Invalid checkpoint " + text + " color.");
    }
  }
  if (!LABEL_MODES.includes(value.labelMode)) {
    throw new Error("Checkpoint label mode must be Off, Hover or Always.");
  }
  if (typeof value.showRoadName !== "boolean") {
    throw new Error("Show Road Name must be true or false.");
  }
  return { ...value };
}

export function checkpointIconPath(value) {
  const appearance = value ? validateCheckpointAppearance(value) : DEFAULT_CHECKPOINT_APPEARANCE;
  if (appearance.type === "fa") {
    return CHECKPOINT_ICONS.includes(appearance.icon)
      ? CHECKPOINT_ICON_ROOT + appearance.icon + ".svg" : null;
  }
  return appearance.type === "image" ? appearance.image : null;
}

/** Visual offset only: stored node positions and native Region shapes never move. */
export function checkpointMarkerPosition(point, appearance) {
  return { x: point.x,
    y: point.y - (appearance.type === "dot" ? 0 : appearance.size / 2 + 8) };
}

export function resolveCheckpointAppearance(value) {
  return value ? validateCheckpointAppearance(value) : { ...DEFAULT_CHECKPOINT_APPEARANCE };
}
