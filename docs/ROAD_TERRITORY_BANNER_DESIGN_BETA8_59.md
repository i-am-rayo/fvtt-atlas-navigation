# Road territory subtitle — owner decision proposal (PR #376 annotation 23)

**Status:** design only. No new Road fields, Scene/Region flags, World presets, data migration, player projection or rendering behavior are authorized by this proposal. The existing Road label/hover subtitle is unchanged.

## Verified baseline and existing ownership

- Road names are authored on **Scene Atlas Roads** and rendered by `RoadCanvasController`. At default canvas zoom the Road label is centered 18 screen pixels above its Road anchor; current optional hover subtitle is the *surface/travel preset*, from `roadSurfaceAtPoint` or its explicit travel preset. The sample preview change is independent.
- **Native Regions** own shapes, hidden state, geometry, elevation and Behaviors. Atlas geographic kind and parent IDs live in validated Region flags; a linked Region is not necessarily a public label.
- `readTerritoryRoadDirectory` groups Roads using bounded polyline sampling and explicit include/exclude overrides. It is a **many-to-many directory projection**, not a claim of one authoritative territory at every Road point. Sampling is capped; geometry requires the active Scene.
- `mostSpecificPublicTerritoryLabel` already implements a **fail-closed ancestor tie-breaker** for validated, explicitly published Territory labels; unrelated/sibling overlapping Regions do not yield a winner.
- `checkpointSelectedTerritoryName` handles a **Map Marker** with an explicit Scene-scoped Region ID. That design is useful for explicit identity but cannot establish whole-Road containment.
- `playerAtlasOverlay` already strips hidden Road/Map Marker fields. A future Road subtitle must be produced **from a player-safe read model**; never expose native Region names/IDs or unpublished aliases by building a GM preview and hiding it later.

## Three choices

| Choice | Anchor and selection | Advantages | Limitations / risk |
|---|---|---|---|
| **A. Explicit selected Territory** | GM assigns one stable native Region ID for the Road, regardless of hover point | Predictable; straightforward GM workflow; mirrors Map Marker explicit selection | A multi-territory Road can display a misleading single name. Requires validated Scene-only additive field, compatibility readers and presets that do not copy the Region ID across Scenes |
| **B. List associated Territories** | Deterministic, alphabetically ordered validated set from `readTerritoryRoadDirectory`; display e.g. “Valecor · Reshara” | No arbitrary winner; can explain cross-boundary Roads | Sampling caps, membership overrides and scrolling labels do not prove Road-wide containment. Can become too long; high information-leak risk unless strictly public-filtered and capped |
| **C. Territory at actual Road label / hover anchor** | Test the real Road-label point against eligible native Region shapes on the active Scene | Reflects local location on cross-boundary Roads; no stored Region choice or migration; Road pan/hover naturally updates | The “Always” label anchor can move with the viewport; boundary text changes during pan, and overlapping siblings are ambiguous. Requires precise scene coordinate conversion and guarded redraw performance |

## Recommendation — C, opt-in and initially GM-only

1. **Keep the first implementation non-authoritative.** Add only an optional visual control after owner approval; do not change Road geometry, native Region data, the Road's travel preset, route priority or Journey narration.
2. Use the **same point used for the Road name**: hover anchor when Hover, visible label point when Always. Convert to native Scene coordinates using the existing Atlas canvas coordinate adapter; never use the Road's first/last checkpoint as a substitute.
3. Identify valid, currently Atlas-linked, geographically classified native Regions whose native shapes **contain that point**. Do not reuse directory membership or choose the lowest-area Region. If no match or invalid geometry: **no subtitle**.
4. If multiple candidates are nested through validated parent IDs, choose the single deepest valid descendant through the existing ancestor rule. If two unrelated/sibling shapes overlap, **show no subtitle**; never select by native Region priority, render order or alphabetical label.
5. For player display, **require** the Road itself to be player-visible and the Region to be non-hidden, authorized, and have a validated **published public Territory label**. An unpublished `region.name` is never a player fallback. In the first release, keep the feature **GM-only** until this is owner-tested on Fog/hidden Regions.
6. If the subtitle would overlap a Map Marker banner or the Road label, omit or alpha-fade it using the existing label collision/read model; do not move Roads or markers to make room. Use a distinct smaller text style. Keep current hover terrain surface subtitle as its own concept, not silently overridden by Territory.
7. If a future persistence flag is approved, store only a validated display **mode** (Off / GM-only anchor / player-public anchor) on the Scene Road appearance, with additive schema compatibility and World preset semantics explicitly reviewed; **do not persist a derived Territory name**. Previews remain transient.

## Proposed label at the Road anchor

```text
                    Millstone–The Eyrie
                        Valecor
          --------- curved Road line ---------
```

This is only a static placement example. The actual Road name uses the existing canvas anchor and can have an optional independently published Terrain/Surface hover label.

## Decision points for Product Owner

- **Which selection semantics?** Recommended: dynamic Territory at the current label/hover anchor (C). Alternative A explicitly pins one Region but may be misleading for cross-boundary Roads.
- **Audience?** Recommended initial release: GM-only; later player labels only when the particular Territory has a published alias, is not native-hidden, and the Road is revealed.
- **When to show?** Recommended opt-in Hover first, then consider Always once boundary transitions/collision behavior are accepted.
- **Coexistence with surface hover subtitle?** Recommended separate lines only with available space, otherwise suppress Territory subtitle rather than overwrite a surface label.
- **World presets?** Recommended do not include Scene-native Region references. A portable display mode can be considered once approved.

## Data integrity, caching and acceptance

- Pure candidate selection is independently testable with zero Regions, one Region, nested parent/child, unrelated overlaps, hidden or unpublished Regions, invalid geography cycles and same-name Regions.
- Current active Scene and canvas readiness are mandatory for dynamic geometry; fail closed on scene switch, canvas rebuild, camera pan, zoom and Region unload. Never write on read.
- Cache by Scene ID + relevant Road graph revision + Region document revisions/publication version + visibility projection + camera anchor **only if profiling demands it**. Start with bounded reads and refresh only for relevant canvas/Region/permission lifecycle events. Do not poll or produce per-frame Scene writes.
- Include GM and non-GM live Foundry v14 tests at cross-boundary and overlapping polygons, active/inactive Scenes, hidden native Region, public alias, Fog, hover and pan/zoom, high-DPI and large Road networks. Confirm current Journey and label behavior does not regress.
- No release work is authorized by this design. Implementation awaits the choices above.
