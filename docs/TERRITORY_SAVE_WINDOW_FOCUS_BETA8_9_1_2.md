# v0.3.9-beta.8.9.1.2 — Territory Save and canvas editor focus

Status: owner-reported Foundry v14 Save failure; local automated verification only.
Stacked draft PR on beta.8.9.1.1. Do not merge or release without GM acceptance.

## Root cause and focused correction

The owner confirmed the beta.8.9.1.1 Graphics fallback allowed a pre-existing
Dirwest Region's 104 nodes and a new Continent editor to open. Clicking
**Preview & Save** then failed with `DialogV2 is not defined`. The callback in
`territory-authoring-canvas.js` referenced `DialogV2` without binding or
importing it. It now calls the documented v14
`foundry.applications.api.DialogV2.confirm` directly; reject and dismiss
remain non-writing, and a closed/stale editor cannot commit a resumed confirm.

## Window focus behavior

When an Atlas **Territory control-node/grid editor**, **Road canvas editor**,
or **Manual Fog brush palette** begins, a shared client-local focus lease
records current Foundry v14 `foundry.applications.instances` entries. Only
rendered, framed, currently expanded ApplicationV2 windows are minimized.
When the final active Atlas editor ends, only those windows actually minimized
and still minimized are maximized. Already-minimized windows, the editor's own
Road dock, Foundry sidebar, persistent canvas tools and any closed window are
not reopened. Editor sessions release leases on Save, Cancel, Close, errors
or Canvas teardown; interleaved sessions hold the original snapshot until
the last session ends. No settings, position flags or document writes are made.

**Boundary:** this uses Foundry v14's public ApplicationV2 registry. Legacy
third-party ApplicationV1 popouts are not managed where their minimized state
cannot be reliably determined through public APIs. Editors that open new
windows after the focus snapshot are not retroactively minimized (for example
the subsequent native Save confirmation dialog).

## Owner GM retest — use a backed-up Foundry v14 World

1. Open Atlas Scene Workspace, a Region sheet, and another normal application
   while keeping a fourth window **already minimized**. Edit **Dirwest** via
   Territories → Edit Boundary. Expanded windows should minimize; the editor's
   control panel and draggable node handles remain usable. Undo one movement.
2. Click **Preview & Save**, **No**: no native Region write. Click again, **Yes**:
   verify native Dirwest Region Shapes update, and the chosen parent,
   publication, Behaviors, and Region ID remain unchanged. No `DialogV2` error.
3. After Save, verify only the originally expanded windows restore. The
   pre-minimized fourth window must stay minimized; the Atlas editor disappears.
4. Repeat with **Territories → [+] → new Continent → Draw Atlas Boundary Nodes**.
   Draw 3+ nodes; Preview & Save, confirm native Region creation and no
   unexpected overlapping or uncontained native write. Repeat with Paint Native
   Hex/Grid Spaces on a gridded Scene. Cancel must never write a Region.
5. Open Road editing from Atlas Workspace; verify its floating Road dock stays
   visible, other app windows minimize and restore on Save/Cancel. Repeat for
   the Atlas Manual Fog brush palette, including ESC dismissal. Verify neither
   workflow changes Road/Fog behavior or persists window state.
6. Try Canvas refresh with an editor open: its UI/listeners must clean up and
   prior windows restore. Repeat as non-GM and verify no GM edit controls or
   hidden region/territory metadata exposed. Smoke-test player Journey and
   banners independently; no Journey commits should occur from editor focus.

## Regression gates

- DOM unit test: actual Save button path, v14 confirm namespace, rejection
  without writes, acceptance with one staged Save and cleanup.
- Client focus tests: skip already minimized/unframed/closed windows, exclude
  Road dock, support overlapping leases, idempotent cleanup, pending minimize
  completion, avoid reopening windows manually expanded during editing.
- `npm run check`, `npm run architecture:check`, syntax checks and
  `git diff --check` required before publishing draft.

Automated passing does **not** constitute owner Foundry v14 live acceptance.
