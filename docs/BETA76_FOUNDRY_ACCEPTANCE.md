# v0.3.8-beta.7.6 — fog architecture acceptance

**Status:** installable *draft test branch*, not merged into main. Back up your
Foundry v14 World before testing. The only runtime refactor extracts Scene fog
flag readers to a read-only module, breaking the last storage import cycle.
No fog flags, saved exploration history, road coordinates, or migration behavior
are intentionally changed.

**Install:** use the `manifest` URL from this branch's `module.json`. Check the
module version reads `0.3.8-beta.7.6`. Reload both GM and non-GM clients.

## GM and player exploration regressions

- [ ] Open a Scene with previously explored terrain. Both clients show the
      same explored areas that were visible before installing beta.7.6.
- [ ] Move the designated party explorer token over unexplored terrain.
      New survey areas persist after moving away, reloading the player, and
      returning to the Scene.
- [ ] Check manual GM Reveal/Hide actions in any Scene that already uses them.
      The resulting visibility persists on player reload and does not expose
      the entire Scene.
- [ ] Visit or reveal a checkpoint, and verify its player visibility remains
      independent of the road's known/lore/visited settings.
- [ ] Confirm native weather, lighting, and other Scene effects still render.
- [ ] Open a Scene saved under older Atlas map-fog settings. Confirm a prior
      enabled fog setting does *not* unexpectedly reveal its entire map.

## Road Editor carry-forward from beta.7.5.2

- [ ] While editing an existing road, **Locate Road** pans, zooms, and pulses
      the *unsaved* working road. Editor stays open; Save Points/Undo/Cancel
      are unaffected.
- [ ] A draft new road can be located without saving it, and cancelling the
      draft leaves no new road behind.

**Stop and report:** if exploration disappears, player-visible terrain suddenly
expands, road coordinates shift, or any prior Scene data changes unexpectedly,
avoid saving further edits and share both GM and player observations.

The World CLI helper warning and unrelated third-party module warnings are not
by themselves evidence of a regression in the Atlas fog readers.
