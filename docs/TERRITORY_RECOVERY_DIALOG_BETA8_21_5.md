# Beta.8.21.5 — Native Territory recovery confirmation hotfix

Owner result after beta.8.21.4: the **Recover Native Territory Transfer**
inspection correctly reported Hearth's Heart 145 → 147, Neo Lustrum 38 → 40,
and Millstone 67 → 68 as **Already applied**. On clicking **Review Recovery**
for either available mode, Foundry raised `config.content must be <div> element`.

## Root cause

The initial DialogV2 `input` uses a valid HTMLDivElement. After the GM selects
Resume or Roll Back and presses Review, Atlas passed a plain `HTMLParagraphElement`
to the follow-up `DialogV2.confirm`. Foundry v14 requires a string or an
HTMLDivElement for dialog content. The new code retains the paragraph but wraps
it in an HTMLDivElement. Both routes share the corrected construction helper.

This is **UI-only**. It does not weaken recovery's read-only inspection or its
fresh snapshot, Scene grid, Region permission, geometry, and boundary-source
checks. No automatic write, rollback, or recovery-intent cleanup is introduced.

## GM acceptance checklist

1. Preserve a verified World backup and leave all three native Regions and the
   pending ledger untouched before installing this test build.
2. Open **Resume / Roll Back Transfer** in the Paedor Scene. Confirm all three
   Regions still report **Already applied** and expected counts.
3. Select **Resume**, then **Review Recovery**. A second **Confirm Territory
   Recovery** dialog should display without `config.content` errors. Choose
   **No** first; verify the ledger remains and no Region changed.
4. Repeat for **Roll Back**; choose **No** again. Nothing should be written.
5. If the backup is verified and the GM approves keeping the five planned
   additions, explicitly choose **Resume Native Transfer** on the second
   confirmation. Verify the ledger clears, counts remain 147/40/68, and Region
   IDs, Behaviors, levels and geography remain unchanged.
6. If any recovery inspection blocks or shows new differences, **stop** and
   send the log. Do not manually clear the ledger or repair native Shapes.

Native and Atlas fog visibility changes from beta.8.21.4 remain in this
stacked test build; perform GM/player fog checks separately after recovery.
