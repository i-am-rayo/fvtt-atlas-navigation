# v0.3.8-beta.7.20 — Roads/Checkpoints authoring boundary

**Status:** implementation draft stacked on beta.7.19; automated checks are
not live Foundry v14 acceptance. The only runtime change is call-boundary
extraction; no intended gameplay, drawing, saved flag, migration or UI change.

**Owner result (November 5, 2026):** All seven summarized GM/non-GM live
checks were reported **PASS**: Road Save/reload, point Undo/Cancel/Save with
connectivity/IDs, Locate Road on unsaved geometry, Checkpoint interior/shared
junction creation, discovery/Journal/preset/offers after reload, non-GM display
and authoring restrictions, and unchanged Regions/Fog/Journeys after canvas
refresh. This establishes targeted live smoke acceptance, **not** a two-GM
concurrency guarantee, raw player Scene-flag confidentiality, R-01 resolution
or exhaustive stale-revision/legacy-Scene verification. PR remains draft.

## Contract and architecture

- **Domain:** `checkpointCandidateRoads()` selects eligible owners from the
  authored graph without Foundry globals. `road-model.js` and
  `checkpoint-model.js` still validate and change topology.
- **Application:** `road-authoring-workflow.js` orders the authoritative graph
  creation and optional secondary metadata steps using injected ports. It
  contains no Scene, canvas, DOM, storage or permission APIs.
- **Foundry adapter:** `road-authoring-foundry.js` connects those ports to
  the existing GM-only `road-storage.js` Scene revision checks and the existing
  namespaced Journal, discovery, category, terrain suggestion, preset and
  transportation-offer stores. Reads do not migrate or write.
- **Canvas presentation:** `road-canvas.js` retains pointer hit testing,
  prompts, GM selection, transient editing drafts, refresh and feedback.
  The existing `RoadPointEditor` still stages geometry and offers Save Points,
  Undo and Cancel. Locate Road continues to focus *unsaved* geometry.

The checkpoint and edge split are still **one** Scene Atlas flag revision.
The current graph is always committed before secondary metadata; failed
Journal/discovery/offer writes cannot atomically roll back a saved checkpoint
or road. Preserve the authored graph and warn, never silently retry or delete.
The existing one-GM-per-Scene editing contract remains: Scene revisions detect
staleness but are not a two-GM atomic compare-and-swap. Stable IDs,
image-relative coordinates, old Scene schemas and linked native Regions are
unchanged. Independent checkpoints and migration are deferred to v0.4.

## Product Owner Foundry v14 acceptance

### GM — creation and staged editing

1. Confirm manifest version `0.3.8-beta.7.20`. Start a new Road, place two
   or more points, Save; reload and confirm same name, appearance, preset,
   player visibility, Journal link, node/segment IDs and image geometry.
2. Start another Road, then Esc/Cancel before saving: no new Scene flag write.
   Edit a saved Road: drag, add/remove a bend, insert and detach a junction,
   Undo, Cancel and Save Points. Compare IDs and checkpoint attachments.
3. Use **Locate Road** while an unsaved point edit is open. The editor remains
   open, and map pan/zoom/highlight follows the *draft* road, not saved data.
4. Add a Checkpoint at a Road interior and at a shared junction. Verify a
   road-choice prompt for shared nodes, exactly one Scene graph revision per
   creation, stable first segment ID on split, and persisted name/elevation/
   appearance, Journal, discovery, category/preset/terrain suggestion/offers.
5. Close/cancel a checkpoint prompt with no write. Change Scene graph revision
   while a prompt is open; the stale save must be refused, without orphan
   metadata or lost unrelated roads. Do not use competing live GMs as a
   supported simultaneous-edit mode.
6. Open old Scenes, edit and reload Roads/Checkpoints without automatic schema
   upgrades or changing manually authored native Region shapes/Behaviors.

### Canvas and player regression

7. Test Scene padding, rapid pan/zoom and canvas rebuild while editing; draft
   cleanup and geometry must remain stable. Test road/checkpoint hover and
   clustering with curved road appearance.
8. In a separate non-GM client, confirm existing revealed roads/checkpoints
   display as before and hidden names/graphics remain visually hidden; no
   authoring controls or successful Scene writes. Visual filtering does **not**
   establish confidentiality of raw Scene flags—A19-P1 remains a separate gate.
9. Confirm Region surface costs, Levels, native fog/weather, and an existing
   completed Journey/Journal remain unchanged. Inactive-GM R-01 remains an
   investigation, not fixed by beta.7.20.

## Automated regression scope

- Pure workflow tests check graph-before-Journal, checkpoint secondary write
  order, no metadata on rejected graph writes, and explicit partial outcomes.
- Domain tests preserve shared-node vs single-edge Road choices.
- Canvas/road storage tests check GM permissions, graph split revision count,
  saved IDs, staged edit/undo/cancel, Locate Road draft focus and player overlay.
- Full suite: `npm run check`; import graph: `npm run architecture:check`;
  syntax/JSON and `git diff --check` before any uploaded test build.

**Do not merge or mark as owner-verified until GM and non-GM live checks pass.**
