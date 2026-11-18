# v0.2.25.4.5 — Direct Foundry Primary Graphics fog hotfix

Owner verified in v0.2.25.4.4 that a non-GM client with native Token Vision OFF, Atlas Map Fog ON and Party Exploration ON sees the entire map; the last Scene test confirmed no configuration issue. Unlike Hexplorer's direct Graphics attachment, v0.2.25.4.4 nested Atlas's fog Graphics inside a plain PIXI.Container. That parent does not expose the expected primary-scene sort geometry.

This focused hotfix mounts **the fog PIXI.Graphics itself** as a direct child of `canvas.primary` with Foundry v14's documented `PrimaryCanvasGroup.SORT_LAYERS.TILES + 1` (501), elevation 0 and final sort. A missing sort-layer API is an explicit error, never a silent fallback. Atlas road/checkpoint markers remain in `canvas.interface`, ahead of fog. The existing direct geometry cut, reversible saved travel reveals, checkpoint knowledge and other Scene flags are unchanged.

Manual acceptance: with Vision 5e disabled, Scene Token Vision OFF, Atlas Map Fog ON, Party Exploration ON, verify unrevealed terrain is opaque with revealed discs and weather in reveals. Compare GM/player client. No claim of live v14 proof until owner confirms.

# v0.2.25.4.4 — Native-layer fog diagnostic and Atlas history controls

- Following the owner-provided Hexplorer architecture reference (not bundled or depended upon), Atlas fog now draws in Foundry v14's **primary Scene group**, above tiles and below weather/lighting effects. The roads/checkpoint UI remains in the interface group. Foundry FogExploration, Token Vision and Scene Grid records remain unchanged.
- The Scene Atlas map-fog panel reports current survey grid-cell radius and every stored travel reveal's radius. It allows confirmed removal of the ten most recent individual travel circles or confirmed clearing of **only Atlas travel records**. History saves require current GM authority, Scene permission and exact prior-version match; native fog and checkpoint knowledge remain intact.
- An enabled Atlas map fog Scene may still expose terrain through knowledge-checkpoint discs (their radius is independent of party survey radius). A currently assigned token adds a *temporary* current-radius disc even when saved history is cleared.
- Test v14 on separate GM/player clients with weather enabled. Compare before/after deleting one large saved travel record, moving the token, and switching scenes. Do not merge until visually validated.

# v0.2.25.4.3 — Reversible Atlas Map Fog: Live Foundry v14 Review

This is an **experimental, separately opt-in Scene mode**. Its purpose is to stop
duplicating the Scene background above rain and lighting. The initial GM and
player clients must verify Pixi v8 inverse masking in actual Foundry v14.

## How this differs from v0.2.25.4.1

- **Native mode (default):** Native Token Vision and native saved FogExploration
  continue unchanged. Atlas no longer draws a copy of the Scene background for
  lore-revealed checkpoints; the marker can remain known while the terrain is dark.
- **Atlas Map Fog mode (opt-in):** Atlas draws an opaque inverse-mask above the
  **normally rendered Foundry scene**, revealing circles for lore/visited checkpoints,
  the currently selected party token, and its recorded travel history. The original
  scene is never copied or replaced; rain and lighting should therefore remain
  part of the single native scene rendering inside reveal circles.
- Atlas Map Fog stores a separate **Scene flag**,
  `flags.fvtt-atlas-navigation.mapFog` v1:
  `{schemaVersion:1,enabled:boolean,trail:[{x,y,radiusCells}]}`.
  Travel coordinates are image-local pixels, measured against the current
  Scene native Grid. **No** native `FogExploration` writes, resets, token clones,
  scene Token Vision changes, Region edits, or migration-on-read.
- The existing separately versioned `partyExploration` v2 flag and authored
  checkpoint override radii are retained as-is. Switching modes never discards
  its trail automatically. The trail is capped at 2,048 points and refuses
  additional points rather than silently truncating previously explored ground.
- The overlay is **visual presentation**, not secret storage or access control.
  Players may be able to inspect Scene flags or native data in browser tools.

## GM setup on a **backed-up test world**

1. Confirm your current world and existing native FogExploration history is backed up.
2. Activate the test branch and load the atlas Scene.
3. In **Scene Configuration → Atlas → Party Exploration**, check **Enable Party
   Exploration**, manually select an existing placed party token, choose a
   **Survey Radius** in the Scene Grid's distance units, and save.
   Keep the radius at or below 100 native grid cells for this test.
4. In the new **Atlas — Reversible Map Fog (experimental)** section, check
   **Use Atlas Map Fog for this Scene**, then **Save Map Fog Mode**.
   Atlas records the *current* location of the chosen token as its initial reveal.
5. **Only after Atlas Map Fog is saved**, turn **Token Vision OFF** in native
   Scene Configuration. Atlas deliberately does **not** change this for you.
   Leave other ambient lighting and weather settings as desired. As with
   Hexplorer, this mode is an explicit alternative to native Token Vision;
   it does not combine native token darkness rules with a manual exploration mask.
6. Reload both a GM and a non-GM player view.

## Required GM/player checks

- [ ] With no lore markers, the player sees only the survey circle around the
  placed party token, not the entire map. GM still sees the whole map.
- [ ] GM Shift-click **Orc Bridge**, set **Known through Lore** and a visible
  reveal radius. Player sees the original Scene in that circle—not a brighter
  duplicate image—and can see the same rain and ambient lighting effects.
- [ ] Change Orc Bridge to **Undiscovered**: its Atlas reveal circle closes
  (unless already included in some other Atlas travel/checkpoint circle).
  **Foundry's stored exploration history must not change.**
- [ ] Move the explicitly chosen party token. Its newly traversed region reveals,
  previous positions stay explored across refresh, scene switch, and reload.
  Moving a different token does not add any exploration history.
- [ ] Previously hidden road portions remain hidden behind the Atlas mask;
  road names only show when their displayed segment is revealed.
- [ ] Known checkpoint marker with radius **0** appears without opening terrain.
- [ ] Checkpoint overlays, labels, and roads remain visible even if the optional
  mask API errors; a failed mask must remain dark instead of revealing the map.
- [ ] From GM client, re-enable **native Token Vision** first, then disable
  Atlas Map Fog. The old native fog exploration history is still present.
- [ ] Test with Vision 5e active, day and night, the same rain/weather effect
  previously affected by the background-copy workaround, and one non-GM browser.

## Known constraints

- When Token Vision remains on in Atlas Map Fog mode, native visibility can
  still obscure the circles. This is an explicitly separate manual fog mode.
- The weather/lighting effect ordering requires **live v14 confirmation**.
  Automated pure tests cannot prove WebGL layering behavior.
- The travel mask uses circular samples and image-local persisted trail points.
  It does not record exact movement paths or visibility occlusion by terrain.
- Existing native FogExploration is **preserved but not imported** into Atlas
  mode. Re-enabling native Token Vision restores its normal rendering.
- There are no GM brush tools yet. Manual paint/erase is deferred to
  v0.2.25.5 after this renderer passes the live weather test.
- This PR must stay **draft and unmerged** until owner acceptance.
