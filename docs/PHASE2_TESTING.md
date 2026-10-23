# Phase 2c — v0.2.5 GM smoke test: image anchoring, junctions, bend edits

**Status (October 23, 2026):** Automated model and UI checks are prepared; **this specific 0.2.5 build has not yet been verified inside Foundry v14**. The owner previously verified 0.2.4 save/reload, rename/delete and Scene isolation.

**Use a backed-up/disposable v14 world, ideally with a second Scene.** The development manifest remains:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

Go to Setup → Add-on Modules → Check for Updates and confirm **0.2.5**, then refresh the world.

## Important: one-time migration of existing Roads

Roads created with 0.2.4 use **schema v1**, whose node coordinates refer to the entire padded canvas. New Roads use **schema v2**, anchored to the background image. Atlas deliberately never guesses the original padding of a legacy road:

1. In the Scene Grid/Basics settings, restore the **padding where old roads visibly line up** with the map. The owner reported **0.00 for Paedor**.
2. Open that Scene on the canvas and its **Scene Configuration → Atlas** tab.
3. Check the actual overlay against the background. Click **Anchor legacy roads to map image**, read the warning, and confirm.
4. At this exact moment, the roads should **not visibly jump**. Their stored node IDs, names, connectivity, and revision history stay intact; the version increases and revision increments.
5. Save Scene padding as **0.05**, reopen Atlas, and confirm the roads remain on the same geographical features. Change back to **0.00** to retest. The stored v2 coordinates should not drift.
6. Repeat per Scene only if it contains legacy roads; new Scenes need no migration. A GM can still rename/delete legacy roads without anchoring, but adding or reshaping a populated v1 network is blocked for safety.

**Caution:** If legacy roads currently appear misaligned, do **not** anchor yet. Restore the matching padding or restore a backup first. Migration is not automatically reversible in the UI. Foundry core Scene Grid remains the only source of distance units and ruler measurements.

## New road junction test

1. Choose an existing road with a clear interior straight section, preferably far from endpoints.
2. Click **Roads [+]**. Make the **first point** land on the middle of that saved road, then choose a faraway endpoint.
3. Finish Road. The old road should now appear as **two pieces with its old name**, and the new road shares their new stable junction. This is an intentional split of one segment, not a cosmetic overlay connection.
4. Also connect exactly at an existing bend; it should create a real junction.
5. To test a disconnected crossing, start a new road near an existing road and **hold Alt on the first endpoint**. Cross a road elsewhere: there should be no automatic graph connection at the crossing.
6. Refresh the world and confirm all saved segments and junctions persist. If the old road was split, note that the two named pieces can subsequently be edited individually.

## Bend redraw and highlight test

1. Click the new **Redraw road bends** action in any road row.
2. Click new intermediate points between its two original fixed junctions. Choose **Save Bends**. A straight route is created if you save with no intermediate bends.
3. Confirm the road's stable endpoints and other road connections are unchanged; reload and inspect again.
4. Highlight a road. Close Scene Configuration. The temporary highlighted state should clear while the normal GM overlay remains. Closing mid-draft should cancel pending unsaved points and remove pointer/key listeners.
5. Switch Scenes during editing: no ghost draft or old Scene road network should appear in the new Scene.

## Still deferred

Road color/solid-dashed-dotted style, labels, hover name/length, smoothing, path visibility, direct context menu and draggable handles, dedicated Waypoints manager, native Region integration, shortest-path routing, and player visibility remain future milestones. Do not mistake the PIXI road path length for Foundry's native ruler distance.

---

## Archived v0.2.4 owner test and previous checks


**Status (October 23, 2026):** The owner completed an initial Foundry v14 GM test of **0.2.4**. Road creation, rename/delete, reload persistence, independent Scene networks, and road highlight **passed**. Changing Scene padding 0.00 → 0.05 displaced the saved road overlay relative to the background; changing it back realigned roads. Creating a connection at an existing road's interior **did not** work (the code only snaps to nearby junction nodes). Highlight persists after leaving Scene Configuration. These are tracked Phase 2c follow-ups, not accepted functionality. Foundry's experimental VFX warning seen earlier is unrelated to Atlas VFX usage.

## Update from the feature branch

Test in a backed-up or disposable Foundry v14 world. Keep the existing feature-branch installation URL:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

Go to **Setup → Add-on Modules → Check for Updates** and confirm version **0.2.4**. If the update is not detected, check that the installed module uses the feature-branch manifest; a main-branch or old Phase 1 manifest will not automatically follow this branch.

## Core GM workflow

1. Open the **Scene on the canvas** and open its native **Scene Configuration → Atlas** tab. A separate "Configure Atlas" button or activation toggle should **not** appear.
2. Atlas should say no road network is configured if the Scene has no saved roads. Find a **Roads [+]** section, plus the read-only **Scene Grid** measurement.
3. Click **+**. A notification should indicate road drawing started. A small instruction area with **Finish Road** and **Cancel Drawing** should appear in Atlas.
4. With Scene Configuration still open, click **two or more** positions on the map (try a curve with three points). The gold draft polyline/dots should appear; the Atlas instruction should update its count.
5. **Finish Road** should save the road to the Scene, show a success notification, and add "Road 1" to the list. The saved line is cyan; using the row's highlight control changes its color. If clicking the map does not place points while the Scene Configuration sheet is open, report that specifically with console logs.
6. Use **✎** to rename a road and reopen the Scene settings to confirm the name persisted. Add a second road; it should default to "Road 2".
7. Draw the second road starting near the first road's endpoint. The endpoint should snap within ~14 Scene pixels. Try another line that **crosses midway** through the first: it should **not** create a graph junction at that intersection.
8. Try **Backspace** before saving: it should remove the most recent draft point. **Esc/Cancel Drawing** should leave no new saved road. Finishing with fewer than two points should show a warning and keep the draft.
9. Use **×** on a saved road. Confirm the delete prompt works and the road disappears. Remove the last road; the Atlas status should return to no roads configured. The native Scene Grid values should remain unchanged.
10. Close the Scene configuration and reload the world. Reopen it and confirm saved road names, geometry, and the active status persist.

## Scene, Grid, lifecycle, and permission checks

- Open the Atlas tab of Scene B while viewing Scene A; **+** must refuse to draw in the wrong Scene, instead of silently saving geometry to either one. Open Scene B on the canvas and retry.
- Zoom or pan the canvas, then add a road: it should land under your cursor rather than being offset.
- Switch Scenes or leave the canvas during an unfinished draft. The draft listeners and overlay should clean up. Old drafts must not be saved to a different Scene.
- As a non-GM, there should be no road editing UI and no GM road overlay. **Do not rely on hidden UI to conceal Scene flags** from players; privacy/reveal is a future feature.
- In the native **Grid** tab, change the distance and save it. Atlas read-only measurement must follow; this editor does **not** independently calculate road length or alter the ruler's measurement.
- If your Scene once used a manual calibration like 0.05 km/px, it must not reappear as an active control or override.

## Optional read-only data inspection

While viewing the Scene:

```js
canvas.scene.getFlag("fvtt-atlas-navigation", "atlas")
```

Expected new road geometry has `nodes[]` with Scene-space `x,y` and `segments[]` entries containing `from`, `to`, ordered interior `via[]`, and a name. `revision` increases for each successful add/rename/delete. Legacy `calibration` and `enabled` fields remain in v1 flags for compatibility, although **active UI state is based on the presence of roads**. Deleting a road leaves its junction nodes intact.

## Regressions to address before completing Phase 2c

The following failures are **known in 0.2.4**; re-test after future fixes rather than assuming this test build already supports them.

- **Padding/image anchor:** Draw a road on the visible background at padding **0.00**. Change the native Scene Padding Percentage to **0.05**, apply, and verify each road still follows the same buildings, shores, or paths. Reverse to 0.00, zoom/pan, reload and verify again. Also test Shift (Pixels) and any changed Scene dimensions independently. A coordinate data migration must preserve pre-fix v1 roads.
- **Interior connection:** Start a new road at the **middle** of an existing road, not just a cyan endpoint dot. Explicitly choose to join; the target road must be split into two connected graph edges sharing one new stable node with the new road. A visually crossing road should remain disconnected unless explicitly joined.
- **Transient highlight:** Highlight a road, then close Scene Configuration or navigate away from the Atlas editing context. The gold emphasis must clear without deleting or hiding the road. Scene-switch teardown must also clear it.

The owner's additional LegendKeeper-inspired requests—road labels (off/on hover/always), per-road colors and solid/dashed/dotted patterns, editable/smoothed shapes, focus-to-fit, hide/show, native-measured name/length hover, and direct right-click editing—are recorded in [Phase 2 design](PHASE2_DESIGN.md) and [roadmap](ROADMAP.md). These have **not** been built.

## Known limits

- This is a **first Phase 2c slice**, not the complete road network editor: saved bend/junction dragging, insert/split-road, named Waypoints [+], linked native Regions, calculated distances/routes, token terrain movement, and player reveal are not here yet.
- Endpoints snap only to existing junction *nodes*, not to any point along an existing road.
- One GM edits an Atlas Scene at a time. Revision checking detects many conflicts but is not an atomic multi-GM lock.
- Existing Scene road flags may be delivered to player clients even though authoring controls are GM-only.
- Foundry's experimental **VFX** console warning is not caused by Atlas VFX usage; this implementation uses standard PIXI graphics. If you see a **new error mentioning `road-canvas.js`, `scene-config.js`, or `main.js`**, share it.

## Automated checks

From a Node 20+ repository checkout:

```bash
npm test
npm run check
```

The tests cover road creation and snapping, no automatic connection at visual crossings, rename/delete preservation, Scene flag persistence, permission/revision rejection, Scene Atlas tab rendering, GM canvas pointer capture, saving, cancellation, and overlay highlights. They do **not** substitute for a live Foundry v14 visual and interaction test.
