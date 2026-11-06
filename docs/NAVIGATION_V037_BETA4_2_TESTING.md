# Atlas v0.3.7-beta.4.2 — Selectable Debugging and Journey Interruption Hotfix

**Test build only.** Back up the Foundry v14 world. This draft is stacked on v0.3.7-beta.4.1 and must receive live owner approval before merging.

## What changed

- Five independent **Atlas Debug** categories are available in **Configure Settings → Module Settings → FVTT Atlas Navigation**: Journey, Token Movement, World Time, Exploration & Fog, and Scene & Windows. Set **Atlas Debug — Console Logging Level** to Info, Verbose, or Trace, then enable only the categories needed. All are **off by default**. Warnings and errors are always printed.
- Logging uses one reusable `atlas-debug.js` module; route/fog geometry, hidden map contents, Actor documents, and token identities are not dumped. Info records important journey transitions; Verbose adds confirmed token chunks and World time writes; Trace adds Scene and fog refresh diagnostics. Use the browser Console filter **`[fvtt-atlas-navigation]`**.
- If Foundry redraws the **whole canvas during a journey**, Atlas intentionally ends its reference to the old Token/Canvas instead of continuing movement on stale objects. The GM now receives a warning, and a lifecycle message identifies `canvasTearDown`/`canvasReady`, the Scene ID, and whether a journey was active. Reopen Navigation using the party token as Point A to calculate a fresh route. **Journeys are not yet resumable across a full canvas rebuild.**
- An unexpected exception during native token movement now produces an error log and a readable Navigation notice (if the panel survives), while the active session is released. Previously an exception outside the inner clock/break handlers could silently skip the final status.
- Normal Scene updates such as time-of-day, lighting or unrelated module flags no longer rebuild the Atlas **manual exploration mask**. The mask is still updated for Atlas exploration state, checkpoints, grid geometry and relevant manual fog changes. This targets the single dark frame captured at ~1.58 seconds in the owner's 30-second recording. Other modules' native vision/lighting redraws remain outside Atlas's control and need live verification.

## Suggested live diagnostics

1. On the backup world, enable **Debug Level: Verbose** and enable **Journey**, **Token Movement**, **World Time**, and **Scene & Windows**. Keep **Exploration & Fog** off initially. Open DevTools Console and filter for `[fvtt-atlas-navigation]`.
2. Start a 20+ moving-hour route from **Party token location**. Select Long Rest at 8h; keep moving past the next 2–3 hours. Record whether the panel remains open, if a canvas redraw occurs, whether a warning appears, and which event is last (`Native movement confirmed`, `World time advanced`, `canvasTearDown`, `Journey stopped`, or `Guided travel failed unexpectedly`).
3. Retry a second long route with **Debug Level: Trace** plus **Exploration & Fog**. Film a short clip of the known flicker area. Check whether **Exploration mask rebuilt** and **Scene updated** appear around the flash. Turning off World-time advancement temporarily is a useful comparison; do not change more than one setting at a time.
4. Confirm that Pause, Resume, End Journey, Long/Short Rest, Continue March, progress/ETA, and Foundry World time all behave as in beta.4.1. A blocked movement must not receive World time, and repeated Travel Route clicks must not launch multiple journeys.
5. Confirm a GM closing Navigation intentionally and switching Scenes does not produce a false *unexpected canvas redraw* warning. Confirm the fog overlay still updates when new cells or checkpoints are discovered, and that player visibility rules are preserved.
6. Return the Console filter contents and note any other Foundry modules reporting errors near the same time. Switch debug level back to **Off** after diagnosis; Verbose/Trace can generate substantial logs on long journeys.

## Observations and limits

The supplied console capture includes a full `Drawing game canvas for scene Paedor` sequence, and Atlas previously tore Navigation down on either `canvasTearDown` or `canvasReady`. **Why Foundry redrew that canvas is not established by the log.** An unrelated third-party `MidiQOL is not defined` error also appears, but it cannot be attributed to Atlas or the journey without further evidence.

The recording has at least one single-frame map darkening. The selective Atlas fog refresh is a targeted fix, **not proof that every dark flash is Atlas-generated**. If it persists in beta.4.2, the category trace will help determine whether a native vision/lighting module, Scene refresh, or Atlas fog mask update is responsible.

No Road, Checkpoint, Region, Actor or Atlas Scene schema migration is included. This build does not apply exhaustion or automatically recover Actor rest resources. A full canvas rebuild still safely aborts the active movement; later durable journey checkpoint/resumption requires its own design and test gate.
