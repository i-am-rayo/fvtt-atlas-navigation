# v0.3.9-beta.8.46 — Dual Destination Picker, clean integration

## Product owner baseline

- **v0.3.9-beta.8.45** was confirmed working in the owner's live Foundry v14 test.
- This candidate branches **directly from** `test/v0.3.9-beta.8.45-workspace-settings` and includes **only the feature and tests from #347**.
- The owner identified temporary native movement-blocking Walls in the test Scene as the reason travel previously stopped. Native collision prevention was working.
- **Do not include #346 native-movement rejection diagnostics or #349 integer waypoint normalization.** In beta.8.48, the new waypoint normalization could throw `Native movement stretch collapses to one pixel after rounding` after 8h Long Rest. Both speculative movement changes are excluded to preserve the observed working beta.8.45 behavior.

## Behavior and scope

Two explicit ways to choose navigation Point B:
1. **Map position:** regular click to set initial B, Alt/Option+click to change B. The party-token or chosen map Point A remains as before.
2. **Checkpoint directory:** select Point B by stable Checkpoint ID from sorted groups: **travel terrain → settlement / territory → associated Road**. Native HTML uses optgroup captions for the flattened hierarchy.

Terrain is derived from existing Road travel mode; territory grouping is inferred only from valid native Atlas-linked geography and explicit associations or verified containment. Ambiguous native territory matches or missing Road/mode/settlement data fall back to **Other locations / No linked road / Unclassified terrain**, rather than guessing or omitting a Checkpoint. Duplicate Checkpoint names remain distinguishable by stable ID.

Switching the *unapproved preview* selection source clears only Point B and retains Point A. Both input methods call the pre-existing route solver. A saved, recoverable, active, or completed Journey cannot be silently retargeted by either method. No persistence migration, Token movement, Region edits, World clock, Actor rest or Journal side effect occurs when choosing Point B.

## Code changes

- `scripts/navigation-checkpoint-destination.js`: explicit method toggle, ID-driven dropdown, read-only native metadata adapters
- `scripts/navigation-destination-groups.js`: pure sort/group/ambiguity handling
- `scripts/navigation-controller.js`: transient method state and matching canvas-click recovery lock
- `tests/navigation-destination-groups.test.mjs`, `tests/navigation-destination-picker.test.mjs`: taxonomy, stable IDs, unclassified fallback, preview mode switching
- Existing `tests/navigation-controller.test.mjs`, `tests/atlas-scene-workspace.test.mjs`: current Journey recovery lock and explicit method controls

**Out of scope:** contextual Road hover labels, broader UI/UX standardization, new movement APIs or animation changes, automatic rest/recovery rewriting, Region/Wall collision overrides.

## Automated quality gate

- `npm run check`
- `npm run architecture:check`
- changed-JavaScript syntax checks
- `git diff --check` and no import cycles/missing modules
- CI evidence and real Foundry tests must be reported separately

## GM Foundry v14 acceptance

**Use a backed-up / cloned World and an unobstructed route.**

1. Install branch manifest; confirm module version `0.3.9-beta.8.46`. Verify all Atlas Roads, Checkpoints, Territories and native Scene/Region flags remain unchanged.
2. Start from the assigned party Token. Set Point B anywhere on the Scene using a map click, then change B using Alt/Option+click. Route and estimates should update as in beta.8.45.
3. Switch to **Select from checkpoint list**. The previous preview B should clear, but Point A remains. Verify terrain → settlement/territory → Road group headings, stable duplicate-name options, independent checkpoints, fallback categories and deterministic ordering.
4. Choose Millstone, then The Eyrie. Both should resolve to saved Checkpoint Node coordinates; verify the preview result matches the same destination chosen via map click.
5. Switch back to map mode. Verify no prior saved Checkpoint selection remains and map Point B can be set again. Check Shift-click Point A/party departure rules and ordinary map interaction.
6. Test recoverable Journey lock with an existing paused or interrupted Journal: neither selector may mutate the original approved Point B. Recover through existing native workflow.
7. On a **clean unobstructed route**, start a >8h GM Journey, reach a daily-limit Long Rest, approve the 8h break, verify stationary hold, World clock advance *exactly once*, Journey Journal rest event, subsequent native movement, checkpoint continuation and arrival.
8. Refresh/reload after a confirmed chunk and during a safe Journey pause; verify Journal/Token/clock rejoin, no duplicate movement/rest/payment/time or unconfirmed progress.
9. Verify non-GM clients cannot see GM authoring controls, unpublished Checkpoints or secret territory metadata; player labels, fog and native Regions retain beta.8.45 behavior.

## Merge / release gate

A successful automated run plus owner GM and non-GM acceptance is required before `main` integration. No merge, force-push or final release is authorized by creation of this draft candidate alone. Preserve the working beta.8.45 manifest for immediate rollback.

### Manifest
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.46-dual-destination-clean/module.json

### Archive
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.46-dual-destination-clean.zip
