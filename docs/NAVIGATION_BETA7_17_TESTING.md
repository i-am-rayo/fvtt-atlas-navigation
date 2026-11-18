# v0.3.8-beta.7.17 — Journey state and Journal publication boundary

Status: **draft, automated checks passed; not live-tested in Foundry v14**.

## Owner-reported failure and design decision

On the Dirwest → Port Barthos → Hearth's Heart Dock journey, repeated World-time
rest checkpoints were followed by Foundry canvas rebuilds. Earlier rebuilds
recovered, but the final one left the native TokenDocument beyond the saved
confirmed Journal anchor. Atlas refused automatic continuation, then rejected
the shortened remaining route against the original unconfirmed distance.
No failed Journal write was observed. The rebuild source was not proven.

The owner approved separating active navigation/recovery state from the
readable Journal registry. Existing native JournalEntry flags **remain the only
authoritative persistent state**. There is no separate backend service or
second Scene/World record. Its generated JournalEntryPage is a read-only
presentation published on leg arrival or explicit journey finalization.

## Implemented in this draft

1. A state-store adapter writes validated Journey snapshots to the existing
   namespaced Journal flag. A separate writer updates only the Atlas-managed
   summary page. The existing `saveJourneyJournal` API is retained for old
   callers and schema-v1 Journey compatibility.
2. Incomplete progress, rests, recovery interrupts, and ordinary pauses now
   persist state **without rewriting** the managed summary page. A confirmed
   checkpoint arrival and explicit Completed/Ended status publish that page.
3. Normal guided native movement saves each verified chunk and its confirmed
   token anchor before starting another chunk. It waits for World-clock commit
   before crediting the chunk in the recovery record. A Journal failure stops
   onward movement; the code never silently credits or replays a move.
4. Continuous native vessel movement retains its previous pending-intent
   protocol and GM safety review where an in-flight step cannot be reconciled.

## Required GM v14 checks

- Back up the World and at least one recoverable beta.7.16.x Journey Journal.
- Start a land leg, select a mounted or hired method, advance through several
  native movement chunks. Confirm the token stays smooth and World time
  advances only for confirmed chunks. The Journal's **flag** should advance;
  its managed summary page should remain at the last publication until arrival.
- Trigger Long Rest, Short Rest or overnight camp mid-leg. Confirm the
  recovered day, rest history and World clock are correct but no incomplete
  directions/rest text appears on the managed page until the leg completes.
- Finish a leg at Port Barthos. Verify exactly one readable leg publication,
  correct transport, directions, rests, distance and final World time. Continue
  by a different eligible method and ensure the completed first leg remains
  unchanged while the next leg progresses.
- Pause manually during a leg: the Navigation UI must retain the paused
  decision; the Journal flag is recoverable; the page stays at the last
  published leg. On deliberate End Journey, the page publishes the confirmed
  partial history, not untraveled directions.
- Force a canvas rebuild **after** a completed native chunk or rest checkpoint:
  automatic recovery should proceed without another GM decision if token,
  Scene revision, Journal and World time still agree. Repeat **during** native
  movement: an ambiguous move must remain blocked with intact Journal, no
  guessed progress, no duplicate clock advance or movement.
- Reload and repeat the above using a Journey saved by beta.7.16.3.2. Its
  old metadata must remain readable with no write-on-read migration, missing
  original Point B, duplicate log, or unexpected reset.
- Temporarily disable unrelated modules and compare canvas refresh after
  rest/World-time changes. Re-enable separately to investigate `Stealthy` and
  `Gatherer` console entries without attributing the rebuild to either one.
- With a non-GM client connected, verify no access to private Journey flags,
  unauthorized movement or clock writes, player road/checkpoint/fog leakage,
  or change to native Regions, Levels, weather or Actor resources.

## Deliberately not changed / known limitations

- The JournalEntry **flag** still updates every verified native movement
  checkpoint, so third-party Journal update hooks can still fire even though
  the HTML page is not rewritten. This is necessary for durable recovery until
  another owner-approved state-store design proves safer.
- Native TokenDocument movement, World time and Journey Journal are different
  Foundry documents; there is no cross-document atomic transaction. Unclear
  in-flight native movement is not automatically credited and still requires
  GM review. The beta.7.16.2 continuous-vessel intent protocol is unchanged.
- No World/Scene/Journey schema upgrade, automatic Actor rest, booking, funds
  deduction, new vehicle behavior, Journal appearance redesign, or canvas
  rebuild interception.

## Automated validation gate

Passed locally: `npm run check` (**652/652 tests**),
`npm run architecture:check` (**0 cycles / 0 missing targets**),
JS/JSON syntax checks and `git diff --check`. Targeted Journal and
daily-controller tests cover the new milestone publication policy, failed
state writes, rest-triggered teardown and an unconfirmed native movement.
Automated success does not replace live GM/non-GM acceptance before merge.
