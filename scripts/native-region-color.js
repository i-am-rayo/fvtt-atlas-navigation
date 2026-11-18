/** Native Foundry Region Appearance color is authoritative for every Atlas view.
 * Resolve documented CSS hex strings and Foundry's number-backed Color values;
 * unknown values must never be silently shown as a different Region color. */
export function nativeRegionColorHex(value) {
  if (typeof value === "number" || value instanceof Number) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 && number <= 0xffffff ?
      `#${number.toString(16).padStart(6, "0")}` : null;
  }
  if (value && typeof value === "object") {
    try {
      const html = value.toHTML?.();
      if (typeof html === "string") return nativeRegionColorHex(html);
      const numeric = value.valueOf?.();
      if (typeof numeric === "number") return nativeRegionColorHex(numeric);
    } catch { return null; }
    return null;
  }
  if (typeof value !== "string") return null;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value))
    return `#${[...value.slice(1)].map(n => n+n).join("").toLowerCase()}`;
  // Some Foundry ColorField inputs are expressed as 0xRRGGBB.
  if (/^0x[0-9a-f]{6}$/i.test(value)) return `#${value.slice(2).toLowerCase()}`;
  // ColorField may expose an otherwise-equivalent CSS RGB serialization.
  const rgb=/^rgb\(\s*(\d{1,3})\s*(?:,\s*|\s+)(\d{1,3})\s*(?:,\s*|\s+)(\d{1,3})\s*\)$/i.exec(value);
  if(rgb){
    const channels=rgb.slice(1).map(Number);
    if(channels.every(n=>n>=0&&n<=255))
      return `#${channels.map(n=>n.toString(16).padStart(2,"0")).join("")}`;
  }
  return null;
}

export function nativeRegionColorNumber(value) {
  const hex = nativeRegionColorHex(value);
  return hex === null ? null : Number.parseInt(hex.slice(1), 16);
}
