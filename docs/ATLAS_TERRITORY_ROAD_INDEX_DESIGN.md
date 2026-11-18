# Atlas Territory Road Directory — design approved for beta.8.6

Implementation and remaining caveats are recorded in
`docs/ATLAS_TERRITORY_ROAD_INDEX_BETA8_6.md`.

## Why the current dropdown cannot implement the requested hierarchy

The legacy Road picker is one flat list of Road IDs. Existing Atlas-linked
native Regions know only whether they are linked; their native names, geometry,
elevation/Levels, and public Journey labels do not define a **continent/city**
taxonomy. A flat HTML select cannot contain a meaningful arbitrary-depth
continent → city → roads hierarchy, and road names are not a safe source of
geographic membership.

## Recommended future behavior

Replace the flat Road picker with a collapsible **Territory Road Directory**:

- **All roads** (always available).
- **Valecor** — Continent
  - **Dirwest** — City — shows roads touching Dirwest, including the
    Millstone–Dirwest Road and Dirwest–Neo Lestrum Trade Route.
  - **Millstone** — City — can show the *same* Millstone–Dirwest Road.
- **Reshara** — Continent
  - **The Eyrie** — City — its associated roads.
- **Unclassified / no matching territory** (roads never disappear).

Clicking a territory **filters the single canonical Road list**; it does not
copy Road records or modify graph connectivity. One Road ID may belong to
several cities and their parent continent simultaneously.

## Data ownership and proposed schema

1. Native `RegionDocument` remains the authority for Shape, elevation, Levels,
   visibility and Behaviors. Atlas-linked manual Regions can opt in to a
   separate, strictly validated, **versioned Atlas geographic flag** with a
   semantic `kind` (e.g. `continent`, `city`, `town`, `village`, `area`) and an
   optional stable parent Region ID. Existing Regions stay unclassified until
   a GM explicitly chooses kind/parent. Classifications must reject missing
   parent links, cross-Scene references, and invalid hierarchies.
2. Existing Atlas Scene flags remain authoritative for Road IDs and graph
   points. Territory membership can initially be a **transient, read-only
   projection** from Road geometry against linked native Region geometry,
   retaining many-to-many matches and an explicit Unclassified bucket.
3. Foundry v14 has documented public Region point-testing APIs, but one point
   sample cannot prove a road intersects a thin or holed polygon. A robust
   implementation should test the Road polyline with bounded native geometry
   checks (including Region holes) and expose uncertain matches for GM review.
   It must use scene-image-relative Atlas coordinates converted through the
   active Scene origin without changing authored nodes or relying on private
   canvas internals.
4. A GM-only **manual association override** should be possible when political
   road ownership differs from physical intersection. This must be explicitly
   versioned and revision-checked if persisted. No automatic bulk migration.
5. Player safety: geography tags are GM-only unless explicitly published;
   Region names/parents must never leak through player-facing menus or Journey
   banners without a separately approved public-safe label.

## Non-goals

- Native Scene Levels are **not** used as continent/city categories.
- Road category does not change route costs, traversal, generated corridors,
  Region Behaviors, fog, navigation or World time.
- Atlas never silently changes native Region shape to force Road membership.

## Owner decision — approved

The owner approved the combination of **explicit GM-assigned geographic kind/parent on
Atlas-linked native Regions**, with **geometry-derived many-to-many Road
membership** and a manual override for ambiguous cases. This is
recommended over trying to infer region hierarchy from native elevation Levels
or Road/Region names.
