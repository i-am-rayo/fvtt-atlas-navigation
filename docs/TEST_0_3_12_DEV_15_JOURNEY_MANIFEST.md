# Atlas 0.3.12-dev.15 — traveler deck, Journal manifest and scroll continuity

Stacked on dev.14 recovery-integrity guard (draft PR #475).
No release or merge authorized.

## Owner feedback (Foundry v14, 2026-11-21)
- Increase default Navigation window to 900 × 745, remaining resizable.
  Retain Foundry native window behavior on narrow screens.
- Preserve tab scroll position across ApplicationV2 re-render on traveler
  drag, keyboard move, check/uncheck or transport-unit quantity change.
- Show a permanent **Not traveling** column for mixed methods. Drag there
  to preview a split party or use the existing keyboard Move selector.
  Keep the subset preview-only movement safety rule.
- Snapshot names of Group travelers in the **approved schema-v2 convoy**
  alongside stable Actor IDs/method keys and validated seat/price data.
  The official completed Journey view and GM-owned Journal page display
  these names by method; names are escaped for HTML safety.
- Existing schema-v2 records without names and schema-v1/v3 records
  continue to render aggregate counts without silent Actor lookups,
  retroactive migration or fabricated historical assignments.
- Do not edit World Party-owned rider assignments or Actor state.

## GM and non-GM acceptance
1. New Journey: multi-method Walking + Warhorse + Wagon + Cart where
   available. Confirm four-or-more columns plus Not traveling when wide;
   narrow windows may wrap columns without clipping.
2. Drag Cassian and Jonathan between vehicles and Not traveling; scroll
   remains at the assignment board after each change. Test keyboard Move
   (including the not-traveling destination).
3. A subset remains preview-only with Play disabled, no World/Token/Journal
   writes; restore all travelers to allow approved Group Journey.
4. Confirm a new full-Group Journey. Check rider names, no-seat companions,
   cargo-only vehicles and seat counts in both completed view and the
   generated GM-owned Journey Journal.
5. Modify a Group Actor's display name *after completion* and reopen the
   generated Journal: historical manifest must stay unchanged.
6. Existing dev.13 Journal (aggregate-only, no stored names) still reads,
   resumes safely without migration and does not invent who rode what.
7. Verify dev.14 canvas teardown guard, GM and non-GM permissions, World
   time, Journal and TokenDocument consistency, native Region/fog safety,
   and other Journey checkpoints and transfer legs.
8. Recheck Foundry v14 default/resized window behavior with an ordinary
   desktop viewport; diagnose Foundry core minimum-resolution warning
   separately from Atlas-specific sizing.

## Verification
Targeted Node/DOM/Journal tests, npm run check, npm run architecture:check,
syntax and git diff --check; Foundry live acceptance required.
