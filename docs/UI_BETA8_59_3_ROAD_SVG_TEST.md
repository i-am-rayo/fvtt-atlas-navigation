# Atlas beta.8.59.3 — Road Settings SVG crash repair

**Status:** Foundry v14 owner Sandbox verification required. No merge or production release.

## Reported failure and diagnosis

The attached Foundry log for beta.8.59.2 ends with:

```text
Cannot set property className of #
onClick @ atlas-map-directory.js:163
```

The Map Directory action correctly calls Road Settings; the exception comes from the Road appearance form created before the native Road window opens. Its SVG `<text>` preview label assigned to the read-only SVGElement `className` property, which is an `SVGAnimatedString` in real browsers. Test mocks previously supplied normal HTML-style mutable class names, masking the defect. The earlier beta.8.59.2 styling and diagnostic changes did not touch that bug.

## Fix and automated evidence

- Use the native SVG `setAttribute("class", "atlas-road-preview-name")` API, preserving the exact preview CSS.
- Add a regression that constructs the Road form using `createElementNS` and read-only SVG `className`, verifying the original statement would throw and preview creation now succeeds.
- No Scene graph writes, native Region changes, Atlas data/flags migration, World preset/Journey changes or player metadata exposure.
- Focused fix PR #390 passed Node tests and architecture gates. This versioned test branch must pass its own checks before owner installation.

## Owner Foundry v14 Sandbox acceptance

1. Verify installed version **0.3.9-beta.8.59.3** after updating module and reloading Foundry. Foundry build from last log was **14.370**, system **dnd5e 6.1.0**.
2. As GM, open Workshop > Map Directory > All Roads; select a Road's gear Settings action. Confirm the Road Settings window now opens without the SVG `className` exception.
3. Open the same Road Settings through the canvas and other existing entry points. Confirm the form and Road-line SVG preview render, including Road name above the line, border swatch and text color.
4. Switch tabs, resize/zoom and verify Paint Territory-inspired heading, scroll body and fixed bottom footer remain readable. Press Cancel and verify no Road or Region settings saved.
5. Change Road name or appearance on a disposable Road; Save explicitly once, reload, and verify correct persistence. Try header close on dirty form and a stale revision conflict. Do not bypass authorization/confirmation.
6. Confirm Map Directory tree/search/sort, Map Markers and native Region priority remain unchanged. As a non-GM, verify hidden Road, Map Marker, Territory and Journal metadata is not displayed.
7. If any exception remains, stop dependent acceptance and supply **the first red error and full expanded console stack** plus triggering UI path, not only initialization warnings. Distinguish unrelated third-party deprecations from Atlas error.

## Manifest and rollback

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.59.3-road-svg-fix/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.59.3-road-svg-fix.zip

Rollback Sandbox candidate: beta.8.59.2; last explicitly owner-live-accepted release in this branch sequence was beta.8.57. All PRs stay draft and unmerged.
