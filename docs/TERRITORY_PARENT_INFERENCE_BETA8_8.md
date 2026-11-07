# v0.3.9-beta.8.8 — Native-area inferred continent hierarchy

## Owner behavior

Given Valecor (Continent) and Dirwest (City), if **80% of Dirwest's native
2D Region area** overlaps Valecor, Atlas should place Dirwest beneath Valecor
in the GM Road directory and treat Valecor as Dirwest's geographic ancestor
when resolving already-approved public Journey names. A GM who manually
selects a parent keeps that explicit selection, regardless of percentages.

## Read-only inference, not a migration

The per-native-Region `territoryGeography` flag remains schema 1 and is not
rewritten, auto-migrated or revised simply by loading a Scene, opening the
Workspace or starting a Journey. The Foundry read adapter uses documented
v14 `RegionDocument.area`, `RegionDocument.polygons`, and the native
`PolygonTree.intersectPolygon` method to compute the area of each eligible
City/Town/Village inside each classified, Atlas-linked Continent:

`coverage = area(child ∩ continent) / area(child)`.

Unlike image/grid sampling, this is an area measurement using native polygon
geometry, and does not use token elevation, routing rules or proprietary
copies of native Region shapes. The native polygon-tree is allowed to handle
a complex multi-shape continent with holes, while the child must be a single
native Shape with a single polygon, a finite positive area and valid public
geometry. Unsupported native geometry fails closed to manual parentage.

An inference is permitted only when:

- Both native Regions exist in the Scene and have valid Atlas links and
  classification; only child types `city`, `town`, or `village` are considered.
- The child has no explicitly saved `parentRegionId`.
- One Continent covers **strictly more than 50%** of the child area and leads
  the next-highest Continent by **at least 5 percentage points**. A tie,
  ambiguous plurality, missing geometry, invalid native intersection or
  an excessive computation budget leaves it unassigned.
- No more than 128 child/Continent intersections are needed per projection;
  otherwise all automatic inferences for that projection are skipped.

Manual parent IDs always win and are never corrected by geometry. Changing
native polygon coordinates changes the *next* derived projection only, not
any flags, native Behavior, native Level, Road topology, Token or Journal.
This initial slice does not introduce a separately persisted "force root even
though it overlaps" override; the blank parent selection means automatic.
That optional explicit opt-out requires a separately versioned geography
schema and review before implementation.

## Consumers and logging

- **GM Workspace — Territories:** displays `Parent: Valecor (auto · 80%
  overlap)` or `Parent: Valecor (manual)` when applicable. The Geography
  dialog now explains its role in Journey naming and offers automatic mode
  by default. Existing explicit parent values remain selected on edit.
- **GM Workspace — Roads:** the geographic directory uses transient inferred
  ancestry for Road grouping; Road membership remains independently derived
  from sampled Road/Region geometry or explicit manual Road corrections.
- **GM-only Journey announcement adapter:** after successful Journal
  verification and public Region permission checks, the existing overlap
  tie-breaker uses the same effective ancestry. It still publishes only a
  GM-approved public territory label and refuses overlapping siblings or
  unrelated continents. No new announcement payload, World setting or
  client-visible raw geography is introduced.
- **Atlas Debug — Verbose:** a bounded summary records native-overlap method,
  candidate counts, inferred count, unsupported count and thresholds; no
  private names, coordinates, polygons or Actor data are logged.

## Tests and required owner v14 acceptance

Automated unit tests cover 80% containment, manual parent override, runner-up
ties, less-than-majority, unsupported/invalid native geometry, no writes,
GM directory grouping and nested public Journey banner selection.

In Foundry v14, the owner must still verify:

1. Unset Dirwest's Parent territory. With about 80% of its native area inside
   Valecor, refresh Workspace → Territories and inspect the automatic parent
   label. The Road directory should also nest Dirwest beneath Valecor.
2. Start and complete a Journey to an already published Dirwest Region inside
   Valecor. Confirm player-safe start/arrival names and GM-only Verbose
   overlap diagnostics. The original saved Point B must be inside Dirwest.
3. Explicitly select a *different* valid continent as Dirwest's parent; it
   must remain authoritative regardless of shape coverage. Reset to blank
   to restore automatic inference.
4. Move a Region in the native Foundry editor, refresh and verify re-derived
   parentage without a silent native/Atlas write. Inspect Regions with holes,
   multiple Shapes, overlapping sibling towns and nearly tied continents:
   ambiguous or unsupported automatic decisions must fail closed.
5. As a non-GM, verify no hidden labels or GM diagnostics are exposed and no
   Region/Scene write is possible. Check roads, generated Regions, fog, native
   Levels/Behaviors, ongoing Journeys, Journal and World-time recovery.

Automated verification does **not** establish live Foundry v14 acceptance.
