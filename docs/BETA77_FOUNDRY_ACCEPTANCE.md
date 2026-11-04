# v0.3.8-beta.7.7 — full-suite regression stabilization

**Status:** installable *draft test build*, stacked on the owner-accepted
beta.7.6 architecture branch. No module runtime JavaScript, Scene/Actor/Journal
flags, stored coordinates, or travel rules changed in this slice. All code
changes are to Node regression assertions and architecture documentation.

**Install:** use this branch's `module.json` `manifest` URL. Confirm the version
is `0.3.8-beta.7.7`, then refresh GM and player clients as appropriate.

## Engineering gate

- `npm run check`: syntax checks and **556 passing tests**, 0 failures.
- `npm run architecture:check`: no missing imports or cycles.
- Fixed six old test expectations: accessible Pause and Overnight Camp buttons,
  checkpoint continuation wording, and the rule that a checkpoint-bound
  travel leg cannot silently change the saved Journey destination.
- These are test-expectation corrections, not changes to Journey runtime.

## Short live Foundry v14 regression check

- [ ] Road Editor **Locate Road** pans/zooms/highlights an existing unsaved road
      without minimizing or saving the editor.
- [ ] A Journey can pause, resume, and show an accessible Overnight Camp action
      at the daily travel limit; time advances only after GM confirmation.
- [ ] At a checkpoint, a new leg retains the original Journey destination
      until the GM explicitly chooses another destination.
- [ ] A player still sees previously explored terrain after moving, reloading,
      and switching Scenes. Roads, checkpoints, and weather remain unchanged.

**Stop and report** if any prior confirmed Journey moves a token without GM
approval, advances World time twice, loses saved data, or unexpectedly reveals
the map. Do not merge stacked draft PRs without explicit owner approval.
