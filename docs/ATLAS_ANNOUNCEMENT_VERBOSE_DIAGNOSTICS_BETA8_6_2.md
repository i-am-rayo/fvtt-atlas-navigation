# beta.8.6.2 — Banner name diagnostics in Atlas Debug → Verbose

## Why this slice exists

The Foundry v14 owner retested beta.8.6.1 with the public **Valecor** continent
and child **Hearth's Heart** town. The actual start/arrival banners continued to
say **“your destination.”** The former “Recent banner decisions” section in
Announcement Banner Samples reported the original caller subject rather than
the final name handed to the banner, so it could not reveal the failed gate.

This slice **instruments the existing decision**, without modifying the
checkpoint or native Region selection policy or weakening authorization.

## Behavior

- **Atlas — Announcement Banner Samples** now shows only local preview buttons.
  It no longer stores or renders discovery/journey diagnostic history.
- **Atlas Debug — Console Logging Level: Verbose** emits GM-only
  `[fvtt-atlas-navigation][announcement] Journey banner name resolution` for
  each Journal-verified `journey.started` / `destination.reached` event.
- The structured record distinguishes `requestedSubject`, `finalResolvedName`,
  `source` (`public-checkpoint`, `public-territory`, `generic-fallback`, or
  `caller` when no Scene was supplied), and `reason`. For a tested native Region
  fallback, `publishedTerritoryCount` and `containingPublicTerritoryCount`
  further distinguish absent/overlapping/outside Regions.
- Read-only native containment checks still use Foundry v14 RegionDocument
  `testPoint`; unknown elevation, invalid Point B, canvas mismatch, overlap,
  or permission/receipt inconsistencies still fail closed.
- The existing discovery status and delivery decisions now go directly to
  Verbose logs; no duplicate in-memory diagnostic history remains.
- The name that reaches the World announcement pulse still must pass the
  existing player-safe public-label rules. GM-only console records can include
  the caller's requested subject; they never enumerate private native Region
  names, document IDs, coordinates, or Journal contents. No new information is
  shared with player clients or written to Scene/Token/Region/Actor documents.

## Verification / owner's Foundry v14 checklist

1. Install the branch manifest and reload Foundry as a **GM**. Open
   **Module Settings → Atlas Debug — Console Logging Level**; select
   **Verbose**. Also enable the browser DevTools **Verbose** console level,
   since browser consoles can hide `console.debug`.
2. Open **Atlas — Announcement Banner Samples**. Confirm preview buttons still
   work and **Recent banner decisions** / its refresh button are gone.
3. Repeat the owner scenario with public **Valecor (Continent)** and
   **Hearth's Heart (Town)**, both linked. Start and complete a new Journey
   whose saved Point B is within the town. Capture both console records whose
   prefix contains `Journey banner name resolution`.
4. Note `finalResolvedName`, `source`, `reason`, and containing/published counts
   separately for start and arrival. A `generic-fallback` diagnosis identifies
   the gate for a focused follow-up fix. Do not declare the naming bug solved
   just because the diagnostic build loads successfully.
5. Check GM and non-GM clients: the player should see the same public-safe
   banner name, but **never** GM-only debug records or private Region labels.
6. Recheck canvas redraw, Scene switch, resumed Journey, World time, Journal
   history, and native Region geometry/elevation/Behaviors: this slice must not
   alter any of those authorities or introduce duplicate announcements.

## Results and exclusions

- Focused automated checks cover accurate resolved name, source, fail-closed
  reason, Verbose/Off and non-GM logging gates, unchanged player pulse payloads,
  Region overlap/elevation/Point B, and preview-only UI.
- A passing automated suite is **not** owner GM/non-GM Foundry acceptance.
- No change to naming precedence, journey commits, Regions, travel geometry,
  Scene data schemas, or gameplay side effects; no migration is required.
- beta.8.6.1's persistent generic-name symptom remains open pending the new
  live `reason` evidence. Do not guess its cause from the former status panel.
