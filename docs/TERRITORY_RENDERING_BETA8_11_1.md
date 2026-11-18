# v0.3.9-beta.8.11.1 — Territory fill rendering hotfix

## Owner Foundry v14.370 feedback

The beta.8.11 Atlas Layers and hex-brush footprint generally look good, including the previewed group of hex cells. The owner reports **long gold spokes/diagonals** radiating across drawn Regions when translucent fills are enabled, and cannot find a way to change Atlas map Region colors from the layer palette. These are live **presentation** defects; no evidence indicates the saved native Region geometry has changed.

## Diagnosis and targeted changes

The beta.8.11 overlay built **native triangulation fills and exterior border strokes on the same PIXI Graphics object**. Its consecutive fill and stroke path calls can plausibly cause triangle edges to inherit the outline style; the screenshot's radiating edges strongly resemble the Region's native fill triangles. This is a likely cause **pending owner live confirmation**, not proof of corrupt native Region points.

- Two isolated, noninteractive Graphics instances are mounted in the existing GM-only canvas interface overlay: **fill triangles** use only fill calls; **native polygon borders** use only stroke calls. No stroke operation is issued to the fill context. Rendering and teardown remain limited by the existing Regions, vertices and triangle budgets.
- The **Region colors** section of Atlas Layers lists classified native Regions and displays a read-only swatch. **Edit native Region color** opens Foundry's authorized native Region Configuration (Appearance) via the existing Atlas adapter. Saving the native color there updates the GM Atlas outline/fill through the existing `updateRegion` hook. This avoids storing a competing Atlas color override or silently changing native Region Appearance values. Atlas Layers fill sliders still affect only the local GM client's opacity.
- The native Region ID, Shapes, color field, flags, Behaviors, Levels, visibility and Journey data are not written by either view/overlay. The only native write available is the GM's deliberate Save in Foundry's Region Configuration, which performs its own permission checks.

## Owner acceptance checklist

1. On a World backup or copied Scene, install beta.8.11.1 and open the problematic drawn Territory with **Settlements** enabled and a nonzero fill opacity. Confirm its outline has **no gold radiating lines**. Toggle opacity to 0 and back, and test at different zoom levels with fog on/off.
2. Test an older drawn/polygon native Region, a native grid/hex Region, a Region with multiple disconnected areas, and one with a hole. Verify outline and fill follow actual native geometry. If large Regions omit fill under the draw budget, report the Region ID/shape count and native triangulation availability.
3. Open **Atlas Layers → Region colors**, select a specific classified native Region and click **Edit native Region color**. Use Foundry's Appearance color picker, Save, and verify the atlas outline/fill updates to the new color without changing layer opacity. Reopen Atlas Layers to refresh the read-only color swatch.
4. Verify different Regions retain distinct native colors; canceled Region configuration makes no change. Ensure the color shortcut is not available to non-GM users or to unauthorized Regions.
5. Reload the Scene, rebuild the canvas, toggle Roads/Terrain/Corridors and continent/settlement/all overlays. Verify no stale graphics, leaking labels, fog changes, native Shape movement, or gameplay/Journey state transition.

## Safe progression

The following implementation can begin with **Gate C read-only polygon-to-grid conversion preview**, including a documented cell-inclusion rule, candidate cell counts, area difference and Scene-grid compatibility. **No native Shape replacement, multi-Region transfer or automatic migration** is authorized by this graphical hotfix; those require a separate reviewed, GM-approved Save workflow and recovery plan. No README entry is added.

## Verification

Regression tests explicitly assert fill and border GraphicsContexts are isolated, native fill triangulation is bounded, native Region colors reach the border, and the Region color shortcut opens only the existing authorized native configuration.

- `npm run check`: **827/827** passed, including syntax checks.
- `npm run architecture:check`: **4/4** passed; 175 modules, 0 missing targets, 0 import cycles.
- `git diff --check`: passed.
- Foundry v14 GM and non-GM live verification: **pending**.
