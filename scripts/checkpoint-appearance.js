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

/** Opt-in discoverability filters, not a restriction on saved icon identifiers. */
export const RPG_ICON_CATEGORIES = Object.freeze({
  settlements: ["house", "house-chimney", "city", "building", "church", "landmark", "castle", "fort-awesome", "dungeon", "archway", "tower-observation", "tent", "campground", "store", "shop", "hotel", "bridge", "monument", "place-of-worship", "mountain-city", "warehouse"],
  travel: ["route", "road", "map", "map-location", "map-location-dot", "map-pin", "location-dot", "compass", "signs-post", "person-walking", "person-hiking", "horse", "carriage", "ship", "sailboat", "anchor", "ferry", "boat", "train", "flag", "location-arrow", "footprints", "water", "bridge-water", "bridge", "cart-shopping"],
  nature: ["tree", "seedling", "leaf", "mountain", "mountain-sun", "hill-rockslide", "volcano", "water", "snowflake", "cloud", "cloud-sun", "sun", "moon", "wind", "tornado", "fire", "fish", "frog", "spider", "paw", "feather", "earth-americas", "earth-europe", "earth-asia", "bacterium", "icicles"],
  danger: ["skull", "skull-crossbones", "shield", "shield-halved", "swords", "hand-fist", "crosshairs", "bullseye", "bomb", "explosion", "radiation", "biohazard", "fire-flame-curved", "dragon", "ghost", "dice-d20", "person-falling", "triangle-exclamation", "dungeon", "lock", "key", "mask", "crow", "bolt"],
  magic: ["wand-magic", "wand-magic-sparkles", "hat-wizard", "star", "stars", "moon", "sun", "gem", "flask", "vial", "flask-vial", "book", "book-open", "scroll", "eye", "eye-low-vision", "hand-sparkles", "sparkles", "crystal-ball", "ring", "yin-yang", "atom", "meteor", "fire-flame-simple"],
  creatures: ["dragon", "horse", "otter", "cat", "dog", "wolf-pack-battalion", "dove", "crow", "spider", "frog", "fish", "fish-fins", "hippo", "horse-head", "paw", "feather", "locust", "bug", "person", "person-hiking", "user-ninja", "user-astronaut", "mask", "ghost"]
});
const RPG_ICON_SETS = Object.fromEntries(Object.entries(RPG_ICON_CATEGORIES)
  .map(([category, slugs]) => [category, new Set(slugs)]));
const RPG_ALL_SLUGS = new Set(Object.values(RPG_ICON_CATEGORIES).flat());

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
export function findCheckpointIcons(query = "", style = "all", category = "all") {
  if (category !== "all" && category !== "rpg" && !RPG_ICON_SETS[category]) return [];
  const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return CHECKPOINT_FREE_ICONS.filter(icon =>
    (style === "all" || icon.id.startsWith(style + ":")) &&
    (category === "all" || (icon.id.split(":", 1)[0] !== "brands" &&
      (category === "rpg" ? RPG_ALL_SLUGS : RPG_ICON_SETS[category])
        .has(icon.id.split(":")[1]))) &&
    words.every(word => (icon.id + " " + icon.label + " " + icon.terms)
      .toLowerCase().includes(word)));
}
export const DEFAULT_CHECKPOINT_APPEARANCE = Object.freeze({
  type: "dot", icon: "location-dot", image: "",
  size: 24, color: "#9c7bf0", borderColor: "#000000", labelMode: "off",
  showRoadName: false, textColor: "#ffffff"
});

const KEYS = Object.keys(DEFAULT_CHECKPOINT_APPEARANCE);
const TYPES = ["dot", "fa", "image"];
const LABEL_MODES = ["off", "hover", "always"];

export function validateCheckpointAppearance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Checkpoint appearance must be an object.");
  }
  // Existing v0.2.21–v0.2.28 checkpoint styles have no borderColor. Read
  // them unchanged; add the black default only when a GM explicitly saves.
  const normalized = { borderColor: "#000000", ...value };
  if (Object.keys(normalized).length !== KEYS.length ||
      Object.keys(normalized).some(key => !KEYS.includes(key))) {
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
  for (const [key, text] of [["color", "icon"], ["borderColor", "border"], ["textColor", "label"]]) {
    if (typeof normalized[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(normalized[key])) {
      throw new Error("Invalid checkpoint " + text + " color.");
    }
  }
  if (!LABEL_MODES.includes(value.labelMode)) {
    throw new Error("Checkpoint label mode must be Off, Hover or Always.");
  }
  if (typeof value.showRoadName !== "boolean") {
    throw new Error("Show Road Name must be true or false.");
  }
  return normalized;
}

export function checkpointIconPath(value) {
  const appearance = value ? validateCheckpointAppearance(value) : DEFAULT_CHECKPOINT_APPEARANCE;
  if (appearance.type === "fa") {
    return CHECKPOINT_ICONS.includes(appearance.icon)
      ? CHECKPOINT_ICON_ROOT + appearance.icon + ".svg" : null;
  }
  return appearance.type === "image" ? appearance.image : null;
}

/** Screen-clamped zoom behavior; never changes saved sizes or coordinates. */
export function checkpointCanvasSize(size, zoom = 1) {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const screenSize = Math.max(18, Math.min(56, size * Math.sqrt(scale)));
  return screenSize / scale;
}

/** Visual offset only: stored node positions and native Region shapes never move. */
export function checkpointMarkerPosition(point, appearance, zoom = 1) {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return { x: point.x,
    y: point.y - (appearance.type === "dot" ? 0 :
      checkpointCanvasSize(appearance.size, scale) / 2 + 8 / scale) };
}

export function resolveCheckpointAppearance(value) {
  return value ? validateCheckpointAppearance(value) : { ...DEFAULT_CHECKPOINT_APPEARANCE };
}
