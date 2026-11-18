# v0.3.9-beta.8.31.1 — Checkpoint and Territory canvas Journal status

This targeted stacked hotfix extends beta.8.31's Journal access indicator from
the GM Territory directory to the **on-map names** of both Checkpoints and
their associated native Territories. No Journal or Region data is copied or
modified. The existing Foundry Journal Entry/Page remains the only permission
authority, and the earlier directory indicator remains intact.

| Canvas label | GM | Player |
| --- | --- | --- |
| Checkpoint hover/always name | `Dirwest 📖 ✓` / `📖 ◐` / `📖 🔒` / `📖 —` | `Dirwest 📖` only if this player has Observer permission |
| Linked Territory name | Same four GM statuses next to name | Plain `📖` only if this player has Observer permission **and** can see the Territory and Checkpoint |
| No valid link, missing Journal, insufficient permission | No glyph | No glyph |

## Acceptance checklist (Foundry v14 — GM + two player accounts)

1. Create/link a native Journal Entry or Page to a named Checkpoint and associate
   a public, shared native Territory with that Checkpoint. Enable the appropriate
   Atlas Checkpoint and Territory layers. Keep both canvas labels in view, or
   hover the Checkpoint if its label mode is Hover.
2. With all configured non-GM players at **Observer**, verify both name labels
   show `📖 ✓` to the GM. With some at Observer, verify `📖 ◐` on both; with
   none, `📖 🔒`. With no non-GM accounts configured, verify `📖 —`.
3. Verify the linked Territory directory retains its status and the native
   Journal opens from its existing action. Confirm a Territory's on-map name
   uses the linked Checkpoint's Journal rather than creating a second link.
4. As a player with Observer, verify a plain `📖` beside both eligible labels.
   As a player without Observer, verify neither label advertises the Journal.
   No player should see the GM's `✓`/`◐`/`🔒`/`—` breakdown.
5. Hide the Territory under native fog and then Atlas manual fog. Verify neither
   the Territory outline nor the text/Journal glyph leaks through. Revoke
   player sharing, public Territory name, or Checkpoint discovery and verify
   the withdrawn label/glyph does not reappear.
6. Remove the Journal link or delete the Journal; verify its status disappears.
   Reopen/refresh the canvas after changing permissions (the local lookup cache
   refreshes within approximately 15 seconds).
7. Switch scenes or close/reopen the Atlas overlay during a slow Journal lookup;
   verify an old label is never updated or reopened. Confirm normal Checkpoint
   icon hover, road subtitle, Territory label double-click and Journal opening.
8. Confirm native Journal ownership, Region Shapes/Behaviors, Fog Exploration,
   checkpoint discovery, player access, travel, and World/Scene flags remain
   unchanged by simply viewing the status.

Automated coverage: `tests/overlay-journal-label.test.mjs`,
`tests/road-canvas.test.mjs`, `tests/territory-view-overlay.test.mjs`.

**Release gate:** this is a stacked draft against beta.8.31. The owner must
confirm the GM/player Foundry v14 acceptance matrix before merging or closing
the tracking issue (#291).
