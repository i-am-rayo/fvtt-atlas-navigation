# Atlas Navigation v0.3.9-beta.8.50 — Active Journey controls

## Source and scope
Draft successor to beta.8.49 / PR #353, based on owner-tested native movement beta.8.45. No movement geometry, Regions, Worlds, Road graph, Actor rest, Token authority, native collision, or Journal recovery rewrites.

## Implemented
1. Fixed the stale Navigation controller range check that silently rejected planning visual speed above 8 seconds/hour. Full validated 0.5–30 seconds/hour is now used, including 20 seconds/hour native movement regression coverage.
2. Active Journey shows **Journey / Directions / Journey Speed** tabs. Planning retains Travel / Playback / Directions. Footer and GM-approved rest controls remain present.
3. Journey heading uses an authored Checkpoint only when the original saved Point B exactly aligns; otherwise a neutral destination. Remove redundant resume text, travel method line, boilerplate explanations, generic World-time hint, speed description and technical saved A→B targets from the ordinary GM Journey view. Preserve confirmed World-time number and real warnings.
4. Directions are displayed directly, without a second collapsible main panel. Nested optional terrain details remain. A vertical approximate progress track uses verified saved chunk distance, never animation-frame authority.
5. GM active Journey speed changes affect **only the next public Foundry v14 native TokenDocument.move**, never an in-flight chunk. The visual speed snapshot is persisted with the next confirmed Journey Journal checkpoint. Continuous native movement cannot be retimed mid-operation.
6. Explicit **Skip visual Journey** option is GM-only and confirmation-gated. It skips future visual animations and already-confirmed visual rest holds, while still calling native TokenDocument.move with movement constraints, verifying every endpoint, sequential World time, Journals and each GM rest decision. This is not teleportation, an automatic rest or a bypass of native Walls.
7. Optional post-Long Rest / Overnight Camp GM approval to issue a public ChatMessage to players. Chat is only offered after a durable rest event. When skipping with multiple expected rest stops, GM may consolidate **player-facing notifications only** at the end of the current leg. In-game rest choices, hours and World-clock events remain separate and authoritative.

## Tests
Run npm run check, npm run architecture:check, git diff --check, syntax and missing-import checks. Target regressions cover speed over 8 seconds before and during movement, next-chunk native animation, retained Walls, visual hold completion, active GM-only chat, three-tab keyboard navigation, exact destination naming and direction progress.

## Product owner Foundry v14 checklist
- Install in a backed-up Sandbox World. Confirm version and Scene Atlas/native Regions unchanged.
- In planning use 8, 12, 20 and 30 seconds/hour; verify real target slider changes and token animation responds (subject to existing 600-second movement cap).
- On a normal chunked Journey, adjust 2 to 20 seconds/hour during an active chunk; the current move must finish unchanged and the next chunk must animate slower. After the confirmed chunk, refresh/recover and confirm saved visual speed.
- Verify active Journey tabs, header, red-marked field removals, fixed footer, keyboard focus, and independently scrolling Directions without an outer disclosure. Check vertical progress across a Bridge, turn and Long Rest.
- Choose Skip visual Journey: each native move still completes, respects Walls/Regions, updates the confirmed Journal and World time exactly once, and stops for all needed GM rest decisions. Cancel skip; confirm later chunks animate again.
- After an approved Long Rest or Overnight Camp, choose whether to inform players in chat; verify no automatic Actor rest. When multiple rests are expected, choose consolidated chat: only player notices are combined, not gameplay rests.
- Test manually paused rest, refresh, long multi-leg transitions, native continuous vessel (skip/retime locked), fog/permissions and non-GM clients.
- Keep PR draft/unmerged until owner live acceptance. No main merge or final release.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.50-active-journey-controls/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.50-active-journey-controls.zip
