# v0.3.9-beta.8.24 — Geographic Territory and Checkpoint identity

Status: unmerged, stacked draft; Foundry v14 live GM/player testing required.

## One identity, distinct document ownership

- A Checkpoint keeps its stable Scene Atlas ID, road Node, marker appearance, player visibility, and linked Journal Entry/Page.
- A manually authored geographic Territory keeps its native Foundry Region identity, exact Shapes/Levels, native Behaviors, public Journey label/permissions, and classification.
- A single versioned native Region association flag links the Checkpoint ID. **Neither object is moved, renamed or automatically published** when linking.

## Bidirectional editing

- **Workspace → Territories → map-pin:** choose one existing Checkpoint or remove the link.
- **Checkpoint Settings → Terrain Region → Link geographic Territory:** choose an available manually authored Atlas-linked native Region or unlink the current one. If already linked, unlink explicitly before choosing a different Region. The generated Terrain Region tools remain separate.
- If the exact normalized native Region name matches a Checkpoint name **and** its category matches the geographic City/Town/Village kind, Atlas marks that unique, unclaimed pair as **Suggested**. The picker may preselect it, but the GM must still review and confirm. Ambiguities and generic/area/continent categories do not produce a suggestion.

## GM label and Journal behavior

1. When **Atlas Layers → Regions** displays a Territory **and** **Show Region names** is enabled, a linked geographic Region displays the Checkpoint's current name (the Checkpoint remains the naming source). This is a **GM-only local overlay**; published public Journey labels are separate.
2. Only if that linked geographic label was actually drawn, a Checkpoint whose saved label mode is **Always** temporarily behaves as **Hover**. An existing Hover or Off choice is unchanged. Turning off Region names or hiding the Region restores the Checkpoint's original Always setting without a Scene, Checkpoint, or native Region write.
3. Double-click the visible Territory **text label** (not the boundary) to open the already-linked Checkpoint Journal. Atlas rereads the live Region association and current Journal UUID, using the same native Journal permission checks as its existing Checkpoint double-click. Unlinked, invalid, stale or Journal-less labels do nothing. Pointer listeners detach on refresh, Scene teardown and module cleanup.
4. This release does **not** expose geographic layers or clickable names to players. Player map visibility and discovered vs known lore remain separate, awaiting the existing two-client data-exposure permission review.

## Owner acceptance checklist

Back up the World before testing. Confirm beta.8.23 identity linking and prior recovery records are healthy.

1. Open **Dirwest Checkpoint Settings → Terrain Region** and use **Link geographic Territory** to select the existing Dirwest City Region. Verify one review and one native Region flag write only. Unlink there; relink from Workspace → Territories. Repeat with a second Checkpoint to verify occupied Regions cannot be selected.
2. Rename the Checkpoint and verify its associated Region's visible GM map label follows the new Checkpoint name, without changing the Region's native name or Journal link.
3. In Atlas Layers, set Regions = All Regions and **Show Region names** = ON. With Checkpoint label saved as Always, verify the Region name appears once and the Checkpoint label appears only on hover. Turn names OFF; verify Always returns. Test Off and Hover checkpoint modes separately.
4. Double-click the visible Region **name** with an existing linked Journal Entry/Page; the correct Journal opens. Double-click a boundary or an unlinked Territory label; no Journal should open. Remove the link while editing and confirm a stale label cannot open its former Journal.
5. Confirm GM/Player sessions: the player sees only explicitly authorized Checkpoint and Road information from previous releases, with no new Territory label, Journal permission or Fog leaks. Inspect native Region IDs/Shapes/Behaviors/Levels and confirm no mutation.
6. Test zoom/pan, Scene reload, Scene switch, module disable/re-enable and malformed association flags; listeners and hover modes must clean up.

## Future extensions for owner approval

- An opt-in, player-safe Territory layer and Region-label Journal interaction **after** an explicit visibility/permission and two-client exposure review.
- A Checkpoint hover tooltip summarizing the linked geographic kind and public destination Journal, without using native Region label as a discovery grant.
- A one-click GM "Locate linked Region/Checkpoint" command using existing map focus, and potentially Checkpoint-based region membership for journey destination fallback — separately gated to avoid changing navigation semantics silently.
- More advanced coordinated polygon-boundary adjustments remain low priority.
