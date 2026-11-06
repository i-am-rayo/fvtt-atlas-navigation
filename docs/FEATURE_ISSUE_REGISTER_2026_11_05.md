# Atlas feature and defect issue register — November 5, 2026

Owner requests gathered in `FUTURE_FEATURE_MILESTONES.md` and earlier beta.7.x
feedback were checked against the existing open Issues. Each entry below is
tracked on GitHub; **issues are proposed/deferred**, not beta.7.24 scope or
permission to implement/migrate. The Product Owner sets priorities/releases.

## New Feature

| Stage | Request | Issue |
| --- | --- | --- |
| B | P-01 Player Journey progress bar | [#192](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/192) |
| B | N-01 Player-local travel camera follow | [#193](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/193) |
| B | N-02 GM visual playback speed | [#194](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/194) |
| B | R-02 Display Road distance | [#196](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/196) |
| B | R-03 Road Editor merge parity | [#195](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/195) |
| B | G-01 Group Actor transportation editor parity | [#197](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/197) |
| B | V-01 GM discovered-only visibility preview | [#198](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/198) |
| C | C-01 Independent Node-anchored Checkpoints | [#206](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/206) |
| C | C-02 Native Region containment / Regions [+] | [#204](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/204) |
| C | R-04 Road slicer | [#200](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/200) |
| C | I-01 Portability schema and ID remapping design | [#205](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/205) |
| D | T-01/T-02 Scheduled and on-call service windows | [#136](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/136) (existing) |
| D | P-02 Player Checkpoint transportation pamphlet | [#203](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/203) |
| E | P-03 Player Rest request anywhere | [#201](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/201) |
| E | N-03 Interrupted rests and programmed events | [#202](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/202) |
| E | C-03 Inn Checkpoint services | [#207](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/207) |
| E | C-04 Toll Checkpoint services | [#199](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/199) |
| E | C-05 Bridge attributes | [#209](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/209) |
| F | V-02 Land/water/air route networks | [#211](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/211) |
| F | S-01 Slope and elevation travel | [#208](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/208) |
| F | R-05 Teleport gate travel transfers | [#210](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/210) |
| G | I-02 Scene-only Atlas import/export | [#217](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/217) |
| G | U-01 UI icon/form parity | [#216](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/216) |
| G/B UX | U-02 Completed Journey Journal redesign | [#215](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/215) |
| Deferred | U-03 Token Settings Atlas controls | [#214](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/214) |
| Deferred | N-04 Stable A–B–C–D leg labeling | [#212](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/212) |
| Deferred | N-05 GM fast travel | [#213](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/213) |
| Deferred | Terrain Region preview/minimize/close UX | [#186](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/186) (existing) |
| Deferred | Relocate existing Checkpoint with identity preserved | [#187](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/187) (existing) |
| Deferred | One-time player Lore Checkpoint cinematic camera focus/highlight | [#191](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/191) |

**Lore camera focus (#191) is separate from Journey camera follow (#193).**
The first is a one-time, opt-in discovery camera event after a GM publishes
known-through-Lore state; the latter follows approved travel. Neither owns
token movement, World time, Fog or any hidden Road metadata.

## Bugs / investigations

| Incident | Issue | Disposition |
| --- | --- | --- |
| Foundry canvas teardown interrupts guided travel | [#135](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/135) | Open; initiating caller unconfirmed generally |
| Checkpoint-transfer Journey native-token/Journal anchor mismatch during weather-associated rebuild | [#189](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/189) | Open; **high-risk recovery gate**, no safety bypass |
| Guided travel appears stopped with GM window backgrounded | [#218](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/218) | Open investigation; native movement vs visual stall unknown |

Previously fixed/tested issues are not reopened as fresh Bugs without new
owner reproduction. New reports should include Foundry v14 version, GM/player
roles, console stack, expected vs actual behavior, World/Scene state and
recovery evidence. The successful second Journey after #189 does **not** prove
that the first interrupted Journey recovered.

## Implementation sequencing

- The complete issue set is backlog, not the current beta.7.24 implementation.
- Treat independent Checkpoints, Region containment and Scene portability as
  separate schema/migration gates. No automatic Region/Journal/Fog migration.
- Test in a backed-up World. Keep draft PRs until owner acceptance and do not
  merge or publish final versions without owner authorization.
