# Atlas 0.3.11-dev.1 — Legend Add (+) icon sizing

**Issue:** [#406](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/406) · **Milestone 01:** Atlas Workspace & UI/UX Stabilization · **Platform:** Foundry v14.

**Test manifest:** `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-406-legend-add-icon-sizing/module.json`

**Archive:** `https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-406-legend-add-icon-sizing.zip`

This build starts from **v0.3.10 main**, which already includes the owner-accepted dev.1–dev.3 improvements (#412, #409, #410). The next development version is **0.3.11-dev.1**, not a prerelease older than the accepted 0.3.10 mainline.

## What changed

The Add controls already used the shared `createSettingsIconButton` factory. Atlas's CSS already defines a 2rem target and a .8rem Font Awesome glyph. This patch **only makes the existing glyph size selector more specific inside native fieldset legends**, including the glyph pseudo-element, to prevent the Foundry legend context from enlarging + controls. No alternate icon helper, per-window pixel offsets, new dependency, data migration, or gameplay writer was added.

**Diagnosis limit:** A specific computed-style override has not been captured from the owner's Foundry session. The updated rule is a targeted compatibility hypothesis based on the current CSS cascade. Confirm real computed styles before calling the visual defect resolved.

## GM live acceptance — use a backed-up Foundry v14 World

1. Install this test manifest. Open a Scene and **Map Marker Settings → Transportation**; compare **Add Land Travel Method (+)** with the adjacent regular Atlas edit/settings icons.
2. Open a **Road Settings** window and compare **Add Map Marker (+)** and **Generate Region (+)** with nearby compact settings/Locate icons. They should share the same glyph weight, apparent dimensions and central alignment.
3. At normal text zoom and **200%** zoom, check that the **button target stays 2rem relative to root size**, the + glyph stays **.8rem**, the surrounding legend remains legible, and the buttons do not overflow the fieldset.
4. In browser developer tools, examine the native legend button and its nested `i`: `getComputedStyle(button).width`, `getComputedStyle(icon).fontSize`, and `getComputedStyle(icon,"::before").fontSize`. Compare with a regular Atlas action button in the same window; record actual values if any are different.
5. Confirm Add still opens its existing selection or preview flow, without creating a Map Marker, Region or transportation offer until the existing GM action is accepted. Check disabled buttons, tooltips, keyboard focus and accessible names.
6. Check as a non-GM that no GM-only authoring control becomes available. Atlas manual Fog, native Region Shapes/Behaviors, Road graph and Journey persistence must remain unchanged.

**Stop condition:** If the three glyphs are still oversized or the computed values differ, keep the PR in draft and report the rendered screenshot, the three measured style values, and the active Foundry theme. Do not add speculative `!important` overrides or broad root font-size changes.

## Automation

The existing `ui-action-button` DOM regression verifies the three labels, their shared accessible icon structure and the scoped CSS target/glyph rule. `npm run check`, `npm run architecture:check`, syntax and `git diff --check` are required before owner acceptance; passing CI does not prove the live CSS cascade.
