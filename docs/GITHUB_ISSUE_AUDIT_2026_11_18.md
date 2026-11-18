# Open GitHub Issue audit — 2026-11-18

**Repository:** [fvtt-atlas-navigation](https://github.com/i-am-rayo/fvtt-atlas-navigation). **Reviewed against:** current draft beta.8.62.1 integration [PR #405](https://github.com/i-am-rayo/fvtt-atlas-navigation/pull/405), its native Foundry adapters and regression tests, recorded Product Owner live outcomes, and individual issue bodies/comments.

**Result:** 53 open issues before audit → **5 closed as completed** → **48 still open**, including one historical roadmap issue #271. Exactly one draft integration PR (#405) remains open separately; GitHub counts PRs as issues in some APIs. No gameplay implementation, release, native data mutation or PR merge was performed.

## Closed — feature workflows implemented and reported owner-successful

| Issue | Specific completed scope | Work intentionally still open |
|---|---|---|
| [#186](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/186) | Terrain Region generator preview minimize / cancel restore / successful create close | Native Region recovery #265, spatial membership #204, general UI #216 |
| [#292](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/292) | GM opt-in one-cell City/Town/Village/Settlement Region + stable Checkpoint link | General containment #204/#268, peer recovery #265, player exposure #269 |
| [#293](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/293) | Four-tab modeless consolidated Territory Settings with existing explicit native action confirmation | Whole-module UI #216, geographic membership #268 |
| [#301](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/301) | Modeless/minimizable Road/Territory Settings and guarded draft lifecycle | Whole-editor parity and edge cases #216 |
| [#226](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/226) | Confirmed checkpoint-arrival GM/player banner, player-safe payload and local deduplication | Full event catalog #228 and Journey redraw/recovery defects #135/#189/#224 |

The owner reported beta.8.30.1 and beta.4 successful for the applicable workflows. These results support the delivered **scoped** features but do not prove every possible non-GM or recovery edge case. Closure comments record code/tests and leave those independently tracked concerns open. Do not silently use closed issue status as proof that separate data-safety milestones passed.

## All remaining open issue assignments — ordered goal milestones (proposed, not yet GitHub-created)

### 01 — Baseline Integration & Authoring Acceptance — 1 open

- [#206](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/206) — New Feature: Road-independent Node-anchored Checkpoints

### 02 — Native Territory Integrity & Recoverable Editing — 4 open

- [#265](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/265) — Hex/Grid Territory: multi-source cell transfers with recovery and undo
- [#264](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/264) — Hex/Grid Territory: shared-cell boundary editor and seam-safe preview
- [#268](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/268) — Checkpoint–Territory: spatial membership and explicit semantic links
- [#204](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/204) — New Feature: Native Region spatial containment and Regions [+] authoring

### 03 — Journey Authority, Resume & Canvas Resilience — 4 open

- [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189) — Bug: checkpoint-transfer Journey recovery blocked after weather-triggered canvas rebuild
- [#135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135) — Known issue: Foundry canvas rebuild interrupts active Atlas guided navigation
- [#224](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/224) — Bug: canvas redraw at checkpoint boundary leaves saved A/B/C target out of sync
- [#218](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/218) — Bug investigation: active guided travel appears stopped when GM client is backgrounded

### 04 — Native Scene Portability & Private Beta Handoff — 2 open

- [#205](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/205) — New Feature: Versioned Atlas Scene portability schema and ID-remap contract
- [#217](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/217) — New Feature: Scene-only Atlas import/export with preview and rollback

### 05 — Road, Map Marker & Surface Topology Refinement — 7 open

- [#187](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/187) — Improvement: relocate a Checkpoint from one map point to another with safe Node handling
- [#195](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/195) — New Feature: Road Editor Shift-click merge action parity
- [#200](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/200) — New Feature: Road slicing with topology-safe graph transaction
- [#196](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/196) — New Feature: Display measured authored Road distance
- [#267](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/267) — Road and Surface: Hex/Grid Territory corridor classification and cost audit
- [#221](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/221) — New Feature: continuous road curvature strength slider beyond current Strong
- [#222](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/222) — New Feature: optional bounded road irregularity / uneven turns control

### 06 — Player Atlas, Visibility, Fog & Discovery — 5 open

- [#269](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/269) — Player Atlas Layers: GM-authorized Hex/Grid Territory visibility and local toggles
- [#266](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/266) — Discovery and Fog: Lore, Seen and Explored state/visibility contract
- [#198](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/198) — New Feature: GM preview of player-visible Atlas discovery state
- [#191](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/191) — New Feature: cinematic player camera focus when a Checkpoint is revealed through Lore
- [#214](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/214) — New Feature: Token Settings Atlas exploration control redesign

### 07 — Navigation & Player Journey Experience — 6 open

- [#192](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/192) — New Feature: Player Journey progress bar
- [#193](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/193) — New Feature: Player-local camera follow during guided travel
- [#194](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/194) — New Feature: GM-controlled visual playback speed
- [#212](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/212) — New Feature: Stable logical A-to-B-to-C Journey waypoint lettering
- [#213](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/213) — New Feature: GM-authorized fast-travel mode
- [#215](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/215) — New Feature: Completed Journey Journal visual redesign

### 08 — Transportation, Services, Rest & Economy — 8 open

- [#136](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/136) — Roadmap: scheduled departures and on-call hire availability at checkpoints
- [#197](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/197) — New Feature: Group Actor party-owned transportation editor parity
- [#203](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/203) — New Feature: Player-facing Checkpoint transportation pamphlet
- [#201](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/201) — New Feature: Player request for Short or Long Rest during travel
- [#202](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/202) — New Feature: Interrupted and programmed Journey rest/event state machine
- [#207](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/207) — New Feature: Inn Checkpoint services and accommodations
- [#199](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/199) — New Feature: Toll Checkpoint services
- [#209](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/209) — New Feature: Bridge Checkpoint/road-crossing properties

### 09 — Announcements, Narration & Territory Appearance — 4 open

- [#228](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/228) — New Feature: modular Atlas cinematic announcements for Journey and discovery events
- [#233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233) — Future UX: system-neutral themes, generic destination wording, and Region border banners
- [#294](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/294) — Linked Territory label: prefix the associated Checkpoint's approved icon
- [#295](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/295) — Territory label typography: per-Territory styles and World defaults by Geographic kind

### 10 — Advanced Traversal & Optional Geometry — 4 open

- [#211](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/211) — New Feature: Distinct land, water and air network topology
- [#208](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/208) — New Feature: Measured Road slope and elevation-aware travel
- [#210](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/210) — New Feature: Teleport gates as typed travel transfers
- [#270](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/270) — Backlog: advanced polygon Territory seam editing and multi-polygon transfers

### 11 — Product UX, Performance & Release Readiness — 2 open

- [#216](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216) — New Feature: Atlas editor icon and form visual consistency
- [#289](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/289) — Settings windows: include the edited Road/Checkpoint/Territory name in title

### Legacy roadmap — 1 open

- [#271](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/271) — historical Sunday private-beta roadmap. **Keep open** until 11 actual native GitHub Milestone records and all issue assignments are created and verified. The source is preserved; the current dependency-based plan is [GITHUB_MILESTONE_ROADMAP.md](GITHUB_MILESTONE_ROADMAP.md).

## Items not closed despite substantial implementation

- **#289 contextual titles:** Initial Road/Map Marker/Territory title formatting exists and passes Node tests. Native Territory renames made while the Territory Settings window remains open do not have a verified title-refresh path. Test that precise live behavior before closure.
- **#194 visual playback speed:** Configuration/implementation exists in later Navigation betas, but independent GM/non-GM pause/resume, Canvas refresh and speed-change acceptance from the owner is not documented. Do not equate beta.8.62.1 Road hover success with playback-safety acceptance.
- **#187/#200/#206 topology:** A narrower standalone/checkpoint-junction slice was owner-tested; the original contracts still include shared-Node detachment, complex Road slicing, schema compatibility and player/recovery gates.
- **#204/#264/#265/#268 native geography:** Native grid editing, overlap review and links have working slices, but the original ledger specifically retains multi-source recovery, elevation/Levels, mixed Shapes and authoritative stale-state checks.
- **#198/#266/#269 player visibility:** Territory-only previews and publication foundation were tested; selected-player discovery, reconnect/revoke and true non-GM confidentiality are still independent gates.
- **#135/#189/#218/#224 Journey bugs:** A successful unrelated Journey does **not** demonstrate recovery of the original weather-triggered interruption, saved A/B/C mismatch or background-GM incident. Preserve fail-closed guards until actual state-transition reproduction and live resolution.
- **#205/#217 portability:** Native Scene JSON carried map data in the owner's cross-World test, but external asset paths, Journal Entry/Page UUIDs, permission coverage, native Region Behavior validation and semantic re-export remain unverified.
- **#216 and #228:** Broad multi-editor accessibility and full announcement event/queue acceptance must not be inferred from completed focused UI and checkpoint-banner issues.
- Remaining open features are deliberately planned/deferred; do not close simply because a supporting subsystem already exists.

## Completion policy

1. Keep each distinct scope issue open until its *own* behavior and required GM/non-GM, native-data and failure-mode acceptance have evidence, regardless of merged/closed predecessor PRs.
2. For focused completed work, close as GitHub `completed` with a concise trace to current source and the owner test. Retain broader active issues separately.
3. Use the **11 goal milestones**, not per-beta or per-PR milestones, after GitHub native records exist. Keep #405 a draft integration PR against `main` pending owner authorization. No silent merges or World-data migrations.

**Audit accounting invariant:** 47 active feature/defect issues + one legacy roadmap issue (#271) = 48 open issues; zero unaccounted issue numbers from the live GitHub open-issue listing at audit time.
