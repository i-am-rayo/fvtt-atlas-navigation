# Atlas 0.3.12 — batched UI/UX implementation plan

**Planning baseline:** current `main` version 0.3.11, commit `ccd889027a570ae2300f2440122e0f6c40b2495a` (2026-11-19). **Status:** planning only; this branch contains no feature changes or installable 0.3.12 build yet.

**Product Owner requests:** Group-owned Vehicles must present transportation like **Map Marker Settings → Transportation**, sourced from native D&D 5e Group membership and linked to World Transportation presets. Territory appearance issue **#417** is included for 0.3.12. Both are UI/UX scope; #417 was **already assigned** to UI/UX Milestone 01 at the live review, and #460 now tracks Group transportation under that milestone.

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
