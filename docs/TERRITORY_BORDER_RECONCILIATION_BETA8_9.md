# v0.3.9-beta.8.9 — native Territory border reconciliation (first safe slice)

## Owner request and authorized scope

After beta.8.8's successful owner test of inferred Continent hierarchy, the
owner promoted automatic geographic delimitation ahead of the Checkpoint
Workspace: competing neighboring Territories should not overlap or develop
unintentional seams after smoothing. The owner approved a staged milestone:
detect/preview first, with guarded GM-approved corrections rather than
unreviewed bulk editing.

This build implements **bounded peer-overlap analysis plus a one-sided native
polygon difference preview/approval**. It is not a general-purpose
multi-Region topology engine or automatic gap filler. Its supported correction
is deliberately narrower than the eventual shared-edge topology editor.

## Rules and native ownership

- Only Atlas-linked, valid geographic `city`/`town`/`village` peers compete;
  classified `continent` Regions compete with other `continent` Regions.
  **Continent over settlement is intentional nesting and is excluded.**
  Atlas-generated road corridors and generic `area` Regions are excluded.
- The GM opens **Atlas Workspace → Territories → Analyze Borders**. A
  read-only adapter checks public native v14 `RegionDocument.area`, bounds,
  single Shape, `polygonTree.intersectPolygon` and polygon coordinates.
  It reports exact supported peer-intersection area and approximate boundary
  proximity (potential gaps, **not proof of enclosed voids**).
- Maximum 40 eligible manual/native geographic Regions and 80 expensive
  native pair intersections per analysis; additional unsupported/complex
  geometry is counted as unsupported, not silently considered clean.
  Native Shapes with holes or multiple components are excluded from this
  first editing mode.
- For an actual overlap the GM explicitly chooses **which native Region to
  preserve** and which to trim. Foundry's documented PolygonTree
  `intersectPolygon(...,{clipType:ClipperLib.ClipType.ctDifference})` computes
  the candidate difference. If the public Clipper difference enum is absent,
  this mode refuses the edit rather than inventing a geometry algorithm.
- A proposed trim must be a **single valid simple polygon**, have no holes
  or disjoint parts, contain at most 2,048 vertices, and remove at most 30%
  of the losing Region's native area. The difference area must agree with
  the measured source overlap. Clipping a continent interior or slicing a
  territory into islands is refused; use native editing instead.
- Original (orange), protected neighbor (blue) and corrected proposal
  (green) are disposable GM-only canvas graphics. **Cancel writes nothing.**
- After explicit confirmation the adapter rechecks native permission,
  Atlas/Region association, geographic type, both Regions' source Shapes,
  names and classification, and recomputes the native clip. Exactly **one**
  existing native Region receives a `{shapes}` update. Both native IDs,
  Behaviors, hidden state, flags, Levels, Road geometry, fog, Journey and
  World time remain untouched. It never writes a second Region in the same
  transaction. Native shape edits made during preview cause a refusal.
- GM Atlas Debug → Verbose records safe pair counts, supported/unsupported
  outcomes, vertex totals and approved area percentage. No Region names,
  polygon coordinates or player-visible secret metadata are logged.

## Known boundaries and follow-up design

- Near-but-disconnected outlines are flagged for inspection; *automatic gap
  filling* requires a separate shared-edge/polygon-union proposal with proof
  that no lake, road channel or deliberate corridor is being covered.
- The current single-side trim handles simple overlap by conforming one
  Region to an untouched neighbor. Full multi-Region paired-border editing,
  seamless post-smoothing shared edge ownership and holes/multi-island
  support require a separate validated topology representation, bounded
  previews and an explicit recoverable multi-document transaction plan.
- Some native clipped polygon outputs may fail the safety gate; this is an
  intentional no-write result, not permission to use unvalidated geometry.
  The next iteration must be based on observed Foundry v14 output for
  real complex coastlines rather than guessing Clipper encoding.

## Automated verification

Tests cover sibling vs parent overlap policy, native proximity, no-write
analysis, one-sided clipping, local/native shape origin, stale protected
border refusal, generated road Region refusal, invalid geometry, absence
of the documented clipping enum, non-GM denial, and the Workspace button.
Run the full check, architecture import gate, syntax and diff validation.

## Owner Foundry v14 GM and player acceptance

1. Install beta.8.9 in a backed-up test World. Open the Paedor Scene as GM.
   Set Dirwest and Millstone to Town/Village/City and Valecor to Continent;
   overlap Dirwest and Millstone slightly. Click **Analyze Borders**.
2. Confirm the Dirwest/Millstone overlap is reported while Valecor containing
   either town is *not* treated as an erroneous overlap. Inspect counts in
   GM Verbose without names/geometry and verify no document writes on scan.
3. Choose **Keep Dirwest; trim Millstone**. Compare orange, blue and green
   outlines at two zoom levels; Cancel and ensure nothing is saved. Reopen,
   approve, then verify precisely one native Region Shape update. Compare
   original/protected Regions' Behaviors, IDs, flags, Levels, name and color.
4. Reverse the protected side on a fresh test fixture and inspect the result.
   Test >30% overlap, a complete containment split/hole, multi Shape, an
   intricate coastline, invalid native polygon and missing clipping support:
   all unsupported edits must refuse without a write.
5. Change either native Region in Foundry while the preview is open, or
   unlink/reclassify it. Confirmation must fail with an actionable stale
   error and preserve both current Region Shapes.
6. Check a 1–20 px gap between two otherwise adjacent Regions: inspect the
   proximity hint; no auto-fill should happen. Protect real holes, rivers,
   coastlines, road corridors and custom Area Shapes.
7. Attempt as non-GM, during an unfinished Road draft, and during an active
   Journey. Authoring must be denied. Confirm existing Roads, Checkpoints,
   native Levels, Fog, Region Behaviors, Journey resume and World-time/Journal
   remain unaffected after a legitimate GM-confirmed edit.

Automated tests do not establish the above Foundry v14 acceptance.
