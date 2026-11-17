# Atlas v0.3.9-beta.8.59.1 — Map Directory crash regression

**Scope:** narrow repair to the beta.8.59 Sandbox candidate. Foundry v14 owner live acceptance pending. No other beta.8.59 features or behavior have been changed.

## Failure reported

On opening Workshop > Map Directory in Foundry v14, Atlas displayed:

```text
Failed to render Application "atlas-scene-workspace-...":
children.children.slice is not a function
```

The directory used `children.children.slice(1)`. A native browser `HTMLElement.children` returns an `HTMLCollection` with indexes and iteration but no Array `.slice()`. Node's simplified DOM tests represented `children` as an Array and missed the failure.

## Change and validation

- The renderer now safely copies the live `HTMLCollection` to an Array before slicing when collecting Road/Map Marker count metadata.
- The new regression mocks `details.children` as an iterable object without `.slice()` and runs Map Directory with a Road and an associated Map Marker.
- GitHub Actions run #458 passed **Node tests** and **architecture checks** for the fix source branch.
- There is **no new migration, Road graph write, native Region update, disclosure/permission bypass, user setting change, or Journey change**.
- Core/other-module deprecation and blocked-network warnings in the owner's log were not the Atlas crash; they are not modified by this patch.

## Owner's focused Foundry v14 Sandbox checklist

1. Install **0.3.9-beta.8.59.1** and verify the installed version in Foundry, not merely the manifest URL.
2. On the original tested Scene, open the Atlas Workshop. Open **Map Directory > By territory**. Confirm the window renders without the HTMLCollection exception.
3. Open **All roads**, expand a Road containing Map Markers, verify its `Map Markers (count)` section shows the correct rows. Repeat with no associated markers.
4. Open **All Map Markers**. Test A–Z/Z–A, type filter, Territory filter and search; expand/collapse a Territory group with nested Roads and Map Markers. Confirm counts and parent actions remain attached and no exceptions occur.
5. Refresh the Workspace and reload the Foundry page. Open the same views again. Verify that read-only navigation and expansion did **not** change authored Road graph, Region Shapes/priority/Behaviors or Map Marker information.
6. As a non-GM, verify hidden Road/Map Marker/Territory metadata is not exposed by the directory or other changed surfaces. In the GM view, verify the existing native visibility controls still respect native permissions.
7. Only after the Map Directory crash is confirmed fixed, resume the broader beta.8.59 test checklist `docs/UI_STANDARDIZATION_BETA8_59_TEST.md`. Any repeat render exception should stop dependent acceptance; provide a console trace.

## Manifest and archive

- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.59.1-directory-fix/module.json
- Source archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.59.1-directory-fix.zip

Draft, unmerged. Do not install in production or treat automated CI as Foundry owner acceptance.
