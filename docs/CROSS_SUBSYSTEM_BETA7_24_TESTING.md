# v0.3.8-beta.7.24 — Cross-subsystem regression & compatibility gate

**Status:** draft test build, local automated and architecture verification
passed. **Owner live acceptance:** beta.7.23 passed on GM and non-GM
clients (owner report, November 5, 2026); owner later reported other
beta.7.24 behavior looked correct but **the original Journey again failed to
continue**. This is a partial positive report, not a full 14-row PASS.
The newer 5.8%-unconfirmed recovery failure is logged as another occurrence
under bug #189. The GM/player matrix still needs individual outcomes.
This branch stacks on beta.7.23 draft PR #190. It makes no runtime changes,
storage migrations or new gameplay features. Test in a backed-up Foundry v14
World; preserve native Region/Fog/Token/Journal ownership.

## Automated integration contract

`tests/cross-subsystem-beta724.test.mjs` composes **existing public modules**
instead of mocking an impossible all-in-one controller:

1. GM adds Road, Checkpoint and Road bend through revision-checked Scene Atlas
   writes; stable Checkpoint ID/node, manual Fog and native Region geometry,
   elevation and Behaviors are unchanged. Stale edits and non-GM mutations
   are rejected without writes.
2. A permitted Checkpoint on a hidden Road exposes only its player-visible
   identity; Road geometry/name/elevation remain hidden. Manual Hide wins
   over checkpoint reveal. Native Region overlay reads preserve a GM-edited
   polygon and report provenance mismatch without regenerating it. Repeated
   canvas-style reads do not write Scene or Region flags.
3. Legacy Scene reads stay read-only; approved interrupted transport recovery
   selection is a pure query and rejects a changed surface/method. This does
   **not** simulate or solve real interrupted token/Journal anchor recovery.

Developer loop: `npm run test:focused -- tests/cross-subsystem-beta724.test.mjs`
or other relevant test files. **Full upload gate:** `npm run check` (all
accumulated tests and syntax checks), `npm run architecture:check`, targeted
`node --check`, `git diff --check`. Targeted runs accelerate iteration;
they are *not* a replacement for the full test suite before a published PR.

**Local verification (2026-11-05):** `npm run check` passed **683/683** tests,
including three new cross-subsystem cases; `npm run architecture:check`
found 142 JS files, 417 imports, zero cycles and zero missing targets.
The focused test command, new JS syntax check and `git diff --check` passed.

## Owner Foundry v14 cross-subsystem test matrix

Perform separate GM and non-GM client runs. Record *Pass / Fail / Blocked*
per row; do not assume prior successful subsystem tests prove interactions.

| ID | Live scenario | Required observation |
| --- | --- | --- |
| X24-01 | Edit Road geometry, Undo/Cancel/Save; create interior/shared-junction Checkpoint | IDs/connectivity preserved; unsaved drafts not written; non-GM cannot edit |
| X24-02 | Refresh Canvas, pan/zoom, change Scene padding and switch Scenes | Road/Checkpoint locations stay image-relative; no unsaved edit loss or cross-Scene mutation |
| X24-03 | Generate Region preview and create one native corridor/area; reload | Native Region ID, geometry, elevations, Levels and Behaviors unchanged; no duplicate Create |
| X24-04 | Manually edit native Region, including holes/overlap/elevation, then refresh Atlas | Native geometry/Behaviors preserved; modified provenance reported, no silent regeneration |
| X24-05 | Sample land/water/air travel presets and Region surface color | Visual preset/color do not override native movement-cost Behaviors or road routing |
| X24-06 | Player shows hidden/visible Road and independent Lore/Seen Checkpoint | No hidden Road labels/hover/cluster/GM metadata in canvas; cannot edit Atlas; raw Scene flags **may still be readable** |
| X24-07 | Square and hex native Grid, manual Reveal/Hide, checkpoint radius and padding | Hide always wins, native FogExploration/vision untouched, no uncovered flash on redraw |
| X24-08 | Start approved journey, reach checkpoint transfer, continue road/vehicle leg | Only confirmed TokenDocument/Journal progress is durable; original Point B retained; fares and World time counted once |
| X24-09 | Short/Long Rest, manual pause, resume, complete and reread Journal | No duplicate rest effects/fare/clock/Journal events; native Token location persists |
| X24-10 | During Journey, trigger native weather/day rollover Region/Scene update and Canvas rebuild | Record lifecycle stack and coordinates pre/post redraw; recovery must verify confirmed native Token vs Journal anchor |
| X24-11 | GM minimized/backgrounded; separate player watches same Journey | Capture whether authoritative movement/time stops or only visual animation; report issue #218 evidence |
| X24-12 | Disconnect/reconnect non-GM; rerender canvas repeatedly with GM Trace | No stale highlight timers, event listeners, PIXI leaks or duplicate Journey writes; record redraw timing and memory trend |
| X24-13 | Existing pre-beta legacy Scene, completed Journey and managed native Regions | No write-on-read upgrades, ID changes or loss of manual edits; new test build displays old data |
| X24-14 | Non-GM attempts Scene Atlas authoring and privileged Journey/World actions | Server/native permissions reject changes; visual filtering alone is not relied upon for secrecy |

### Blocking known incidents

- [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189):
  previous owner log showed an interrupted checkpoint-transfer voyage whose
  native Token moved beyond its last confirmed Journey anchor. Atlas rightly
  withheld automatic continuation; later manually starting a new Journey is
  **not** proof of recovery. **Do not mark X24-08/X24-10 full PASS until the
  mismatch has a tested safe resolution or the owner explicitly scopes an
  isolation gate.** Do not bypass the guard or rewrite the Journal to fit.
- [#135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135):
  Canvas rebuild trigger still needs attribution; a third-party weather
  Scene update is supported by one owner trace, not a universal cause.
- [#218](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/218):
  inactive-GM travel requires evidence that distinguishes a native movement
  pause from a cosmetic player animation stall.

## Exit policy

- Passing automated tests establishes source-level boundaries only, **not**
  Foundry v14 compatibility across weather, Levels, real native documents,
  GM/non-GM clients, token moves, multileg recovery or canvas lifecycle.
- Owner marks individual rows; any new live regression halts dependent work.
- beta.7.24 remains a draft; no merge/release until owner authorization.
- The future-feature register is
  [FEATURE_ISSUE_REGISTER_2026_11_05.md](FEATURE_ISSUE_REGISTER_2026_11_05.md).
