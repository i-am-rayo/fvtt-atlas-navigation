# v0.3.9-beta.8 — Opt-in public Region destination naming

Status: **draft test build; Foundry VTT v14 GM/non-GM live acceptance pending**. The Product Owner accepted beta.7. Beta.8 adds the next *isolated* destination-naming layer. Native Region boundary crossing events, Region-as-travel-trigger automation, themes, and campsite eligibility remain separate work.

## GM setup

1. Draw/configure a native Scene **Region**, with its shape(s), holes and elevation in Foundry's own Region editor. The Region's private native name does **not** become public automatically.
2. Open **Scene Configuration → Atlas tab → Public territory names · Journey banners**, and select **Configure public Region labels**.
3. Select the native Region. Enter a **public-safe territory name** (for example `Valecor`), explicitly tick **Show this name in Journey banners**, then **Save public territory setting**. The Region must not have native `hidden` enabled.
4. Atlas stores only a version-1 public-name opt-in flag on that native Region. Native shape/elevation/visibility/Behaviors/name, Atlas roads, native movement and existing Journeys stay unchanged. A saved label can be removed by unticking the same control.

## Live GM/player test matrix

| Test | Expected GM and player banner result |
| --- | --- |
| Visible checkpoint `Dirwest` at saved original Point B, even inside an opted-in Region | **The road ahead leads to Dirwest**; then **Welcome to Dirwest** (checkpoint wins) |
| Mid-road Point B inside a single native Region explicitly published as `Valecor`, with the party token at an applicable elevation | **The road ahead leads to Valecor**; then **Welcome to Valecor** |
| Mid-road Point B inside an unconfigured Region | Generic **your destination** wording |
| Native Region is hidden, label invalid, GM unticks opt-in, or party-token elevation is unavailable | Generic wording; no private/native Region names or IDs in the World pulse |
| Two published native Regions overlap at Point B | Generic wording (no arbitrary precedence) |
| Point B outside Region, inside a hole, or at an inapplicable elevation | Generic wording using native v14 `RegionDocument.testPoint` |
| Canvas padding/image origin changed | Native Region uses canvas-space point converted from saved image-local Point B; no geometry or destination write |

Additional checks:

- Run separate GM and non-GM sessions. Non-GMs must not be able to open/change the public name editor. Confirm only the **public label** (not native Region name or Journal details) appears in the strictly validated World announcement pulse.
- Test a Journey end on a road without a checkpoint. Confirm the Region fallback is only applied at the saved **original Point B**, not along an arbitrary waypoint or nearest Region. Confirm a saved completed endpoint with a conflicting native anchor cannot produce a named banner.
- Repeat a Long Rest (including beta.6 real-time stationary hold), canvas redraw, GM-awaiting recovery, checkpoint/road discovery and FIFO banners; World time, Journal progress, native Token position, Region Behaviors and weather must remain intact.
- Reload/reconnect a player after a banner: old announcement pointers must not replay. Leave the native Region hidden/unsupported to confirm fallback never causes an authorization failure or a Journey transaction failure.
- Test overlap and a Region with native holes and elevation restrictions in an actual Foundry v14 Scene; the automated mock tests cannot substitute for native-geometry live confirmation.

## Architecture and safety

- Pure `region-narration-model.js` validates one explicit, bounded public display label; null is private by default. Its schema does not change Scene Atlas topology, native Region schema or any persisted Journey format.
- `region-narration.js` alone reads/writes the namespaced flag after GM, Scene and Region document permissions plus stale-snapshot checking. It does not modify the Region's native name, geometry, elevation, hidden status, or Behaviors.
- `atlas-announcement-region.js` converts the verified original saved Point B into native canvas coordinates; the documented Foundry v14 `RegionDocument.testPoint({x,y,elevation})` decides actual inclusion. It requires the saved Journey party TokenDocument's finite elevation. Overlapping eligible Region labels fail closed.
- Only after the active GM's verified Journal receipt does the runtime try visible checkpoint naming *first*, then this explicit public Region fallback. It sends at most one sanitized `publicSubject` on existing version-2 `journey.started`/`destination.reached` World pulses; other events remain generic. Rendering never authorizes World time, movement, rests or Journal writes.

## Intentionally deferred

- Entry/exit **border-crossing** banners must derive from verified movement and native Region transition/elevation state, with ordered/deduplicated Journal-safe events and no replay on refresh. Never publish raw native Region labels.
- Dedicated territory precedence for overlapping public Regions, cross-Scene Regions, camera reveal, custom banner wording, public theme registry, system-specific rules and Inn/Camp checkpoint eligibility require separate approval and implementation.

Tracked in [issue #233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233) and [roadmap](ROADMAP.md).
