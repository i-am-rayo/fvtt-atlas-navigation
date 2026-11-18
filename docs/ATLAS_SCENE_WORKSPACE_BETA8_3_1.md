# Atlas Scene Workspace v0.3.9-beta.8.3.1 — Territory usability hotfix

## Owner live test

Owner confirmed beta.8.3's Scene Overview and Territories work in Foundry v14.
Screenshots exposed a tall stack of Territory buttons, uneven glyph size, a
blank Public Territory editor despite an existing published label, and a
duplicated workspace entry point inside Scene Configuration → Atlas.

## Changes

- The GM **Atlas canvas sidebar** remains the Workspace launcher; its icon is
  now a **gear**. Remove the redundant launcher inside Scene Configuration →
  Atlas. The existing Scene Atlas tab and authoring controls remain in place
  until separately tested migration phases; this change does *not* remove the
  Scene Atlas tab itself.
- Each Territory is a compact row with its Region name and public status,
  followed by a horizontal row of four consistent Font Awesome buttons:
  native Region settings, smooth boundary preview, Atlas link/unlink, and
  public Journey label. The buttons retain their exact action handlers and
  descriptive accessibility labels.
- Public-name dialog now uses the shared Foundry-compatible settings input
  primitive, setting both live values and serializable defaults. Existing
  published labels and checked states survive DialogV2's content recreation.
- On a Region without a public label, **suggest the native Region name in the
  text field**, while leaving the publication checkbox OFF. This removes
  repetitive retyping without silently exposing GM-only Region names.
- When a published label equals the Region name, the list shows `Public ✓`
  instead of repeating the identical name. A different public alias remains
  visible as `Public: <alias>`.

## Authority / data ownership

The public label is still a separately validated player-safe native Region
Atlas flag, with explicit GM approval and stale checks. Native Region name is
*never* automatically broadcast, and native Shapes, Levels, elevation,
Behaviors, IDs, visibility, and Scene Atlas graph flags are unchanged. The
native Region name and public label can coincide but must not become the same
unrestricted data field: an unpublished/private native Region name is not
permission to narrate it to players.

## Regression and live acceptance checklist

1. Open Atlas canvas sidebar; confirm the Workspace launcher uses a **gear**.
   In Scene Settings → Atlas, confirm no duplicate Workspace button, but all
   existing road/checkpoint/surface/fog controls still work.
2. Open Workspace → Territories. Check each native Region occupies one compact
   row with four evenly sized horizontal buttons below its information.
3. Open a Region **already published as Dirwest**. Verify both its existing
   public name and checked publication box are displayed, edit just the name,
   and save. Reopen to confirm the new value.
4. Open a Region **never published**. Verify its native Region name is suggested
   in the field but publication remains unchecked. Cancel without writing.
5. Confirm changing the native Region name alone does **not** silently publish
   or overwrite any existing public label.
6. Confirm Journey banners continue to use the explicitly published alias,
   and non-GM users cannot access the Workspace or unpublished Region names.
7. Confirm smoothing preview/Cancel, existing Region Behaviors, road/region
   separation and navigation World time/Journal behavior remain unchanged.

## Deferred

Next independent milestone: migrate Roads and topology, then Checkpoints,
Surfaces, and Exploration into focused Workspace sections. Only after these
paths are live-accepted should Scene Configuration → Atlas be retired.
Geographic semantic tiers/overlap precedence, shared borders, seam snapping,
and 20 km coast/ocean generation stay separately deferred.
