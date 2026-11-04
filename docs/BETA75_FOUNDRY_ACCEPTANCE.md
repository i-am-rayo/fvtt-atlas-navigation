# v0.3.8-beta.7.5 — architecture acceptance checklist

**Status:** Installable *test branch*, not a merged mainline release. Use a copy
of a Foundry v14 World or make a backup first. No intentional Scene, Actor,
World-setting, Journal, fog-history, or road-coordinate migrations.

**Install:** Paste the `manifest` URL in this branch's `module.json` into
Foundry's module installation dialog. Confirm the installed module reports
`0.3.8-beta.7.5`. Reload both GM and player sessions after installation.

## GM edit-window checks

- [ ] Open Road Editor for an existing road; drag a node without saving.
- [ ] Click **Focus Map**. Verify the dock minimizes via the normal Foundry
      title bar and leaves the map available for interaction.
- [ ] Restore the dock; verify points, Undo and **Save Points** still work.
- [ ] Repeat while drawing a *new* road, then Cancel; verify no abandoned road
      appears. Repeat and Finish; verify one road is saved.
- [ ] Verify native Scene configuration minimizes while the Road Editor opens,
      then restores when the dock closes.
- [ ] Check checkpoint preset Settings: Add/Edit, icon actions, hover tooltips,
      keyboard focus, Delete confirmation, and persistence after reopening.

## Navigation and player regression

- [ ] Navigation **New Route**, Journey Journal, pause/resume and rest buttons
      remain legible, clickable and correctly enabled/disabled.
- [ ] Repeat a known-good `beta.7.4.4` route (including 8-hour Long Rest while
      underway if available); verify Journal and elapsed World time match.
- [ ] Move through a surface or vehicle transition and verify no duplicate
      confirmation, time advancement, or token movement.
- [ ] Check the player session: roads/checkpoints remain appropriately visible;
      no GM editing controls are exposed; map fog persists after reload/Scene
      switch; weather and other Scene effects remain intact.

## Reporting

Provide the Foundry v14 version, module version, GM/player result, the last
successful step, and any Atlas-specific console error. Other installed modules
may generate unrelated warnings; do not assume they belong to Atlas.

**Stop condition:** If a window loses unsaved edits, a Journey advances time
twice, or fog/road/visited history disappears, stop and report before saving
more data. Do not merge the stacked architecture drafts until accepted.
