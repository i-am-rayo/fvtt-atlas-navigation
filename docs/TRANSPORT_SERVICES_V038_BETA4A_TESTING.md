# v0.3.8-beta.4a — Crew-wage & preset-editor GM acceptance

Draft test build. Stack: v0.3.8-beta.3.2 → beta.4 transport-services audit → beta.4a.
Do not merge until live Foundry v14 GM and player testing is accepted.

## Before installing

- Use a backup World or restore point. Do not delete existing Atlas or Group flags.
- Install branch `test/v0.3.8-beta.4a` using its branch manifest.
- Verify existing presets, mounts, saved Group-owned overrides and Navigation remain readable.

## GM: preset editor

1. Open World Transportation Presets. Edit Draft Horse. Verify **General | Cost** tabs.
2. General: name, type, surface, speed, seats, **Crew required (#)** and notes appear. Change crew count and switch to Cost, then back; pending edits should survive.
3. Cost: recurring cost/denomination, basis, unit/passenger charge, purchase cost, **Crew wage per person per day** and opt-in **Include crew wages** appear.
4. Confirm the **100-mile** and **one travel day (8h)** table updates immediately when editing speed, recurring price, units/passengers basis, crew count and wage. Table uses one unit and one passenger as explicitly stated.
5. A Draft Horse at 3 mph and 5 CP/day should quote **5 travel days × 5 CP = 25 CP** for 100 mi; 1 travel day (24 mi) should quote **5 CP**; zero wages while crew is zero or wages are off.
6. Warship at default 2.5 mph and 60 crew: wages are **off** by default. Enabling them at 2 GP/day/crew on a 100-mile example (40 moving hours, five 8h travel days) adds **600 GP** (60 × 2 GP × 5 days). Adjust crew count and wage; projected total changes.
7. Cancel a modal and confirm no settings changed. Save, close and reopen; crew settings, wages and opt-in should persist. Reset the built-in and confirm reference defaults return.
8. Switch Rules Profile and confirm modifications remain isolated. Editing custom presets should also save crew fields. Galley passenger capacity must remain unspecified by default, not invent a value.
9. Reinstall/reload with World catalog v1 data: verify existing data is read, and no automatic writes happen merely by viewing.

## Navigation / compatibility gates

- Travel-time comparison stays at same daily pace for land **wagon and riding horse**; both 90.23 mi at 3 mph require 30h5 moving and 3d6h5 total with an 8h day.
- Example-cost table **does not** change Navigation duration or apply ship continuous service. That is reserved for beta.4b. For an eligible owned transport, Navigation's illustrative Group fare *does* include opt-in crew wages; existing water/air wage days currently use the 24h moving-time reference until service policies are added.
- No Actor, Group member, Scene, Token, currency, or native Region/Behavior writes occur from quote previews.
- Check GM editor access; players cannot mutate World presets.
- Check player scene, fog, roads, route conditions, journey clock, notes and Journal for regressions.
- Confirm all repository checks and tests, manifest URL and ZIP URL before owner acceptance.

## Deferred to beta.4b and later

- Actual for-hire, paid passage, overtime, continuous-travel service toggles with schedule and rate logic in Navigation.
- Per-party service purchase/payment, crew hiring and wages being deducted, multi-leg mixed transport, automatic crew checks.
- Work-based mount carrying restrictions and rider-size suitability rules (GM warnings, not silent block).
