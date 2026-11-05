# v0.3.8-beta.7.23 — Fog & player visual read-model boundary

**Status:** draft implementation, automated verification only. Owner Foundry v14
GM/non-GM acceptance pending. This branch stacks on beta.7.22; it does not
merge or release any previous drafts. Test in a backed-up World.

## Scope and contracts

- `player-overlay-model.js` constructs an explicit **canvas-only visual read
  model** with only permitted Road, segment, Node and Checkpoint display fields.
  Road and Checkpoint reveals remain separate. Discovery/Lore can reveal a
  Checkpoint without showing its hidden Road association, Road name, elevation,
  Region metadata, or other raw Atlas fields. The old `player-visibility.js`
  export paths remain compatible; its GM mutators stay separate.
- This improves isolation of displayed data, **not confidentiality of Foundry
  Scene flags**. Foundry may already send the complete namespaced Scene flag
  to a player; an ordinary client can inspect that data. No new player socket,
  public API, Journey panel, GM-authored permissions or server-filtered read
  channel is introduced. Future player pamphlets/itineraries require a separate
  explicitly authorized server-side data and permissions design.
- `atlas-manual-fog-projection.js` extracts the pure mask selection rule from
  PIXI rendering. Explicit Hide overrides GM Reveal and permitted checkpoint
  discovery; Native Grid is still the geometry owner. No mask is persisted.
- A corrupt manual Fog flag now draws a full opaque image-area fallback for
  a player instead of aborting the renderer before it can create a mask.
  Unsupported native grid geometry retains its existing opaque fallback.
  Player Road rendering independently catches corrupted Fog state so it does
  not prevent the opaque Fog controller from running. The flags are **not**
  repaired, migrated or overwritten on read. GM brush interaction with a
  corrupt state reports an error and makes no change.
- Native `FogExploration`, token vision, weather, Scene effects, Regions and
  Behaviors remain Foundry-owned. No Journey, clock, movement, Actor or
  transport change. The Checkpoint independence design remains deferred to a
  separately approved versioned migration.

## GM / non-GM Foundry v14 acceptance

1. **Player overlay:** Connect a separate non-GM user and compare against
   beta.7.22. With all Roads/Checkpoints hidden, neither markers nor hover
   labels appear. Individually reveal one Road and Checkpoint. Confirm Road
   curves, color/pattern, clusters, icon textures, and visible labels are
   unchanged at low/high zoom, through pan, reload and Scene switch.
2. **Discovery boundaries:** With Party exploration enabled, mark one
   Checkpoint Known Through Lore and another Seen/Visited. A revealed
   Checkpoint on a hidden Road may show its own name and icon, but never its
   hidden Road name/ID, elevation or other GM details. Hide/restore the Road
   and verify its independent visibility. GM authoring remains unavailable to
   non-GMs, including Shift-click and all Scene/World settings.
3. **Manual Fog:** Test square and hex Scenes with manually Revealed, Hidden,
   and Cleared cells, including cells around discovered Checkpoints. Hide must
   win over Reveal. Confirm padding and zoom do not shift the cell centers;
   refreshing/tearing down the canvas must not flash previously hidden areas.
4. **Invalid-data fallback (test copy only):** On a disposable Scene,
   simulate malformed manual Fog flags or unsupported native grid geometry.
   Players should receive an opaque mask, not an uncovered map; an affected
   GM sees a warning and must repair the state deliberately. Confirm no
   automatic Scene flag migration or native Fog write occurs.
5. **Native ownership:** Compare native Token Vision and FogExploration, active
   weather/Scene effects, manually edited native Regions, Levels and movement
   Behaviors before and after redraw. Atlas display work must not change them.
6. **Journey isolation:** Reopen an existing completed Journey/Journal and
   compare TokenDocument, World time, fares and rest history. This beta does
   not address [checkpoint-transfer recovery bug #189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189)
   or [canvas rebuild issue #135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135).
   Do not bypass the Journey anchor/recovery guard in an affected World.
7. **Client-read limitation:** On a test World, inspect the raw Scene document
   as a non-GM and explicitly acknowledge that visual-only hiding does not
   guarantee secret data is absent from client-readable flags. Do not publish
   new player-facing data features based only on this projection.

## Automated evidence and remaining work

- `tests/player-visibility.test.mjs` reproduces leakage through the original
  root-object spread before the fix, then verifies whitelisting, stable
  geometry copies and legacy import compatibility.
- `tests/atlas-manual-fog-projection.test.mjs` covers overlap precedence and
  no writes; `tests/atlas-manual-fog-renderer.test.mjs` covers corrupt flags
  and unsupported grids with full opaque fallback.
- Existing Fog, Party exploration, Road/Checkpoint hover and permissions tests
  must remain green. Run `npm run check`, `npm run architecture:check`, new
  module syntax checks and `git diff --check` before drafting the PR.
- Large-Scene mask performance, PIXI lifecycle, native hex/grid variants,
  two-client payload exposure and all real-v14 effects remain owner live-test
  obligations. This slice does not claim to solve A19-F1's full performance
  measurement or A19-P1's server-side confidentiality problem.

**Exit gate:** review GM/non-GM test outcomes before beta.7.24's broad
integration gate; bug #189 is a separate high-risk Journey investigation,
not a basis for relaxing recovery safety.
