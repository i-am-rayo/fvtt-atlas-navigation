# Navigation Point B selection — v0.3.9-beta.8.47

## Product request
Provide two equally supported, explicit **preview** methods:
1. **Click a location on the map** (party token or Map Point A; regular click to set initial B; Alt/Option+click to replace B).
2. **Select from checkpoint list**, grouped in this priority: **travel terrain → named settlement/territory → associated Road**. Groups are HTML optgroups with flattened hierarchy labels; native HTML does not support nested optgroups. Each option retains its stable Checkpoint ID.

When switching modes while no Journey is approved/recoverable, Atlas clears only the current preview Point B, retains Point A, recalculates nothing until B is selected, and shows the relevant control. A named destination selects the exact saved Atlas node and calls the same existing route calculation as map clicks. The saved Journey destination is never changed by a preview-mode toggle.

## Categorization
- Terrain is derived from the associated Road's authored World travel preset, using the existing land/water/air mode resolver.
- Settlement is derived from *linked, classified* native territory metadata and verified grid containment or an explicit Region→Checkpoint association. A unique most-specific city/town/village/settlement takes priority over area/continent. Same-tier overlaps are ambiguous and fall back to “Other locations.”
- A Checkpoint with no associated Road displays “No linked road.” A Road with no supported travel mode displays “Unclassified terrain.” All Checkpoints remain selectable even without geography, a Road, or native map data.
- Sorting is deterministic by terrain, settlement, Road, and Checkpoint; duplicate Checkpoint names are disambiguated with their stable IDs.
- No background scan writes Region/Scene flags or changes native Regions/Behaviors.

## Safeguards
- The selector is absent while an active, paused-for-transfer, recoverable or completed Journey locks Point B. Recovery must finish through the existing Journal workflow, not a UI override.
- The existing GM + Scene update permission guard, canvas readiness, original Point A rules, and route revision checks remain.
- No token movement, Journal approval, currency, World-time or Fog writing happens on either selection.
- The two controls are not a fix for the separately reported public `TokenDocument.move` rejection: beta.8.46 diagnostics are included here for further investigation.

## Targeted automated coverage
`tests/navigation-destination-groups.test.mjs`: grouping priority, duplicate stable IDs, settlement hierarchy, peer ambiguity, unclassified fallback and no mutation.

`tests/navigation-destination-picker.test.mjs`: DOM mode choice, checkpoint saved Node, clearing only Point B when switching, no automatic travel and saved-Journey lock.

Existing `tests/navigation-selection.test.mjs`: map-click A/B, Alt/Option replacement and input modifiers.

Required before release: `npm run check`, `npm run architecture:check`, JS syntax, `git diff --check`, plus actual Foundry v14 GM/non-GM acceptance.

## Owner acceptance
1. Back up test World. Inspect the current **Port Barthos→Millstone 0% Journey** before doing anything; do not forget or resume until actual TokenDocument/Journal recovery state is reconciled.
2. With a clean unrelated Scene/Journey, open Navigation. Ensure **Click a location on the map** is selected by default. Use party Point A, click an arbitrary map position B, verify route. Alt/Option+click changes B.
3. Switch to checkpoint-list method; verify old preview Point B clears and Point A stays. Select Millstone and confirm B matches its saved Atlas Node. Then choose The Eyrie; no extra Road group or renamed Road should appear.
4. Inspect optgroup headings: **Land/Water/Air → native Settlement/Territory → associated Road**. In a Scene with classified geographic Regions, check correct labels; in unclassified areas, verify neutral fallbacks. Confirm no destination is missing. Duplicated names must retain unique stable-ID selections.
5. Switch back to map, click a new B; verify the route is recalculated and Checkpoint ID is cleared.
6. Test disconnected/off-road B and a Checkpoint on an independent Node. Route errors, when applicable, should be identical for selecting the same position by either method.
7. Start/resume only a separately confirmed safe, unblocked Journey. Native movement must remain GM-authorized; no duplicate Token/World time/Journal writes. If `TokenDocument.move` returns false, capture the new bounded diagnostic and stop. Do not retry or bypass the native blocker.
8. Non-GM: no extra GM Navigation authority or hidden native territory metadata should leak through player UI.
9. Canvas refresh, checkpoint pause/continuation and native Foundry Scene/Region/Fog behavior must remain unchanged.

## Install
Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.47-dual-destination-picker/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.47-dual-destination-picker.zip

No Atlas graph, native Region, Journey Journal or World setting migration. Draft only.
