# v0.3.8-beta.7.13 — Navigation GM selection view extraction

Architecture-only build based on owner-accepted beta.7.12.1. The **Start from**
and main **Travel method** rows are now created by a presentation module,
`navigation-selection-view.js`. The controller still owns every availability
decision, route calculation, edit action, permission and gameplay write.

## Foundry v14 GM / non-GM live checklist

1. Back up the World; install beta.7.13 using the branch manifest, verify the
   version and reload both GM and player clients.
2. Open GM Navigation without an assigned party token. **Map Point A** should
   be selected; click A and B, then confirm the same preview and Travel button.
3. Assign the party explorer token manually, reopen Navigation and confirm
   **Party token location** is selected with **Refresh location** beside it.
   Move the token, refresh, and verify Point A updates without moving Point B
   or committing Journey history. Switch to Map Point A and back deliberately.
4. On a land-only route, confirm **Travel method** retains its Party and
   offered-checkpoint groups, names, order and current value. Selecting Walking,
   an owned Riding Horse or an eligible hired carriage should update the same
   previews and GM eligibility as beta.7.12.1.
5. The edit pencil should appear only for non-Walking selections; editing and
   saving a journey-only method should still update the preview. Check normal
   and disabled/busy control states during a confirmed Journey. No edit may
   be triggered simply by rendering the panel.
6. Travel across a checkpoint with a hired vessel and resume on land. Verify
   the existing checkpoint-specific method picker, recovered operation select,
   narrated transfers, Journey Journal, World-time accounting, rests and the
   completed-route Play suppression still behave identically.
7. Refresh the Canvas mid-journey and verify approved transport recovery still
   requires the appropriate GM confirmation. From the player client, confirm
   no new editing controls, leaked hidden metadata or changes to roads, fog,
   weather or native Regions.

## Automated verification

- Direct selector DOM tests prove grouping, label/ID pairs, selection values,
  edit visibility, disabled states and no callbacks during rendering.
- Existing controller, checkpoint transfer and completed-route regressions.
- Full Node suite, architecture graph, syntax and whitespace checks.

Keep the stacked PR draft until the owner confirms the Foundry v14 results.
