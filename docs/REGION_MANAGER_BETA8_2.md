# v0.3.9-beta.8.2 — Geographic Region management cleanup (draft)

**Status:** Local draft pending Product Owner authorization to publish; GM/non-GM Foundry v14 live acceptance required. Stacks on beta.8.1 without changing Journey/Region persistence schemas.

## Owner live-test result and diagnosis

- Beta.8.1 native Region smoothing, Atlas links, and public Journey banners worked in the owner's live test. The logs record three successful smooth Region saves, followed by `Smoothing supports polygons with 3–64 distinct border vertices.`
- This was Atlas's explicit input-vertex safety cap, not a crash. Smoothing increases vertex count on each save, so repeated passes cannot continue indefinitely without risking excessive geometry and shrinking territory boundaries. Third-party Foundry console warnings did not implicate this code path.

## Focused beta.8.2 changes

- **Scene Settings → Atlas → Territories & custom native Regions** now lists only native Regions **without** Atlas road-generation metadata. Atlas-generated corridor/checkpoint Regions continue to be managed within their Road's existing Terrain Region controls. This distinction is based on validated native Region provenance, never a name prefix or geometry guess.
- The duplicate **Public territory names · Journey banners** fieldset is removed. Each manual/native Region's tag button directly edits the versioned, explicit, public-safe label on that Region. A tag button is also added to the generated Road Region controls to preserve naming access to every native Region type. The existing label flag/schema and native geometry stay unchanged.
- The bounded smoothing model accepts up to **128 source vertices**, still limiting proposals to **256 output vertices**. Gentle may be used again where this limit allows. Moderate and additional repeated saves fail with actionable reasons once they would exceed the limit. It remains safer to edit the original native polygon before trying significantly stronger rounding, because repeated saves can shrink the boundary and alter shared seams.
- No manual Region is automatically turned into a geographic territory, no generated provenance flags are migrated, no native Behaviors/Levels are altered, and no label is automatically published.

## Proposed architecture: standalone Atlas Scene Workspace (not implemented)

The current Scene Configuration rectangle is not a sustainable editor for Road, Checkpoint, Region, Fog, and Navigation features. Recommend a **GM-only, Scene-scoped ApplicationV2 Atlas Workspace** launched from the existing Scene Atlas tab, retaining the latter as a lightweight launcher and native Scene/Grid status view. This is an authoring application, **not a World-settings menu**, because its working context and data authority remain the selected Scene.

Proposed independently scoped workspaces: Roads & topology; Checkpoints & visibility; Territories & native Regions; Terrain/Surfaces; Fog/Exploration; and Navigation/Journal links. Reuse shared settings controls and existing focused editors; preserve modeless drafts, native focus, per-Scene identity, GM permissions, preview/Save/Cancel/Undo, and lifecycle cleanup. Move views incrementally without any automatic migration of Scene flags or native Region geometry. This migration needs its own architectural assessment, design approval, and live tests.

## Owner Foundry v14 GM/non-GM checklist

1. Confirm Dirwest/Millstone appear in **Territories & custom native Regions**, with unchanged Atlas links and public-safe names. Road-generated corridors should be absent from that list and remain available in the respective Road Terrain Region settings.
2. Confirm no duplicate **Public territory names · Journey banners** fieldset appears. Tag buttons for manual and Road-generated Regions must still open the correct Region's public-label dialog, and disabled/hidden labels must stay private.
3. On an **isolated** polygon already smoothed in beta.8.1, retry Gentle. It should be permitted only if the proposed result fits the 256-vertex ceiling; test exceeding the ceiling and verify an actionable error with no native Region write. Do not smooth a shared seam independently.
4. Recheck native Region ID, shape, Behavior, Levels, elevation, color, Atlas links, and original Point B destination name priority. Overlap without approved semantic hierarchy must still use generic wording.
5. Test canvas redraw/Scene switch and both GM and non-GM clients. No authoring surface should be available to non-GMs; no Journey, World-time, Actor, Token or Journal state should change from the UI cleanup.

**Deferred:** Dedicated Atlas Scene Workspace, territory semantic tier/priority, shared-edge snapping, seam repair, coast/ocean generation, and arbitrary multipart/holed Region editing.
