# Phase 2a — Scene atlas setup and calibration smoke test

This documents the **implemented 0.2.1 vertical slice**, not the revised future UI. It enables one Scene as an atlas and stores a manual travel scale in a validated, versioned Scene flag. Road drawing, junction editing, native Region linking, overlays, and routing are **not implemented**. The approved [revised Phase 2 design](PHASE2_DESIGN.md) will replace the top-of-sheet launcher with a better Atlas management surface and read native Scene Grid measurements by default; it is not yet available in this test build.

## Install this development build

Use an expendable Foundry VTT v14 test world. In **Setup → Add-on Modules → Install Module**, use:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

**Important:** If your existing Phase 1 install uses the Phase 1 feature-branch manifest, it will not automatically track this Phase 2 branch. This is a separate test channel; verify the installed version is **0.2.1**. Do not overwrite a production world just to switch channels. We will move to a stable main/release manifest after acceptance.

## GM acceptance walkthrough

1. Start a test World as a GM; enable **FVTT Atlas Navigation**.
2. View a Scene with an image/canvas.
3. Open **Scenes → right-click the target Scene → Edit/Configure** to open that Scene's native configuration window.
4. At the top of **Scene Configuration**, find **Atlas Navigation → Configure Atlas**. Click it; the dialog should identify the Scene you selected (even if a different Scene is currently viewed).
5. Check **Use this Scene as an atlas**, enter **0.05** in **Travel units per Scene pixel**, and set the unit to **km**.
6. Click **Save Atlas Setup**. You should see a confirmation notification that stays visible until dismissed (development feedback).
7. Reopen the dialog from the same Scene's configuration window; check that enabled, scale, and unit persisted. In v0.2.0 the fields could look empty despite saved data; v0.2.1 fixes that display bug.
8. Reload the World and reopen the same Scene's dialog. Values should still be present.
9. Edit a different Scene and open its Atlas Setup. It should be disabled/uncalibrated there.
10. Return to the first Scene's configuration. Uncheck the atlas checkbox and save; reopen and confirm scale was **preserved**, not deleted.
11. Re-enable it and clear the numeric scale. The Scene should now be enabled but explicitly **uncalibrated**.

Optional read-only DevTools confirmation while viewing the first Scene:

```js
canvas.scene.getFlag("fvtt-atlas-navigation", "atlas")
```

Expected general structure:

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "enabled": true,
  "calibration": { "source": "manual", "unitsPerPixel": 0.05, "unit": "km" },
  "nodes": [],
  "segments": []
}
```

The revision increments after every successful save. Never manually set or paste Scene flags while testing valuable data.

## Permission and concurrency checks

- As a non-GM player, the Atlas Setup button inside Scene Configuration must not be available. No canvas overlay or atlas network is intentionally presented to players.
- For this development slice, **use only one GM editor at a time**. If another GM changes a Scene flag while your dialog is open, a revision mismatch should reject your save, but the compare/check and write are not atomic across clients.
- Do not put secrets in Scene flags. Hiding an interface does not establish confidentiality against player clients.

## Static checks

With Node 20+ and no npm package installs required:

```bash
npm test
npm run check
```

These cover the v1 atlas schema, invalid endpoints, nonfinite coordinates, zero-length segments, calibration validation, GM-only save permission, stale-dialog checks, and the Phase 1 bootstrap. They do not replace in-Foundry testing.

## Out of scope / next Phase 2 slice

- Native-looking Atlas management section/tab, Scene Grid measurement default, and eventual Region linking (revised Phase 2b/2d; see [design](PHASE2_DESIGN.md))
- Canvas road and node overlay
- Drawing, moving, connecting, disconnecting, and deleting junctions/segments
- Route computation (Phase 3)
- Player atlas presentation (Phase 5)

See [ROADMAP.md](ROADMAP.md) for the Phase 2 acceptance criteria. Report Foundry's exact build, game system, and any console errors when reviewing this branch.

## Settings separation

- **Per-Scene:** Atlas enabled, calibration, and later network editing are accessed from the native **Scene Configuration** sheet for the selected Scene.
- **Per-world module settings:** Only the optional GM startup diagnostic remains under **Configure Settings → FVTT Atlas Navigation**.
- The development save confirmation is deliberately persistent until dismissed, so testers can verify that a save completed after the dialog closes.
