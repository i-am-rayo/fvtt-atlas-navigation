# Atlas 0.3.11-dev.17 — Combined editor accessibility and action consistency

**Milestone 01 / #216.** Cumulative on owner-accepted `0.3.11-dev.16`. Presentation-only changes; live Foundry v14 GM and non-GM acceptance is required. Not a published release.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-216-editor-accessibility-batch/module.json

**ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-216-editor-accessibility-batch.zip

## GM Foundry v14 acceptance — one combined pass

1. Open an existing Map Marker Settings editor and stage changes in General, Customization, Terrain Region and Transportation. Switch via mouse, Left/Right arrows, Home and End. Selected keyboard focus must follow; each tab must announce its associated panel, and unsaved fields must persist across switches. Cancel leaves the Scene unchanged; one explicit Save persists approved edits. Verify same-marker stale rejection and unrelated-marker sequential saves still behave as previously accepted.
2. Open Atlas Workspace → Settings → World travel settings. Use keyboard arrows, Home and End on Travel rules / Journey & playback. Each tab must identify its associated panel. Preserve the existing lazy form and staged values; navigation alone must not write World settings or Scene data.
3. Enter Road Editor in new-Road and edit-points modes. Footer DOM/keyboard order: Locate (when available), Undo, Redo (when available), Cancel, Save/Finish at the end. Undo/Redo only change draft history. Cancel discards; Finish/Save persists through existing GM-authorized checks. Verify Escape/dirty-close behavior and Locate pans/highlights.
4. Open an existing Map Marker with linked generated native Terrain Regions. Inspect Radius/width, Regenerate and Delete icons: consistent 2rem Atlas targets, accessible names and destructive styling for Delete. Use disposable Region fixtures for actual operations. Previously manually modified Regions must still block protected Regenerate/geometry actions. Preview/cancel must not alter native Shapes, elevation, Behaviors or links.
5. Confirm a separate non-GM client gains no authoring controls or private metadata. Check visible keyboard focus at increased Foundry UI scale and narrow window widths.
6. Smoke-test accepted dev.16 Token/Group accessibility and dev.14 sequential save behavior. No background movement, Actor cost, Journey Journal, Fog or World-time changes are authorized.

## Automated/release gates

Focused DOM regressions cover four-page Map Marker keyboard focus/draft retention, Workspace travel tab associations and no-write navigation, Road dock footer order, and existing native Region action path. Run `npm run check`, `npm run architecture:check`, syntax and patch whitespace; run `git diff --check` in a local checkout if available. Automated success is not the owner's GM/non-GM live acceptance.
