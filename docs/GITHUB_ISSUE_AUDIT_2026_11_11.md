# Atlas GitHub issue audit — 2026-11-11

**Repo:** [i-am-rayo/fvtt-atlas-navigation](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues). **Inventory at audit:** 56 tracked issues = **2 closed + 54 open**. This is an issue count, not a percentage of module features implemented: one umbrella issue may cover years of work, and a feature slice can be implemented but still require additional acceptance.

## Confirmed closed — 2

- [#288](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/288): Checkpoint→existing Territory suggested matching, including exact/close-prefix names; owner reported the result successful.
- [#290](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/290): same-kind settlement candidate filtering; owner reported the result successful.

No other issue was closed in this audit. The remaining tickets have an explicit unmet contract, known failing behavior, future scope, or uncompleted native Foundry v14 acceptance. **Do not mark an entire umbrella issue complete merely because a component shipped.**

## Implemented slices / active acceptance — 15 open

| Issue | Verified implementation to date | Why the ticket stays open |
| --- | --- | --- |
| [#292](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/292) | One-cell native Territory offer and same-kind existing link (beta.8.29). | Full Hex/Square, stale/retry/partial failure and concurrent-GM live matrix outstanding. |
| [#301](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/301) | Minimizable Road and consolidated Territory Settings delivered. | Unsaved form preservation, multiple windows, focus, Scene switching and two-client verification outstanding. |
| [#293](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/293) | Four-tab Territory Settings (beta.8.30); disabled-button fix in beta.8.30.1. | Validate every native editor/association action and state preservation live. |
| [#291](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/291) | Associated Checkpoint and Journal shortcut available in Territory Settings. | Requested *Territory directory* Journal-status icon and player-safe state matrix incomplete. |
| [#289](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/289) | Contextual editor titles in beta.8.28. | Rename, stale/unsaved name and two-editor lifecycle acceptance incomplete. |
| [#265](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/265) | Recovery and grid-cell transfer stages. | Full multi-source/recovery/undo guarantees and live matrix still in progress. |
| [#264](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/264) | Shared-border and grid-cell editor improvements. | Complete multi-Region seam-safe editing and atomicity require further work. |
| [#216](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216) | Settings and editor icon/form consistency improvements. | Broad UI/accessibility contract covers other editors beyond current changes. |
| [#228](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/228) | Modular cinematic banner foundation and multiple event triggers. | Entire event/lifecycle/theme/queue acceptance not complete. |
| [#204](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/204) | Native Hex/Grid Region authoring and polygon conversion accepted. | Spatial containment, hierarchy, derived membership and transfer refresh remain explicit unchecked items. |
| [#186](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/186) | Generator minimize-on-preview and close-on-success delivered beta.8.30. | Native creation, cancellation, stale state, focus and failure paths need live acceptance. |
| [#226](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/226) | Original arrival-banner visual foundation shown to GM/player. | Two-client security, idempotency, wrong Scene, reduced motion and recovery matrix remains open. |
| [#269](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/269) | Player Atlas Layers with explicit boundary publication and Fog-underlay successfully tested. | Raw native/Scene distribution confidentiality, revoke and reconnect acceptance is wider. |
| [#268](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/268) | Explicit Region↔Checkpoint semantic link and some derived parent behavior. | Complete native spatial membership/overlap and stale/reconnect matrix incomplete. |
| [#215](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/215) | Initial generated Journey Journal visual treatment accepted. | *Completed Journal* final redesign to mirror the Navigation window remains planned. |

## Known unresolved bugs — 4 open

- [#224](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/224): checkpoint-boundary A/B/C progress desynchronization after redraw.
- [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189): weather-triggered canvas rebuild blocks checkpoint-transfer recovery.
- [#135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135): Foundry canvas rebuild interrupts some active guided travel.
- [#218](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/218): guided travel appears stopped while GM client is backgrounded.

## Master roadmap — 1 open

- [#271](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/271): master Hex/Grid-first plan contains many independent checked and unchecked tasks; intentionally stays open until the roadmap is complete.

## Future or broad not-yet-accepted feature contracts — 34 open

| Workstream | Open issues |
| --- | --- |
| Territory appearance, polygon and Fog | [#294](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/294) Checkpoint icon label; [#295](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/295) typography; [#270](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/270) polygon transfers; [#267](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/267) Road/cost audit; [#266](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/266) Lore/Seen/Explored contract; [#198](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/198) player preview; [#214](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/214) exploration controls. |
| Roads and navigation topology | [#206](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/206) independent Checkpoints; [#211](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/211) land/water/air networks; [#209](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/209) bridges; [#208](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/208) elevation; [#212](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/212) A/B/C labels; [#196](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/196) measured Road distance; [#195](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/195) Shift-merge; [#200](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/200) slicing; [#222](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/222) irregularity; [#221](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/221) continuous curvature. |
| Journey/transport services | [#207](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/207) Inns; [#210](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/210) teleport; [#213](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/213) fast travel; [#203](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/203) pamphlet; [#202](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/202) rest state machine; [#201](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/201) player rest; [#136](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/136) schedules; [#199](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/199) tolls; [#197](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/197) Group transport; [#192](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/192) progress bar; [#194](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/194) playback speed. |
| UX, portability and camera | [#233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233) themes/borders; [#191](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/191) Lore camera; [#217](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/217) Scene import/export; [#205](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/205) portable schema; [#193](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/193) player camera follow; [#187](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/187) Checkpoint relocation. |

## Recommended issue-management rule

For each owner-accepted milestone, cross-check the issue's **complete** acceptance section against actual tests. Close a scoped issue only when all required behavior is implemented and live-tested (or owner explicitly narrows its scope). Link the tested build/PR and acceptance evidence in a closing comment. Keep umbrella roadmaps open while their checklists contain unchecked items. For implementation-only progress, add a comment/checklist update without closing. This prevents misleading completion counts and losing unresolved requirements.
