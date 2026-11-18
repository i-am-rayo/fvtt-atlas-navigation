# Atlas v0.3.9 — mainline baseline

**Foundry compatibility:** v14 minimum. **Product Owner decision (2026-11-18):** promote the cumulative owner-tested beta.8.62.1 code to version **0.3.9**, integrate it into `main`, then use short-lived goal-based development branches. This is a baseline consolidation, **not** a claim that all 47 open feature/defect issues were accepted or completed.

## Release boundaries

- The version/manifest promotion changes only package metadata, documentation and a release-manifest test. There are **no new persistence migrations, gameplay writers, or native Foundry document changes** in this release-specific delta.
- `module.json` and `package.json` must both declare `0.3.9`. After merge, the public mainline manifest is:
  `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/main/module.json`
- Mainline archive:
  `https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/main.zip`
- `main` is the single approved development baseline. Future milestones use their GitHub-native goals; start new focused branches from verified `main`, not another cumulative beta/test PR stack.
- The pre-merge beta.8.62.1 owner pass covered the most recent UI changes, including the Road/Territory subtitle. It did **not** establish all old edge-case, permission, multi-World or failure-recovery gates. Release status must not imply otherwise.

## Known unresolved contracts — keep open

- [#265](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/265): interrupted native multi-Territory transfer recovery, many-to-many edits and confirmed undo remain outstanding. Do **not** try to bypass an existing recovery ledger; preserve it and require GM review.
- [#135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135), [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189), [#218](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/218), [#224](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/224): canvas/weather/GM background/leg-target interruption and authoritative TokenDocument/Journal state recovery remain unverified. Stop on mismatch; never fabricate confirmed movement, World time, rest or fares.
- [#205](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/205), [#217](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/217): external Journal/Page UUIDs and icon/asset paths are not guaranteed to survive native Scene JSON transfers to unrelated Worlds.
- [#269](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/269): published geometry and genuine non-GM privacy/fog validation remain independent acceptance gates. Player-only projection of UI is **not** confidentiality.
- [#216](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216), [#289](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/289): remaining Milestone 01 editor/accessibility and external-rename title behavior.

All other outstanding work remains in the [ten goal-based GitHub Milestones](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestones). The original roadmap [#271](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/271) was archived as superseded, not completed.

## Owner live acceptance checklist (backed-up Foundry v14 World)

These are **not** automatically passed by GitHub CI. Record the actual installed module version and test results before using a production World or publishing a distribution release.

1. Back up the World and capture its Scene, Region/Behavior, Atlas Scene flags, existing Journey Journal and TokenDocument snapshots. Refresh the Foundry client after installing.
2. **GM:** open all Workspace sections; check Road, Map Marker and Territory Settings, keyboard and icon actions, minimize/restore, unsaved Save/Discard/Cancel/Undo, Locate and 200% browser zoom.
3. **GM:** create/edit a non-critical Road, connected and independent Map Marker, and native Region in a disposable Scene. Cancel before commit and reload; assert stable IDs, Road graph, native Region Shapes/Behaviors and absence of unintended writes.
4. **Non-GM client:** check allowed and hidden Road/Map Marker/Territory views under native and manual Fog, linked Journal permissions, player Layers toggles and absence of GM-only authoring actions or hidden metadata.
5. **Journey:** in a backed-up safe test World, check start, native Token movement, pause/continue, manual rest, transport transfer, Journal and World-time agreement, canvas reload, and interruption at a checkpoint; avoid asserting that #189/#224 are fixed.
6. **Portability:** only on an isolated target World, inspect dependencies before native Scene transfer; ensure missing Journal UUIDs and external image paths are flagged, not silently repaired.
7. **Post-merge:** verify `main/module.json` and `main.zip` return the promoted version, GitHub Actions for the main push pass, and PR #405 is merged rather than merely closed.

**Stop condition:** If Foundry data is inconsistent, native Region recovery is blocked, the Journal/Token anchor diverges, or a non-GM can access hidden metadata, do not advance those workflows or claim live acceptance. Preserve state, logs and original documents for a scoped fix.
