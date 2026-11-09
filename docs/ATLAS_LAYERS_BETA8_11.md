# v0.3.9-beta.8.11 — Atlas Layers and Territory painting previews

## Scope and owner live report

The owner confirms the preceding Territory authoring and native Region outlines work in Foundry v14 build 370, but identified four presentation problems:

1. Turning on Region labels printed `[object Object]` on the canvas.
2. Road View / Corridor View and Territory Map View were separate, transient controls.
3. A multi-ring grid/hex brush gave no hover indication of the cells to add or erase.
4. Continent borders had no translucent map fill.

## Design and ownership

**All UI state is presentation-only.** A new client-scope, versioned Atlas Layers setting stores Road mode, Region mode, name visibility and independent continent/settlement fill opacity. The GM-only `Atlas Layers` toolbar action opens a modeless ApplicationV2 palette. The Territory workspace remains an always-selectable, settlement-first native Region directory; it no longer owns a competing canvas overlay or its own temporary view settings.

Road layers:

- **Road View:** authored Road appearance.
- **Terrain View:** existing highest-priority surface/preset coloring of Road spans (the former Corridor toggle's rendering behavior).
- **Corridor View:** authored Road lines with native Atlas-generated corridor Region outlines and subtle fills, read without regeneration.

Region layers:

- **Hidden / Continents / Settlements / All Regions** select classified Atlas-linked native Regions. Continent and settlement groups have independent zero-to-50-percent opacity controls. All Regions draws continents before settlements. Native-only unclassified Regions remain accessible in the Territory directory.
- All GM overlays draw in Foundry's `canvas.interface` group above fog and are noninteractive. Native `RegionDocument.polygons` supply absolute outline paths, and its public `triangulation` supplies clipped triangle fill geometry; this preserves disjoint islands and holes without generating synthetic polygons. Missing/invalid/excessive triangulation safely omits fill while retaining outlines.
- Labels pass the actual Region name string into Foundry's `PIXI.Text(text, style)` signature, and remain constant screen size across canvas zoom.

Grid/hex painting:

- The editor derives the hover footprint from the same native grid adjacency/ring offsets and Scene-bounds filtering as the actual paint action.
- Light cyan outlines show cells to **Add**, coral outlines cells to **Erase**; a dark halo keeps them visible through fog. The caption counts affected cells before clicking. Radius/brush changes redraw the footprint immediately.
- Hover and pointer exit perform **no draft or Region writes**; clicking/dragging edits only the draft, and existing staged Save, Undo, Cancel and confirmation rules remain in force. All listeners and PIXI resources are cleaned on Cancel/Save.

## Non-goals and safeguards

- No conversion of drawn native Regions to grid/hex shapes, no automatic hierarchy overrides, no changes to native Region Behaviors, Elevation, visibility, IDs or Atlas links.
- No player-visible overlay or disclosure of hidden Region names. Client-scope settings persist for the **current browser/client**, not across browsers or users.
- Existing Roads, checkpoints, fog, journeys, World time and Journals are untouched. An invalid settings payload fails closed instead of rewriting it on read.
- The native Region triangulation draw budget is capped; very large/invalid Regions retain outlines but may not receive fill. Further optimization is contingent on real build 370 performance observations.

## Foundry v14 owner acceptance checklist

1. On the Paedor Scene, open **Atlas Layers** using the former Road/Corridor toolbar icon. Switch **Road View → Terrain View → Corridor View**. Confirm authored Road colors, surface colors, and generated corridor native boundaries respectively; verify none of these changes modifies the Road/Region document properties.
2. Switch Regions through **Continents → Settlements → All Regions → Hidden**. Confirm that All Regions shows nested settlements above continent color fills, and that native Regions remain selectable in the Territory workspace even when the GM overlay is hidden.
3. Enable **Show Region names**. Confirm the actual labels (e.g. `Valecor`, `Dirwest`, `Hearth's Heart`) appear rather than `[object Object]`; zoom, pan, refresh the canvas, and reopen the Scene. Confirm labels remain correctly located and scaled.
4. Set continent fill to 35% and settlement fill to 15%. Verify native boundary colors are respected, native holes stay hollow, and disconnected islands do not become a giant connecting polygon. Move the fill sliders back to 0% and verify only outlines remain.
5. Close Atlas Layers; reload Foundry. Reopen and verify Road/Region mode, name preference and fill opacity remain. Repeat in a second Scene to confirm these are client-wide presentation preferences.
6. On a copied native hex/grid Territory, start a paint draft. Hover with 0, 2, 3 and 4 brush rings; inspect highlighted Add cells, switch to Erase and inspect Erase cells. Confirm edges clip to Scene bounds. Clicking must affect exactly the previewed cells; Undo restores the draft; Cancel leaves the native Region untouched. Also test `Preview & Save` with explicit GM confirmation.
7. Test with fog enabled, canvas refresh, changing Scenes and an active/paused journey. Verify overlay resources clean up and no movement, Journal, rest, funds or World-time events are triggered by Atlas Layers or hover.
8. With a non-GM client, confirm the Atlas Layers authoring tool is absent, Region names/continent outlines do not leak, and existing player-visible Roads/checkpoints/fog remain unchanged.

Stop and report the affected Region ID, shape type, native `triangulation` availability, canvas zoom and console stack if a fill fails or lags. Do not regenerate or overwrite a native Region merely to correct preview rendering.

## Verification

- Focused unit/DOM/canvas tests cover native label construction, native fill triangulation and limits, versioned preference storage, palette controls and recovery, GM authorization, lifecycle, hover footprint, and staged authoring.
- `npm run check`: **826/826** tests passed, including syntax checks.
- `npm run architecture:check`: **4/4** tests passed; **175** imports scanned, **0** cyclic groups, **0** missing targets.
- `git diff --check`: passed.
- Actual Foundry v14 build 370 GM/non-GM live acceptance **pending**. Automated success does not substitute for the owner's live test.
