# v0.3.9-beta.8.27 — Checkpoint ↔ Territory selectors

Status: stacked draft, subject to owner Foundry v14 GM/player testing. Tracks #288.

## Behavior

- **Checkpoint Settings → Terrain Region → Link geographic Territory** lists every Atlas-linked, manually authored native Territory of the same geographic kind as the current Checkpoint type (City/City, Town/Town, Village/Village, Settlement/Settlement).
- **Atlas Workspace → Territories → Link Checkpoint** provides the inverse type-specific list, using the same availability policy.
- Both selectors display a current link, unclaimed compatible locations, and unavailable ones. If a location is already linked to something else, its option is visible and disabled with an owner name. If this Checkpoint/Territory already has a link, all alternatives are visible but disabled until the GM explicitly unlinks.
- An exact normalized name match is suggested first. A complete leading name with a descriptive suffix, in either direction, is also suggested at lower priority: **Ježibaba** ↔ **Ježibaba - Abandoned Town**. We do not match partial words such as Port ↔ Portage, embedded substrings such as Dirwest ↔ Old Dirwest, or one-letter prefixes. Multiple equal-ranked suggestions leave the selector unselected.
- Suggestions only prioritize the initial selection; **Review Association** and a separate **Confirm** action remain required. Nothing links automatically. The unchanged native Region's versioned Atlas association flag is the only saved data.
- New links are checked again at the GM save boundary against current Checkpoint type and native Territory classification, and are rejected if stale or incompatible. Existing links with a now-mismatched type remain visible for explicit unlink, without migration.

## GM test checklist

1. Open a **Town** Checkpoint named **Ježibaba - Abandoned Town** and a **Town** Territory named **Ježibaba**. In Checkpoint Settings → Terrain Region, verify the Territory appears as a **similar starting name** suggestion and can be reviewed/confirmed.
2. Add another Town Territory with exactly the Checkpoint name. It should sort ahead of the prefix suggestion. City/Village/Settlement Territories should not appear in that Town list.
3. Add a second Town Territory with a similarly matching prefix; if no exact match exists, neither prefix candidate should be preselected. The GM may still explicitly select one.
4. Link a different Checkpoint to another Town Territory. Reopen the first Checkpoint's selector: the already-claimed Territory must still be listed, disabled and clearly identified with its owner.
5. Create a link, reopen the selector, and confirm that other compatible Territories stay visible but cannot be chosen before using **No linked Territory** to explicitly unlink. Then reopen and reassociate. Repeat from the Territory → Checkpoint direction.
6. Verify existing mismatched historical associations remain displayed to allow unlinking. Newly attempting a mismatched link through stale/forged data must fail with no native Region write.
7. Verify native Region Shapes, Behaviors, Colors, Levels, names, linked Journals, and Scene Atlas Checkpoint positions remain unchanged. Only the explicit association flag should change.

## Player safety

- This is a GM-only editor. Player Atlas Layers permission, Territory sharing, native fog and Atlas manual fog occlusion are unchanged. A link does not publish a Territory name or Journal.
- With a player client, verify the link still follows existing public visibility and native Journal ownership checks; no duplicate Region or Checkpoint label should appear when the existing unified-name rule applies.

## Deferred

- Automatic creation of a new native Region when placing a matching City/Town/Village/Settlement Checkpoint.
- Consolidated Terrain Region settings window and linked font/icon customization (separate UI issues).

Automated coverage includes both selector directions, Unicode and prefix matching, ambiguous/missing/claimed choices, disabled options serialized by DialogV2, and the GM save-time type guard. Live Foundry v14 testing remains required before merge.
