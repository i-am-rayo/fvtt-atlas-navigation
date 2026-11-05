# v0.3.9-beta.1 — Journey Journal Visual Presentation

**Status:** stacked draft; automated checks and owner Foundry v14 GM/non-GM acceptance required. Builds on `fix/v0.3.8-beta.7.26.1-checkpoint-boundary`, not a public release.

## Decision and scope

This beta is the first presentation-only slice of Stage B. The native Foundry `JournalEntryPage` retains the generated Atlas summary, while a separate module-scoped stylesheet provides an original Atlas visual design:

- Static decorative Journey header/banner with status badge and confirmed World departure/arrival times.
- Three at-a-glance figures: confirmed moving, confirmed downtime, elapsed time.
- Clearly separated leg cards, confirmed progress bars, transportation/transfer notes, directions and highlighted rest events.
- Responsive card layout, safe text escaping, meaningful headings, native Journal scrolling and print styling.

**Intentionally unchanged:** Journey Journal flag/schema, saved route and checkpoint targets, token positions, canvas redraw handling, World time, transport methods, fares, Actor rests, fog, Scene/Region documents, native Journal permissions, personal-note pages, and Navigation window gameplay or layout. The Journal renderer is pure; CSS is confined to `.atlas-journey-journal`.

**Existing pages:** Old generated summary pages remain as-is until the normal authorized Journal summary publication. No automatic migration, write-on-read or bulk rewriting of owner history.

**Not included in this beta:** animated full-screen/overlay arrival announcements or checkpoint-focus camera effects. Product Owner clarified they want a custom *yourTurn*-inspired on-screen arrival banner **instead of a native Foundry toast**. This is tracked separately in [feature #226](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/226) for a focused beta.2; [#191](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/191) covers Lore-reveal camera panning. Neither should copy third-party proprietary assets or bind to rendering callbacks that might replay an arrival after a canvas rebuild.

## GM live acceptance (Foundry v14)

1. Install the beta branch using the exact manifest URL in `module.json`, then start a **new** Journey. Open the generated native Journey Journal page. Confirm banner, labels, status, time cards and leg layout render without corrupting the core Journal editor or window.
2. Complete a route with multiple legs, a rest, and a transportation transfer. At each normal summary publication, review the confirmed-only directions, transfer entries, progress and status. Arrived World time must appear only on a completed Journey.
3. Trigger a canvas redraw mid-leg and resume through a checkpoint. Observe a single saved recovery history, correct confirmed progress, and no additional World time, fare or rest; the banner **must not** cause actions.
4. Open a pre-beta Journey Journal. It remains unchanged until its next normal, authorized summary sync. Other pages for personal notes must remain untouched.
5. Inspect with light and dark themes, narrow window, long checkpoint names, and screen reader/keyboard navigation. Progress should be understandable without color. Print or export if used.

## Non-GM live acceptance (Foundry v14)

1. Verify default Journal ownership remains GM-only; non-GM access must not change because of the CSS or markup.
2. If a GM has explicitly shared a Journey Journal via native Foundry permissions, the generated summary should render identically in a non-GM client, without exposing unconfirmed steps or GM-only Atlas metadata.
3. Confirm no native Foundry banners, canvas camera movement, token changes, notifications or automatic journey approval are triggered by simply viewing a Journal page.

## Automated checks

Run `npm run check`, `npm run architecture:check`, `git diff --check` and JS syntax checks. Regression assertions cover banner/status structure, CSS packaging, escaped user titles, confirmed-only timeline, zero-percent and completed statuses, and unchanged recovery metadata. Automated checks do not substitute for actual Foundry v14 Journal editor/renderer acceptance.
