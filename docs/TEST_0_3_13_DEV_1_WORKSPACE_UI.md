# Atlas 0.3.13-dev.1 — Workspace and UI/UX stabilization acceptance

**Scope:** GitHub Milestone 01, issues #515–#519; draft PR #520. **PO decision:** #417 Territory appearance/typography deferred, excluded from this build. #513 Navigation transport approval parity stays Milestone 08.

**Baseline:** PO-accepted 0.3.12 on `main`. This build changes only GM authoring/presentation and read-only Territory preflight; it does **not** authorize new Journey movement, World-time, Actor/Group, fares, Region Behaviors, or Journal recovery behavior.

**Test manifest:** `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/codex/atlas-gm-ux-release/module.json`

## Install/boot and permissions

- [ ] Back up the Foundry v14 World; install the **test branch**, confirm installed manifest and module version `0.3.13-dev.1`. Do not accidentally install the mainline 0.3.12 manifest.
- [ ] First load as GM and a separate non-GM client; Atlas initializes without a manual refresh. If a script fails to load, capture first-failure Network entry (URL, Status, headers, proxy response) for #453, before refreshing.
- [ ] Verify Scene, native Region and World preset writes are still restricted to authorized GMs; player visibility contains no private Region, Road, Map Marker, Journey or Journal metadata.

## A. Directory and map-first Road creation (#518, #515)

- [ ] Workspace → Map Directory: **Create on Scene** has exactly one set of Add Territory, Add Road, Add Map Marker commands. **Browse** choices filter without writing. Per-section nested Plus shortcuts no longer crowd results.
- [ ] Search, filters, category grouping, Road/Map Marker counts, native Territory, Journal actions and row-level Locate/Visibility/Settings/Edit remain functional. Changing a filter preserves existing data and visible focus.
- [ ] At 200% browser text zoom, narrow Workspace width and long bilingual names, controls remain reachable, labels do not overlap and keyboard focus remains visible.
- [ ] Toolbar → Draw Road starts with the map and floating Road Editor, **without** a preliminary Settings wizard. One point cannot Save; two points permit Finish Road. The saved Road Settings opens using the exact stable persisted Road ID.
- [ ] Workspace → Add Road has the same map-first behavior. After Save, Road Settings can change name, World travel preset, appearance, linked Journal and Region options by their existing Save workflow.
- [ ] Cancel/Escape/X before Road Save leaves zero new roads. Cancel/close **Road Settings after a committed Road** leaves that Road intact.
- [ ] Undo/Redo, Road-to-Map-Marker connections, graph snapping review, declined connection, stale revision, repeated rapid Add clicks and switching the active Scene mid-draft refuse unsafe or duplicate commits.
- [ ] The Workspace returns to its original view/focus after canvas editing, and stays closed if deliberately closed. No forced reopening of a different Scene's editor.

## B. Inherited transport and Layers/brush clarity (#517, #519)

- [ ] Map Marker → Transportation → Add Cart: an inherited World Cart offer is staged and displayed **without automatically opening** its local editor. Map Marker Save is the persistence boundary; Cancel is a no-op.
- [ ] Edit Cart explicitly opens the existing shared customization form. Save local overrides, reset to inheritance, and inspect missing/deleted World presets; existing World catalog is unchanged.
- [ ] Check Land/Water/Sea/Air methods, a missing World method, duplicate offer prevention, non-GM access and a simultaneous World preset change (stale editor rejects overwrite).
- [ ] Atlas Layers GM Preview: entering/exiting player projection shows an accessible active status and explicit Exit. It changes neither published permissions nor client-layer settings.
- [ ] Separate non-GM session sees only its authorized player projection; no GM Road hover/hidden Territory or unpublished Journal metadata appears.
- [ ] Exploration Brush: current-Scene scope and active Reveal/Hide status are visible; Stop/Escape ends mode; manual override counts are not confused with total native Fog. Opening/closing or changing brush radius never paints cells.
- [ ] Actual GM painting changes only the selected manual Scene cell overrides. Native Regions, Behaviors and Foundry Fog remain unchanged.

## C. Native Territory creation review (#516)

- [ ] Create Territory requires an explicit geographic type; it does not silently preselect **Continent**. Standalone and parent choices remain intentional.
- [ ] Painting an overlapping same-tier Hex/Grid cell shows **named** conflicting peer Territory plus per-peer cell count in a map-side review **before Save**. Save is blocked; no native Region is created.
- [ ] Polygon peer overlap is identified by name; parent containment and mixed native geometry use the existing authoritative preflight and fail closed.
- [ ] Canceling review preserves draft; approval against a changed native Region/peer ownership halts without writes and keeps draft open. Native transfer/recovery ledgers are neither bypassed nor auto-resolved.
- [ ] A valid, non-overlapping draft saves one native Region. Retain native Region IDs, original Shapes/Behaviors/elevation, World rules and linked Journals; no preview write occurs.

## Baseline regression and acceptance gate

- [ ] Existing 0.3.12 travel still works across ordinary and mixed transportation, weather canvas redraw, interruption/recovery, approved fares including 50% World mount boarding, Journal append and GM-only time approvals.
- [ ] Automated evidence: Node tests, `npm run check`, `npm run architecture:check`, syntax, `git diff --check`, CI and branch manifest/archive consistency.
- [ ] **Owner live acceptance is required before merge.** Report any repro with Foundry build, system/module versions, steps, console/Network records and screenshots; don't close #515–#519 solely on green CI.

_Status: test plan; completing any automated gate does not check the corresponding live-test box._
