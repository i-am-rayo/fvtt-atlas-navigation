# beta.7.16.2.3 — Forget Saved Journey / New Route escape hotfix

**Status:** Owner-reported live Foundry v14 recovery-lock usability bug. The native ship checkpoint mismatch remains unverified and blocked; this patch only permits deliberate GM abandonment of an unwanted recovery. Draft stacked on beta.7.16.2.2 PR #173. Do not merge or promote to a final release before GM/non-GM live acceptance.

**Manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.3.8-beta.7.16.2.3-forget-saved-journey/module.json

**Branch ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/hotfix/v0.3.8-beta.7.16.2.3-forget-saved-journey.zip

## Live acceptance checklist

1. **Back up the test World first.** Reopen the existing interrupted Port Barthos → Hearth's Heart Dock Journal. Verify approved Ship passage (hired) remains visible and recovery/travel are still blocked; the Journal opens without modifying saved data.
2. Verify that **Forget Saved Journey** appears next to the disabled Recover button and **New Route** is enabled in the footer. Click Forget, then **Cancel**. Confirm the Journal stays Interrupted, its pending native intent remains, and all original controls/state persist.
3. Click **New Route**, carefully read the GM confirmation and **Confirm**. Verify the original Journey Journal becomes **Ended** and stays readable, with original confirmed movement, World time and pending native checkpoint intact. It must no longer appear as recoverable after closing and reopening Navigation.
4. Confirm the navigation controls return to a clean route with Point A at the **current placed party token**, no selected destination, and ordinary route selection available. Selecting a new B must never reuse the old ship booking, clock or saved A→B→C→D path. A new movement requires its own normal GM approval and new Journal.
5. Repeat with a normally interrupted Riding Horse or Walking Journey and after successfully loading a recoverable Journey. Both New Route and Forget must require GM confirmation before ending the saved record; Cancel must leave it unchanged.
6. Confirm non-GM clients cannot access the GM-only management action. Verify no changes to fog, weather, Regions, road/checkpoint links or unrelated Scene flags.
7. To continue investigating native ship travel, perform a **separate disposable** voyage and capture the complete console JSON warning from beta.7.16.2.2+; do not reuse or force-reconcile the abandoned Journal.

## Boundaries and recovery safety

“Forget” means **end its recovery eligibility**, not delete its historical Journal. A failed Journal write or stale approval must leave the route locked; no token update, World-time change, rest, booking or payment is authorized by this action. The pending native checkpoint remains documentary evidence, not credited travel. A new Journey gets its own Journal after its own approval.
