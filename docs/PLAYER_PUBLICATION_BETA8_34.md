# Player Atlas Layers — Stage 2A (beta.8.34)

Draft stacked on beta.8.33.2; do not merge without owner Foundry v14 acceptance.

## What to test in two clients

1. GM opens **Atlas Layers → Player Publication**. Confirm the searchable linked-Territory roster distinguishes **Boundary: Private/Shared** from **Journey name: Private/Public**. Existing Region geometry must default to Private unless previously shared explicitly.
2. Choose a classified Hex/Grid Territory with a **public Journey name but private boundary**. Confirm that the player receives no Atlas geometry simply because its name is public.
3. Click **Share Boundary**, review the confirmation, and approve. In the separate non-GM client, choose each Region display mode and confirm that only the explicitly shared geometry appears, under existing Fog/exploration constraints. Toggle local display preferences and verify the GM's preferences are unchanged.
4. Reopen the GM overview and **Revoke Boundary**. Confirm it disappears in the player client without resetting local toggles. Reconnect the player and switch Scenes; it must remain absent.
5. Try nested/overlapping Territories, a native-hidden Region, an unclassified linked Region, and an account without GM permissions. Check that the non-GM palette exposes no publication roster or authoring controls.
6. Confirm that existing Roads, Checkpoint labels, hover overlay order, native Region Shapes/Behaviors, Journeys and Journals remain unchanged.

## Privacy boundary

The Atlas player overlay filters to explicitly published Territory records and uses separately opted-in public names. This is **not a claim of native Foundry Region data secrecy**: player clients may receive native Region documents outside Atlas's projection. Review player client data as well as on-canvas behavior before deciding whether the privacy requirement in #269 has been met. Publication/revocation changes one Atlas Region permission flag through the existing revision-checked, separately confirmed GM writer.

## Remaining Stage 2

- Live permitted/non-permitted player verification, including data exposure and reconnect/revocation.
- GM as-player preview (#198), with no widening of underlying access.
- Do not close #269 or mark roadmap #271 Stage 2 complete on automated tests alone.
