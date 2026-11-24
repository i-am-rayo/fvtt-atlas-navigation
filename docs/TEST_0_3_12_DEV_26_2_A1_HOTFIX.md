# 0.3.12-dev.26.2 — Live A1 regression checks

**Status:** Stacked draft on PR #488; GM/non-GM Foundry v14 acceptance pending. No merge, tag or release.

## Confirmed failures and resolution

1. **Onward water/air leg used a legacy dropdown.** The active, unapproved water/air leg now uses the same grouped transportation tiles as land, with a single-select **radio** (cross-surface/mixed passenger assignment remains future B1 scope). A selected non-Walking method carries its own accessible pencil and invokes the existing trip/Map Marker editor. An already-approved/recovered leg remains a locked, read-only method display.
2. **Only one checked vehicle had no tile pencil.** All selected non-Walking tiles (both one and several selected) expose a pencil on the tile, separate from the selection input. The redundant single-method Edit footer is removed. Walking has no vehicle editor.
3. **A 12h hired Cart prompted an 8h Long Rest despite its Map Marker allowing continuous operation.** Enabling a method capability is not GM approval of 24h operation. The active Journey selector now explicitly shows Standard, eligible Overtime and eligible Continuous choices. The controller now uses the effective World + Map Marker + trip-local method for all travel rules, planning and approval instead of falling back to an unmodified World preset. A GM-selected continuous Cart yields `dailyHours:null`; a 12h move cannot request a day-limit rest. Invalidated capability fails closed rather than silently downgrading an already approved operation.

The 2026-11-23 completed Journal **Port Barthos → Dirwest**, 12h movement + 8h approved downtime = 20h elapsed, remains historically valid. This hotfix **does not** edit or reinterpret that confirmed Journal, charge currency, move a Token, or authorize rests.

## Foundry v14 GM live verification

- Load version `0.3.12-dev.26.2` in a sandbox; check the manifest points to this draft branch and restart the client.
- Reproduce a confirmed Port Barthos checkpoint; choose **Continue**. On the following WATER leg, verify grouped method **tiles**, not the old dropdown, the Ship Passage selection, its pencil, and explicit operating schedule. Review read-only future legs; no future booking, payment, Token move or time advance.
- Choose a single hired Cart on LAND. Its selected tile has an Edit pencil without requiring a second method; clicking it must not toggle the checkbox. Verify Save for Journey vs Save to Map Marker scopes. Verify Walkers have no pencil, multi-selected Carriage/Wagon cards keep separate drafts.
- Set the Cart **Allow continuous travel** capability in the Map Marker and persist it. The Journey remains **Standard** until the GM explicitly selects **Continuous — 24h/day**. With the choice selected, the trip preview must show continuous duty, no planned 8h overnight stop, and the appropriate per-operating-day estimate. Selecting a different method resets the unapproved operation.
- Approve a Cart leg longer than 8h (e.g. 12h) with **Continuous**. Verify the confirmation reports the chosen schedule, the party token moves only through native Foundry movement, there is **no automatic rest prompt at 8h**, and World time advances only for confirmed movement. An optional manual pause/rest remains explicitly GM-authorized.
- Repeat the Cart leg with **Standard**. A rest/daily-limit decision must still occur at 8h. If World/Map Marker continuous capability is disabled after the preview, approval must fail/require replan rather than silently downgrading.
- Test water and air with normal, overtime, continuous where supported, and recovery after Canvas redraw/interruption. Confirm no duplicated Journal legs, time, fares or Token movement. Confirm existing legacy completed Journals remain unchanged.
- Test non-GM: selectors and pencils cannot commit Scene/World/Actor, Journey, Token, money or clock changes. Keyboard Tab focus and labels must be available.

## Evidence

- RED runs: [45102378334](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45102378334) (single-method editor, effective Cart method), [45102878529](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45102878529) (read-only preview dropped continuous Cart).
- Automated checks on **final head** must be confirmed separately, after all changes.

**Scope boundary:** Multi-surface mount/animal boarding manifest, livestock seats/fares, future-leg B1 assignment continuity are not implemented in this hotfix.
