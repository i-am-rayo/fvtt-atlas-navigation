# Atlas 0.3.11-dev.20 — Milestone 01 painter-style canvas editors

**Owner issue:** Four annotations from live Foundry v14 screenshots on 2026-11-19. Cumulative on `0.3.11-dev.19`; previous dev.19 owner acceptance was **not** claimed. Milestone 01 and the draft v0.3.11 integration remain open.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-painter-canvas-editor-parity/module.json

## GM Foundry v14 visual and interaction acceptance

1. Open **Paint Territory**, note its reference: frameless dark bordered panel, `Atlas · …` heading, short purpose, readable progress, aligned two-column shortcut list, visible labeled Cancel / Preview & Save actions. Cancel the native Territory draft.
2. From Atlas Workshop, **draw a new Road**. The modeless `Atlas · Draw Road` panel should match that visual format, keep current Road name in its summary, and show working shortcut keys. Title dragging and arrow keys (focus title, Shift+arrow for 20px) move the *panel*, not Road points. Normal Scroll remains Foundry map zoom. Check narrow window / 200% UI scale and scrollbar accessibility.
3. **Edit an existing Road's control points** (especially a Road with a Map Marker attached). The `Atlas · Edit Road` panel shows Road identity, point count, dirty state, key gestures, Locate, Undo/Redo, Cancel, and an explicit **Save Points** action. Move panel while editing without modifying the point draft. Save edits through the existing revision-protected workflow only; Cancel or Esc must not save.
4. **Move a Road-connected Map Marker** via Road point editing. The same painter-style Road editor must remain; check junction/attachment behavior and Road/Map Marker identities after a legitimate saved move. Do not loosen native graph guards.
5. **Move an independent Map Marker.** The heading says `Atlas · Move Map Marker` and the app identifies as **Map Marker Editor**, *not* Road Editor. The panel matches Paint Territory's style and shortcuts. The only immediate action is Cancel/Locate; **no Save Points or Finish Road** button. Clicking the new map location must still trigger the existing GM confirmation and revision checks; decline/Cancel/Esc leaves the marker and Journal/history untouched.
6. Open **standalone Map Marker placement** and **Road junction** canvas authoring: headings, shortcut descriptions, canvas interactions, and Cancel remain appropriate. No Road Editor mislabel on independent marker placement.
7. While panel is open, test drag release, cancellation via Esc and close, redrawing canvas, switching Scenes, and restoring previously minimized Workspace. No extra listeners, lost noncommitted draft writes or double saves. At least one separate non-GM client must not access GM authoring or hidden metadata.

## Automated gates / release

- `npm run check`, `npm run architecture:check`, JavaScript syntax, and git patch whitespace; run `git diff --check` from an actual checkout when available.
- CI success proves code regression coverage **only**. Require Product Owner actual Foundry v14 GM and non-GM acceptance for this build before updating draft mainline PR #451 to a releasable final candidate.
- Do **not** merge, tag, publish, or close Milestone 01 merely on CI. Journey recovery #265/#135/#189/#224 is not implicated or fixed.
