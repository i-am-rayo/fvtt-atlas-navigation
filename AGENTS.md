# Agent and contributor instructions

## Project identity

- Repository: `i-am-rayo/fvtt-atlas-navigation`
- Intended module ID / manifest ID / module folder: `fvtt-atlas-navigation`
- Target: **Foundry VTT v14**, system-agnostic.
- Status: **Phase 1 merged** after owner testing; **Phase 2 authorized** by the owner on 2026-10-22. Phase 2a v0.2.1 atlas setup/calibration is the current tested slice. The Phase 2b–2d Scene UI, roads, and native Region association design was revised October 23, 2026. Phases 3+ require separate approval.
- Foundry module development is the primary framework; do not build a standalone web service or introduce a LegendKeeper requirement.
- No campaign-specific or game-system-specific assumptions, example content, assets, settings, or APIs.

## Read before making changes

1. `README.md` — goals and present status.
2. `docs/ARCHITECTURE.md` — boundaries, native Foundry integration, planned subsystems.
3. `docs/DATA_MODEL.md` — proposed persisted shapes and validation.
4. `docs/ROADMAP.md` — scope, milestones, acceptance criteria.
5. `docs/PHASE2_DESIGN.md` — approved direction for Scene Atlas tab, road tools, native Grid scale, Region association, and phase gates.
6. Official docs: https://foundryvtt.com/article/module-development/ and https://foundryvtt.com/api/v14/.

If a requested change conflicts with these documents, explain the conflict and propose a documentation update first.

## Workflow

- Phase 2 is authorized. Deliver it in reviewable slices: **2b** Scene Atlas management UI/native Grid measurement, **2c** GM road/waypoint canvas editing, **2d** native Region associations and tags. Travel-time and fastest-route calculations belong to future **Phase 3b** and require separate approval. Do **not** begin routing, player-visible features, or phases 3+ without new approval.
- Make changes on a topic branch and submit a reviewable PR. Do not merge to `main` without explicit approval.
- Keep PRs focused. Include rationale, affected files, manual/test evidence, risks, and deferred follow-ups.
- Avoid unrelated refactors or changing repository settings. Preserve user edits and existing work.
- When implementation begins, deliver the smallest complete vertical slice; keep complexity behind clear interfaces.
- Verify v14 API signatures with official versioned documentation (or an installed v14 instance) before using them. Do not assume a v13 pattern still works.

## Architecture invariants

- Use native Foundry `Scene` as the atlas map; `NoteDocument` with linked `JournalEntry`/`JournalEntryPage` for locations/lore; and existing native `RegionDocument` shapes/holes/levels for optional terrain associations in Phase 2d. Never duplicate Region geometry in Scene atlas flags.
- Store authored road junctions and segments as **versioned, namespaced Scene flags**. The route graph is a validated in-memory projection. Do not use `DrawingDocument` as the canonical graph database.
- Keep authored network, computed route result, and transient animation/display state separate.
- Coordinates are Scene/image-space pixels, never camera/screen pixels. **Prefer native Scene Grid measurements** (`grid.size`, `grid.distance`, `grid.units`) for scale/units; keep a deliberate manual override for exceptional Scenes. Preserve existing schema v1 manual calibrations until an explicit lossless migration or GM choice; do not silently rewrite flags.
- Topological connections are explicit. Two lines crossing on the image do **not** automatically create a junction.
- Geometry/routing/validation should be pure, testable code; keep Foundry document access and canvas rendering in adapters.
- Preserve stable IDs, reject malformed links and nonfinite coordinates, and plan migrations before changing a persisted schema.
- Link Regions with validated, versioned module-owned metadata (tag and explicit speed multiplier) only after reviewing a persisted schema. Ordinary Regions without this metadata have no Atlas travel effect. Do **not** automatically interpret native `Modify Movement Cost` Behaviors, whose token movement semantics may depend on the game system.\n- A 0.5× speed factor affects **time**, not geometric length. Applied Region geometry must intersect road polyline intervals precisely, respecting holes/levels and a deliberate overlap policy. Phase 2 stores links, Phase 3b (separate approval) computes time.\n- No reliance on any specific game system, actor fields, or third-party route module.

## Permissions and privacy

- MVP is GM-authored and GM-used.
- Use Foundry's native Journal/Note permissions for revealing lore and linked places when possible.
- Hiding UI elements or filtering a rendered overlay is **not** proof that its Scene-flag data is secret from connected players. Do not implement player-facing road data or hidden POIs until a two-client data-exposure review establishes a safe distribution strategy.
- GM-only mutations must be checked at the command/action boundary, not only by disabling buttons. Do not trust client-provided identifiers or route payloads.
- Do not add sockets, server-side trust assumptions, or player-visible data broadcasts without an explicit design review.

## Quality and testing (when code is authorized)

- Use a current Foundry v14 test world with a neutral game system; test with a GM and a non-GM account.
- Add unit tests for segment validation, graph projection, connectivity, Scene Grid/manual calibration, zero-length segments, disconnected routes, and deterministic path choice. Phase 2d also needs native Region link/metadata tests; Phase 3b (after approval) needs pure road–polygon intersection, holes, overlap, level filtering, and time-cost fixtures.
- Manually test initial canvas load, switching Scenes, resize/pan/zoom, module disable/re-enable, save/reload, and malformed/corrupt flags. Verify Region changes never mutate native shapes/Behaviors and old manual calibration persists when the Grid measurement differs.
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
