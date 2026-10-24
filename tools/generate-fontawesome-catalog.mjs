/**
 * Rebuild the checkpoint icon catalog from Font Awesome Free's bundled
 * metadata/icon-families.json. Usage:
 * node tools/generate-fontawesome-catalog.mjs /path/to/icon-families.json
 * The matching Free 7.3.1 webfonts and license are vendored separately.
 */
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Pass the Font Awesome Free icon-families.json path.");
const source = JSON.parse(readFileSync(input, "utf8"));
const records = [];
for (const [slug, metadata] of Object.entries(source)) {
  const free = metadata.familyStylesByLicense?.free ?? [];
  for (const { family, style } of free) {
    if (family !== "classic" || !["solid", "regular", "brands"].includes(style)) continue;
    if (!/^[a-z0-9-]+$/.test(slug) || !/^[0-9a-f]{2,6}$/i.test(metadata.unicode)) continue;
    const terms = metadata.search?.terms ?? [];
    records.push([
      `${style}:${slug}`, metadata.label ?? slug, metadata.unicode,
      Array.isArray(terms) ? terms.join(" ") : ""
    ]);
  }
}
records.sort((a, b) => a[0].localeCompare(b[0]));
const output = `/* Generated from @fortawesome/fontawesome-free 7.3.1 (metadata/icon-families.json).
 * Icons: CC BY 4.0; Fonts: SIL OFL 1.1; metadata/code: MIT.
 * Copyright Fonticons, Inc. — see assets/checkpoint-icons/fonts/LICENSE.txt.
 * Regenerate with tools/generate-fontawesome-catalog.mjs.
 */
export const CHECKPOINT_FREE_ICONS = Object.freeze(${JSON.stringify(records).replaceAll('],[', '],\n  [')}
  .map(([id, label, unicode, terms]) => Object.freeze({ id, label, unicode, terms })));
`;
writeFileSync(new URL("../scripts/checkpoint-icon-catalog.js", import.meta.url), output);
console.log(`Wrote ${records.length} free style/icon choices.`);
