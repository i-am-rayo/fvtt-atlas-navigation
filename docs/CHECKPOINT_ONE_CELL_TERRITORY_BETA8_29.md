# v0.3.9-beta.8.29 — Optional Checkpoint Territory + minimizable Road Settings

Status: stacked draft; Foundry v14 live GM/player acceptance required before merge.

## What changed

1. Once a GM **saves a new City, Town, Village or Settlement Checkpoint**, Atlas offers an optional matching **single native square/hex cell** Territory. No Territory is created before the Checkpoint is committed.
2. Atlas highlights the precise native grid cell without persisting a draft. The GM chooses **Create One-Cell Territory**, **Link Existing…**, or **Skip**. Closing also skips; the default is Skip.
3. Creation reuses the Territory author's native grid Shape and peer-overlap validation. One `Region` document creation persists the name, geographic kind, Atlas boundary source and stable Checkpoint association **together**. No new native Behaviors or visibility permission are added.
4. Same-type existing Territories are displayed as linking suggestions, including same-cell and full leading-name matches (for example, `Ježibaba` and `Ježibaba - Abandoned Town`). Exact same-name native Territories, occupied peer-settlement cells and unsupported native grids block new creation. **Link Existing…** uses the existing explicit review/confirmation picker; matches never automatically link.
5. Stale Checkpoint position, Scene Atlas revision, geographic type, native grid geometry, or Region inventory blocks creation. The offer is GM-only and requires an editable Scene and native `GridShapeData` on a live square/hex canvas.
6. **Road Settings is now minimizable/modeless**, like Checkpoint Settings, using Foundry's native `DialogV2` window support. Minimize/restore does not Save, Discard, reset the tab, or change form fields. The existing guarded close remains. Future consolidated **Terrain Settings** should follow this same window contract.

## Live GM acceptance checklist

1. Back up the World and install the draft. On a native **hex** Scene, create a new **City** Checkpoint on a road. Checkpoint saves first; then the offer previews precisely one hex.
2. Choose **Skip** (or close). Reopen Checkpoint Settings and confirm no native Territory or association was created. Repeat for **Town**, **Village**, **Settlement**, confirming their geographic kinds.
3. Choose **Create One-Cell Territory** for a new Checkpoint. Verify one native Region covers the correct hex and has the matching name/kind and stable Checkpoint link. Its native **Behaviors remain empty**; player boundaries and names remain unpublished.
4. Repeat on a square-grid Scene and after a Scene padding change to confirm the native cell is correct.
5. With an exact-name existing native Territory, verify Create is blocked and **Link Existing…** offers the same-type candidate for explicit review. Repeat with `Ježibaba` versus `Ježibaba - Abandoned Town`; a leading match must be only a suggestion.
6. Place a Village inside a grid cell already owned by a Town/Settlement. Creation must fail safely without changing the owner. Continent/Area nesting should remain possible.
7. Open an offer, then change the Scene, Region inventory or Checkpoint metadata elsewhere; Create must refuse stale state. Multi-GM writes have no atomic Scene-wide lock; use the project's one-active-editor rule.
8. Confirm unsupported gridless/older Foundry grids fail safely. Bridge, Port and generic Checkpoints must not prompt for settlement Territory creation.
9. Open Road Settings, change fields and tabs without saving, then **minimize**. Work on the map, restore, verify all unsaved fields and the selected tab, and Save once. Repeat closing with changes and test **Continue Editing**, **Discard** and **Save**. Compare Checkpoint Settings.
10. In a player client, the new Region must remain hidden unless the GM explicitly shares it; any shared boundary must still render beneath native/Atlas fog. Journey time, transportation, Checkpoint Journal and native Region Behaviors should be unchanged.

## Safety and deferrals

- No automatic creation when editing existing Checkpoints, bulk migration, player sharing, Journal transfer, native movement-cost Behavior, or Region transfer/ownership change.
- The stable link is part of the native Region's initial document write. If creation fails, the Checkpoint remains; later linking or drawing is still available using the existing GM Territory controls. No automatic destructive rollback.
- Native Region writes lack cross-client compare-and-swap. Revisions and native geometry/inventory are rechecked before commit, but GMs should not edit the same Scene concurrently.
- Consolidated custom Terrain Settings, typography per geographic kind, and linked Checkpoint icon prefixes remain future work.

## Automated checks

- `npm run check` — JavaScript parsing and all Node regression tests.
- `npm run architecture:check` — import structure and cycle checks.
- Focused `tests/checkpoint-territory-creation.test.mjs` and checkpoint placement in `tests/road-canvas.test.mjs`.

These cannot replace live Foundry v14 native Region, two-client visibility and window minimization tests.
