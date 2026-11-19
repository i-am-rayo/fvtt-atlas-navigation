# Atlas 0.3.11 — Milestone 01 UI stabilization

## Owner-accepted changes

Cumulative UI changes through `0.3.11-dev.21`, including:

- Atlas Workspace, Map Directory, contextual record names/counts and user-facing Map Marker terminology.
- Road, Map Marker, native Territory and World preset controls, accessible tabs/fields, focused buttons, staged Save/Cancel and independent sequential settings saves.
- Road- and Map Marker-authoring panel parity with Paint Territory, with Foundry v14 native window positioning and without redundant instruction toasts.
- GM-scoped authoring and permission-preserving read-only display improvements. No gameplay authority/schema migration introduced for this release.

## Verification and limitations

- Owner confirmed dev.21 works in live Foundry v14 on 2026-11-19. Automated validation of dev.21: **1,139 tests passed**, architecture **4/4**, zero missing imports/cycles. Mainline release branch CI must also pass independently.
- Full independent GM/non-GM live acceptance logs were not supplied for every UI subfeature. Automated tests do not substitute for those cases.
- **Known open issue #453:** intermittent first Atlas boot immediately following an update fails while loading a static JavaScript module; normal reload typically succeeds. The root cause is not proven. Do not state that 0.3.11 fixes it.
- **Performance issue #455:** ordinary warm-cache browser loads revalidate cached assets successfully; further server/proxy and bootstrap profiling is deferred. No speculative Atlas compendium cache or retry/auto-reload logic introduced.
- Unrelated native Region/Journey recoverability work remains open and is not represented as fixed.

## Install manifest

https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/main/module.json

This branch-based archive points to the current `main` branch. For reproducible historical versions, use the exact merged commit or a separately authorized release/tag.
