# Beta.8.25 — Player Territory Layers and GM Sharing

This stacked draft follows beta.8.24. It introduces a **separate, opt-in boundary grant** for manually classified, Atlas-linked native Regions. It does not alter the existing public Journey-name permission, native Region geometry or gameplay rules.

## Permission contract

| Native Territory state | Player outline | Player Territory name |
|---|---|---|
| Neither permission | Hidden | Hidden |
| Public Journey name only | Hidden | Hidden on map (still eligible in Journey banners) |
| Boundary shared only | Visible if local Layers filter includes its geographic tier | Hidden |
| Boundary shared + public Journey name | Visible if included by filter | Visible only if **Show Region names** is on |
| Native Region hidden, unlinked, unclassified, or malformed flag | Hidden | Hidden |

- GM changes sharing from Atlas Workspace → Territories → eye/eye-slash button. Each explicit confirmation writes **only** `Region.flags["fvtt-atlas-navigation"].playerTerritory = {schemaVersion:1,visible:true}` (or unsets the flag on revoke), with GM, Scene and Region edit checks and snapshot comparison.
- A client-side read never upgrades, normalizes or overwrites a saved flag. Unknown versions fail closed.
- Players receive Atlas Layers under a dedicated Scene Control, with client-local **Regions** filters (Hidden, Continents, Settlements, All Regions), **Show Region names**, and separate continent/settlement fill sliders. Players do not receive GM Road/Corridor view-mode controls or editing tools.
- Region polygons and triangulation are consumed directly from native v14 Region objects. No copied geometry and no authoring payload travels through Atlas settings.
- Player projections contain only shared Region IDs, geographic tier and optional **published public label**—not private native names, Road membership overrides, or Behavior data.
- Linked Checkpoint label deduplication is display-only and occurs only when an eligible published Territory label is actually drawn. The Checkpoint's persisted label preference is unchanged.
- Territory label doubleclick remains subject to current Region/Checkpoint association, explicit Checkpoint player visibility and native Journal Observer permission.

**Security and fog boundary:** Sharing a native Region outline intentionally reveals its **whole geographic boundary** on the player's map, including portions outside explored fog. Sharing a public Journey name never implicitly grants that boundary. This is a visual presentation grant, not data-level secrecy: authorized Scene clients may already receive native Region/flag data from Foundry. Do not encode unpublished campaign secrets in client-readable Region flags; a secure redacted transport/discovery-by-cell design is out of scope for this slice.

## Live Foundry v14 acceptance (two clients required)

1. Back up the World and install the beta.8.25 branch in a Foundry v14 World. Open Paedor as GM and player simultaneously. Confirm player has the new Atlas Layers Scene Control and no Atlas Workspace/authoring actions.
2. Choose a normal, linked, classified City (e.g. Dirwest). Leave its public Journey name **off**. In Territories, click its eye icon and approve **Share Boundary**. In the player palette choose **Settlements**, then **Show Region names**. Expect the exact native boundary and selected fill, **without** its native/private name.
3. Publish the City public Journey name separately using the existing tag control. Player map should show **only the approved public label** with names enabled; disabling names hides it but preserves the outline. The player's local fill sliders and tier filter must not change the GM's display.
4. Link the City to a Checkpoint that is already explicitly visible to players and uses **Always** label mode. With the shared public Territory name visible, the Checkpoint's duplicate label should appear **on hover only**; with the player name toggle off, its original Always label should reappear. Verify the GM's independent preferences are unaffected.
5. If that Checkpoint has a Journal, doubleclick the Region label with an Observer-authorized player and then an unauthorized player. Only the authorized player should open it. A hidden or unshared Checkpoint must not become a Journal shortcut.
6. For a second Territory, publish a Journey name **without sharing its boundary**. Check no outline appears for the player—even in All Regions—and the public name can still be used in Journey narration.
7. Revoke the shared boundary for the first City; player outline and name should disappear upon native Region update while Journey-name flag stays intact. Share once more, then set native Region **Hidden**: player display must fail closed. Restore native visibility for continued tests.
8. Test invalid/newer sharing metadata read-only (in a backed-up test World), newly created unshared Regions, switching Scenes, refreshing the browser, zoom/pan/resize, and enabling/disabling the Atlas Layers palette. No native Region geometry, Behavior, color, Region ID, Fog state, or Scene Atlas graph should change from local display toggles.
9. Check the player canvas while native Fog or Atlas manual Fog is enabled. A **shared outline** is allowed over unexplored areas by this explicit GM design; the underlying map image must not be uncovered merely by toggling Atlas Layers.

## Automated evidence

- `npm test` — 915/915 passed locally.
- Native Region-sharing projection, stale/invalid flags and GM-only write guards are covered in `tests/player-territory-sharing.test.mjs`.
- Player Atlas Layers controls and GM Road-mode isolation are covered in `tests/atlas-layers.test.mjs`.
- Player overlay grants, private-name suppression and sharing revocation are covered in `tests/territory-view-overlay.test.mjs`.

This repository does not include a running Foundry v14 World, so the two-client test matrix remains an explicit release gate. UI polishing of the Checkpoint Settings → Terrain Region tab and coordinated multi-Territory polygon editing are deferred.
