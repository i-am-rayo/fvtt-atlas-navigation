# Atlas dev.24 — independent native path normalization

## Evidence and scope

Dev.23 owner live failure: expected (3891,1748) → (3963,1769), native intermediate (3896,1782), snapped:true, intermediate:true, explicit:false, checkpoint:false, correct operation ID and unconstrained. Two ship intervals had already confirmed 28,837 seconds. Repeated recovery safely restored the remaining route but re-submitted the same rejected interval. Dev.22 fixture: (3763,1675) → (3816,1716) → (3823,1720), intermediate (3798,1697). Red CI 45040243432 reproduced both missing preview handoff and recovery validation regression; integration CI 45040345944 passed 1235 tests before additional controller coverage. API: https://foundryvtt.com/api/v14/classes/foundry.documents.TokenDocument.html#getCompleteMovementPath. The actual host expansion remains to be validated; test doubles are not a Foundry acceptance test.

## Owner acceptance (v14.370)

1. Back up the World; install dev.24 after final CI green. Retain the current saved journey. Do not use Forget Saved Journey or move the token manually.
2. Open Review Saved Journey. The pending unexecuted interval should have unchanged start coordinates and unchanged World time. Recover Saved Journey, then use the normal Travel/Play action if the recovered plan is paused. Verify original ship method, remaining leg, party and final destination stay unchanged.
3. With verbose logging enabled, inspect normalizedNativePath in intent/mismatch logs. The captured interval should include the independent native waypoint (3896,1782) if the same original path and grid are in use. If native preview differs, stop; share full logs. Do not relax guard or change coordinates. A different remaining interval after replanning may yield a different valid expansion.
4. Verify the blocked interval now completes, multiple subsequent intervals reach Port Barthos, and the original Journey Journal is updated only with confirmed travel. Confirm expected remaining time once, no repeated 28,837 seconds, no duplicated fares or Actor mutations. Continue to Dirwest with the existing checkpoint decisions.
5. In a disposable copy, test canvas redraw, full reload, interrupted Journal write/recovery, manual token displacement, constrained path, unrelated movement, GM/non-GM permissions, native fog/Regions/weather. Missing or conflicting authority must fail closed. Do not claim successful live acceptance until these results are reviewed.

No changes to A1/B1 transportation planner, road geometry, fare logic, or rest scheduling. No migration needed for legacy interrupted intents without nativePath.
