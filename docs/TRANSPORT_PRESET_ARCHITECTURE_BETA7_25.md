# v0.3.8-beta.7.25 — Transportation Methods & Presets architecture assessment

**Status: source-backed assessment only.** Authorized by the Product Owner on
November 5, 2026. Stacked on beta.7.24 draft PR #219. No Foundry runtime,
Journey recovery, World/Scene/Region/Actor/Journal flag, schema, calendar,
gameplay, UI or permission change is implemented here. The installed module
should behave exactly like beta.7.24 apart from its test-build version.

**Owner evidence:** beta.7.23 passed GM and player tests. The owner reports
other beta.7.24 functions working, but guided Journey recovery **again failed**;
[bug #189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189)
now contains the new 5.8%-unconfirmed continuation error (in addition to the
earlier 32.6% case) and a SimpleTimekeeping weather/Scene redraw stack. The
current guard correctly refuses to invent unconfirmed travel; **beta.7.24
cross-subsystem Journey acceptance remains blocked**. This audit does not
identify or repair the distance mismatch.

## 1. Vocabulary, ownership, and schema contracts

Transportation and terrain are **different concepts**. A vehicle/pace defines
how a party moves and the authorized cost; a terrain preset describes where it
travels, which surfaces are eligible, and optional native movement Behaviors.
They meet during *read-only route planning* and never overwrite each other.

| Data / contract | Authoritative owner | Current implementation | Critical separation |
| --- | --- | --- | --- |
| World transportation method catalog | World `guidedTransportationCatalog` v3; current rules profile | `navigation-transport-catalog.js`: built-in 2014/2024 profiles, custom methods, speed, capacity, crew, costs, service settings, v1/v2 compatibility reader | No Scene/Actor/Token/Journal writes; labels/presets are recommendations until chosen |
| World travel-day rules | World `guidedTravelRulesProfile` and custom rest/day settings | `navigation-rules-profile.js`, `navigation-travel-method.js` | D&D5e adapter is optional; non-D&D rules may have no daily cap; overland speed differs from tactical Token speed |
| Party-owned transport | World `guidedGroupTransportation` v4 scoped by stable Group/Actor IDs; D&D5e Group Actor is read | `navigation-group-transport.js`, `navigation-group-transport-settings.js` | Group Actor owns members/resources; Atlas settings are *assignments*, not a second editable Actor roster |
| Checkpoint hire/service offers | Scene `checkpointTransportOffers` v1 keyed by stable Checkpoint ID | `checkpoint-transportation.js`, editor; `navigation-controller.js:saveNavigationCheckpointOffer` | Scene-local offers override compatible World method fields; GM creates/edits, not automatically inferred from a Road |
| Terrain/surface preset catalog | World `corridorTravelPresets` v3; Road stores `travelPresetId` | `travel-preset-model.js`, `travel-preset-settings.js`, `navigation-transport-transitions.js` | Road surface classification/terrain cost projection, **not** transport method identity or speed |
| Native Region terrain applicability | Foundry `RegionDocument` shapes, elevation, Levels and Behaviors; Atlas Region association flag `travelPreset` v1 | `native-movement-cost.js`, `region-native-read.js`, `generated-region.js` | Native modified/disabled Behaviors and shape edits win; no automatic reapply on World preset edit |
| Preview route & quote | Transient application/view state | `navigation-transport-transitions.js`, `navigation-transport-service.js`, `navigation-transport-choices.js`, `navigation-controller.js` | No money/World time/token moves on preview; hire estimates not bookings |
| Approved Journey & committed progress | Journey Journal flags + committed native TokenDocument anchors; native World clock on explicit GM commit | `navigation-guided-transport-leg.js`, `navigation-transport-journal.js`, `navigation-transport-recovery.js`, `navigation-controller.js` | Previously approved method, fare/operation, Point B and checkpoint ID must survive interruption |

Catalog version numbers are **not interchangeable**: transportation v3,
terrain catalog v3, Group assignment v4, Checkpoint offer v1 and Region
association v1 each have their own data owner. Existing read-only compatibility
normalization is preferable to a cross-flag migration in beta.7.25.

## 2. Current dependency and data flow

1. **GM configuration:** `AtlasTransportationSettings` reads/writes a
   revision-sensitive World catalog and rules profile. `TravelPresetSettings`
   separately edits World terrain data; World reference presets remain editable
   without changing previously confirmed native Region costs.
2. **Availability:** The projected current Group Actor supplies party-owned
   resources; `checkpointOffers` supplies explicitly authored services at
   Checkpoint IDs. `navigation-controller.js` gathers compatible options for
   each route surface and distinguishes `owned` from `hire`.
3. **Planning:** `projectTransportationRouteLegs` groups Road segments by
   `travelPresetId → land/water/air`, requiring a real Checkpoint for surface
   transfers. `quoteTransportationService` computes optional fare/crew/overtime
   estimates. Native Region effects remain separate from these quotes.
4. **Authorization:** `prepareGuidedTransportLeg` validates only the selected
   first leg and captures method/arrangement, arrival Checkpoint, operation,
   estimate and Road identifiers. GM approval precedes TokenDocument movement,
   World-time advance and durable Journey Journal history.
5. **Recovery:** `approvedTransportRecoverySelection` restores the saved
   method before re-planning; `restoreApprovedTransportPlan` checks the
   compatible surface, destination, Checkpoint and remaining route distance.
   Any unresolved mismatch must **stop**, preserve Journal and provide GM
   diagnostics. Rerendered animation is not authoritative movement.

### What is architecturally healthy

- Pure catalog validation/projections and quote math are separate from
  ApplicationV2/DOM and Foundry writes. Existing unit tests cover methods,
  service quotes, Group roles, Checkpoint offers, route transfers and recovery.
- D&D 2024/5.5e overland defaults are distinguished from 2014 and custom
  profiles. Built-ins, World overrides and custom IDs are separate; older
  catalogs are *read* compatibly without automatic migration.
- Checkpoint offers and Group owned transport are separate sources; a saved
  Journey retains the selected transport identity. Cost quotes are not Actor
  currency changes. Native Region Behavior application has explicit GM
  confirmation and native DataModel validation.
- The full import check on the beta.7.24 baseline found 142 modules,
  417 relationships, zero missing targets and zero cycles. This means import
  integrity, **not** proof that all application boundaries are finished.

## 3. Findings and targeted future decision gates

The priorities below refer to **risk and investigation urgency**, not a proven
new bug. No item authorizes an immediate fix or a version migration.

| ID / priority | Source-backed observation | Proposed safe gate |
| --- | --- | --- |
| **T25-R1 — Critical recovery safety** | `navigation-transport-recovery.js:checkConfirmedRemainingDistance` compares a recomputed native route with the saved Journal's remaining percentage using a bounded tolerance. Two owner incidents (#189) now show 32.6% and 5.8% unconfirmed progress after canvas rebuild; a third-party weather Scene update initiated some observed redraws. | Instrument the exact last committed native anchor, saved pending intent, current Token position, pre/post teardown route geometry, unit conversion and checkpoint leg identity. Reproduce both percentages and investigate #189 in an isolated fix; do not broaden tolerance or silently credit distance. |
| **T25-R2 — High cross-record reference lifecycle** | `checkpointTransportOffers` stores records by Checkpoint ID and writes a separate Scene flag. `saveCheckpointOffers` checks GM permission and IDs but has no graph-revision expectation itself; `navigation-controller.js:saveNavigationCheckpointOffer` checks prior source snapshots before calling it. Future independent Checkpoints/moves complicate references. | Define deletion/detach/move/orphan handling and stale-write strategy across Scene graph + offer flags; do not invent atomic multi-document transactions. Test two-editor races and compatibility with future Node-anchored Checkpoints (#206/#187). |
| **T25-R3 — High custom-method deletion integrity** | `AtlasTransportationSettings._delete` deletes a custom World transport method after GM confirmation, explicitly leaving Scene and Journals unchanged; Group profile references and Checkpoint offers can still carry its stable ID. A later recovery rightly fails if the approved method becomes incompatible. | Inventory World method uses in Checkpoints, Groups and unfinished Journals before delete; design explicit block/warn/detach/reassign policy, never silently delete or mutate history. Add missing-method and resumed-Journey regression cases before changing behavior. |
| **T25-R4 — Medium profile isolation** | `selectedTransportationProfile` chooses `dnd5e2024` for D&D5e and `neutral` otherwise; the current `neutral` reference preset list reuses the 2024 entries. Core computation has no hard system requirement, but neutral defaults carry D&D-flavored assumptions. | Owner decision: neutral demonstration templates vs genuinely generic defaults. Keep rule selection isolated, with no hardcoded requirement for D&D5e, 7-day calendars or a currency adapter. |
| **T25-R5 — Medium terrain-ID and native-cost independence** | Road classification uses the World terrain preset ID. `TravelPresetSettings._deletePreset` already inventories references (`worldPresetUses`) before delete; Region association flags remain schema v1 and native costs do not follow edits automatically. | Test delete/rename/retarget under stale dialogs, manually edited Regions, missing IDs and cross-Scene references. Keep visual surface, terrain-weighted distance and native movement-cost Behavior separate. |
| **T25-R6 — Medium optional Group adapter** | `projectGroupTransportation` reads D&D5e `type: group` members and stable IDs. It is intentionally Group-specific while core transportation profiles support other systems. | State a capability-based adapter interface before promising party-owned transport for arbitrary game systems; do not force Group/Actor schema or Levels dependency on core logic. |
| **T25-R7 — Medium presentation/controller size** | `navigation-transport-settings.js` is approximately 847 lines, `navigation-group-transport-settings.js` 439, `travel-preset-settings.js` 398; transport planning and live transitions are also coordinated by `navigation-controller.js`. | Characterize event/listener lifecycle, stale drafts and duplicated field validation before splitting UI; extract only cohesive tested components. Do not add speculative abstractions. |
| **T25-R8 — High future player data security** | Existing player canvas overlay filters rendered fields but not raw client-readable Scene flags. Future player transportation pamphlets and request UI have no authorized data channel yet. | Require GM-approved, permission-filtered server-side requests/projections before #203; no player direct Scene/World/catalog writes or hidden destinations in payloads. |
| **T25-R9 — Medium schedule and units extensibility** | Catalog stores transport speed in mph and money in CP-equivalent values, with Scene display conversions; service operation distinguishes normal/overtime/continuous. Scheduled departure windows and calendar adapter are still backlog #136. | Before scheduling, validate unit round trips (mi/km, Grid scale), operating-day semantics, snapshot stability, 2014 vs 2024 defaults, recurring fare bases, crew/capacity, and Foundry World-calendar capability. No schedule code in this milestone. |

### Scope boundaries for subsequent work

- **Fix #189 in an independent, recovery-focused branch** with test fixtures
  from both owner logs and safe fail-closed behavior. The weather-triggered
  teardown is supported by stacks, but the mismatch cause is not proven.
- For reference integrity, prioritize non-destructive **preflight validation**
  and diagnostic views over eager migration or background reconciliation.
- Transportation schedules [#136](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/136),
  player Travel Desk [#203](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/203),
  Group editor parity [#197](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/197),
  and independent Checkpoints [#206](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/206)
  remain feature backlog, not part of beta.7.25.
- No player movement/request/booking API, rental semantics, Actor rest,
  currency charge, new Rules Profile, 5.5e speed change, migration or native
  Region Behavior update is authorized by this audit.

## 4. Evidence, status and exit

**Implemented previously:** method/terrain catalogs, GM settings, checkpoint
offers, Group-owned resources, compatible transfers, quotes and Journey
snapshots. **Automated-tested previously:** focused module tests; beta.7.24
cross-subsystem integration tests. **Owner-tested:** beta.7.23 GM/player pass;
beta.7.24 generally positive except unresolved transfer recovery. **Proposed:**
the T25-R1–R9 follow-up gates. **Deferred:** scheduling, player requests,
independent checkpoint migration, and any runtime change.

This assessment is complete once its documentation is reviewed, full Node
tests/architecture checks remain green, the branch-pinned manifest/archive
are verified, and a *stacked draft PR* is published. No new Foundry live
behavior can be claimed or validated by a documentation-only patch. The owner
can next authorize specific diagnostics, tests and fixes, starting with #189.
