/**
 * Optional checkpoint overlay styling. Null means the old purple GM dot.
 * Font Awesome Free icons are bundled locally; this module makes no API calls.
 */
export const CHECKPOINT_ICON_ROOT = "modules/fvtt-atlas-navigation/assets/checkpoint-icons/";
export const CHECKPOINT_ICONS = Object.freeze([
  "location-dot", "flag", "house", "mountain", "anchor", "ship",
  "tree", "campground", "landmark", "water", "skull", "map-pin"
]);
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
  if (!CHECKPOINT_ICONS.includes(value.icon)) throw new Error("Unknown Font Awesome Free icon.");
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
  if (appearance.type === "fa") return CHECKPOINT_ICON_ROOT + appearance.icon + ".svg";
  return appearance.type === "image" ? appearance.image : null;
}

export function resolveCheckpointAppearance(value) {
  return value ? validateCheckpointAppearance(value) : { ...DEFAULT_CHECKPOINT_APPEARANCE };
}
