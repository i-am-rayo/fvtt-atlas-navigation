# Atlas v0.3.9-beta.8.62.1 — Road hover local + continent label hotfix

**Status:** Draft Foundry v14 Sandbox candidate. The Product Owner reports beta.8.62 live test successful except overlapping local geography/continent subtitle behavior. No release, merge or migration is authorized.

## Scope and invariant

- A GM-only, opt-in Road hover Territory subtitle now reads **`Local Area/Settlement, Continent`** at the *existing* Road-label anchor, e.g. **`Genasi Village, Reshara`** or **`Desert Dunes, Reshara`** when those names are native geographic Regions.
- When explicit native Atlas geography parent IDs form a verified chain (Continent → Area → Settlement), the deepest co-containing Area/Settlement wins before the Continent. City, Town and Village are also supported local kinds.
- A unique **one-local/one-continent** co-containing Region pair may display without an explicit parent if the local Region has **no** parent. This is GM-only presentation of point containment, **not** inferred/recorded geographic parentage. An explicitly conflicting parent is never overridden.
- Continent-only and local-only labels remain single names. Multiple competing local Regions or continents, invalid flags, missing native polygon geometry, and stale/mismatched canvas fail closed. Existing Road surface/travel preset labels (e.g. `Desert Dunes` if it is a surface rather than an Area) remain separate.
- All native Region reads, 256-candidate bound, GM guard, player-preview suppression, Map Marker proximity suppression, hover eligibility and existing Road styling are preserved. No Scene/Region writes, graph schema changes, new settings, Journeys, Tokens, Actors, Journals, World time or migrations.

## Focused owner GM/non-GM live acceptance

1. Install beta.8.62.1 in a backed-up Foundry v14 Sandbox, verify the module version and confirm Atlas Layers > Roads > **Show Territory under hovered Road name (GM only)** remains enabled if previously selected.
2. On a Road overlapping only Continent **Reshara**, hover: show `Reshara`. Overlap a unique **Genasi Village** Settlement (no parent Region): show `Genasi Village, Reshara`. Overlap an Area **Desert Dunes** (no parent): show `Desert Dunes, Reshara` when the Area is the only local match.
3. On a nested explicit Continent → Area → Settlement where all three polygons contain the hover point: show `Genasi Village, Reshara`, **not** three names or a guessed sibling.
4. On two competing Settlements (or two Continents), no Territory subtitle. On a local Region explicitly parented to a different unavailable Region, do not assign the co-containing continent. Invalid/unsupported native geometry must never produce a guessed label.
5. With an independent Road surface subtitle, verify surface and composed geography stay on **separate lines**. At a nearby Map Marker banner verify the existing Territory-label collision suppression remains unchanged.
6. Confirm Atlas Layers toggle Off, GM Player Territory Preview and an actual non-GM client do not reveal native Region names. Pan, zoom, change Scenes, redraw and reload: no stale labels or browser errors.
7. Verify Region flags/shapes/Behaviors, Road graph, Map Markers, player fog, Journal events, Token position, Actor resources and World time remain unchanged. Finish the prior beta.8.62 checklist in `docs/UI_STANDARDIZATION_BETA8_62_TEST.md` for any still-pending items.

## Verification

- Targeted Node regression: `node --test tests/road-territory-hover.test.mjs tests/road-canvas.test.mjs`.
- Full repository gates: `npm run check`, `npm run architecture:check` and `git diff --check`.
- GitHub Actions must pass on the draft PR; automated tests are not Foundry v14 owner acceptance.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.62.1-road-territory-label/module.json

**Archive:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.62.1-road-territory-label.zip

**Rollback (beta.8.62):** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.62-road-territory-hover/module.json
