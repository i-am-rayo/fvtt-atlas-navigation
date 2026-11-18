# beta.7.16.2.4 — Native checkpoint timing hotfix

**Status:** Owner-approved draft test build; automated verification does **not** replace live Foundry v14 GM/non-GM acceptance. Stack on beta.7.16.2.3 draft PR #174. Do not merge or promote to stable before the owner validates the voyage.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.3.8-beta.7.16.2.4-native-checkpoint-timing/module.json

**Branch ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/hotfix/v0.3.8-beta.7.16.2.4-native-checkpoint-timing.zip

## Owner Foundry v14 test checklist

1. **Back up the World.** Do not replay or manually reconcile a previously interrupted native checkpoint. Use a fresh disposable Journey with the party token physically at the expected start. Existing historical/Ended Journals must remain unchanged.
2. Install `0.3.8-beta.7.16.2.4`, confirm the version and set **Atlas Debug — Console Logging Level** to **Verbose**. Keep one non-GM client connected to check that GM diagnostic details are not exposed there.
3. Plan the same route: Riding Horse → Port Barthos, then **Ship passage (hired)** → Hearth's Heart Dock. Confirm checkpoint decisions and the vessel once. Verify the party starts the water leg and no longer stops solely because the hook-time TokenDocument still shows the previous location.
4. In GM console, inspect `Native checkpoint observed` events. Each native checkpoint should have **`observationPhase: "move-hook"` and `"animation-ended"`**; compare native movement/operation IDs, road/segment IDs, native checkpoint index/key, expected from/to, native origin/destination, and TokenDocument x/y. A hook-time `documentMatches:false` is permitted **only if** the same checkpoint later has an authoritative `animation-ended` match.
5. Inspect `Native checkpoint durably confirmed` after each accepted interval. Check World time and Journey Journal progress agree, no interval is credited twice, the hired ship method/speed remains approved and the same ship fare is not charged twice. The original A → B → C → D destination must remain intact.
6. Reach Hearth's Heart Dock, then choose the next method at the GM checkpoint decision. Verify the final Journey has confirmed arrival and no unnecessary replay/return to Port Barthos.
7. Pause and resume during the water leg; repeat with canvas redraw and Scene switch. Never accept unconfirmed progress or duplicate fare/World time. If the native TokenDocument still does **not** match after animation, expect `Native checkpoint reconciliation blocked` with `observationPhase: "animation-ended"`, `failureReason: "native-document-checkpoint-mismatch"`, and expected/actual coordinates. The pending intent must remain available for GM review, not auto-recovered or silently discarded.
8. Repeat a Walking/Riding Horse leg and a noncontinuous vessel, and test non-GM read-only behavior, player fog, weather/Scene effects, native Region movement costs/Levels, and road/checkpoint visuals. Existing Scene geometries, native Behaviors and saved IDs must remain unchanged.

## Invariants and deferred work

The hook-time Document coordinate is a **snapshot**, not sufficient proof of arrival. Native path identity/destination stays mandatory at the hook; committed TokenDocument position stays mandatory after animation and before any Journal, clock or fare credit. A rejection must preserve the pending Journey and expose actionable GM diagnostics. This patch introduces no migrations, new transportation IDs, direct TokenDocument updates, speculative recovery, Region changes, new navigation UI or automatic actor rest. Any additional live mismatch is a stop condition for further stabilization work.
