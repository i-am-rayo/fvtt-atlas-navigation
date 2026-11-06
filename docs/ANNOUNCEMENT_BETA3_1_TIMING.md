# v0.3.9-beta.3.1 — Atlas announcement timing hotfix

**Owner result from beta.3:** both GM and player saw live Journey banners. Their first animation needs refinement; rapid announcements should play one by one, five seconds each by default. The attached November 5 console log names `atlas-announcement-view.js:53` and `TypeError: Illegal invocation` in `setTimeoutFn`. Other visible warnings belong to Foundry or third-party integrations (for example CAT/MidiQOL) and are not grounds to change Atlas gameplay code.

## Focused fix

- Native browser `setTimeout` and `clearTimeout` are called with the original Window host context, rather than as methods bound to the renderer instance. The complete animation lifecycle and overlay removal can now finish.
- The renderer accepts **FIFO queued committed events** without dismissing a previous banner, with one active timer and five seconds per banner including a 550 ms fade-in and a 750 ms fade-out. The animation and timer share a duration CSS property; reduced-motion users see the same display duration without motion.
- The browser-local queue has a 64-pending-item safety limit. Excess items are rejected rather than growing memory without bound. This does not alter native gameplay or Journal state. GM-only Module Settings preview buttons still replace their previous sample immediately, and a rejected/cleared/stale callback cannot replay a banner.
- The existing GM authorization, public-safe World-setting pulse schema, non-GM generic names, Journal confirmation, anti-replay and native Canvas/Token/clock protections are unchanged. Checkpoint/Road discovered and break started/ended remain beta.4 **live trigger** work; beta.3.1 only ensures their eventual displays can queue.

## Foundry v14 test checklist

1. Join as active GM with a separate non-GM client; start a new Journey. Both should see **Journey started** and the banner should fade in, remain legible, fade out and disappear cleanly after ~5 seconds, without the prior `Illegal invocation`.
2. At a confirmed transfer checkpoint followed by another committed event, verify the second banner waits for the previous five-second slot. The GM sees the real checkpoint name; the player receives only the generic public-safe message.
3. Under GM Module Settings → **Atlas — Announcement Banner Samples**, click several types quickly. Preview remains immediate and local to the GM; it does not create a player queue or change Journal/World time.
4. While a live banner is visible, trigger a Canvas redraw/Scene swap or reconnect. No duplicate banner, stale replay, movement, fare, rest, World-time or Journal entries may appear.
5. Confirm reduced-motion mode displays readable static cards with normal five-second lifetime.
6. Inspect console logs. If an Atlas error still appears, capture the full stack; ignore unrelated third-party errors unless they reproduce a demonstrable Atlas failure.

**Test harness:** `node --test tests/atlas-announcement.test.mjs tests/atlas-announcement-commit.test.mjs tests/atlas-announcement-ready.test.mjs`, `npm run check`, `npm run architecture:check`, `node --check` changed JS modules and `git diff --check`. Live acceptance is still separate from automated pass.
