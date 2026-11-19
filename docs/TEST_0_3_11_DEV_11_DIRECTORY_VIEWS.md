# Atlas 0.3.11-dev.11 — Map Directory view correction

**Milestone 01:** [Owner issue #439](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/439), superseding only the duplicate navigation introduced by #418. Foundry **v14 GM/non-GM acceptance required**. This is a cumulative development build, **not** a public release.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-directory-contextual-indicators/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-directory-contextual-indicators.zip

**Cumulative base:** dev.10 / draft PR #438, including dev.9 #418 and owner-accepted dev.1–dev.8. This patch is restricted to the directory presentation and contextual access. Source PRs remain draft; integration PR #436 was closed unmerged because an unreleased dev manifest may not target main.

## Behavior / exact source ownership

- Only the original **View: By Territory, All Roads, All Map Markers** navigation remains. The added **Tools** selector is removed. Existing GM-only authoring and recovery services are not deleted or re-implemented.
- **By Territory** items show a swatch from native `RegionDocument.color` through the existing `nativeRegionColorHex` adapter. Invalid native colors remain unfilled instead of becoming a fabricated swatch. Only the existing public/permissioned Atlas read model is used.
- **All Roads** show the effective Road appearance color using the same `resolveRoadAppearance` World/Scene rules as canvas, plus **Map Markers (N)** next to the Road name. N is derived only from authored `roadId`/incident graph association (not heuristic geographic proximity). No disclosure when N=0.
- **All Map Markers** show the selected appearance: color dot, locally bundled SVG/Font Awesome glyph or GM-authored validated local image. The name row shows **Transportation (N): [method names]** from actual validated Scene checkpoint offers and the World transportation catalog (unknown method IDs shown verbatim instead of invented names). Expanding a marker with offers lists names/modes. No chevron when N=0; it displays **No transportation**.
- This also applies to corresponding nested Road/Marker records in **By Territory**. Section/parent groups remain expandable when they have real children, without extraneous empty "Map Markers" subgroups.
- **Exceptional GM-only functionality** stays contextual: **Start/Review/Discard Batch Edit**, **Resume / Roll Back Transfer** (only with valid interrupted native ledger), and **Analyze Borders** are available in By Territory; schema v1/v2 **Anchor/Organize legacy Roads** only when applicable in All Roads. Marker terminal Road-link reviews reuse the established action. The previous native manager services remain as implementation compatibility paths, but have no duplicate user-facing navigation.
- Opening, filtering, expanding, or previewing never writes Scene Atlas, native Regions, player visibility, fog, Journey, Token, Actor, Journal or World settings.

## Owner Foundry v14 acceptance — backed-up World

1. Open Atlas Workshop → Map Directory. Confirm **Create** and only **View: By Territory / All Roads / All Map Markers**; there is **no Tools group or Advanced Map Operations** in normal UI. Settings retains the World preset and Surface/Topology functions.
2. **By Territory:** confirm each authored geographic Territory dot matches its native Foundry Region color. Check several continents, towns and custom Regions; use a Region with invalid/unset native color if available and ensure the UI does not invent a color. Native Linked/Sharing/Locate/Settings/Edit work. Blank leaf Territory has no disclosure.
3. **All Roads:** verify color dot matches the rendered Road line's configured color/World fallback. Road name shows exact **Map Markers (N)** count for directly linked and incident-node markers, including independent Map Markers with more than one Road. For a Road with zero Map Markers, there must be no > arrow. For a populated Road, expand once to see its actual attached Map Marker rows, without a second empty nested subsection.
4. **All Map Markers:** choose a Dot marker, classic Atlas SVG, Font Awesome Free icon, and valid custom image. Confirm the correct appearance appears **before** each name with authored color, without loading an external path. A marker with configured transport offers shows their real method names beside the name; expanding shows their Land/Water/Sea/Air modes. A marker with no offers says **No transportation** and has no arrow.
5. Change Map Marker transportation from its existing Settings. Reopen the directory and verify the read-only method display updates; no inferred World travel services appear unless the marker actually has those saved offers. Verify missing/deleted World method ID is shown, not silently substituted.
6. Search, filter and sort in each view, change Scenes, expand/collapse several entries, resize window, navigate by keyboard and at 200% zoom. Actual expandable records use native HTML details, have a working keyboard summary, and persist disclosure state on refresh. Static records are plain rows with no fake chevron/tab target; action buttons remain at the far right.
7. **Safety-critical exception:** In By Territory, confirm **Start Batch Edit** still enters the original guarded workflow. With a pre-existing **valid interrupted native Territory transfer** in a disposable World, verify the **Resume / Roll Back Transfer** action is available without using the old Tools screen; do not start recovery in a production World. Confirm **Analyze Borders** remains permission-checked. In a migrated v1/v2 test Scene, All Roads exposes applicable Anchor/Organize conversion without running it on view.
8. Confirm Map Marker connections on eligible isolated/terminal nodes remain GM-only, require their original review, and make no writes until approved.
9. Non-GM must not open the GM-only Workspace or see hidden map metadata via these controls. Canvas refresh, recovery ledger state, native Region Shapes/Behaviors, fog, Token position, Journey Journal and World time remain unchanged.

## Automated gates
The Workspace DOM regression checks removal of the Tools navigation, inline color icons, Road attached count, actual transportation names, and no empty disclosure. Original native Region batch/recovery and player overlay suites remain required. Run `npm run check`, `npm run architecture:check`, syntax and `git diff --check`. Green CI is **not** user-live Foundry acceptance.

**Stop** if a recovery or legacy graph action becomes inaccessible, a hidden/GM record is revealed to players, a marker shows a fabricated service, an icon path is unsafe, or any directory interaction writes persistent state.
