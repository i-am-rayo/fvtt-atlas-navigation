# v0.3.8-beta.6 — Checkpoint transportation transitions

Status: stacked draft, automated and live Foundry v14 acceptance pending.
Base: `test/v0.3.8-beta.4c.5`. Do not merge without owner approval.

## Scope

- Read-only `navigation-transport-transitions.js` interprets the **same** saved road
  graph and travel preset surfaces as ordinary Navigation (no duplicate route data).
- A route crossing land → water → land is split into three separately configured
  travel legs. A change of surface requires a named authored checkpoint at the
  shared road node. A geometric crossing is not a connected road or transfer.
- The GM chooses a Group-owned resource or a hire/passage offer **at that leg's
  departure checkpoint**. Only walking is defaulted, and only on land.
- Speed and hire/owned upkeep quotes call existing World/Group/Checkpoint
  transportation modules. Estimates show moving time, rest downtime and 5e
  currency; each leg's 8-hour operating day is calculated independently.
- Contextual narration derives port/road/vehicle names from the current Scene:
  arrivals, embarkation, hired caravans, disembarkation and onward walking.
- Guided travel is disabled on any route crossing surfaces, including walking
  across water. No transfers, payments, Scene changes, Actor writes, World time
  changes or Journey Journal writes occur during multi-leg planning.
- Land-only guided walking, existing single-method quotes and recoverable
  journeys remain unchanged. Transport-assisted movement is **beta.7**.

## GM acceptance checklist

1. In a copy of the test World, connect a land road to a waterway at an authored
   Port checkpoint, then connect the waterway to another land road at a second
   checkpoint. Assign land/water travel surface presets to their roads.
2. Attach a hired ship service to the first port and (optionally) a cart to a
   land checkpoint. Assign an owned suitable vessel/mount to the Group Actor.
3. Select a route covering all three road surfaces. Verify the Journey legs
   panel lists **land → water → land** and names the correct checkpoints/roads.
4. Verify land defaults to Walking and water requires an explicit selection.
   Choose hired passage; check that arrival, booking/embarkation, disembarkation,
   and return-to-walking narration appears.
5. Compare the water leg's speed, fare frequency, capacity/units and currency
   to the World preset and the port's local overrides. For owned transportation,
   confirm the Group roster and crew/upkeep estimates are used.
6. Remove the transfer checkpoint in a test copy and repeat. The planner must
   show a blocked transfer rather than permitting a magical mode change.
7. Verify the Travel Route button cannot move a token for mixed-surface or
   water-only Walking routes. Test a land-only Walking journey and ensure
   movement, pauses, clock, weather, explored areas and Journal behavior remain
   unchanged.
8. Test with GM and non-GM clients, then reload the Scene. A preview must not
   persist arbitrary selections or change currencies, World presets, checkpoint
   offers, Group Actor resources or Journal records.
9. Open a route using an unknown/dangling travel preset: no guessed surface or
   transfer, and no console crash.

## Deliberate limitations

This is a **planning** milestone, not confirmed boarding. Selection is transient,
not saved to a Journal, and no auto-transfer/teleport is performed. Multi-leg
operating days are independent previews; cross-leg rest carryover and automated
vehicle playback need the explicit beta.7 guided-travel design. The shortest
route still comes from the current authored road graph and cannot invent a
waterway between unconnected road nodes.
