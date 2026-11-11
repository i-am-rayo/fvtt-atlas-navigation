# Checkpoints Workspace — focused GM test (draft, 2026-11-11)

This change adds a Checkpoints Workspace section and a GM-confirmed standalone placement workflow. It does **not** yet claim complete Road connect/disconnect, full parity, or native Foundry live acceptance. The historical Scene → Atlas Checkpoints panel remains available until owner acceptance.

## Owner test in Foundry v14 (backed-up World)

1. Open Atlas Workspace → Checkpoints on Paedor. Confirm existing 38 Checkpoints appear, retain names, map Locate, editors, Journal links, player visibility/discovery and reveal-radius controls. Check the legacy Scene → Atlas panel still functions.
2. Click **+ Independent Checkpoint**, then click a free point on the Scene canvas. A name/elevation confirmation must appear. Cancel must leave Scene flags unchanged; Escape before confirmation must remove the placement listener.
3. Confirm a test Checkpoint. It should appear on GM canvas and Workspace list, with no synthetic Road or native Region; Atlas revision increases exactly once. Its marker should be hidden from a separate player client by default unless explicitly published or discovered.
4. Edit its name and elevation; locate it; optionally link a Journal via existing Checkpoint Settings. Reload the Scene and reconnect the player client. Identity, position, Journal references and permission settings must survive.
5. Start placement and change Scene or Atlas revision before confirmation. The stale action must stop without creating a Checkpoint in the wrong Scene. Repeat with a non-GM client: no Workspace access and no Scene write.
6. Confirm old Road-bound Checkpoint creation still works. Check that existing Roads, Territories, native Region Shapes/Behaviors, Fog, Journey state, Actor data and World time are unchanged.

## Known limits / next slice

- Independent Checkpoints are not routable until a Road actually connects to their Node. Physical graph attach/detach workflow is not implemented by this PR.
- The first Workspace slice reuses existing save/actions and keeps the legacy panel; polish and full control-by-control parity await live testing.
- Migration from v9 with two different Checkpoint IDs sharing one Node is explicitly blocked. The GM must reconcile those identities in a later reviewed tool.
- No release manifest/version/archive changes: this is a **draft implementation PR**, not an authorized build.
