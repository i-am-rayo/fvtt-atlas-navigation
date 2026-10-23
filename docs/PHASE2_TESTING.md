# Phase 2c — v0.2.9 GM smoke test: explicit Waypoints and bend junctions

**Status (October 23, 2026):** The owner confirmed that v0.2.8 detachment and reattachment (including confirmation, independent endpoints, and saved Scene persistence) work in Foundry v14. **v0.2.9 is ready for new in-client testing; do not merge draft PR #3 yet.**

Install/update using the unchanged feature-branch manifest:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

Check for Updates → verify **0.2.9** → reload a **backed-up Foundry v14 world**.

## A. Waypoints [+] placement and persistence

1. Open Scene Configuration → Atlas with at least one saved road. Confirm **Waypoints [+]** is a separate section under Roads. A new blank Scene should show a disabled waypoint + until a road exists.
2. Click Waypoints [+] and then click a road **interior** away from its endpoints. The picker should become a reversible **point-edit** session with a new gold node; its **Save Points**, **Undo**, and **Cancel Edits** controls appear in **Waypoints**, not Roads.
3. Undo: the new junction disappears from the temporary graph. Try again, then **Cancel Edits** and verify there is no saved Scene change. Repeat and **Save Points**; reload to confirm the node and original named road survive and the graph segment count increases by one.
4. Click Waypoints [+] and click an existing gold endpoint/junction. Atlas should report that the location already has a graph node; no duplicate should be saved.
5. In the Waypoints list, check the active-node count, connected-road names and ◎ highlight action. Up to **25 newest junctions** display in the list; older nodes still exist on the map and graph.

## B. Bend promotion and connection approval

1. Use **Roads [+]** to draw a North–South road with a white middle bend crossing the **interior** of a different named Millstone road. Confirm **no junction is created automatically** at the crossing.
2. Select Edit Points for North–South. **Shift-click the white bend**: it turns into a gold junction, but the two named roads remain disconnected.
3. Drag the new gold point onto Millstone (or move it slightly and release it at the crossing). A connection confirmation should list both road names.
4. Decline once: no cross-road attachment is made. Accept on the next attempt: Millstone splits into graph segments but stays one named road. North–South also stays one named road.
5. Test **Undo**, **Cancel Edits**, then **Save Points** and reload. The confirmed connection must survive; the declined/canceled version must not. Original Scene Grid distance values should not change.
6. Try a crossing that must remain **unconnected** (e.g., a bridge). Do not Shift-click or attach it: two visually overlapping lines must remain separate graph paths.

## C. Regression/safety

- Confirm v0.2.8 Alt/Option-click gold shared-junction **Detach**, independent drag, reattachment confirmation, and saved persistence still work.
- Confirm Alt/Option-click white bend removal and double-click bend insertion work after conversion of other bends.
- Confirm Scene padding changes, multiple Scenes, selected waypoint highlight cleanup on closing Scene Configuration, GM-only controls and no Walls are unaffected.
- Check native Foundry v14 console for errors and report any unexpected prompt, scene flag change or performance problem on a road-rich map.
- Phase 2d Region linking, waypoint names/Note associations, Phase 3 routing, and player-facing features remain out of this version.

---

## Archived v0.2.8 checklist

# Phase 2c — v0.2.8 GM smoke test: detach and reattach shared junctions

**Status (October 23, 2026):** Owner verified v0.2.7 double-click insertion and removal, as well as prompts that identify one or two existing road names. The owner noted that dragging a shared junction pulls all attached roads—which is correct graph behavior but prevents independent endpoint relocation. **v0.2.8 adds confirmed detachment.** Real Foundry v14 retesting remains required.

Use a **backed-up v14 world** and the same feature-branch manifest:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

Check for Updates, verify **0.2.8**, reload, and leave draft PR #3 unmerged.

## A. Detach, move, reattach

1. Start on a named road (for example, Road 2) whose gold endpoint is already shared with a differently named main road. In Scene Configuration → Atlas choose **Edit road points** for Road 2.
2. Hold **Alt/Option** and click the **gold shared junction**. The new **Detach road from junction?** prompt should identify Road 2 and the other road name(s). Click **No** and verify nothing changes.
3. Alt/Option-click again and **Detach Junction**. The outline initially remains at the original coordinates (two independent nodes now coincide). Check that **Undo** reverts detachment without touching saved Scene flags.
4. Detach a second time, then **drag Road 2's gold handle away** from the main road. The main road must stay fixed. Save Points and reload the world. Confirm Road 2 has an independent endpoint at the new location and all road names survive.
5. Drag that independent endpoint back near the main road. A **Connect road junction?** prompt should appear. Reject once (the attempted drag is canceled), retry and accept, then Save Points. Verify the connection restores without merging names.
6. Test where **three different named roads** meet: detaching one should preserve the junction shared by the remaining two; dragging the detached road should leave both in place.
7. Try Alt/Option-clicking a gold point used only by the selected named road. Atlas should explain there is nothing to detach and must not change graph topology. Escape/Cancel Edits must roll back all pending changes.

## B. Understand graph segment counts

1. Open the Atlas tab with a main road split by a spur or shortcut. Its smaller italic line now says something like **“5 graph segments”**; hover it for an explanation.
2. The number counts **internal edges split at junctions**, not five separate named roads or visual branches. Confirm the named main road is still one row and that highlighting includes all its graph segments.
3. Test newly joining another road interior: its graph segment count may rise by one because a split introduces two pieces where there used to be one. The joining road retains its separate name and count.
4. Verify double-click insertion, Alt/Option-click bend removal, Undo, Cancel Edits, and native Scene Grid measurement still work. No Foundry WallDocuments should be created.

## Deferred

Road context menus, advanced controls to detach one arm of the **same** logical named road, auto-smoothing and styling, native Region associations, routing, token movement and player visibility remain later milestones.

---

## Archived v0.2.7 checklist

# Phase 2c — v0.2.7 GM smoke test: explicit road connections

**Status (October 23, 2026):** v0.2.7 implementation is ready for a new **owner live-test in Foundry v14**. Automated pure-model, UI and canvas regression checks passed in the test harness; a real Foundry session is still required. The previously reported v0.2.6 issues are included below.

Install/update via the same development manifest:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

Use a backed-up v14 world, Check for Updates → verify **0.2.7**, reload, and leave draft PR #3 unmerged.

## A. Connection confirmation and name safety

1. In Scene Configuration → Atlas, click **Roads [+]**. Verify the plus is directly beside Roads, like Levels (+). Make two separate, differently named roads; ensure they do not touch.
2. Draw a *third road* starting near the interior of one and ending near the interior of the other. Click Finish Road. A **Connect road junction?** dialog should identify both existing road names and the connecting road.
3. **Decline**: the new road must not save, merge, or form topology; the points remain in the draft until changed/canceled. To intentionally avoid a connection, start over and hold Alt while placing the near-road endpoint.
4. Repeat and **confirm**: both original roads may become two graph *sections*, but retain their original name **once each** in the Atlas list. The new road has its own name and section(s). Save/reload.
5. Use Edit road points (⌖) on an independent road. Drag a **gold junction** near a different road or existing junction. Confirm the prompt lists the target and explains that the names remain separate. Decline once: no movement or connection should be staged. Try again and accept: see snapped junction, then **Save Points** to persist.
6. When a moved junction is **shared with several roads**, the prompt should identify all source road names and warn that all will share the new destination junction; acceptance must still leave separate names. Connect a shortcut to two junctions of the same road: this is allowed without automatically merging logical groups.
7. Test Undo before Save Points, Cancel Edits, closing Scene Configuration, reloading, and switching Scenes. Verify no unapproved connection survives and Scene image padding changes do not displace roads.

## B. Point editor and Atlas UI fixes

1. Select Edit road points and **double-click a road line between handles**: a new white bend handle must appear. Drag it, Option/Alt-click to remove it, and test Undo and Save Points.
2. The road should display one name. Any split count appears as a **small italic secondary line** (for example, “3 sections”), not as part of its name.
3. When a road touches **two or more differently named groups**, click **Merge connected roads**. A selection dialog must open without console errors. If you actually intend to combine names, choose one and confirm; otherwise cancel—existing names and topology must stay unchanged.
4. With Edit road points active, the secondary action should say **Cancel Edits**, not Cancel Drawing.
5. Verify no Foundry Walls are created and roads do not block senses or movement. Confirm the Scene Grid remains the only authority for distance.

## Not yet included

Waypoints panel; road styling, smoothing, hover, road labels, context-menu edit; native Regions; calculated routes; terrain, token motion, or player visibility. Use Foundry v14 to validate the input/dialog events, since unit tests cannot simulate the full Foundry canvas.

---

## Archived v0.2.6 instructions

# Phase 2c — v0.2.6 GM test: named roads and point handles

**Status (October 23, 2026):** Automated unit/UI tests have been exercised. The owner has already verified the preceding v0.2.5 anchoring and junction split behavior in Foundry v14. **This v0.2.6 change still needs a new live Foundry test.**

Use a backed-up v14 world and the existing feature-branch install URL:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

Check for Updates and confirm **0.2.6**, then reload the world. Do not merge PR #3 yet.

## A. Upgrade existing roads safely

1. Open Paedor (or another previously authored Scene), keep its map/image alignment correct, and open Scene Configuration → Atlas.
2. For an existing **v2** network, choose **Organize named roads (v0.2.6)** and confirm. Back up before this one-time change. An existing **v1** Scene must use **Anchor legacy roads** first (with confirmed alignment), then Organize.
3. Verify road geometry **does not move at all**. Road names and colors still display, and the grid measurement remains from the native Grid tab.
4. Inspect the road list and check that every previous road is present. Two saved v2 sections with identical names intentionally remain separate initially; they are **not assumed to be the same named road**.
5. For *two roads meeting at a shared junction*, choose the **Merge** action on the name you want to keep, select the other road if prompted, and confirm. They should become **one Atlas row** with multiple sections. Geometry and junction connections must not change.
6. Reload to confirm names/grouping persist. Try Scene padding 0.00 → 0.05 → 0.00 and confirm the road overlay follows the image correctly.

## B. Create a new split junction

1. Draw a fresh road, then add a spur whose *first endpoint* is placed near the center of the first road.
2. The original road should remain **one named road row**, although its graph is now split into two connected sections; the spur is another named row.
3. Highlight the original name: **both** road sections should highlight together. Rename the original: its two sections should remain grouped. Delete a grouped road only if you are comfortable removing **all sections** belonging to that name.

## C. Edit points as with Foundry Walls / LegendKeeper

1. Click **Edit road points** on a road with two endpoints and one or more bends.
2. Gold circles mark graph junctions, white circles mark interior bend points. Drag one white bend. The line should follow your cursor as an editable **polyline, not a closed polygon**.
3. Press **Undo** (or Ctrl/Cmd+Z) and confirm the previous position returns. Drag again, then **Cancel**, and verify the saved road did not change.
4. Enter Edit again, drag a bend, and choose **Save Points**. Reopen the Atlas tab and reload Foundry; geometry and IDs must persist.
5. **Double-click** a line between existing handles to insert a bend; drag the new handle. **Alt-click** that bend to remove it. Save and reload.
6. Move a **gold shared junction** where two roads meet. Both roads should remain connected and use the updated junction position.
7. While editing but before saving, close Scene Configuration. The draft/handles/highlight should disappear and no edits should be persisted. Also try switching Scenes; the previous overlay must not bleed into the new Scene.
8. As a non-GM, verify that authoring controls and the GM-only road overlay are not exposed.

## Not yet included

A direct right-click road context menu; draggable entire segments independent of shared junctions; smart natural smoothing; road name/length hover overlays; color/dash/dot/visibility/labels; explicit waypoint manager; native Region association; pathfinding; terrain travel math; token motion; player reveal/hide. **Actual Foundry WallDocuments are intentionally not used**—they have sight/movement semantics that roads must not acquire. Native ruler / Scene Grid remains authoritative for future distance.

---

## Archived v0.2.5 testing notes

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
