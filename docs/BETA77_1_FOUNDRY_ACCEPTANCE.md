# v0.3.8-beta.7.7.1 — Journey continuity hotfix

This patch is stacked on beta.7.7 and must remain a draft until GM and non-GM
Foundry v14 testing confirms it. Do not merge or overwrite existing Journals.

## GM acceptance

1. Back up the World. Install this branch's `module.json` manifest, verify
   `0.3.8-beta.7.7.1`, and reload GM and player clients.
2. Select an owned Riding Horse and begin a long approved guided route. After
   travel is journaled, cause a normal canvas refresh. The saved Riding Horse
   must remain selected during recovery; continuation must not silently switch
   to Walking. Confirm whether a GM confirmation dialog is presented when
   required; if eligibility genuinely changed, travel must stop with an
   explicit reason before any additional movement or World time.
3. Pause and resume the riding journey; compare actual confirmed time and
   distance with the Journal. Previously recorded legs must remain intact.
4. Reach Port Barthos by ship and explicitly choose Continue. Deliberately set
   Point B close enough to make the next proposed water leg terminate again at
   Port Barthos. The next leg must be disabled with an explanation. Atlas must
   not book another ship, move the token, increase a fare, or append a short
   duplicate Journal leg.
5. Choose a genuinely different checkpoint / valid onward land destination;
   travel must remain possible. A separately selected destination 20% of one
   grid cell beyond the dock must **not** be auto-completed as Port Barthos.
6. Test the same saved Journal after reloading both clients. Verify no new
   console errors attributed to Atlas, checkpoint visibility regression, or
   map weather/fog changes.

The Journey Journal and Scene/Token flags are never rewritten just to display
the corrected selection or checkpoint warning.
