# Atlas 0.3.13-dev.9.1 — Journey confirmation hotfix

PO live test of dev.9 was partial: Map Marker settings saved, but the plain single land confirmation did not match the accepted mixed-party summary. Logs also showed active-GM World-time authority refusing departure. No completed Journey was demonstrated. Related #532, #513, #517.

## Scope
- Existing native DialogV2 confirmations for single land and walking/cargo now reuse the existing Transportation summary table and metrics. Mixed-party and checkpoint-assisted summaries retain their existing layout. Plain walking without a transport confirmation is unchanged.
- Show selected traveler names, units, effective estimate, pace, moving time, schedule and explicit mount/left-behind notes when relevant. Cargo remains cargo only. Existing per-method rounding is reused. Saved land approvals do not re-quote historical fares; unavailable historical totals are not invented.
- Revalidate exact quote/pace and existing roster, offer, scene, route and native movement authority after confirmation. Active GM and World-time API are checked before showing approval and again before creating a Journey. A GM handoff cannot silently authorize the clock.
- No new dependencies, schema, native Group changes, movement, pricing rules, recovery migrations, or implicit currency/time writes.

## Foundry v14 PO retest
1. Use the active GM session (if another GM is active, sign out that session or switch to it). With World-time advancement enabled, an inactive GM gets an actionable message before approval. Do not disable the setting unless you intentionally want no Atlas World-time advancement.
2. At Port Barthos, select a valid hired Chariot and Dirwest destination; finish each mount's Embark or Stay behind decision. Press Travel Route. Confirm the standard Method / Travelers / Units / Cost table and four metrics are shown. Verify names, seats/units, schedule, fare and mount details against the draft. Select No/close and verify no movement, new Journal or time change.
3. Reopen and approve from the active GM. Confirm native movement, World-time progression and Journal checkpoints; do not assume completion until the Journal confirms it. Recheck rest, onward and recovery flows as applicable.
4. Repeat with an owned land mount, mixed-party transport, walking/cargo (if configured), and checkpoint-assisted vessel. Existing mixed and checkpoint summary visuals should remain unchanged.
5. Test active GM handoff during confirmation; approval must fail before Journal creation or movement. Recheck with a separate non-GM and with the World-time option intentionally disabled if appropriate. Preserve any existing saved Journey and do not replay an approved leg.
6. Use a supported Foundry viewport of at least 1024 × 768 CSS pixels. The reported 1011px viewport warning is native Foundry, not a transportation logic error.

## Candidate
- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.13-dev9.1-transport-confirmation/module.json
- Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.13-dev9.1-transport-confirmation.zip
- Draft PR #533, based on exact dev.9 commit a3365f6a62dac8338d95818b5db37bd2246dc855. No integration/merge/release or issue closure until acceptance.
