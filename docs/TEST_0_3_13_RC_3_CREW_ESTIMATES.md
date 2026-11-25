# 0.3.13-rc.3 — Owned vehicle capacity and crew estimates

Based directly on PO-tested RC.2 6c73d31cbbabe2666f650abce5baa0d63bbe3611. Scope is the new #527 presentation slice, not new crew assignment or movement authority.

- General: separate Passenger seats per unit and read-only Required crew per unit, with linked World profile, quantity total and wage inclusion/rate/basis. Existing Group seat, speed, upkeep and note overrides stay editable; required crew and wages remain World-owned.
- Party owned vehicle cards: show required crew per unit and total across available units, separate from passenger seat capacity. Crew role counts are explicitly unallocated; not counted as passenger seats or deducted from wages. Clearing a profile reports Not configured.
- Single-method Navigation and current-leg estimates/approval notes: required crew and separately wage-estimated crew, existing crew wage amount and overtime breakdown. If the hired fare includes crew, the separate estimate is zero. Historical/incomplete breakdown counts are not invented. Recovered legs are not re-quoted. No changes to amounts, billing periods, rounding, schema, native Group membership, Actor, token, Scene, Journal or clock ownership.
- Mixed-method crew breakdown and explicit assignment of individual crew to particular vehicles/legs are separate unresolved scope (#527/#513); no automatic allocation or staffing validation. Existing Group Crew role lacks a resource/leg assignment. Do not reduce wages or infer an occupied position from that role alone.

## Foundry v14 live acceptance

1. Open Party Transportation; edit an owned Warship linked to Warship World profile. Verify 60 passenger seats and 60 required crew per unit (unless profile/seat override differs). Quantity 2: verify 120 crew required across 2 units. Changing passenger seats must not change crew requirements. Verify displayed World wage policy, switch compatible profiles and clear profile; unknown staffing must be shown honestly. Apply updates only the Party draft; Cancel/reopen preserves saved data.
2. Assign an NPC Crew role with quantity > 1, verify crew count separate from passengers and no automatic assignment/discount. Check companion with/without seat and reserved mount still work.
3. World preset: optionally enable wages and set rate per day/trip/mile; owned quote shows total required crew and separately paid crew, and wage amount with current operating units. Compare cost with RC.2 same inputs. With wages disabled or zero crew, verify zero separate crew cost and no false staffing assurance.
4. Hired vessel with driver/crew included in fare: zero separate wages despite required crew. With included=false and wages enabled, verify existing math once per paid crew, unit, configured period. Verify land and water current-leg approval and cancel. Do not intentionally test unsupported continuous-water recovery; #528 remains separate.
5. Reopen RC.2 approved saved Journey; historical quote unchanged, no new charges. Test GM and separate non-GM. Verify no writes on open/preview or Cancel, and no changes to native Group, Actor, Fog, Scene, Journal, time or movement from editor/preview.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-rc3-crew-estimates/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-rc3-crew-estimates.zip
Draft PR #539. No merge/tag/release.
