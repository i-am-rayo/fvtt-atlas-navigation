# Phase 2c — Roads [+] GM smoke test (v0.2.4)

**Status:** First road-authoring slice, awaiting live Foundry v14 GM verification. Phase 2b native Grid behavior was confirmed by the owner: a saved Grid distance change from 7.5 to 8 was reflected in Atlas. The v14 experimental VFX warning seen in that test is from Foundry core; this module does not call the experimental VFX API.

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
