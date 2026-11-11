# beta.8.36 — Stage 3A: read-only native Hex/Grid Checkpoint membership

Stacked on accepted beta.8.35 preview (draft #312). Scope: #268 and #204. No native Region/Checkpoint writes, migrations, automatic semantic links, hierarchy edits or player-facing data changes.

## Live Foundry v14 checks

1. In a live square/hex Scene, open **Territories → [Territory] → Checkpoint & Journal**. Confirm a **Native Hex/Grid membership — read-only** section appears.
2. Place a saved Checkpoint node inside a native grid Region: expect **Inside native cells · Spatial only** until deliberately linked. A separate explicit semantic link must be identified without changing the derived result.
3. Move the Checkpoint (through its existing editor) outside the Region and reopen Settings. The prior Region's explicit link, if any, should say **Outside native cells · Explicitly linked**. The inspector must never relocate it.
4. With a Continent containing a Town, both may contain the point without the Continent being marked ambiguous. With two same-level grid Territories owning the same cell, check the overlap warning.
5. Edit native grid cells or perform a guarded cell transfer, then reopen Settings: results reflect the saved cell inventory (never an unsaved brush draft). Test Scene switch and native-hidden Regions.
6. Verify non-GM cannot open the Settings inspector, and no private hierarchy/Checkpoint names are newly exposed to player UI. Confirm native Shapes, Behaviors, Levels, Fog, Journals, Token movement and Journey are unchanged.

## Deliberately deferred

- This first report reads native grid offsets and an Atlas Checkpoint node's grid cell. Polygon-only geometries, mixed native Shape types, elevation/Levels and coordinate boundary ambiguity need separate explicit policy; they are not silently inferred.
- Membership does not reassign a Checkpoint or replace manual links. A nested hierarchy favors the child for ambiguity reporting, while same-depth or unrelated overlaps remain flagged, not auto-resolved.
- Membership refresh is on Settings reopen. Live subscription/transfer integration, elevation policy, and two-client acceptance remain pending before #268/#204 close.
