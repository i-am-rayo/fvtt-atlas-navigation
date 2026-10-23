# Phase 2b — native Scene Atlas tab and Grid-first measurement test (v0.2.2)

**Current build:** Phase 2b test build **0.2.2**, targeting Foundry v14. The native Atlas tab, distance-source summary, and manual/Grid selection are implemented. **Roads, Waypoints, Regions, overlays, and routing are not implemented yet.** They remain Phase 2c/2d and Phase 3 tasks.

## Install / update this development build

Use an expendable Foundry VTT v14 world. Install once in **Setup → Add-on Modules → Install Module** with:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

If you already installed using this **same branch URL**, use **Setup → Add-on Modules → Check for Updates** and verify version **0.2.2**. This is a test channel; do not use valuable production Scenes without a world backup. A different Phase 1 branch manifest won't automatically track this branch.

## GM acceptance checklist

1. Open a Foundry v14 world as GM and enable **FVTT Atlas Navigation**.
2. Open any saved Scene's native **Scene Configuration**.
3. Look for an **Atlas** tab alongside **Basics**, **Grid**, **Levels**, etc. There should be **no Atlas banner floating above the native tabs**. If custom module/sheet integration prevents the native tab, the in-sheet fallback should appear *inside* the Scene's **Misc** or **Grid** tab. Report which appears.
4. Open **Atlas**. It should identify whether Atlas is enabled and show the native Scene Grid measurement (distance per grid space, pixel size, and inferred approximate units per image pixel), or a clear warning if invalid.
5. Click **Configure Atlas**. Verify the editor identifies the **configured Scene**, even if a different Scene is currently viewed on the canvas.

### Preserve existing v0.2.1 manual values

6. On an existing Scene where you entered **0.05 km per pixel**, the **Measurement source** dropdown should read **Manual scale override**. Reopening without saving must not change the Scene flag or the manually saved 0.05.
7. If its native Grid is **7.5 km per 49 pixels**, Atlas should show an approximate Scene Grid scale of **0.1530612 km per pixel** and a warning that this differs from the old manual value. The **effective** value must still be **0.05 km per pixel** until you change the source.
8. Change only the atlas-enabled checkbox and save; the old manual calibration should still be preserved.
9. To intentionally adopt Scene Grid, select **Use Scene Grid (default)** and click **Save Atlas Setup**. This explicitly removes the v1 manual override (it is not silently migrated). Reopen the editor: it should show Scene Grid selected.
10. If you want the old 0.05 scale again, choose **Manual scale override**, enter **0.05** and **km**, and save. It should persist through reopening and world reload.

### New Scenes and Grid changes

11. On a new/unconfigured Scene with a valid native Grid, Atlas should default to **Use Scene Grid** even without a saved Atlas flag. Merely viewing Atlas must not write flags.
12. Enable Atlas and save. Reopen: the source remains Scene Grid; `calibration` is **null** in schema v1, indicating a derived native Grid scale.
13. Change the Scene Grid's distance/units in the core **Grid** tab, save the native Scene Configuration, and reopen Atlas. Its measurement summary should reflect the new saved Grid values.
14. Switch to **Manual scale override** and save a scale. Subsequent native Grid changes must **not** overwrite that manual override.
15. On an intentionally invalid/empty Grid scale, Atlas should explain that Scene Grid is unavailable; selecting that source and saving should be rejected, not silently persist a bad scale.
16. Test a hexagonal Scene and a gridless Scene. The displayed units-per-pixel ratio is only an approximate continuous map scale at this phase; compare native ruler behavior and report discrepancies for Phase 2c.
17. Confirm that a non-GM cannot use the Atlas authoring controls. Do not put player-secret network data in Scene flags.

Optional, read-only console confirmation on the Scene you are currently viewing:

```js
canvas.scene.getFlag("fvtt-atlas-navigation", "atlas")
```

Expected for a **new Scene set to native Grid** after its first save:

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "enabled": true,
  "calibration": null,
  "nodes": [],
  "segments": []
}
```

For an old Scene that still uses manual calibration, `calibration` will be `{"source":"manual","unitsPerPixel":0.05,"unit":"km"}` (unless you explicitly switched it to Grid). Revision increases per successful save.

## Separation and safeguards

- **Per Scene:** Atlas source/status and future road/waypoint/Region lists in native Scene Configuration.
- **Global module settings:** Only the optional diagnostic startup notice.
- **Scene Grid:** Native Scene fields remain authoritative when Grid is chosen. No mandatory global Metric/Imperial selector; custom units remain display-only until a verified conversion feature exists.
- **Persistence:** Scene atlas schema stays **v1**. It stores only manual override values or `null`; a computed Grid ratio is **never saved** as `calibration.source = "scene-grid"`.
- **Concurrency:** One GM editor at a time; the optimistic revision check is not an atomic multi-GM lock.
- **UI feedback:** Successful saves show a dismissible, currently persistent development notification.
- **Privacy:** A GM-only UI is not proof that Scene flags are confidential from player clients.

## Automated checks and known limits

Run on a repository checkout with Node 20+:

```bash
npm test
npm run check
```

The relevant Node tests for this slice cover Grid resolution, manual override preference, null Grid fallback, explicit source switching, native tab injection/fallback, GM-only interface, revision conflicts and schema validation. These tests were individually exercised via Node data-URL imports before publishing v0.2.2; a complete `npm test` from a local checkout and **visual in-Foundry rendering** are still pending your test.

If the tab is missing, misaligned, or the save confirmation is not visible, please share the **exact Foundry v14 build, game system, browser console errors, and a screenshot**. We can adjust the supported integration or use the in-sheet fallback without patching private core methods.
