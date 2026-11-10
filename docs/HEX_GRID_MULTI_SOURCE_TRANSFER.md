# Guarded Hex/Grid multi-source Territory transfer

This is the next reviewed slice after the owner accepted the read-only
**Review Shared Cells** inspector. The intended operation is **two to four
same-tier source Regions → one target Region**, not arbitrary many-to-many
geometry editing and not polygon editing.

## Preconditions

1. An authorized GM edits a linked native grid-shaped Territory on the active
   Scene with the same grid identity used at planning time.
2. Newly painted cells are already owned by between one and four other linked
   native grid-shaped Regions **of the same geographic tier**.
3. No added cell is owned by two different same-tier peers. Such a conflict
   must be resolved separately; the transfer does not guess an owner.
4. Every source retains at least one cell; at most 500 peer-owned cells move.
   Existing geography, parent containment, native geometry, permissions and
   Scene revision checks remain in force. Recovery intent size is at most 1 MB.
5. No prior unfinished native cell transfer is awaiting recovery.

## Write sequence and failure behavior

After both GM confirmations, Atlas recomputes and checks the exact plan; a
change to any involved native Region fails closed **before** a write. Then:

1. Persist the complete ordered **before/after Region snapshots** as a Scene
   recovery intent. Existing two-Region records remain schema v1; multi-source
   intents use schema v2 with unique `sourceIds` and a single `targetId`.
2. Read back the persisted intent. Verify all current Region states and the
   hypothetical final native geometry as one coherent multi-Region plan.
3. Remove transferred cell ownership from each source Region, one document at
   a time. The target is **always updated last**. Do not mutate native Region
   Behaviors, colors, names, Levels or Region IDs.
4. Remove the recovery intent only after every native update succeeds.
   If any document update or final cleanup fails, leave the intent intact.
5. Workspace recovery requires an explicit GM **Resume** or **Roll Back**.
   Validate every affected Region against its saved before/after state and
   block recovery on third-party edits. Rollback reverses write order, first
   restoring target ownership, then each source.

Foundry native Region membership/Behaviors may observe intermediate geometry
during a multi-document operation. The intent provides **recoverability, not a
database-atomic transaction**. Test in a backed-up World and do not treat the
operation as safe to auto-replay on a second client or canvas rebuild.

## Explicitly deferred

- Many-to-many transfer destinations, empty-source deletion or Region split.
- Post-commit undo history (a new reviewed reverse transfer or backup is
  required after the recovery intent has been cleared).
- Automatic failure rollback/replay without GM confirmation.
- Polygon-to-polygon transfer, paired polygon edges, mixed native shape types.
- Player-owned editing or automatic public Territory geometry disclosure.

## Acceptance evidence needed

- Existing v1 single-source transfer and interrupted recovery still work.
- Two source Regions are updated before target; an injected failure after the
  first source leaves a usable v2 recovery intent.
- Both explicit Resume and Roll Back succeed; unexpected native edits block
  recovery and never silently remove the intent.
- Duplicate peer cell claims, empty source Regions, more than four sources,
  stale native geometry and malformed recovery intents fail closed.
- Live Foundry v14 GM and separate player sessions with square and hex grids;
  validate Regions, Behaviors, Token position, Fog, Road graph, Journals and
  World time before and after the transfer.

GitHub tracking: #265 (multi-source transfer), #264 (accepted read-only
inspector foundation) and #271 (complete implementation-order roadmap).
