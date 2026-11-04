# v0.3.8-beta.7.5.2 — architecture acceptance checklist

**Status:** Installable *test branch*, not a merged mainline release. Use a copy
of a Foundry v14 World or make a backup first. No intentional Scene, Actor,
World-setting, Journal, fog-history, or road-coordinate migrations.

**Install:** Paste the `manifest` URL in this branch's `module.json` into
Foundry's module installation dialog. Confirm the installed module reports
`0.3.8-beta.7.5.2`. Reload both GM and player sessions after installation.

## GM edit-window checks

- [ ] Open Road Editor for an existing road; drag a node without saving.
- [ ] Click **Locate Road**. Verify the map pans/zooms to the in-progress road
      and briefly highlights it without minimizing the dock.
- [ ] Verify the unsaved points, Undo and **Save Points** still work.
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

## Historical Focus Map follow-up: beta.7.5.1 (superseded)

After the owner found that **Focus Map** produced no visible window change in
`beta.7.5`, the Road Editor explicitly enables Foundry v14's
`window.minimizable` option. This was an incorrect interpretation of the
requested button. The option remains available for *native* title-bar
minimization, but the editor button no longer calls `minimize()`.

## Corrected road-location intent: beta.7.5.2

Owner clarification: **Focus Map** was meant to locate and highlight the road
being edited, like **Locate road** in Scene Atlas, *not* minimize the window.
The dock control is now labeled **Locate Road** and calls the existing native
canvas pan/highlight routine using the unsaved working geometry.

- [ ] While moving a bend or endpoint, click **Locate Road**. The map centers
      and fits/zooms to the edited road, then briefly pulses its highlight.
- [ ] Repeat with an unfinished new road after placing one or more points; the
      gold draft remains unsaved and receives a temporary focus pulse.
- [ ] Confirm the dock stays open, and Undo, Save Points, Finish, and Cancel
      are unaffected. Window minimization remains available via Foundry's
      native title bar, not the Locate Road button.
