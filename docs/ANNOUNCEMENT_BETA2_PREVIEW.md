# v0.3.9-beta.2 — Reusable Atlas Announcement Preview

**Status:** focused GM-local presentation test build; Foundry v14 GM acceptance pending. No multiplayer delivery or gameplay triggers are enabled.

## Purpose

The owner accepted `v0.3.9-beta.1` Journey Journal formatting and requested an original, animated banner language inspired by the *yourTurn* concept. Do not copy that module's CSS, art or assets. The second beta establishes a **pure event catalog**, **DOM-only preview renderer**, and **GM-only Module Settings preview menu**. The banners are transient visual effects, not native Foundry notifications.

## Try it in Foundry v14

1. Install this branch using the `module.json` manifest URL and enable the module as GM.
2. Open **Game Settings → Configure Settings → Module Settings → FVTT Atlas Navigation**.
3. Select **Atlas — Announcement Banner Samples → Preview Journey & Discovery Banners**.
4. Preview each sample: Checkpoint discovered, Road discovered, Checkpoint reached, Destination reached, Journey started, Journey ended, Break started, Break ended and Journey paused. The banner should appear at the top of your **own** client for about 4.5 seconds. Selecting another replaces the old sample without stacking multiple banners.
5. Verify it does not alter token coordinates, Journey Journal data, World time, Scene/Region flags, discovery knowledge, currency, rests, or player clients.
6. Test wide and narrow windows; light and dark Foundry themes; keyboard tab/focus in the settings menu; reduced-motion OS/browser preference (announcement remains legible, with entrance/exit motion disabled).
7. Confirm non-GM users cannot open the restricted preview menu, and direct invocation of the settings UI has a second GM guard.
8. Close the preview window while a sample is visible; its DOM and timer should clean up.

## Architecture

`atlas-announcement-model.js` contains presentation templates and validates safe sample strings with **no** Foundry dependency. `atlas-announcement-view.js` owns one local DOM layer and bounded timer, never touching canvas or persistent documents. `atlas-announcement-settings.js` registers a native restricted `ApplicationV2` menu, providing sample controls only. `atlas-announcements.css` is namespaced and honors reduced-motion settings.

The sample *event names* are preparatory; no claim that an event occurred in the game is made by the preview. In particular, `checkpoint.arrived` is different from `checkpoint.discovered`, and deliberate `journey.ended` differs from successful `destination.reached`.

## Future milestones / non-goals

- **beta.3:** GM-authorized Journey producers and player-safe delivery **only after** validating native TokenDocument and Journal state transitions; never emit from Canvas redraw, render, UI preview or uncommitted native movement. Event IDs must prevent repeated banners across reload, reconnect and other GMs.
- **beta.4:** Rest/break event timing and confirmed Checkpoint/Road discovery events. Road visibility versus actual discovery must be resolved by the Product Owner before data changes.
- No bundled video/image, no additional dependencies, no native Foundry notification hook overrides, no socket events, no camera movement, no Actor rest execution, no migration, and no changes to gameplay/Journey schemas in this beta.

See [umbrella #228](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/228) and [arrival #226](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/226).

## Automated acceptance

Run `npm run check`, `npm run architecture:check`, `node --check scripts/atlas-announcement-settings.js` and `git diff --check`; inspect tests for safe templates, no HTML injection, one reused overlay, timer cleanup, preview-only settings and manifest wiring. Automated checks do not replace a Foundry v14 GM/non-GM manual visual test.
