# v0.3.9-beta.7 — Player-safe destination banners

Status: **draft test build; Foundry VTT v14 GM/non-GM live acceptance pending.** The owner accepted beta.6 visual rest playback. Beta.7 adds a strictly display-only checkpoint name projection to Journey Started and Destination Reached banners.

## Expected wording

| Saved original destination / player knowledge | Journey Started | Destination Reached |
| --- | --- | --- |
| At visible checkpoint `Dirwest` | The road ahead leads to Dirwest | Welcome to Dirwest |
| At visible checkpoint `Dirwest Northern Bridge` | The road ahead leads to Dirwest Northern Bridge | Welcome to Dirwest Northern Bridge |
| Mid-road Point B, no checkpoint at destination | The road ahead leads to your destination | You have reached your destination |
| Hidden / unknown checkpoint at Point B | The road ahead leads to your destination | You have reached your destination |
| Multiple checkpoints at the same Point B without an approved final checkpoint target | The road ahead leads to your destination | You have reached your destination |

A checkpoint counts as visible only when the existing player-safe Scene Atlas projection exposes it: the legacy **Show to players** flag when party exploration is disabled, or the party's **Known through Lore / Seen/Visited** discovery status when exploration is enabled. The checkpoint must be located on the saved original Point B (with a small icon-click tolerance), not merely the closest place along the road. A saved, matching final route target may resolve overlapping checkpoint nodes.

## Owner live acceptance — Foundry v14

1. Install the beta.7 branch manifest in both GM and non-GM clients; reload both clients. In Atlas, place a known/visible named city checkpoint at Point B. Start a fresh guided Journey. Verify both clients display **The road ahead leads to [city]**; after verified arrival, both display **Welcome to [city]**.
2. Repeat with a **Bridge** checkpoint that players know. Confirm no wrong city, road or nearby checkpoint is chosen.
3. Move Point B to the middle of the road, outside any checkpoint's click tolerance, but near one. Confirm both clients use the generic fallback. Try a hidden/unknown checkpoint at Point B: no hidden name should appear in the banner, World setting, or console public pulse. For exploration-enabled Scenes, test both Lore and Seen/Visited knowledge.
4. Place overlapping visible checkpoints at one point. Confirm the generic fallback without an explicitly saved checkpoint target and the correct named destination when the approved final target identifies one.
5. Start/reach events still queue for **five seconds each** (or the configured existing duration). Trigger additional saved rest/pause/discovery events; verify they remain generic and FIFO. Reload or reconnect a player: saved pulses must **not** replay. The previous version-1 generic pulse format must remain readable.
6. Exercise the beta.6 **8-hour Long Rest visual hold**, canvas refresh / GM-awaiting workflow, World time, Journey Journal and final TokenDocument position. Verify display names never cause an extra movement, rest, fare, World time or Journal mutation. Repeat with a disconnected/unauthorized GM and with no player permissions.

## Authority and implementation boundaries

- The active GM alone projects a banner after verifying the saved Journey Journal receipt and matching Scene, stored Point B and route revision. The read-only resolver re-reads the current Scene and party exploration state and checks the existing player overlay visibility projection. It never guesses using a road label or nearest checkpoint.
- A version-2 World-setting pulse permits at most one bounded, validated `publicSubject`, and **only** for `journey.started` / `destination.reached`. It carries no Scene ID, checkpoint ID, road metadata, Journey Journal, Actor or hidden state. Schema-1 generic messages remain readable for compatibility.
- Rendering is best-effort and cannot approve movement. A missing/damaged Scene, stale Journal, ambiguous checkpoint or read error yields the generic text. The current non-GM player projection is a visual display boundary, not a confidentiality guarantee for raw Foundry Scene flags.
- No new native Region, Scene, Token, Actor, Journal or World settings schema, data migration, canvas rebuild hook or rest transaction is introduced.

## Deferred implementation backlog

Tracked in [GitHub #233](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/233) and [roadmap](ROADMAP.md):

- **Region destination fallback:** when no eligible checkpoint is on Point B, derive a known territory from authorized native Region data and elevation, without exposing private GM-authored labels.
- **Border crossing banners:** after confirmed movement crosses an authored Region edge, enqueue “Leaving Valecor / entering Reshara” using deduplicated, saved-transition-safe evidence; never infer from visual-only animation frames. The event order must not misidentify the final destination.
- **Theme selection:** system-neutral, accessible appearance presets shared by cinematic banners and generated Journal summaries. Keep saved Journey content independent of its visual theme.
- **Optional rest services:** Inn/Rest-area checkpoint designation and Camping setup/teardown time; separate approved gameplay rest and World-time policy from the already implemented stationary visual pause.

These are explicitly **not implemented** by beta.7. The Product Owner will choose sequencing after the beta.7 GM/player live results.
