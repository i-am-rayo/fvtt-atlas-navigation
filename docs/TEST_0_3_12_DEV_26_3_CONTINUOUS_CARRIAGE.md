# 0.3.12-dev.26.3 — Continuous Carriage and Fare QA

**Draft** PR #490 stacked on PR #489. **Not GM/non-GM live accepted**, merged, tagged or released.

## Owner evidence

PO's 2026-11-23 live completed Dirwest → Port Barthos Journey:
- Confirmed movement **12h**; rest downtime **0m**; elapsed World time **12h**.
- Confirmed native movement under continuous Carriage with no automatic booking/currency payment.
- These historical records **must not be rewritten**.
- Six annotated requests: remove the redundant Navigation operating-schedule dropdown and instructions; derive planned standard/continuous from the effective Carriage's World + Map Marker/Journey editor setting; continuous fare calculation works for **trip, distance and operating-day bases**; the per-operating-day charge uses **normal World moving hours/day**, not continuous 24h crew duty.

## Expected behavior

A Carriage with **Allow continuous travel** checked in its effective transportation settings should present a 24h continuous travel preview without a duplicate Navigation schedule picker. The GM must still approve Travel; enabling capability is **not** a movement/clock/write authorization. The GM can disable the toggle and return to standard travel, with recovery never silently changing already approved operations.

With **4 GP per vehicle per operating day** and **8 normal World moving hours/day**, 12h continuous travel is **12/8 = 1.5 chargeable days = 6 GP**, not 2 × 4 GP. The World-only baseline can still show the standard 8 GP comparison, but an unsupported World continuous capability must not block the valid effective Map Marker quote. **One-time trip** or **per-mile** fare frequencies remain independent. No booking or automatic payment occurs. Included crew is never charged twice. If paid separately by day, crew wages also use 1.5 normal-day units. Actual method totals follow the existing independent per-method rounding policy.

A normal, noncontinuous 12h land Journey retains two duty days and explicit rest allowance; a 24h continuous crew schedule does not create mandatory long rests or skip native movement. A world with **6 normal moving hours/day** charges **2 normal-day units** for a 12h continuous service, unless a different fare frequency is selected.

## GM Foundry v14 verification

1. Load the `0.3.12-dev.26.3` branch manifest. Start an **unsaved** land route at an authored Map Marker with one available hired Carriage, capacity for the selected Group and a **4 GP per operating day** rate. Confirm method card and edit pencil remain.
2. With continuous toggle off, preview **Standard** (8h/day): 12h moving plus World-configured downtime/rest decisions, with the preexisting **8 GP** two-day hired rate.
3. Via **Edit Carriage**, check **Allow continuous travel** and **Save for this trip**. Check that no extra Navigation schedule dropdown exists. Before Travel, preview 12h movement, 12h elapsed, **6 GP current hired estimate**, and `1.5 normal-day fare units at 8h/day`. No throw of `Continuous operation is not enabled`. World preset comparison, if shown, is clearly independent.
4. Click Travel with explicit GM approval and complete a route exceeding 8 moving hours. Confirm no forced day-limit rest, native TokenDocument path/World-clock evidence, Journey record 12h moving/0m downtime/12h elapsed, no currency charge, no duplicate events or time.
5. Toggle continuous **off** and Save for trip; preview reverts to Standard. **Save to Map Marker** stages the change only to that Map Marker's record, with same-record revision check and no automatic World-global change.
6. Repeat with **Once per trip**: one fare for 12h. Repeat with **Per mile**: distance × rate; no day multiplier. If World custom normal hours/day is 6, 12h continuous/day fare uses **2** charge units.
7. Existing approved normal/continuous Journey resumes with its **saved** operation, even if a method's availability is edited; incompatible changes fail closed. Test redraw, reload, paused/interrupted recovery and non-GM permissions. These require PO live evidence, not just CI.

## Automated verification contract

- RED workflow [771](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45105394833) for duplicate UI, missing automatic mode and fractional fare.
- RED workflow [774](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45105697375) for editor toggle-off stale continuous mode.
- RED workflow [777](https://github.com/i-am-rayo/fvtt-atlas-navigation/actions/runs/45105916120) for GM-confirmation guard wrongly comparing implicit `normal` state to derived `continuous`.
- Final HEAD checks: see PR #490 CI; must pass Node tests, `npm run check`, `npm run architecture:check`, manifest/version validation and patch whitespace before deployment.

**Out of scope:** multi-surface mount boarding, livestock passenger fare/cargo capacity, B1 future-leg assignment and any write to existing completed Journals.
