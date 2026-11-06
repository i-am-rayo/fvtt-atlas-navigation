# v0.3.8-beta.7.25 — Transport/Presets architecture review checklist

**Assessment only.** No new gameplay, UI, persistence, permission or native
Region implementation is included. The Product Owner should review the
[source-backed assessment](TRANSPORT_PRESET_ARCHITECTURE_BETA7_25.md) and its
risk/ownership decisions; future live scenarios listed below are evidence
requirements for separately authorized changes, not a claim this beta fixed
them. Use a backed-up Foundry v14 World and separate GM/non-GM clients.

## Architecture owner review

- [ ] Confirm **World method catalogs** vs **World terrain presets** remain
      separate and only meet in transient route planning.
- [ ] Confirm owned Group vehicles/mounts and hired checkpoint offers are
      independent, with stable World method IDs and GM-only edits.
- [ ] Decide whether `neutral` transportation reference templates may reuse
      D&D 2024 examples or need generic templates (T25-R4).
- [ ] Agree on a blocked/warn/reassign policy when a custom World method is
      referenced by a Checkpoint, Group or unfinished Journey (T25-R3).
- [ ] Agree on checkpoint-offer orphan handling during future Node migration,
      delete, detach and relocation, without silent Scene flag mutations.
- [ ] Keep native Region/Levels/Behaviors, weather, Actor currency and World
      calendar under their native authorities.

## Future focused verification matrix (not executed here)

| ID | Scenario | Required invariant |
| --- | --- | --- |
| T25-01 | 2024/5.5e, 2014 and non-D&D/custom profiles | Distinct reference speeds/rules, compatible fallback, no automatic profile rewrite |
| T25-02 | Edit/reset/delete World custom transportation methods | Stable IDs, previous overrides preserved, orphaned Group/Checkpoint/Journal references detected before unsafe deletion |
| T25-03 | Change inherited World method while editing a Checkpoint offer | Stale source rejected, explicitly overridden fields retained, other offers untouched |
| T25-04 | Edit Group-owned mount/vehicle profile, amount and crew | Native Group Actor members/currencies unchanged; matching via stable Actor and method IDs |
| T25-05 | Road surface transitions land → water → air | Real shared Checkpoint required; invalid geometric crossings do not silently transfer |
| T25-06 | Rename/delete terrain preset used by Roads or native Regions | Usage preflight, native Shapes/Behaviors preserved, invalid IDs fail with guidance |
| T25-07 | Modify manual native Region cost and then World terrain preset | No automatic reapply, disabled/modified native Behavior stays untouched |
| T25-08 | Hired vs owned fare, crew, capacity, overtime/continuous operation | Estimates only; correct mile/km and CP conversions; no double fare or World-time writes |
| T25-09 | Cancel/refresh transport dialog and navigate as non-GM | No implicit booking, player writes, stale listener or leaked hidden data |
| T25-10 | Canvas teardown during approved continuous ship arrival | Journal/Token saved anchor and remaining distance reconcile or **fail closed**; never double time/rest/charge |
| T25-11 | Weather-triggered Scene redraw at 32.6% and 5.8% unconfirmed | Record initiating stack + exact native Token, Journal pending intent and route before/after; don't bypass #189 |
| T25-12 | Scheduled departures using a fantasy World calendar (future #136) | No Gregorian assumption, deterministic window, explicit GM approval of wait/fare, recovery-safe snapshot |

## Automated verification for this assessment

**Local results (2026-11-05):** `npm run check` **683/683 passed**;
`npm run architecture:check` **142 JS modules, 417 relationships, zero
missing targets, zero cycles**; `git diff --check` and manifest/package JSON
version parity passed. The official Foundry v14 GM/player review of this
assessment remains a separate owner decision.


- `npm run check` — all accumulated tests and syntax checks (baseline 683).
- `npm run architecture:check` — missing import and cyclic dependency gate.
- `git diff --check`; JSON validation and manifest/branch URL verification.
- No runtime files changed by this milestone, so no new functionality is
  represented as tested in Foundry. Existing owner issue #189 remains open.

**Exit:** owner accepts or adjusts the documented contracts and priorities.
Further recovery fixes and refactors need new focused draft PRs and the
appropriate Foundry v14 GM/player live acceptance.
