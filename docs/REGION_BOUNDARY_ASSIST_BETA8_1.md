# v0.3.9-beta.8.1 — Native Region boundary assistance (draft)

**Status:** GM/non-GM Foundry v14 live acceptance pending. Stacked on the owner's beta.8 Region narration test. This is the first narrow Region-authoring slice, **not** the proposed shared-edge topology editor or geographic hierarchy resolver.

## Implemented

- **Scene Configuration → Atlas → Native Regions · Atlas boundary tools** lists up to 60 native Regions regardless of Road association, with linked/generated/hidden/public-label status. Each row offers the native Foundry Region editor, explicit Atlas link/unlink, and direct public-label editing. Read operations never write data.
- For a **single manually drawn polygon** without holes or grid-based points, the GM can choose **Smooth native polygon boundary**, Gentle or Moderate, and compare the original orange and proposed green outline on the canvas before confirming. The pure geometry algorithm rounds corners with bounded vertex counts and rejects invalid/self-crossing shapes.
- One native `RegionDocument.update({shapes})` happens only after explicit GM confirmation, same-Scene preview and edit permissions, and an exact stale-geometry check. Native Region ID, flags, Behaviors, name, color, Levels, elevation, visibility, and Road topology are not changed.
- Atlas-generated road corridor Regions retain their separate geometry integrity signatures and their existing Regenerate action. This editor refuses them, and refuses multi-shape Regions and native holes, rather than modifying unsupported geometry.

## Limitations

- Smoothing **one** Region changes its border and **can create gaps or overlaps with adjacent Regions**. The confirmation warns against smoothing shared seams independently. This slice does not snap to neighbors or repair seams.
- Beta.8 behavior for overlapping published Regions is unchanged: destination names remain generic when two eligible public Regions contain Point B. Semantic hierarchy (checkpoint > settlement > province/kingdom > continent) is deferred and will use Atlas metadata, not native Foundry Scene Levels or elevation.
- No native Region Behaviors, travel costs, journey authority, or time accounting have been modified.

## Foundry v14 GM and player checklist

1. **Manager:** On a World Scene with manual Dirwest/Millstone Regions plus a generated road corridor, open Scene Atlas. Confirm all show even without a Road selected. Native gear opens the original Region document; public-name shortcut edits the correct Region; link/unlink changes only Atlas association.
2. **Preview/Cancel:** On a backed-up **isolated** single polygon, click ∿, choose Gentle, see orange original/green proposed boundary, then Cancel. Confirm there was no native geometry write.
3. **Preview/Save:** Repeat with Moderate and Save. Verify the rounded native polygon kept its Region ID, Behaviors, color, elevation/Levels, visibility, public label, and Atlas link. Validate native movement and weather effects still apply.
4. **Rejections:** Atlas-generated road corridors must not use manual smoothing. Multi-shape/hole Regions must reject cleanly. A second GM editing the same Region while the confirmation is open must cause stale-save refusal. Non-GM must not see authoring actions.
5. **Existing Journeys:** Test beta.8's successful single public Region banner and deliberate generic fallback for overlapping published Regions. Check Journal/World time/Token movement, fog and roads, canvas redraw, Scene switching, and no leaked preview overlays.

## Next independent phases

1. **Paired shared-edge tools:** snapping, deterministic identical native vertices, gap/overlap detection, explicit multi-Region preview and stale guards, with partial-failure recovery. Never edit a neighboring Region silently.
2. **Geographic naming hierarchy:** versioned Atlas semantic tiers and priority, intentional parent/child overlap, same-tier ambiguity resolution, strict player-public labels, checkpoint precedence, and spatial checkpoint membership.
3. **Full territory editor:** new territory drawing, direct point manipulation, holes and multiple shapes, undo, explicit regeneration/revert strategies, and safe Scene import/export.

No merge or final release before the Product Owner's actual Foundry v14 acceptance.
