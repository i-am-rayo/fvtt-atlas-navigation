# Atlas — future capabilities, milestone plan and cross-chat handoff

**Owner requests received:** November 4, 2026  
**Status:** Proposed, unimplemented backlog. No feature, release or merge authorization implied.  
**Current baseline:** v0.3.8-beta.7.8 passed owner Journey/rest testing; v0.3.8-beta.7.9 is the next architecture-only presentation extraction pending GM/player Foundry v14 acceptance.

This is the current **future-feature planning handoff** for other chats. Consult the [active roadmap](ROADMAP.md) and [stabilization architecture](ARCHITECTURE_V038_BETA75.md) for the development slice actually in progress. Stage IDs A–G are durable planning references; future version numbers are **provisional** and may change. Do not mix these new features into the beta.7.x architecture PR stack.

## Milestone overview

| Order | Stage / tentative release | Scope | Exit gate |
| --- | --- | --- | --- |
| **A — current** | **v0.3.8-beta.7.9+** | Continue modular Navigation extraction, shared GM/player-safe read models and explicit action boundaries; investigate inactive-GM travel (R-01). **No new gameplay/schema.** | Architecture cycle check, existing regressions, and GM + player v14 investigation. |
| **B — usability** | **v0.3.9 candidate** | Player progress, camera follow, GM playback speed, road distance and merge parity, Group Actor transport editing parity, GM full-map visibility preview. | Role-filtered Journey projections and UI isolation; two-client permission and journey tests. |
| **C — topology** | **v0.4 candidate** | Road-independent checkpoints, Region-categorized checkpoints and Regions [+], road slicer, versioned graph migrations, export format contract. | Stable checkpoint IDs, safe legacy migrations, preservation of road/Region references and undo. |
| **D — services** | **v0.4.x candidate** | Scheduled/on-call hire services, date-based departure windows, missed-service waits, optional player-facing transport pamphlet. | Calendar/offer model, determinism, explicit GM confirmation of time, cost, booking and disclosure. |
| **E — Journey events** | **v0.5 candidate** | Player rest requests at any point, interrupted rests/programmed events, inns, tolls and bridge properties. | Persisted event/rest states; no double World-clock advance, Actor rest or payment. |
| **F — advanced travel** | **v0.6 candidate** | Distinct land/sea/air travel networks, slope/elevation costs, optional Levels adapter, teleport gates. | Typed route-edge/transfer model and opt-in compatibility with native Regions. |
| **G — portability/polish** | **v0.7 candidate** | Tested Scene/World Atlas import/export and remapping; consistent iconography and completed-Journey Journal visual polish. | Export/import schema stable; dry-run, conflict resolution, rollback and backwards-compatible acceptance. |

The earlier **v0.3.8-beta.8** scheduled-transport proposal is **rescheduled to Stage D**, not assumed to be the next build. Some independent Stage B work may be delivered in small draft PRs. Design Stage C's data contract early, but perform migrations only in that separately tested stage. Stable A→B→C→D logical waypoint lettering is a separate future presentation improvement; a Canvas rebuild must never invent a new logical waypoint.

## A. Architecture requirements to preserve now

1. **Authority vs display:** GM/authoritative operations exclusively commit token movement, rests, bookings, currencies and World time. Player-facing Journey state is a permission-filtered *read-only projection*. Later player buttons submit validated requests, not direct writes. Hidden roads, checkpoints, unrevealed future legs and private charges must not leak in payloads.
2. **One durable Journey:** Journal metadata and committed native TokenDocument location own confirmed progress. Resume, Scene refresh, tab inactivity and repeated prompts must not double-move, double-charge, repeat rest or advance World time again. The progress bar must derive from authoritative records.
3. **Native adapters:** Extract state model, routing, calendar policy, settings validation and UI view models from Foundry canvas/DOM side effects. Preserve v14 APIs and zero new import cycles; no hard dependency on Levels or other modules.
4. **Migration safety:** Scene image-relative coordinates must survive padding changes. Preserve existing Scene, Actor, Group, Token and Journal flags, native Region Behaviors, fog/exploration and weather.

### R-01 — Inactive-GM-screen travel appears to stop (reported, not diagnosed)

**Priority: investigate before player progress, camera follow or faster playback.** Determine if authoritative token movement/World time/Journal checkpoints stop, or if **only the player's view** stops rendering. Test a GM foreground and background/minimized, separate player browser, window sleep, Canvas rebuild and reconnection. Compare real TokenDocument coordinates, durable Journal progress, World time and each client's displayed animation. Browser throttling or a GM-owned animation timer is **a hypothesis, not a confirmed cause**. Do not bypass GM permissions or native movement to make it seem fixed. Record the expected and recovered state explicitly in a v14 two-client regression.

## B. Presentation and authoring usability

- **P-01 Player progress bar:** Read-only current-leg and total-Journey distance/time progress in the player's window, only for permitted/known legs; acknowledge waiting/rest/paused states.
- **N-01 Camera follow:** Default on locally during a Journey; track party token while allowing each player to zoom in/out. Yield to user pan or zoom without fighting input, preserve local zoom, permit toggle off. Do not send camera changes to other clients or provoke canvas redraw.
- **N-02 GM playback-speed adjustment:** Speed up the **visual animation only**, never travel speed, elapsed game hours, weather, fares or World-clock advancement.
- **R-02 Road distance:** Display measured authored road length and Scene units. Keep geometric distance distinct from terrain-weighted travel and purely decorative curves.
- **R-03 Merge parity:** Road Editor Shift-click context offers the same eligible merge action as Scene Settings → Atlas, reusing rules, validation and undo.
- **G-01 Party-owned transportation editor:** In Group Actor, edit assigned mount/vehicle/NPC preset with the same shared fields/validation as checkpoint transportation. Distinguish owned vs hired resources; preserve flags.
- **V-01 GM visibility switch:** Compare fully discovered Atlas roads/icons with the **as-players-see-it** visibility/hidden state, without changing exploration, Seen/Visited or Known through Lore. GM-only.

## C. Checkpoint topology and portable schema foundation

- **C-01 Free-standing checkpoints:** Create/edit a checkpoint without road association; attach or detach road links later with the same stable checkpoint ID. Do not create fake roads.
- **C-02 Native Region containment (owner decision, November 4):** Atlas will author delimiting boundary points and, after an explicit GM preview/confirmation, generate or update an associated native Foundry Region. Checkpoints located *inside* the native Region will automatically appear under it in Scene Atlas → **Regions [+]** without manually assigning each checkpoint. Keep checkpoint IDs independent of roads, and preserve native Region Behaviors, Levels and GM geometry edits. Define overlap/boundary handling and refresh rules before implementation; this is a later schema feature, not beta.7.9.
- **R-04 Slicer:** Split an existing road at a user-selected point with preview/undo, explicit graph transaction, preservation/remapping of IDs, junctions, attached checkpoints, Region references, and stale-route recovery.
- **I-01 Data contract:** Versioned export/import payload design, stable reference IDs, Scene-image-relative points and selected metadata; establish legacy migration, collision mapping and native document references before an actual exporter is shipped in G.

## D. Hire scheduling and player-facing transit options

- **T-01 Scheduled transport (owner calendar decision):** Editable service weekdays/World-calendar days, departure windows and eligible ship/ferry/coach/setting-specific air services. Read Foundry's configured World calendar **system-agnostically**, with no hard-coded D&D calendar, Gregorian weekdays or seven-day assumption. Resolve a window such as 12:00–14:00 to a deterministic per-service/per-day departure, stable across rerender and recovery. Late travelers wait for the next service only after explicit GM approval; record schedule/wait snapshots and actual costs in the Journey.
- **T-02 On-call transport:** Carriages/local watercraft/mounts with configurable operating hours, lead time, optional nighttime scarcity or surcharge. Default lore-inspired **editable examples** (daylight ferries, market-day coaches, intermittent merchant vessels), not universal D&D canon or modern fixed timetables.
- **P-02 Player pamphlet (tentative/GM-opt-in):** Role-friendly “travel desk” menu at A→B→C checkpoint transfers listing permitted methods, approximate schedules/fare, and setting descriptions. GM controls visibility and approves booking/payment; no hidden destinations, automatic currency deductions or bypass of available checkpoint offers.

## E. Rest, events and checkpoint services

- **P-03 Rest request anywhere:** Players may request Short/Long Rest during ongoing travel or at a pause, with GM approval and safe movement coordination. The tested beta.7.8 GM rest-while-paused mechanism remains the foundation. Distinguish camp downtime from rest aboard a moving ship (which may overlap crewed travel); Actor rests are separately opt-in.
- **N-03 Interrupted rest/programmed event:** Persist proposed → approved → underway → completed/interrupted with start time, elapsed time and event boundary. Do not grant completed Long Rest effects before its full required duration; never duplicate clock time, Journal events or native D&D5e Actor rest actions after resume.
- **C-03 Inn:** Checkpoint subtype for quality/tier (low/mid/high/custom), stay price, capacity, amenities and rest opportunities; GM authorizes stay/payment/rest.
- **C-04 Toll:** Arrival prompt with fee, currencies, conditions/exemptions and GM approve/refuse; no automatic payment.
- **C-05 Bridge:** Descriptive type (stone/hanging/etc.), traversal limits and optional hazard/slope metadata; no implicit native movement modification.

## F. Advanced traversal and map interaction

- **V-02 Traversal layers:** Distinguish land, water and air route *networks*, not merely drawing order. Lines crossing at different surfaces/altitudes must **not become junctions**. Optional Foundry Levels compatibility adapter, never a required dependency.
- **S-01 Elevation/slope:** Existing checkpoint elevation is useful input but is not sufficient on its own to calculate slope along multi-section roads. Use measured horizontal length and optionally intermediate profile/elevation samples, appropriate units, GM-adjustable grade/threshold and an opt-in difficult-terrain effect. Preserve native Regions and their Behaviors.
- **R-05 Teleport gates:** New typed travel edge/transfer between checkpoints or Scenes with explicit eligibility, direction, time, cost and GM approval; no zero-distance road hack or permission bypass.

## G. World portability and deferred polish

- **I-02 Scene-only Atlas import/export (owner scope decision):** First test what native Foundry Scene export already carries. Prefer a portable Atlas-owned, versioned **Scene-only** bundle where needed: roads, checkpoints, Atlas Region boundaries and native association, chosen Scene metadata and explicitly selected exploration history. Provide preview/dry-run, ID remap, collision warnings and rollback. Do **not** export Actor, Journal or World preset records in the first implementation; preserve or warn about references. Never erase existing exploration or Scene metadata by default.
- **U-01 Visual alignment:** Mirror icons between Road Editor and Scene Settings, harmonize Token/Group forms, and restyle the **completed Journey Journal** after data/journey correctness stabilizes. Keep this separate from movement and persistence hotfixes.

## Owner decisions and remaining questions (November 4, 2026)

1. **Resolved — Regions:** Atlas defines the delimiting geometry for native Foundry Regions. Checkpoint membership is spatial containment, never manual per-checkpoint Region assignment. Overlapping/adjacent Region rules and regeneration with GM-edited native shapes remain to design.
2. **Partially resolved — Players:** Creating, modifying and deleting Atlas data is forbidden to players. The exact permission policy for viewing/requesting travel or rests is **deferred** until most of the module is established; existing restrictions are unchanged.
3. **Resolved — Calendar:** Use the Foundry-configured World calendar through a **system-agnostic** adapter. Editable service templates remain a future feature.
4. **On hold — Inactive GM policy:** Decide whether travel safely pauses or continues only after diagnosing R-01. Beta.7.9 does not guess or change this policy.
5. **Resolved — Portability:** Scene-only Atlas import/export first, including roads, checkpoints and related Scene metadata. Exclude Actor, Journal and World catalog export initially.

## Cross-chat handoff and acceptance rules

At the beginning of future work, identify the **installed tag, Git branch/draft PR, latest owner GM/player test, stage, reported bugs and relevant migration state**. Beta.7.8 manual Journey/rest tests succeeded; R-01 is reported but **unverified**. Keep each new feature in its own numbered test build/stacked draft PR; **never merge without explicit owner approval**. Before providing a usable release, verify manifest/archive URLs and include the current install manifest. Run unit tests and import-cycle checks plus live Foundry v14 GM/non-GM acceptance. Never reset exploration for debugging, rewrite native Region Behaviors silently, or treat unrelated third-party console warnings as Atlas evidence.
