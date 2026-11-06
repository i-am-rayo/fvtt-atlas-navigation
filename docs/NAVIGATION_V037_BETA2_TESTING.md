# v0.3.7-beta.2 — Guided Travel animation and rules-profile test gate

Stacked on the owner-tested beta.1.1 Navigation improvements. Install in a backed-up Foundry v14 world and test with a GM and a separate player view before merging.

## World Settings

1. Open **Configure Settings → Module Settings → Atlas Guided Travel Animation Speed**. It is a native Foundry slider, measured in **real seconds per game travel hour**. Default 2; values range 0.5 (fastest) to 8 (slowest). Save and reopen World Settings to confirm persistence.
2. Set **Atlas Travel Rules Profile** to **Use current game system**, **D&D 5e — 2014**, **D&D 5e — 2024 / 5.5e**, and **Custom** in turn. Confirm the selected value persists. This is a forward-compatible rules selection only; custom rest parameters, character effects and World clock updates are not implemented in this beta.

## Navigation and movement

1. Assign a placed party explorer token and open a route using **Party token location → B**. In Navigation, confirm the new **Token playback** estimate appears below party speed and is distinguishable from *Travel time*. The estimated travel duration still respects the Group Actor's travel pace and terrain-weighted route cost.
2. Set slider to **0.5** and travel a short route. Return token to the start; set slider to **8** and repeat the same route. The 8 setting must visibly move more slowly while both traversals follow the same rendered curved road and end at the same place.
3. Compare a slow versus fast Group Actor pace on the same route and slider value. A faster party should traverse visually faster. For a long route, the estimate is bounded between 2 seconds and 10 minutes; it is *not* one real-world hour per game hour.
4. Stop an animated journey midway and confirm the token remains where Foundry stopped it. Recalculate from its current Scene location and repeat. Test manually selected A/B routes, the Scene Grid scale, multiple terrain costs, curves (Off/Gentle/Moderate/Strong), and a disconnected road.
5. Confirm World time does **not** advance yet, no short/long-rest prompts appear, no exhaustion or resources are applied, and existing Region Behaviors, Fog, maps, Actor stats, and non-GM permissions are unaffected.

Automated tests: `npm run check`. Real Foundry native TokenDocument movement and animation speed still require GM verification; this draft should remain unmerged until sign-off.
