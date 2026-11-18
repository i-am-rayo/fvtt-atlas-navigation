# v0.3.9-beta.8.33.2 — Deterministic GM Atlas canvas order

**Status:** stacked draft on beta.8.33.1 (#309), owner Foundry v14 testing pending.

## Why

The GM Territory renderer and Road/Checkpoint renderer were independently
appending direct children to Foundry's interface canvas group. A Road refresh
could draw above Territory names, and a Territory refresh could draw above
Checkpoint hover details. The beta.8.33.1 hover-only correction did not control
the order of non-hover Territory names and Road graphics.

## Presentation-only architecture

All GM Atlas renderers now share one disposable, untransformed PIXI Container in
`canvas.interface`, with five fixed slots, bottom to top:

1. **Terrain** — Atlas-native Region fills and outlines.
2. **Roads** — Road and Checkpoint graphics and markers.
3. **Territory names** — geographic labels and their GM Journal status.
4. **Road labels** — non-hover Road and Checkpoint text.
5. **Hover** — active Road, Checkpoint and cluster information.

Each renderer owns and removes its own children; the shared root is released
only when both have unmounted. Terrain/Road renderer refresh order no longer
controls visual stacking. No global Foundry canvas sorting, native Region
geometry or PIXI prototype changes.

The **player** Territory renderer deliberately remains in
`canvas.primary` under native and Atlas Fog. Player Road/Checkpoint renderer
and all their existing discovery/permissions filtering are unchanged.
No persisted data, schemas, Regions, Behaviors, Fog, Journals, Tokens, Actors,
journeys or Scene/World flags are written.

## GM/player live verification — Foundry v14

1. With **All Regions** and labels enabled, find a Territory whose name
   crosses a visible Road. The Road stroke must pass **behind** the name.
2. Switch Atlas Layers **Hidden → All Regions** and redraw or pan the map.
   Region fill/border must remain below Road graphics, while Territory name
   stays above the Road regardless of which subsystem updated last.
3. Hover a nearby Checkpoint and Road. Hover details must render above
   Territory outlines, Territory names, and static labels, at several zoom
   levels. Check Checkpoint icon clusters too.
4. Toggle static Checkpoint labels **Off/Hover/Always**, and Journal permissions;
   no stale duplicates, cut-off text or lost Journal status suffixes.
5. Switch Scenes, reload the canvas and disable Atlas layers. Verify no
   orphan labels, outline remnants or flicker after teardown.
6. In a separate **player** client, confirm authorized Regions and Checkpoints
   respect both native/Atlas Fog; unpublished names/geometry remain hidden.

**Automation:** focused GM stack ordering/teardown regression, road and
Territory label/Journal/Fog tests, full `npm test` and architecture validation.

**Deferred:** a broader rewrite of native Foundry layers or player visibility
authorization (separate Stage 2, #269); remaining advanced Region editing
stays postponed (#264/#265).
