# Atlas 0.3.12 — batched UI/UX implementation plan

**Planning baseline:** current `main` version 0.3.11, commit `ccd889027a570ae2300f2440122e0f6c40b2495a` (2026-11-19). **Status:** planning only; this branch contains no feature changes or installable 0.3.12 build yet.

**Product Owner requests:** Group-owned Vehicles must present transportation like **Map Marker Settings → Transportation**, sourced from native D&D 5e Group membership and linked to World Transportation presets. Territory appearance issue **#417** is included for 0.3.12. Both are UI/UX scope; #417 was **already assigned** to UI/UX Milestone 01 at the live review, and #460 now tracks Group transportation under that milestone.

## Updated issue sequencing — owner 2026-11-19

The four new Party-owned Transportation issues were reviewed against main v0.3.11, labeled `area: ui-ux` / `area: transportation` and assigned to UI/UX Milestone 01: **#456 P1**, **#457 P2** (depends on #456), **#458 P2**, **#459 P2** (depends on #456 and #458). The earlier umbrella #460 is the visual acceptance endpoint and should not compete with these implementation tickets. The broader #197 remains in the Transportation milestone and is not closed by UI changes.

**Reordered implementation batches to respect the dependency chain:**

- **dev.1: #456 + #458 foundation** — the existing shared World/Map Marker transportation method editor gets an explicit Group draft scope; profile inheritance, quantity wording, no duplicate inline override controls, and consistent capacity source. Child Apply changes the parent draft only; the explicit Group Save remains authoritative. This batch intentionally retains the existing Vehicles/NPC/PC tabs until the foundation is accepted.
- **dev.2: #457 + #460 compact UI** — Land, inland Water, Sea when explicitly classified, Air lists, matching Map Marker row layout, native-Group-only Actors, editor icon controls, staged remove/re-enable semantics, and elimination of the low-value PC tab. **Do not** implement fake Delete by simply erasing an override and causing automatic vehicle reactivation.
- **dev.3: #459 + #460 refinement** — unique mount `Assigned To` by current native Group Actor ID, no boarding or capacity/fare effect, no implicit assignment for shared pools, compatible additive versioning, stale membership guard.
- **dev.4+: #417 Territory appearance**, using native Region color and the reviewed #295 typography dependency; avoid mixing this native-Region write scope with Group transportation schemas.

Each build still groups coherent UI/validation/tests, retains a stacked DRAFT PR and live GM/non-GM acceptance. Move the later batch numbers only when needed; do not claim the issue is completed until its acceptance criteria are satisfied.

## Batch 1 — 0.3.12-dev.1: Group Transportation display and controls (#460)

**Scope one cohesive implementation, multiple items together.**
- Preserve **Group Actor → Vehicles, NPC, Player Characters** role boundaries and Group membership as the sole source of vehicles; no independent Atlas-owned vehicle roster. Keep the GM-only Group access point.
- Reuse Map Marker Transportation's **Land Travel, Water Travel (rivers/lakes), Sea Travel (coastal/ocean), Air Travel** card presentation, paired details, and shared accessible **Edit / Delete** actions. Vehicle profile and mode selection must not guess from Actor names.
- For each Group Vehicle, show native Actor name, linked World transportation preset, effective speed, capacity, quantity, recurring/hire/purchase summary, and inherited versus individual overrides. **Edit** stages Group-only assignment, chosen compatible `profileId`, and existing bounded fields; existing World preset editor stays separate.
- **Delete** clears only Atlas Group transportation metadata after explicit confirmation. It **never deletes the native D&D5e Vehicle Actor or alters Group membership**. Because the list derives from native membership, the Actor remains visible as unconfigured; removing an Actor from Group Vehicles belongs to native D&D5e Group UI.
- World profiles currently expose `surface: land|water|air`, whereas Map Marker offers additionally distinguish `water|sea`. Preserve all v4 saved Group assignments. Add a bounded explicit water/sea mode only if required for accurate four-way presentation, with compatibility read and no implicit migration-on-read.
- Keep existing per-Group revision guard, live roster membership and World catalog snapshot checks. No direct Actor, Scene, Journal, Token, currency, or Journey writes.

**Automated/live gates:** 4 types, unlinked/missing preset, duplicate/renamed Actors, non-GM, linked vs custom speed/cost overrides, Delete/cancel, same-Group stale and independent Group saves; Foundry v14 GM + player, 100/200% UI scales.

## Batch 2 — 0.3.12-dev.2: Territory Settings clarity, native appearance (#417)

- Apply the existing `AtlasTerritorySettings` window/fieldset/tab design; shorten explanatory rows and make identity, appearance, sharing, and recovery entry points clearer without losing them.
- Field ownership: **RegionDocument owns native `name`, `color`, `shapes`, elevation applicability and native Behaviors**. The public Foundry v14 `RegionDocument.color` field is documented. Atlas must not invent native `borderColor`/`fontSize` properties.
- Introduce a GM-only **staged native Region highlight-color control and local preview** (where the v14 public schema supports it). Save an explicit **minimal `color` update**, with native document permission and stale-check; Cancel/preview never writes. External edits are detected, never overwritten silently.
- Preserve Map Marker/Journal links, Region ID/parent, polygon holes, Behaviors, fog, current visibility and recovery affordances. Do not rerender a dirty form on external updates and discard the draft.

**Gates:** DOM draft/no-write, native minimal-update and stale rejection, old/new Regions, cancelled preview, separate Territory windows, GM/non-GM, externally renamed/recolored native Region, native sheet parity at different zooms.

## Batch 3 — 0.3.12-dev.3 (split only if necessary): Atlas overlay color/typography and final parity (#417 + prerequisite #295)

- **Do not duplicate #295's canonical label typography model**, already tracked in the later Cinematic Announcements & Atlas Appearance milestone. Before writing any new schema, decide the minimum **versioned and validated** Atlas overlay presentation override that can inherit the correct World defaults per geographic kind.
- Scope explicit **Atlas-only** border/outline and label text color/size/font choices with accurate read-only preview, reset-to-default, bundled/offline font allowlist, safe contrast, limits, and player visibility filtering. Keep native Region.color separate.
- If the #295 World-kind inheritance contract is not ready for safe implementation, do not invent a second model or claim #417 complete: ship only reviewed safe native controls in 0.3.12 and leave typography-dependent acceptance tracked/open. #294 linked Map Marker icon integration is **not silently included**.
- Reuse existing Territory overlay and player-safe projection, not a second styling database. No GM-only names/icons leaking to players; no geometry or Behaviors mutations.

**Gates:** kind defaults / per-Territory override / reset semantics, legacy Flags, public-vs-private labels, player visibility, long/Unicode names, zoom and native external color changes.

## Final 0.3.12 integration gate

- Each **development batch** has its own incremental `0.3.12-dev.N` version/branch-specific manifest, stacked **draft PR**, focused tests, architecture notes and concise owner checklist. Group multiple related changes per build; do not create a version for each individual widget.
- Run `npm run check`, `npm run architecture:check`, JS syntax, `git diff --check`, release-manifest branch checks; zero new import cycles/missing targets. **Only actual GM/non-GM Foundry v14 tests count as owner acceptance.**
- In particular test first startup **after installing a dev build**, because **#453** intermittent static import failure remains open. Failed-start network evidence and #455 performance investigation remain separate; do not add speculative caching/auto-reload.
- No merge into `main` or public release/tag until owner acceptance and explicit final merge/release approval. Release-formatted `0.3.12` manifest must point to `main` on integration, not a development branch.
- Issues #417 and #460 close **only when their own acceptance requirements are actually met**. #295 may stay in its later milestone if not fully delivered; do not declare completion by association.

**Out of scope:** new native Vehicle/Group roster editing, boarding, fares/Actor deductions, Token or Journey movements, native Region geometry ownership changes, schema rewrites on read, auto-generated Map Marker icons, and #294's separate icon-link work.

## Dev.1 owner-test correction and dev.2 implementation status

The Product Owner **did not accept dev.1**: its new Group-only dialog did not match the shared Map Marker editor; its cards lacked shared Edit/Delete icons and travel-type sections. Dev.2 fixes the shared renderer, disables Services for owned assets, replaces Vehicles/NPC/PC tabs with compact Land/Water/Air and separate Other NPCs, and adds an explicit versioned Group-only opt-out/re-enable representation. **Dev.2 is automated-test candidate, not owner-tested.** The latest owner requirement for #459 reserves an assigned unique mount for that person in prospective eligibility; it supersedes the earlier informational-only plan and must be implemented in a separate, recovery-safe gameplay batch (with no approved-Journey reinterpretation) after finalizing UI contracts. #417 Territory appearance remains queued; startup #453 remains independently open.

## Owner dev.2 visual review — corrective dev.3 (2026-11-19)

The owner provided five more Foundry v14 screenshots and did **not accept dev.2 visual parity**. The shared `_edit()` renderer was already being used, but Party mode inserted seven visible `Customize` rows, displayed World-owned crew/sale fields and presented NPC role controls below the name.

The cumulative **dev.3 corrective draft PR #463** keeps the exact shared General / Services(disabled) / Ownership renderer. Only Group profile and Quantity Available are added; Party edits now automatically mark **hidden**, validated override flags for inherited values. Reset removes Party overrides. The Group form hides World-owned crew, purchase offers and crew wages, preserving existing legacy Group purchase overrides on unrelated saves. NPC rows display Name / spacer / Role / Edit on one line; NPC removal is governed by native Group membership and role (no duplicate Atlas Delete), while Vehicle removal remains confirmed, staged and re-enableable.

**Dev.2 remains not owner-accepted. Dev.3 CI green (1,145 tests and clean architecture), but awaits actual Foundry GM/non-GM acceptance.** Since dev.3 is a necessary corrective iteration rather than the previously planned rider feature, **#459 Assigned To and eligibility shift to the next separately tested gameplay batch**; Territory #417 follows once Party transportation UI and eligibility are accepted. No mainline merge/release has been authorized.

## 0.3.12-dev.5 — issue #459 personal mount, following owner-approved dev.4

The Product Owner confirmed dev.4 successful on 2026-11-19, authorizing the next scheduled #459 batch. Dev.5 introduces versioned, validated `assignedTo` for individual Group NPC mounts, live native party member choices, explicit retention/clear transitions, and the **owner-required exclusive eligibility calculation** (not the issue's superseded information-only proposal). The existing shared editor/quantity contract is reused. Group method and fare projections subtract reserved riders from shared-passenger allocation; selected preview recognizes the actual participating Actor IDs. No native boarding, Token move, Actor deduction, Journey Journal edit or World-time advance is introduced. This batch still requires CI and actual Foundry v14 GM and non-GM owner acceptance. Territory appearance #417 remains after #459.


## 0.3.12-dev.6 — post-dev.5 live feedback, grouped UI + NPC eligibility

Owner screenshots/12 feedback fields report that dev.5 is **not accepted** pending Party-owned Transportation corrections. Dev.6 is stacked on dev.5, draft PR #466: five tabs, NPC subcategories and unconfigured count, no duplicate native Actor removal, standardized Save footer and Transportation Presets wording, role-specific Needs seat toggle, PC+NPC member selection, corrected seats-required modeling and three A/B fleet scenarios, and mixed personal/shared convoy slowest-speed FYI. Data schema v7 reads v1–v6 without write on read. This is gameplay-affecting and **must** be owner-live-tested as GM and non-GM before issue #459/#457 can be considered accepted. Approved Journey history/recovery is not redesigned; #417 Territory remains separate.
