# Atlas v0.3.9-beta.8.62 — GM Road/Territory hover acceptance

**Status:** Draft Sandbox build, NOT a release. The Product Owner approved PR #376 annotation 23's recommended C variant: opt-in, GM-only, point-local Territory below the Road name on hover; ambiguous overlaps yield no subtitle. The previous beta.8.60 build was owner-tested; beta.8.61 is included in the stack but has not been reported owner-accepted.

## Implemented, authoritatively separate from native geography

- **Atlas Layers > Roads** adds **Show Territory under hovered Road name (GM only)**, **Off by default**. It is a **client-local** v2 Atlas Layers preference. Existing version 1 preferences are interpreted safely in memory with this option Off; simply reading old settings never writes or migrates them.
- A GM hovering a Road (when Road name mode is Hover or Always) sees a smaller Territory subtitle from a **native Atlas-linked, geographically classified Region** containing the Road's current **canvas Road-label point**. Native Region `polygonTree.testPoint` owns 2D containment; no inferred Road membership, sample ordering, native priority, or cached directory results decide the label.
- With nested validated **explicit parent IDs**, the deepest matching descendant wins. Unrelated/sibling overlaps (even if the names are identical), orphaned/invalid metadata, absent native geometry or unsupported Scene/read context render **no subtitle**. A defensive maximum of 256 classified Regions per hover avoids expensive unbounded scanning. If a large Scene hits that limit, the label is omitted rather than guessed.
- Existing Road *surface/preset* hover subtitle remains an independent line. The Territory subtitle is shifted to avoid the Road line and suppressed near Map Marker banners. It appears only on **hover**, even with Road names set to Always, and not when Road names are Off.
- **Absolutely GM-only:** the read adapter rejects non-GMs before native Region metadata access; the player renderer never calls it; the Atlas Layers toggle is absent for non-GMs; and **Player Territory Preview** disables it, regardless of the GM client setting.
- No new Scene Road or Region flag, no native Geometry/Behaviors/elevation changes, no Journal/Token/Actor/Journey/time action, no migration and no World preset changes. This is a read-only canvas view.

## Foundry v14 GM live acceptance

1. Install and verify module version **0.3.9-beta.8.62** on a backed-up Sandbox World. Verify the already tested beta.8.60 Road Settings, Map Directory, Atlas Layers, World Map Marker Presets, and permissions still open without exceptions.
2. In **Atlas Layers > Roads**, verify the new toggle is **Off** by default. With it Off, Road hover labels behave exactly as before. Enable the toggle, close/reopen Atlas Layers, reload Foundry and confirm the client choice is retained. Existing Scene/World Road settings and native Region flags must remain unchanged.
3. Use a Road crossing an authored continent Region and a nested village/city Region with an **explicit classified parent relationship**. Hover the Road on its continent-only portion and inside the child: the subtitle should change from the continent to the child, using **the actual cursor/label anchor** on the Road. Do not infer the parent from mere visual nesting or a display-only directory grouping.
4. Add or locate **unrelated overlapping** native classified Regions over the same Road point. Subtitle should **disappear**, including if both Regions have the same name. Confirm overlapping Regions' native priority, geometry and movement Behaviors are unchanged.
5. Verify **one** classified native Region with no parent can show its GM native name, including a GM-hidden Region; ordinary player World users must never see that name through this feature. If any malformed/unlinked/missing Region or native polygon geometry prevents a trustworthy answer, the subtitle must be absent and the Road itself must still render.
6. With the Road's name mode **Hover**, see the subtitle only while hovering. With **Always**, confirm Territory still appears **only while hovering** and is anchored to the *visible Road name*, not a remote checkpoint. With **Off**, confirm no Road name/subtitle. Test Zoom/Pan, Scene padding changes, long/multi-leg Roads, mouse leave and canvas rebuild.
7. At a point with a Road terrain/surface subtitle, verify that subtitle remains a separate smaller line. Near a Map Marker label/banner, the Territory subtitle should suppress rather than overlap it. No rendered text may shift the stored Road or Map Marker positions.
8. Toggle **Player Territory Preview** while the GM setting remains On: no GM-native Road Territory subtitle should appear. Leave preview: GM hover behavior should restore. As a **non-GM client**, the toggle must not appear, no hidden Territory/Region/Journal names may be exposed, and existing Fog and player Road/discovery visibility must remain unchanged.
9. Save/Cancel a Road Settings draft, then change a native Region's geometry/name/classification deliberately on disposable Sandbox data. After the appropriate canvas refresh/hook, the read-only hover subtitle should follow current native data without changing any Atlas Road graph revision, Region Behaviors, Token positions, Actor resources, Journey Journal or World time.
10. Finish the **beta.8.61** pending GM/non-GM acceptance items from `docs/UI_STANDARDIZATION_BETA8_61_TEST.md` (contextual Directory Plus, editor gestures, Undo/Redo, and closed Workspace restoration). These were automated-tested but not reported owner-live-accepted before this build.

**Stop and report** if a Road/Region becomes modified on hover, a hidden GM-native name appears for a player, Save/Cancel/stale edits regress, the Road overlay fails to render, or runtime cost spikes on a large Scene. Provide Foundry v14 build, module version, Scene/Region/point setup, a screenshot and the first red console exception with full stack.

## Known bounds / follow-ons

- This is **GM-only client presentation**, not a player-public label setting. Reusing a public Territory flag or implementing publication of derived Road text would require a separately authorized security review.
- Only **explicit validated parent IDs** resolve an overlap as nested. Apparent geometric containment without an explicit parent can be ambiguous, intentionally producing no label.
- Native Region `polygonTree.testPoint` is required. Without trustworthy native 2D geometry, no fallback heuristic is used.
- The label is intentionally suppressed for more than 256 classified Regions per Scene while hovered. Profile before introducing a spatial index; never degrade to first-match guessing.

## Install / rollback

Manifest:
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.62-road-territory-hover/module.json

Archive:
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.62-road-territory-hover.zip

Prior owner-accepted baseline (beta.8.60):
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.60-pr376-ui-audit/module.json

All implementation/test PRs remain draft and unmerged. No release, merge or migration is authorized by producing this test build.
