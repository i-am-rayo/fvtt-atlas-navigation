# Agent and contributor instructions

## Project identity

- Repository: `i-am-rayo/fvtt-atlas-navigation`
- Intended module ID / manifest ID / module folder: `fvtt-atlas-navigation`
- Target: **Foundry VTT v14**, system-agnostic.
- Status: **Phase 1 merged**; **Phase 2 authorized** on 2026-10-22. Phase 2b native Grid updates were owner-verified in Foundry v14 (v0.2.3). **Phase 2c v0.2.4** was owner-tested for create/save/reload/rename/delete; v0.2.5 adds image-anchored schema v2, explicit legacy migration, interior junction splitting, redraw bends, and temporary highlight cleanup. The v0.2.5 build still requires live Foundry verification. Separate Waypoints [+] and existing-geometry edit tools are still Phase 2c tasks; Phase 2d native Region linking is planned. Phases 3+ require separate approval.
- Foundry module development is the primary framework; do not build a standalone web service or introduce a LegendKeeper requirement.
- No campaign-specific or game-system-specific assumptions, example content, assets, settings, or APIs.

## Current schema/padding migration safety (Phase 2c v0.2.5)

- Do not silently reinterpret legacy schema v1 absolute-canvas coordinates as image-local positions. A GM must explicitly anchor them using the currently aligned Scene image origin. Preserve existing graph IDs/names and Scene revision checks. Never erase or bulk reset maps.
- Schema v2 `coordinateSpace: "image"` is measured from the Scene image top-left. Render with Foundry `canvas.dimensions.sceneX/sceneY`; author by subtracting that origin from Foundry canvas pointer coordinates. Only actual endpoints join roads, and split connections must be real graph nodes.
- Unit tests cover pure geometry/permissions; a GM must still test changes in Foundry v14, especially Scene padding, interior road joins, and editor lifecycle. Phase 3 routing remains unapproved.

## Read before making changes

1. `README.md` — goals and present status.
2. `docs/ARCHITECTURE.md` — boundaries, native Foundry integration, planned subsystems.
3. `docs/DATA_MODEL.md` — proposed persisted shapes and validation.
4. `docs/ROADMAP.md` — scope, milestones, acceptance criteria.
5. `docs/PHASE2_DESIGN.md` — approved direction for Scene Atlas tab, road tools, native Grid scale, Region association, and phase gates.
6. Official docs: https://foundryvtt.com/article/module-development/ and https://foundryvtt.com/api/v14/.

If a requested change conflicts with these documents, explain the conflict and propose a documentation update first.

## Workflow

- Phase 2 is authorized. **2b is verified** for native Scene Grid updates. Test the **2c v0.2.4 first slice** in real Foundry v14: Roads [+], click-to-draw, road list, snapping, UI removal of Configure Atlas toggle, GM permissions, and Scene-specific persistence. Finish remaining 2c waypoint/geometry editing before **2d** native Region associations with Behavior inspection. Terrain-aware token movement costs and travel-time/fastest-route calculations belong to future **Phase 3b** and require separate approval. Do **not** begin routing, player-visible features, or phases 3+ without new approval.
- Make changes on a topic branch and submit a reviewable PR. Do not merge to `main` without explicit approval.
- Keep PRs focused. Include rationale, affected files, manual/test evidence, risks, and deferred follow-ups.
- Avoid unrelated refactors or changing repository settings. Preserve user edits and existing work.
- When implementation begins, deliver the smallest complete vertical slice; keep complexity behind clear interfaces.
- Verify v14 API signatures with official versioned documentation (or an installed v14 instance) before using them. Do not assume a v13 pattern still works.

- The old v1 `enabled` field is retained for compatibility, but Atlas tab activation now derives from whether the Scene has saved segments. Adding and deleting roads synchronizes the field; no explicit activation dialog remains.

## Architecture invariants

- Use native Foundry `Scene` as the atlas map; `NoteDocument` with linked `JournalEntry`/`JournalEntryPage` for locations/lore; and existing native `RegionDocument` shapes/holes/levels for optional terrain associations in Phase 2d. Never duplicate Region geometry in Scene atlas flags.
- Store authored road junctions and segments as **versioned, namespaced Scene flags**. The route graph is a validated in-memory projection. Do not use `DrawingDocument` as the canonical graph database.
- Keep authored network, computed route result, and transient animation/display state separate.
- Coordinates are Scene/image-space pixels, never camera/screen pixels. **Use native Scene Grid settings exclusively** (`grid.size`, `grid.distance`, `grid.units`). Phase 2b displays the saved Grid settings, not a derived units-per-pixel travel rule. Future road distances must delegate to Foundry v14 `canvas.grid.measurePath(waypoints).distance`, with native square/hex/gridless behavior. Do not treat Euclidean pixel geometry multiplied by a ratio as an authoritative ruler measurement. Schema v1 may contain old `calibration: {source:"manual",...}`; preserve it untouched for future migration but **ignore it in all calculations/UI**. New flags use `calibration:null`.
- Topological connections are explicit. Two lines crossing on the image do **not** automatically create a junction.
- Geometry/routing/validation should be pure, testable code; keep Foundry document access and canvas rendering in adapters.
- Preserve stable IDs, reject malformed links and nonfinite coordinates, and plan migrations before changing a persisted schema.
- Link Regions with **minimal** validated, versioned module-owned metadata (association only) after reviewing a persisted schema. Region names and optional visual tags do not encode rules. Unlinked Regions have no **Atlas-planned** terrain effect, though native Behaviors still apply to actual token movement. Never overwrite or duplicate core or game-system Region movement rules.
- Keep geometric road distance distinct from token-specific movement cost and overland travel time. Phase 2 only stores Region associations. If Phase 3b is approved, use public v14 `Token#createTerrainMovementPath` / `Token#measureMovementPath` APIs with an explicit party token/movement action, testing real v14 behavior. Do not add custom `speedMultiplier`, polygon clipping, or overlap-policy calculations when Foundry's engine already supplies them. Without a token context, show distance only; overland time needs explicit party speed.
- No reliance on any specific game system, actor fields, or third-party route module.

## Permissions and privacy

- MVP is GM-authored and GM-used.
- Use Foundry's native Journal/Note permissions for revealing lore and linked places when possible.
- Hiding UI elements or filtering a rendered overlay is **not** proof that its Scene-flag data is secret from connected players. Do not implement player-facing road data or hidden POIs until a two-client data-exposure review establishes a safe distribution strategy.
- GM-only mutations must be checked at the command/action boundary, not only by disabling buttons. Do not trust client-provided identifiers or route payloads.
- Do not add sockets, server-side trust assumptions, or player-visible data broadcasts without an explicit design review.

## Quality and testing (when code is authorized)

- Use a current Foundry v14 test world with a neutral game system; test with a GM and a non-GM account.
- Add unit tests for segment validation, graph projection, connectivity, native Scene Grid settings and dormant legacy calibration, zero-length segments, disconnected routes, and deterministic path choice. Phase 2d also needs native Region link/metadata tests; Phase 3b (after approval) needs mocked adapters **plus actual Foundry v14 tests** for token-aware cost, Region holes/levels/overlaps, active/disabled Behaviors, movement modes, and no-token fallback.
- Manually test initial canvas load, switching Scenes, resize/pan/zoom, module disable/re-enable, save/reload, and malformed/corrupt flags. Verify Region changes never mutate native shapes/Behaviors, and old manual calibration persists *in flags only* while the Atlas UI always uses native Grid settings. Native token cost previews must never move tokens.
- Test multi-GM editing behavior or explicitly limit the MVP to one editor at a time. Do not silently overwrite concurrent work.
- Only report tests that actually ran. If no v14 runtime is available, state that limitation and supply manual verification instructions.
- Keep performance predictable for long polylines; avoid reconstructing geometry every animation frame.

## Third-party work

- LegendKeeper documents are **product behavior references**, not an API dependency or authorization to use a user's project content.
- Indy Route can inform presentation and Foundry idioms. If any third-party source code is reused, inspect its license and retain all required notices/attribution in the resulting distribution. Prefer independently implemented, small, documented modules.
- Do not copy branding, protected assets, sample campaign content, or credentials.

## Source-of-truth URLs

- https://foundryvtt.com/article/module-development/
- https://foundryvtt.com/api/v14/
- https://www.legendkeeper.com/developers/
- https://github.com/jwrpalmer99/indy-route
