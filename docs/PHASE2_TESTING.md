## v0.2.18 — native surface color, shared filters and status (owner acceptance pending)

1. Back up the World. Update/reload the module and verify v0.2.18. Open Module Settings → Atlas Presets; edit **Stone Road** color to `#2288AA` without changing its Walk/Fly/Swim/Burrow values. Save/reopen; verify the swatch and numeric native costs. Create a new custom Water preset with a different color and one supported cost. Existing catalog v1/v2 values and preset IDs must remain intact on opening; no write occurs until explicitly saving.
2. On a Scene with checkpoints, choose a road and create a generated **corridor** with the edited Stone Road preset but leave **Apply native movement cost** unchecked. Confirm the resulting native Region uses `#2288AA`, has no new native Modify Movement Cost Behavior, and retains native shapes. A generated checkpoint without a corridor preset should have no preset-enforced color.
3. Edit an existing generated corridor's color manually in Foundry. Change its world preset color again; verify its native Region color and Behaviors stay unchanged. The Atlas corridor list should label the difference. Click **🎨 Apply Color**, review the single-Region overwrite warning, cancel (no change), then confirm and verify that ONLY its native `color` changes. Check native geometry signature, Levels and manually configured Behaviors.
4. Regenerate an unchanged corridor's geometry; confirm its existing color does not change, even if the world preset color changed. A manually moved Region still blocks regeneration as before.
5. In Scene Atlas choose Selected road, Connected (one-hop), then All Scene. Verify Junction, Checkpoint, Generated Region, and linked native Region lists respond to the SAME scope. Filters in the lower sections should update the upper lists. Manually linked native Regions without a road owner appear under All Scene; filtering must not alter persisted roads/Regions.
6. On a corridor with native Atlas movement costs, verify **Native costs match world preset**. Change the global preset's Walk cost (without applying) and verify **World preset changed since native cost was applied**, with the old native Behavior left untouched. A manually edited native cost should show a separate warning. A Region with no applied Behavior says preset cost not applied. No sync/overwrite control should appear.
7. Test as a non-GM: view access never grants permission to update preset colors or native Regions. Switch Scenes, reload and retest. Do not merge until the owner checks these in Foundry v14.

**Automated checks:** `node --test` and `npm run check` from a Node 20+ checkout. Mocked checks cannot replace Foundry v14's native Region color/display behavior.

---
 
## v0.2.17.1 hotfix — targeted live Foundry v14 retest

1. Keep a backup of the World. Open the existing "Rough Waters" preset (Walk ×10, Fly ×1.50, Swim ×1.50, Burrow ×10); verify all selected values are unchanged.
2. Open the generated Sea corridor with no native Modify Movement Cost Behavior. Use the separately confirmed **⬆ Apply Native Cost** button. Previously this failed with "world preset costs changed since confirmation"; it should now create exactly one native Behavior with all selected movement costs.
3. Open the native Region editor to verify the four requested costs. Retry the apply action to ensure Atlas refuses to stack a second Behavior. Reassigning or editing a world preset must not rewrite the existing native Behavior.
4. Attempt a genuinely stale confirmation or an off-quarter cost (e.g. ×1.10 under the owner's v14.368 system); it must still refuse the write, rather than silently rounding. An unsupported system action must also fail atomically.
5. Check the legacy scalar single-action flow, metadata-only Region creation, GM/non-GM permissions, and Scene reload. No Region geometry, other Behaviors or travel preset IDs should change during installation.

**Live GM acceptance still pending.** This is a focused hotfix, not additional corridor features.

## v0.2.17 live Foundry v14 owner acceptance (stacked on v0.2.16.2)

1. Back up the test World. Confirm Module Settings → Atlas Presets still lists all old preset IDs/names and a legacy off-step multiplier like ×1.10 without rounding or writing settings just by opening the dialog.
2. Add a new Stone Road test preset under Land. Select independent **Walk ×0.75, Fly ×1.00, Burrow ×2.25** (when system supports Burrow); leave Swim unchecked as **No override**. Verify Foundry range-pickers allow ×2 and larger up to ×10.
3. Save and reopen the world preset. Verify each selected action and multiplier survived, and disabled/unavailable system actions cannot be newly authored. Existing unavailable action keys must not disappear from a per-movement preset after an unrelated edit.
4. Create a test road with two checkpoints and a generated corridor. With native opt-in **off**, verify no Region Behavior is created even if a preset is assigned.
5. For a different test corridor, enable native opt-in with the new per-movement preset, preview and confirm. Verify Foundry's Region editor shows **exactly one** active native Modify Movement Cost Behavior, with all selected actions' costs and no Swim override. Validate any native movement effect with actual tokens.
6. Assign a per-mode preset to an existing generated corridor and use ⬆. Confirm it adds one Behavior with all selected costs; second application, a manual (even disabled) native cost Behavior, or incompatible/normalized native values must be rejected without writing.
7. Edit the world preset, then regenerate corridor geometry. Verify the existing Region Behavior retains its original costs and native Levels, name and geometry-edit protections remain intact. Verify a pending confirmation cannot apply a stale preset snapshot.
8. Verify an existing legacy preset still prompts for a single supported movement action, and already-created schema-v1 native Behavior provenance still displays.
9. Repeat UI visibility and mutation checks as a non-GM. Test saving/reloading the World and switching Scenes. No routing, movement prohibition, vehicle rule, color, or broad filter feature is in scope.

**Not yet live-verified in this draft:** GM/non-GM Foundry v14 application tests, any game-system-specific native field compatibility or token movement behavior. Prior v0.2.16.2 Swim check was owner verified.

# Phase 2h — v0.2.16.2 GM acceptance: native cost normalization hotfix

**Status (October 24, 2026):** v0.2.15.1 preset editing and reference assignment were verified by the owner. The small v0.2.15.2 startup setting cleanup was staged afterward. **This v0.2.16.2 native Behavior integration is a draft and requires live Foundry v14 testing before merge.** Back up the World and keep one GM editing a Scene at once. No Region or world preset is retroactively changed just by installing/updating.

**Development manifest:** `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2h-native-movement-costs/module.json` — reload and verify **0.2.16.2**.

## v0.2.16.2 targeted retest (perform before the existing checklist)

1. Open Game Settings → Atlas Presets. Add a new Land/Air/Water surface and edit an existing quarter-step preset. Confirm Foundry's **range-picker** appears with both slider and editable number, stepping by 0.25. Save and reopen to verify the exact value persists. The native control must not throw `config.content element must have no attributes`.
2. Edit an older preset saved at ×1.10, ×1.15 or ×1.20. It should show the **legacy numeric input** and preserve its exact original value if you save without changing it. Convert it deliberately to ×1.25, reopen, and verify the slider appears. Preset names, stable IDs, road/Region associations and existing native Behaviors must remain untouched.
3. Assign an off-step preset such as Rough Seas ×1.10 or Turbulent Air ×1.20 to an Atlas corridor. Check the native-cost opt-in and choose Swim or Fly. Before pressing Preview/Create, Atlas must explain the **actual native retained cost** (×1.00 or ×1.25 in the owner's tested v14 World) and disable native creation without changing anything. Metadata-only Region creation must still work.
4. Deliberately set the same preset to ×1.25 or ×1.50, select a compatible movement action, and retry with native cost opt-in. A single native Modify Movement Cost Behavior should be generated with the **exact multiplier and action**. Repeat the existing apply-once, regeneration, GM/non-GM and token measurement checks below.
5. Reopen existing Stone Road/Rough Seas Regions and inspect their native Behaviors and manual geometry. Installation and world preset edits **must not** silently update or delete anything. Continue using native editing for a Region that already has a movement-cost Behavior.

## v0.2.16.1 GM verification checklist

1. Under Game Settings → Atlas Presets, edit **Stone Road** (or another Land preset) to cost ×1.5 and **Turbulent Air** to ×0.75; save, reload and verify. Both are native **movement costs**, not animation speed settings.
2. Open a road with two checkpoints. In Scene Configuration → Atlas → Generated Road Regions, choose the corridor and its travel preset. Confirm **Apply native movement cost** starts **unchecked**. Preview/create without checking it; its native Region has **no** automatically added Behaviors and retains the chosen preset annotation. A checkpoint circle likewise has none.
3. Generate a different corridor or test Scene using a valid travel preset, check **Apply native movement cost**, and select an action that the current system can **independently store as a native Region cost**. Token actions such as Swim/Fly that are fixed, derived, or omitted by the native cost schema must not appear in the selectable list; the UI should explain which modes are unavailable and still permit a metadata-only Air/Water corridor. The category Land/Air/Water must **not** silently choose an action. Confirm the preview states the exact preset name, cost and action. Cancel once: no Region or Behavior is created. Repeat and confirm: one linked Region with exactly one native `Modify Movement Cost` Behavior appears. Open its native Region editor and verify the cost applies to the chosen action with the expected multiplier.
4. On an already-generated corridor with saved travel preset and no cost Behavior, use **⬆ Apply Native Cost**. Choose the movement action and review the separate confirmation. Cancel: no changes. Confirm: exactly one new native Behavior is added; region geometry, other Behaviors, Levels, name and appearance are preserved.
5. Try applying the same preset cost again, or use a Region where you manually added an active or disabled native Modify Movement Cost Behavior. Atlas must refuse to stack or overwrite it. The native Region editor remains the way to manually adjust/delete a cost Behavior. A system with no matching native action/model must refuse safely while still allowing metadata-only Regions.
6. Assign another preset using **◈**, change the global preset's multiplier, or edit the named road's default. Existing native cost Behavior values must **not change**. Move a road node and regenerate unchanged native Region geometry using **↻**: the native Behavior is preserved. Manually edit Region shapes and confirm regeneration stays disabled as in v0.2.14.
7. Check actual movement measurement for one relevant test Token in Foundry v14 in and out of the new Region, using the selected action, with the Region Behavior enabled versus disabled. Record whether your active system derives other movement actions, any overlaps with manual Regions, and whether cost differs as intended. Atlas does **not** calculate its own token cost or move tokens. A ×0.75 preset means *less* movement cost, not a 75% movement speed multiplier.
8. Reload and switch Scenes: generated Regions, the native cost, the original preset annotation and all other native Behaviors persist without silent changes. As a non-GM, verify Scene Atlas authoring and Behavior-apply actions are unavailable, and direct modifications fail GM permission checks.

**Intentional scope boundary:** No automatic native costs for checkpoints, third-party/manually linked Regions, previously created corridors or all roads on installation. No guessed Land→Walk, Air→Fly or Water→Swim mapping; supported actions vary by system. No preset-based Region coloring or propagation of road filter to every Scene section (deferred to v0.2.17), no automatic slope/grade calculations, no routing and no token time/terrain previews. Native Behavior/schema acceptance in an actual v14 World is still required even though mock tests pass.

---

# Phase 2g — v0.2.15 GM acceptance: world Corridor Travel Presets

**Status (October 23, 2026):** The owner verified v0.2.14 generated native Regions, including the safety block after accidentally moving a native Region. This v0.2.15 draft is **not yet owner-verified in Foundry v14**. Back up the World before assigning a named-road default: that explicit action upgrades its Scene Atlas from v3/v4 to v5. Do not downgrade that Scene to older Atlas module versions afterward. Keep a single GM authoring a Scene at one time.

**Development manifest:** `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2g-travel-presets/module.json` — reload the world and verify version **0.2.15.2**.

**v0.2.15.1 hotfix:** The original v0.2.15 Add/Edit preset dialogs failed to open in Foundry v14 with `config.content element must have no attributes`. The corrected dialogs use an attribute-free outer container and serialized default field values. Re-test both **Edit** and **Add** (including reopening an edited preset) before proceeding. The underlying preset catalog and Scene schema remain unchanged.

**v0.2.15.2 settings cleanup:** Game Settings → FVTT Atlas Navigation now contains only the **Atlas Presets** submenu. The former *Show GM startup confirmation* diagnostic toggle was removed; module startup should not display a test notification. Existing values are left dormant, not erased from the World database.

## New v0.2.15 GM test plan

1. In Game Settings → Configure Settings → **FVTT Atlas Navigation → Atlas Presets → Configure Corridor Travel Presets**, check the restricted GM submenu. Default **Land, Air, Water** examples must all initially show **movement cost ×1.00**, so no implied game-system terrain penalty exists.
2. Edit **Turbulent Air** to cost **×1.50** (or ×0.75 to confirm a fractional *cost*, not speed, is accepted), save, reopen the settings, and verify persistence. Add an original **Water** preset, edit its name/type/cost, and remove it while unused. Duplicated names within one type and invalid costs such as 0 or a negative number must be rejected.
3. In Scene Configuration → Atlas, click the **◈** button beside a named road and choose a preset as the road's default. Verify its subtitle appears. A pre-existing v4 Scene must become **v5** only after this explicit GM action; checkpoint IDs, road/node/section IDs, shapes, elevations and existing native Regions must remain unchanged. Move a shaping point, edit a checkpoint, rename a road, save, and reload: its default preset persists. Try an older v3 road-only Scene if available; it should gain an empty checkpoint array safely.
4. Create a new generated **corridor** on the road. The generator should initially select the road default. Choose a different preset explicitly (or **None**) for this one corridor and confirm the native Region preview. Its Atlas metadata must show that chosen condition, while native `Region.behaviors` stays empty unless the GM manually adds something. Existing checkpoint Regions still generate normally.
5. Use **◈** beside an existing generated corridor to assign/change/clear its preset. Confirm native geometry, Levels, name, visibility and configured Behaviors do not change. Move a road node and explicitly regenerate an *unchanged native* corridor: the preset association and all manually configured Behaviors remain. Manually move the native Region and verify the original regeneration protection is still enforced.
6. Open a second Scene in the same World: world presets (and any edited value) are shared, while named-road defaults and individual corridor selections remain Scene-specific. Reload Foundry; all presets and references persist. Edit a world preset's cost: its referenced rows should show the new suggested value but **no existing native Region Behavior should change**.
7. Try to delete a preset while a road or generated Region still references it. The settings editor should refuse and identify a reference. Reassign/remove the references, then delete the preset. No native Region should be deleted.
8. As a **non-GM**, confirm the module-settings submenu is restricted and Scene Atlas cannot save road defaults or generated Region assignments. On unsupported/malformed world preset data or stale Scene revision, the operation should fail safely without erasing native Scene data.

**Intentional v0.2.15 limit:** Presets are GM metadata and movement-cost suggestions only. **No `Modify Movement Cost` native Behavior is created, updated, applied, or synchronized automatically.** Live native Behavior creation, token-specific movement, elevation slope costs and shortest-path travel remain separately gated follow-on work.

---

# Phase 2f — v0.2.14 GM acceptance: optional generated native Regions

**Status (October 23, 2026):** The owner verified v0.2.13 meaningful Checkpoints, elevation edits and filtering in Foundry v14. This new generation milestone is **draft and awaits live Foundry v14 acceptance**. Back up the world and keep a single GM editor. Phase 3 route calculation remains separately gated.

**Install this development build:** `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2f-generated-regions/module.json`. Check the module version is **0.2.14** and reload the world.

## Live GM smoke test

1. Open the Paedor (or any) Scene containing v4 road checkpoints. Scene Configuration → **Atlas → Generated Road Regions** appears; **nothing is created** merely by opening it. Without checkpoints, only the add-checkpoint reminder appears. Set native Grid size in **Grid** as needed.
2. Choose a named road, **One checkpoint circle**, a checkpoint name, and half-width **0.5 grid cells**; select **Preview and confirm native Region**. See a temporary green circle around the checkpoint without a native Region being created yet. **Cancel**: the preview clears and no Region exists. Repeat and confirm: exactly one linked native Region is created at that location, with no Behaviors. Open its native Region editor to verify geometry/name and Region linkage in the Atlas Terrain Regions list.
3. On the same named road, select **One corridor between checkpoints**, choose two connected checkpoints (with at least one shaping bend between them). Preview should follow the actual road polyline with rounded joins. Confirm and verify a **single native Region with multiple shapes** appears, one containing the corridor. Check no extra road sections, junctions or checkpoint records were authored.
4. Repeat creation for the same checkpoint or corridor (also reverse the start/end selection): duplicate creation **must be refused** rather than produce overlapping Regions. Generate a Region for a **different interval** or a different named road; it must work independently.
5. Give the generated corridor a native **Pause Game**, movement-cost, or other Region Behavior available in your world, alter its native name, perhaps set a native Level/elevation range, and use **↻ Regenerate** *without first changing its shapes*. Verify the native name, Behavior, Levels and visibility settings remain intact. Any Region Behavior is configured by the GM, never inferred or silently added by Atlas.
6. Manually drag a native Region shape handle or otherwise edit its geometry. Refresh/reopen Atlas: this generated Region should be marked **manually modified** and Regenerate disabled. Its native geometry, Behaviors and name must remain unchanged. Other unmodified generated Regions can still regenerate.
7. Edit a road segment or move a shaping node after generating a corridor. The native Region should remain independent (no silent edit). **Regenerate** the unchanged native Region to update its corridor footprint to the new road layout, after preview and confirmation. Change **Scene padding 0.00 → 0.05**, inspect alignment, and explicitly regenerate if needed. Change the native Grid size and confirm the newly generated footprint recalculates from the Scene's current Grid.
8. Try a corridor spanning disconnected road portions, two **different named roads**, or a same-road loop where more than one possible path exists. A clear error should appear; **no Region and no topology connection** should be fabricated. Long roads over 100 shape-edges should ask you to choose closer checkpoints. In a two-road crossing, merely touching geometry must not connect it.
9. Switch to another Scene and confirm no generated Regions leak across Scenes; reload Foundry to verify native Region shapes and metadata persist. Close Scene Configuration during a preview, and change Scenes; ephemeral highlights must clear. If two editors race, a changed Scene Atlas revision should refuse stale generation.
10. As a **non-GM**, confirm the generator cannot be used to create Regions or alter their flags. These Atlas markers are GM-only UI, **not a promise of secret metadata transport**; player data-exposure work remains Phase 5.

**Intentional v0.2.14 limits:** one Region per explicit operation, no bulk generation, no exact grid-cell fill, no auto-difficult-terrain/grade inference, no native Region levels from checkpoint elevation, no automatic update/merge of Regions when roads change, no automatic Behavior execution, no Journals or token routing. A checkpoint elevation is only semantic metadata in **meters above sea level**. The generated corridor uses half-width times the Scene **grid pixel size**, not a parallel Atlas distance calibration. Multi-shape native Regions are expected. Manual shape edits block regeneration; edit such Regions in the native editor.

---

# Phase 2e — v0.2.13 GM acceptance: meaningful checkpoints and elevations

**Status (October 23, 2026):** Phase 2d v0.2.12 native Region associations were owner-verified in Foundry v14. This new checkpoint milestone is a **draft requiring live owner testing**. The Region and road authoring PRs remain draft/unmerged. Test in a backed-up world with one GM editor at a time. **Do not downgrade to v0.2.12 after saving a v4 Scene**: older code will correctly reject the newer version rather than silently erase it.

**Install/update this milestone:** `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2e-checkpoints-elevation/module.json`. Then reload Foundry and verify the module version is **0.2.13**.

## v0.2.13 checkpoint test plan

1. Open a Scene with v3 roads, Scene Configuration → **Atlas → Checkpoints [+]**. Click a point in the middle of an existing named road, give it a name and elevation **0** meters, then repeat elsewhere with **10**, **50**, **40**, **60**, **55** (or any sample values). Observe purple point markers and named rows with elevation. One split should add a graph section, **not** a new named road; it should not appear among true **Junctions** unless it actually branches.
2. Create a checkpoint **on an existing shared node**. If different named roads meet there, the modal must ask which named road owns this checkpoint. Refusing/cancelling the modal changes **nothing**. Saving creates one semantic checkpoint without a duplicate graph node.
3. **Edit** a checkpoint label and elevation (including a negative value and leaving it empty/unknown). Reload and switch Scenes; labels/heights and road positions must persist in their original Scene. v3 road IDs/names/geometry and dormant old calibration must survive the explicit v3→v4 upgrade. Padding 0.00→0.05→0.00 must not shift the markers.
4. **Filter** by one road, **directly connected roads**, and **all roads in Scene**; unrelated roads should disappear from filtered results. With more than 25 entries, the list must show a bounded recent window and correct total count.
5. **Edit Points** on the road owning a checkpoint, move its graph node, Save Points. Its purple marker must follow. **Shift-click demotion** of a graph node containing a checkpoint should be rejected with a specific warning. Checkpoint deletion must remove **only** label/height metadata, not road geometry; then safe demotion may proceed.
6. **Detach** a named road from a shared node that also has a checkpoint on that named road. Its marker must follow the newly detached node; reattach and save, then verify the metadata remains. An explicit **Merge connected roads** must also preserve checkpoint owner and height. A merge that would create two semantic checkpoints on exactly the same named-road node should safely reject without deleting either.
7. Try deleting a named road containing checkpoints; it must refuse until you delete/reassign its checkpoints. Confirm the existing native **Terrain Regions**, their Behaviors, shape, level range and link flags remain untouched throughout checkpoint creation/edit/deletion. No native corridor Region should appear automatically.
8. Close Scene Configuration during a checkpoint pick; the picker and temporary highlight should clear. Test cancel and a stale scene revision. Verify a **non-GM** cannot open GM checkpoint controls or save flag changes; as always, hiding the UI is **not** proof that secret details are inaccessible from raw Scene flags.

**Expected intentionally absent features:** road slope/difficult-terrain automation, automatic native Region corridors or checkpoint circles (target v0.2.14), native Journal/pause-game trigger wiring, route distance/fastest-route calculations and player presentation. An entered altitude **does not** set Foundry Region elevation ranges or native Scene Levels. Report any console errors with operation and screenshot.

---

# Phase 2d — v0.2.12 GM acceptance: native Region associations

**Status (October 23, 2026):** The owner verified v0.2.11's final junction repair. Phase 2d is authorized, but this new build still requires live testing in Foundry v14. PR #3 for roads remains draft and unmerged; Phase 2d is on a separate branch. **Back up the test world first.**

Install/update using this branch manifest:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2d-native-regions/module.json
```

Foundry Setup → Add-on Modules → Check for Updates should show **0.2.12**. Reload the world and sign in as a GM.

## A. Link existing native Regions

1. In a test Scene, use **Foundry's Regions canvas layer** (not Atlas) to create two native Regions, e.g. one with multiple shapes, a hole and an elevation range, and one ordinary Region. Add native **Modify Movement Cost**, **Difficult Terrain**, or system-provided Behaviors if available; give at least one Behavior a disabled state. Do not assume any particular game system provides a given Behavior.
2. Open Scene Configuration → **Atlas → Terrain Regions [+]**. Choose one existing Region and **Link native Region**. Confirm it appears under its **native Region name**, with a Behavior status summary. The unlinked Region should not appear in the linked list. The + picker should offer only unlinked Regions.
3. Reload Foundry, reopen Atlas, and verify the association persists on exactly the same Scene and native Region. Native shapes, holes, elevation, and behavior parameters must be unchanged.
4. Use **⚙ Open native Region configuration**. Verify it opens Foundry's actual Region settings. Rename the Region, disable/enable a Behavior, and optionally hide/show the Region using native tools. After native Save, use **↻ Refresh Region list** in Atlas. Name, hidden notice and active/inactive Behavior states should reflect the new native configuration.
5. Link the second Region, then use **× Unlink Region from Atlas** on the first. Cancel confirmation first (no change), then confirm. The first native Region, all its shapes and Behaviors, and its normal effect on *actual native token movement* must remain intact. The first Region should now reappear in the + picker.
6. Verify an Atlas Region can be linked **even if no roads exist**. Regions are independent native documents, not entries in the road graph. Linking/unlinking must not change `Scene.flags.fvtt-atlas-navigation.atlas`, road names, graph segments or revision, and must not change native Scene Grid measurements.

## B. Safety and isolation

7. On a second Scene, confirm links from the first Scene do not appear. Create a native Region there, link it, and return to the first Scene; the first Scene's links should still be intact. Delete a linked native Region using Foundry's native tool and confirm Atlas no longer lists it as a dangling reference.
8. Try a native Region with **no Behaviors** and another with several Behaviors (including game-system-provided types). Atlas should display their current names/status without editing or interpreting any system-specific data. Hidden/disabled native Behaviors should be shown inactive.
9. Close and reopen Scene Configuration; switch Scenes; reload. Confirm associations remain correct and earlier Phase 2c road editing, junction creation, and padding alignment still work.
10. Test as a **non-GM**: Atlas setup/link buttons must not become available and the action adapter must reject unauthorized mutations. Use only one GM editor at a time; Foundry Region flag writes do not use atomic cross-GM compare-and-swap.
11. **Advanced corruption/future-version safety, optional in a disposable test world only:** If a Region already has an unsupported `flags.fvtt-atlas-navigation.atlas` payload, Atlas should warn and not offer to overwrite/unlink it. Do not manipulate live world flags without a backup.
12. Check browser console for errors. No new core Walls, Drawings, Region shapes, tokens, duplicated terrain multipliers, road segments or movement preview code should have been created. Report any unexpected behavior before proceeding to Phase 3.

**Scope boundary:** This milestone only stores native Region associations and shows configured Behavior status. It does **not** calculate a route, display native movement cost, selectively filter Region effects on a token, or estimate overland travel time.

---

# Phase 2c — v0.2.11 GM acceptance: safe same-road branch recovery

**Status (October 23, 2026):** The owner verified v0.2.10's other improvements, but reported that some junctions inherited from an earlier same-named-road merge could neither be Shift-click demoted nor Alt/Option-click detached. v0.2.11 repairs that gap **only with explicit section selection**. PR #3 is still draft and unmerged. Back up your world before testing.

Use the existing feature-branch manifest:
```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```
From Foundry Setup → Add-on Modules → Check for Updates, verify **0.2.11**, then reload.

## A. Recover a stuck same-road branch

1. Scene Configuration → Atlas → Roads → Edit Points on a named road with **three or more graph segments** sharing one gold junction and **no other named road** at that point (such as the old Kharak Menzor-Eyrie Sea Route merge).
2. **Alt/Option-click** the junction. A **Disconnect one section of this road?** dialog must open. Its options identify individual incident sections by compass direction, section number and short ID. Select the arm that should stop sharing the junction; cancel once and confirm that no draft data changes.
3. Reopen and choose the desired arm. **Disconnect Section** creates an initially overlapping but independent gold endpoint; the other arms and their positions stay unchanged. Drag the newly freed gold point away beyond the snap tolerance. If Foundry offers a reattachment prompt when dropping near the old junction, reject it or drag farther away.
4. The original node should now have two incident sections if it started with three. **Shift-click the original junction** after moving the detached arm to convert it to a white bend, preserving the remaining path's exact geometry. If it had four or more arms, repeat explicit single-section detachment until only two remain.
5. **Undo** must reverse each staged operation; **Cancel Edits** discards the whole draft. **Save Points** then reload: named road is still a single entry, segments retain their IDs unless you intentionally demoted a two-section pass-through, and only the chosen topology changes.
6. Repeat on a junction shared by **different named roads**. Its existing Alt/Option-click confirmation must still detach the **selected named road**, not present same-road section selection.
7. Verify a terminal gold endpoint and an ordinary two-section same-road pass-through do **not** offer branch selection; Shift-click demotion of the latter still works.
8. Inspect the console for errors. Also check Scene padding, unrelated roads, Scene switching, and persistence; no WallDocuments, native Regions, or Grid settings should change.

## B. Earlier v0.2.10 regressions

The v0.2.10 Junctions/Waypoints separation, filters and safe demotion checks are retained below for regression testing.

---

# Phase 2c — v0.2.10 GM acceptance: Junctions vs Waypoints and safe demotion

**Status (October 23, 2026):** The owner confirmed v0.2.9 middle-of-road graph-node placement and connecting distinct roads work in Foundry v14. The remaining problem was that the old Waypoints list called every graph node a junction. **This v0.2.10 update needs live Foundry testing.** PR #3 remains draft and unmerged. Back up the test world.

Use the existing feature-branch install manifest:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json
```

From Foundry Setup → Add-on Modules → Check for Updates, confirm **0.2.10**. Restart/reload as appropriate.

## A. Junctions and Waypoints are separate

1. Open an existing Scene's **Scene Configuration → Atlas**. The old **Waypoints [+]** graph-node picker should now say **Junctions [+]**. The separately labeled **Waypoints** section is a *future named location/Journal feature* with no active add control yet.
2. On a simple road with only its start and end graph points, **Junctions** must report **0**; this does **not** remove the road endpoints or prevent editing them.
3. Click **Junctions [+]** in an existing road interior. It should stage a gold graph point with **Save Points**, **Undo**, **Cancel Edits** in the Junctions section. Saving this unconnected two-segment pass-through does *not* make it a listed branch junction. It remains an editable gold point in Road → Edit Points.
4. Attach a road to that graph point (with explicit confirmation). It should then become a true junction in the inspector. The named roads stay independent; no auto-merging at geometric crossings.
5. Existing v0.2.9 data should open *without migration*. A graph with 18 endpoints/subdivisions but 3 real intersections should show the intersections, not a list of all 18 IDs.

## B. Reverse Shift-click converts a junction into a bend

1. On a test road with a white bend, choose **Edit Points**, Shift-click the white bend (promote to gold graph point), then **Shift-click the gold point** (demote back to white bend). The path shape must not move.
2. Try the reverse conversion on a single-road subdivision created in v0.2.9 and persisted earlier. **Save Points** and reload: the road name, complete visible line and native ruler behavior must be unchanged; the redundant graph subdivision and segment count decrease by one.
3. Verify **Undo** restores the gold point, and **Cancel Edits** leaves the Scene flag unchanged. A successful **Save Points** increments the Scene revision once.
4. Attempt Shift-click on a *shared intersection*, on a *three-way branch of one named road*, and on a *road endpoint*. Each must be refused (with a warning) and must not disconnect or move anything. To alter a shared intersection, continue using the existing Alt/Option-click Detach + explicit confirmation first.
5. Test a path whose road segments point in opposite `from/to` directions: reverting a subdivision should keep the same bend/path shape, with no twisted or missing section.

## C. Large-world filters

1. The Junctions inspector must default to the first selected road. Use the road selector to choose another named road; list entries should change without altering Scene flags.
2. Select **Directly connected roads**: include junctions on the chosen road and roads directly sharing its junctions, but *not* an unrelated road two hops away. Choose **All roads in Scene** for a global view.
3. Click a road's ◎ highlight: this should also select that road in the Junctions filter. Close Scene Configuration: the temporary canvas highlight clears as before.
4. Check a road with 30+ actual branching junctions: the listing should remain capped at 25 visible rows, with an explanatory count. Endpoints, subdivisions and orphaned nodes must not consume list slots.

## D. Regression and scope boundary

- Save/reload and Scene switching preserve road names, road geometry, junction attachments and unrelated Scene content.
- Double-click to add white bends, Alt-click to remove a white bend, Alt-click a shared gold node to Detach, drag to reattach with approval, Undo/Cancel, and new-road snap all still work.
- Crossing paths at a bridge remain disconnected without confirmation; no actual Foundry Walls or Regions are modified or created.
- Neither Scene Grid distance/units nor historical calibration is touched.
- v0.2.10 does **not** add named POIs, Journals, toll event logic, Regions or travel calculations. The separate descriptive Waypoints model needs its own future design and privacy review.
- Test in Foundry v14 GM client and report console warnings/errors. Automated mock checks are not a substitute for a live Foundry client.

---

## Archived v0.2.9 checklist

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
