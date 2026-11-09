# v0.3.9-beta.8.9.1.3 — Native Territory reconciliation and edit coordinates

## Owner-reported Foundry v14 issues (2026-11-09)

1. A City could not be created without selecting an existing Continent.
2. The Hex/Grid Territory brush radius was a dropdown rather than a convenient slider.
3. Atlas-authored polygon Regions appeared offset after edits.
4. Moving a native Foundry Region directly left Atlas saying to reconcile its editing source without offering a recovery path.

## Ownership and design decisions

- **Native Region Shapes remain authoritative.** Atlas source nodes are editable provenance only. No read action, reconciliation preflight or dialog opening changes native Shapes or Behaviors.
- **Unparented settlements are valid.** A newly authored City, Town or Village may explicitly have no parent; later geographic inference is a read-only convenience and native containment/peer checks still run when applicable.
- **Brush radius** uses one native grid cell at zero rings through four rings, preserving the bounded 100-cell paint-stroke limit. Native square/hex cell geometry and existing overlap constraints are unchanged.
- **Offset defense:** when opening a polygon source, reconstruct its original smoothed local Shape and compare that topology to the actual native Shape. Align control points to the native Shape's origin, even when the Scene background-image padding has moved since the original save. If local geometry does not match, refuse to edit rather than silently reconstruct a different Shape. On Save, existing digest/stale and peer/parent checks still run.
- **Explicit native adoption:** a GM moves/edits a native Region in Foundry and then selects its new **Adopt Native Boundary** icon in Atlas Workspace → Territories. An explanatory confirmation prepares a new control source from the existing native one-piece polygon or grid Shape. The only write is `flags.fvtt-atlas-navigation.territoryBoundarySource`; the Region Shape, Behaviors, hierarchy, elevation, native ID and Atlas visibility remain unmodified. The previous control-node IDs, smoothing preset and imported Blank-Wall IDs are invalidated and clearly disclosed. Concurrent changes between preview and confirmation block the write. Multiple Shapes, holes and unsupported polygon shapes fail closed.
- **Prior offsets are not silently reversed:** Foundry has the current location, but Atlas cannot prove the previously intended location. The GM should restore the Shape to its desired location using Foundry's native tools, verify it visually, and only then adopt it as the new control source. Keep a World backup before manual correction.

## Owner Foundry v14 acceptance checklist

1. Back up the World. In Scene **Paedor**, create **The Eyrie** as City with **No parent** despite Valecor existing. Confirm Save works, and other cities remain unchanged. Repeat with no Continents in a fresh test Scene.
2. Begin Hex/Grid Territory painting. Check the brush radius is a slider, with live `1 cell`, `1 ring`, up to `4 rings`; paint/erase; Undo; Cancel leaves native Regions unchanged; accepted Save creates exactly one native grid Shape.
3. On a **copy** of Dirwest, record the original native Shape bounds and behavior count. Open Atlas Edit Boundary, do not move nodes, Preview & Save. Confirm the native bounds **do not shift**. Repeat after modifying Scene padding, zoom and canvas refresh. Repeat with smoothing enabled (e.g. Gentle).
4. Move a copied native Region a small distance using Foundry's own native Region tools. In Atlas Workspace → Territories, the row should say its native boundary changed; its new **Adopt Native Boundary** icon is enabled, while Atlas Edit Boundary refuses stale controls.
5. Click Adopt Native Boundary and decline. Confirm **no** changes. Click again and approve. Confirm the native Region retains its moved shape, IDs, Behaviors and appearance, and Atlas Edit Boundary now opens its refreshed controls. Cancel editing without writing again.
6. If the Region was accidentally offset by an older Atlas build, move it **back to the correct location in Foundry first**, then Adopt Native Boundary. The adoption action is **not** an Undo for accidental native moves.
7. Verify a deliberately complex native Region with several Shapes or holes is refused for Atlas adoption, without any change to geometry or behaviors. Verify the adoption action cannot be used by a non-GM.
8. Check Road and Checkpoint overlays, Fog, a GM + non-GM client, scene switch/reload and a paused/active Journey have no unexpected changes.

## Automated coverage and release gate

- Standalone unparented City source and native create, slider DOM state/label, polygon/smoothed shape re-projection after Scene padding changes, no native movement on unchanged Save, explicit native adoption, behavior preservation, concurrent edit refusal and non-GM refusal.
- Full `npm run check`, `npm run architecture:check`, JavaScript syntax and `git diff --check` required before publishing this test branch.
- All owner live Foundry v14 acceptance above remains pending; keep the pull request in **draft**, stacked on beta.8.9.1.2. No migrations, bulk rewrites, merges or final release.
