# Phase 2b — native-only Scene measurements smoke test (v0.2.3)

**Current build:** Phase 2b test build **0.2.3**, targeting Foundry v14. The native Atlas tab, Scene activation, read-only native measurement summary, and save confirmation are implemented. The owner confirmed native tab placement and saving in **0.2.2**; this version removes the conflicting manual-scale UI. **Roads, Waypoints, Regions, overlays, and routing remain future Phase 2c/2d or Phase 3 tasks.**

## Update from the feature branch

Use a backed-up or disposable Foundry v14 world. The existing development manifest URL is unchanged:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

Go to **Setup → Add-on Modules → Check for Updates**, then confirm **0.2.3**. A module installed from an older Phase 1 branch manifest will not necessarily track this feature branch automatically. This is still a **draft PR branch**, not a merged release.

## GM checklist

1. Activate the module and open a saved Scene's native **Scene Configuration** as GM.
2. Open the **Atlas** tab (beside Basics, Grid, Levels). There should be no banner floating above the tabs.
3. Check the read-only native Scene Grid distance and size (e.g. **7.5 km / 49 px**) and the description that the **Grid tab** is authoritative. **No units-per-pixel measurement, source dropdown, or manual scale/unit input should appear.**
4. Click **Configure Atlas**. Confirm its title and Scene match the Scene being configured, even if a different Scene is viewed on the canvas.
5. Confirm the dialog contains just the **Use this Scene as an atlas** checkbox for Atlas-specific settings, plus read-only native Grid details and help text.
6. Toggle on/off and save. Verify the Atlas tab updates, a save notification appears, and the choice survives reopening and a world reload.
7. Edit Grid distance/units in the native **Grid** tab, save Scene Configuration, and reopen Atlas. The Atlas read-only summary should reflect the new native data. There should be **no competing Atlas value**.
8. On the Scene that previously used a manual **0.05 km/px** value, confirm Atlas shows only the native Grid settings (for example 7.5 km / 49 px) and **does not show or apply 0.05**.
9. Check a square, hexagonal, and gridless Scene if available. This phase **does not yet draw or measure road polylines**; exact native ruler parity becomes a Phase 3 verification once routes exist.
10. Check a non-GM account: player authoring controls must not be shown. Do not assume the Scene flag's hidden UI makes its network secret.

## Verify legacy data remains safe (optional read-only console check)

On the Scene you are currently viewing, run:

```js
canvas.scene.getFlag("fvtt-atlas-navigation", "atlas")
```

Newly configured Scenes should contain `"calibration": null` (and start with `"revision": 1` on their first successful save). Older Scenes may still show:

```json
"calibration": { "source": "manual", "unitsPerPixel": 0.05, "unit": "km" }
```

**This is intentional compatibility data, not an active measurement override.** Saving Atlas activation preserves that historical object without changing it, and all current UI/calculation paths ignore it. No automatic destructive flag migration takes place in 0.2.3.

## Architecture and known limits

- **Scene Grid:** the only source of distance and units. No Atlas manual calibration or global Metric/Imperial override.
- **Future road measurement:** use public Foundry v14 `canvas.grid.measurePath(waypoints).distance` with the actual Scene-space road points; validate against the native ruler across square, hexagonal, gridless, and multisegment paths before finalizing graph weights. Raw `distance / size` is **not** a substitute for native path measurement.
- **Per-Scene Atlas configuration:** only enabled status changes in the current editor; future road/waypoint/Region lists will be managed in the Atlas tab.
- **Global module settings:** only the optional GM diagnostic startup notice.
- **Persistence:** Scene Atlas schema remains v1. Legacy `calibration` objects are kept dormant. Optimistic revision checks are not atomic multi-GM locks; use one GM editor at a time.
- **Notifications:** a successful save currently uses a dismissible persistent notification for development visibility.
- **Privacy:** GM-only UI is not proof that Scene flags are confidential from connected player clients.

## Automated verification

From a repository checkout with Node 20+:

```bash
npm test
npm run check
```

Tests should cover native Grid configuration, ignored legacy calibration, one-checkbox Atlas dialog, preservation of old v1 data, no new manual overrides, Scene tab placement, permissions, and stale revisions. **Actual Foundry v14 rendering is your acceptance check**; no road/ruler comparison is possible until the editor is built.

If there is an issue, please share the exact Foundry v14 build, game system, console errors, and a screenshot.
