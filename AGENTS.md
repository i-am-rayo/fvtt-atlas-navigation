> **October 23, 2026 — v0.2.15 authorized after owner-verified v0.2.14:** The owner validated opt-in native checkpoint/corridor Region generation and confirmed that manually moved native Regions correctly block regeneration. The next owner-approved slice adds **world-shared Land/Air/Water Corridor Travel Presets**, edited only through a restricted module-settings submenu. Presets have stable IDs, categories, names and bounded movement-cost *suggestions*, with deliberately neutral built-in defaults. The GM can assign a default preset to a named road and override a generated corridor; the first road assignment explicitly upgrades an existing v3/v4 Scene Atlas to v5, retaining all roads, checkpoints, geometry and revision checks. A separately versioned Region flag references a preset ID without touching the native generated-geometry signature. Changes to world presets must not silently update already-authored Regions. **No native Modify Movement Cost Behavior creation, native terrain-cost calculations, automatic Region regeneration, travel time or routing in v0.2.15.** Follow-on opt-in native Behavior integration and Phase 3 require their own test gate. Stage a reviewable PR; live v14 GM/non-GM testing remains required.
 
> **October 23, 2026 — v0.2.14 owner-authorized:** The owner has verified v0.2.13 checkpoints, elevation and filtering in Foundry v14. Implement opt-in, GM-confirmed native Region generation: a single checkpoint ellipse or one unambiguous same-road interval corridor between two checkpoints. Preview on GM canvas; configurable half-width in native Scene grid cells; native Region geometries and Behaviors stay native. Use minimal generated Region metadata with geometry integrity signature, reject duplicates and ambiguous loops; allow regeneration only when current native shapes match the recorded signature. Preserve native Behaviors, names, visibility and levels on regeneration. No auto-bulk creation, native elevation assignment, grade/difficult-terrain inference, Journals, token costs or routing. Phase 3 still requires fresh approval.\n\n> **October 23, 2026 — v0.2.13 newly authorized by owner:** Phase 2d v0.2.12 native Region linking with both tested behaviors is **owner-verified**. Owner approved this order: **v0.2.13 meaningful road Checkpoints and elevation → v0.2.14 opt-in generated native checkpoint/corridor Regions → only then revisit Phase 3 shortest-path routing**. For v0.2.13, checkpoint metadata is a schema-v4 extension of the versioned per-Scene Atlas flag, upgraded only on the first GM-authorized checkpoint creation. Each checkpoint has stable ID, named roadId, existing/new graph nodeId, name and nullable finite elevationMeters. Do not auto-merge roads or alter native Region behaviors, elevation ranges, levels, terrain costs, tokens, or Journals. An interior checkpoint may split its owning road graph section without making a routing junction. Preserve checkpoint associations under edits/renames/merges; block destructive operations rather than discard a checkpoint. GM-only and single-editor restrictions remain. Native Regions generated along roads and elevation-derived slopes are **not** part of v0.2.13. Phase 3 remains unapproved. Unit tests alone are insufficient for v14 acceptance.

> **October 23, 2026 — Phase 2d v0.2.12 authorized:** The owner passed the v0.2.11 same-road branch recovery checks and requested the next Phase 2d milestone. Implement a minimal opt-in link on each existing native Region (`flags.fvtt-atlas-navigation.atlas: {schemaVersion:1, linked:true}`), plus a GM-only Scene Atlas Region picker/list, native Behavior active/inactive inspection and native Region editor shortcut. Unlink removes **only** the association. Do not mutate Region shapes, levels, Behaviors, tokens, Scene road graphs, or native Grid; do not implement terrain costs/routing. Unit tests do not substitute for live v14 GM/non-GM acceptance. Phase 3 remains unapproved.\n\n> **October 23, 2026 — v0.2.11 owner-reported same-road fork repair:** The owner verified other v0.2.10 behavior but found junctions in an older merged Kharak Menzor–Eyrie Sea route trapped: a three-or-more-section same-road fork is neither a two-edge bend nor a junction shared by different named roads. **Only on explicit Alt/Option-click, choose one section of that same logical road to detach**; duplicate the chosen section's endpoint without moving/deleting other sections. Then, optionally, demote a now-two-section pass-through. This is staged, reversible, schema-v3-preserving and requires live v14 acceptance. The owner later authorized Phase 2d Regions after verifying this repair; Phase 3 remains unapproved.

> **October 23, 2026 — v0.2.10 owner test gate:** The owner tested v0.2.9 in Foundry v14 and confirmed placing middle-of-road graph points and connecting roads worked. The old Waypoints panel incorrectly showed endpoints and simple road subdivisions as “Junctions.” v0.2.10 clarifies **geometry bends**, **routing junctions**, and future **meaningful Waypoints**: the latter are deferred; Junctions [+] remains the explicit topology tool, with a bounded/filterable inspector. In Edit Points, Shift-click an eligible gold single-road pass-through to demote it to a white bend (staged, reversible, no geometry changes). Never auto-demote shared or branch nodes, move roads during conversion, or connect overlapping lines without confirmation. v3 data and native Scene Grid are unchanged. **Live v14 testing for 0.2.10 is pending; Phase 2d Regions / Phase 3 are not authorized.**

# Agent and contributor instructions

## Project identity

- Repository: `i-am-rayo/fvtt-atlas-navigation`
- Intended module ID / manifest ID / module folder: `fvtt-atlas-navigation`
- Target: **Foundry VTT v14**, system-agnostic.
- Status: **Phase 1 merged**, **Phase 2 authorized**. Owner verified v0.2.5 anchoring, snapping, Scene isolation, and highlights; v0.2.7 bend editing and confirmed road attachments; and v0.2.8 detachment/reattachment. v0.2.9's explicit junction placement was owner-tested. v0.2.10 separates routing junctions from future narrative waypoints, adds selective reversible demotion, and filters the bounded inspector per road or one-hop neighbors. Internal edge counts are graph segments. **The owner has now verified the v0.2.11 same-road branch repair**. Phase 2d native Region association is authorized as v0.2.12; Phase 3 routing and player features are not authorized.
- Foundry module development is the primary framework; do not build a standalone web service or introduce a LegendKeeper requirement.
- No campaign-specific or game-system-specific assumptions, example content, assets, settings, or APIs.

## Current schema/padding migration safety (Phase 2c v0.2.11)

- Do not silently reinterpret legacy schema v1 absolute-canvas coordinates as image-local positions. A GM must explicitly anchor them using the currently aligned Scene image origin. Preserve existing graph IDs/names and Scene revision checks. Never erase or bulk reset maps.
- Schema v3 separates logical named `roads[]` from topological `segments[]`. Each segment belongs to `roadId`. Splitting a segment never creates a duplicate named road. Conversion from populated v2 to v3 requires an explicit GM command; do not automatically merge same-name roads. Merging connected road groups is explicit and retains graph geometry and IDs. Point edits are staged until Save, with Undo/Cancel, and moving shared junctions affects all connected segments. Endpoint snaps, junction attachments, and junction detachment require explicit GM approval; name merging remains a separate deliberate action, never a side effect of joining topology. Detaching a shared node duplicates only that node for the selected named road's incident edges, preserving all other road connections and labels. Do not create actual core WallDocuments for roads.
- Schema v2/v3 `coordinateSpace: "image"` is measured from the Scene image top-left. Render with Foundry `canvas.dimensions.sceneX/sceneY`; author by subtracting that origin from Foundry canvas pointer coordinates. Only actual endpoints join roads, and split connections must be real graph nodes.
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

- Phase 2 is authorized. **2b is verified** for native Scene Grid updates. Test the **2c v0.2.4 first slice** in real Foundry v14: Roads [+], click-to-draw, road list, snapping, UI removal of Configure Atlas toggle, GM permissions, and Scene-specific persistence. The owner has accepted 2c through v0.2.11; implement **2d** native Region associations with Behavior inspection now. Meaningful narrative Waypoints and remaining appearance/UX features remain separately deferred. Terrain-aware token movement costs and travel-time/fastest-route calculations belong to future **Phase 3b** and require separate approval. Do **not** begin routing, player-visible features, or phases 3+ without new approval.
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
- Topological connections are explicit. Two lines crossing on the image do **not** automatically create a junction. Not every saved graph node is a meaningful junction: ordinary endpoints and degree-2 single-road subdivisions remain stored but are not listed as junctions. A true junction branches (degree 3+) or is shared by distinct named roads. Future narrative Waypoints/Notes are distinct from graph nodes and require separate authorization/schema design. Demotion may collapse only exactly two incident sections of the same named road, retaining the full path shape, never shared or branching topology.
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
