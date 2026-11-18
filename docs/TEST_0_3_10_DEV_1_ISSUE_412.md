# Atlas 0.3.10-dev.1 — Map Marker Type versus assigned World Preset

**Scope:** [issue #412](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/412) · [Milestone 01](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/1) · Foundry VTT v14 · draft [PR #424](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/424).

**Install test build using this manifest** (not the released `main` manifest):

`https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.9-m01-412-marker-type-independent-preset/module.json`

**Archive:** `https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.9-m01-412-marker-type-independent-preset.zip`

## What changed

Changing **Map Marker Type** in the placed-marker Settings window no longer automatically selects another World preset or applies the new type's suggested appearance/discovery/Journal/transportation defaults. **Change preset** remains the explicit action that applies all selected World-preset values to the *local draft*. Save still uses the existing guarded writers.

**Persistence and architecture:** This is a presentation-event correction only. The existing `checkpointCategories` flag remains independent from the World preset assignment (`checkpointPresetAssignments`). No new schema or migrations; no Scene/Region/Token/Actor/Journal/World-time write on type input. Existing GM permission, stale-revision Save checks, preset-identity verification and native document ownership stay in place.

## Owner Foundry v14 acceptance — backed-up disposable Scene

1. Open a placed Map Marker with **World preset A** assigned. Customize its marker color, Banner selection, player visibility, Journal link or transportation service separately. Note the values before changing Type.
2. Change **Map Marker Type** to a different category that has a World preset B. **Before Save**, verify the chosen World preset still shows **A**, and your other customized fields remain unchanged. Closing via Cancel/Discard must not write.
3. Repeat and **Save Map Marker**. Reopen: Type changed, preset assignment remains **A**, and independent color/Banner/visibility/Journal/service values are retained.
4. Use **Change preset** deliberately to choose **B**. Verify this action *does* apply B's editable defaults to the current draft. Save and reopen: B is assigned; it does not retroactively change the World preset record itself.
5. Check a Map Marker with no assigned preset and an old Scene entry, plus creation of a new independent marker: changing Type should not auto-assign a preset; an explicit preset choice should still work.
6. Try opening the same GM editor as a non-GM: editing must be denied. Confirm no unapproved Player reveal, native Region, Road graph or Journey effects.

**Stop and report:** If any unrelated field resets on Type change, preset assignment silently changes, a Save fails partway through, or player visibility becomes exposed, keep PR #424 in draft and provide the Scene/World backup plus console diagnostic. Do not delete/rebuild the marker to work around it.

## Automated checks

`npm run check`, `npm run architecture:check`, syntax checks and diff whitespace verification are required before owner acceptance. DOM regression coverage exercises type-only input after explicit preset selection and proves no early Scene write. Automated passes do **not** replace the Foundry GM/non-GM live test.
