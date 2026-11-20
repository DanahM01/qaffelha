# Reef's Sprint 2 implementation

PB-15 / SCRUM-19 and PB-20 / SCRUM-25 are implemented as Reef-owned rules, integration functions, phone screens, and tests. Full live Team Mode acceptance remains dependent on Layan's PB-14 team/battle engine and the assigned card implementations. This checkout's running server still supports Classic only. These changes deliberately do not implement PB-13, PB-14, or the card effects owned by other members.

## What is included

- PB-15: `findWinningLine` checks every row and column by square ID. Diagonals do not win. `teamGameResult` implements full-board square/point tie-breaks and a draw, while keeping a full board open when a steal remains possible. `completeTeamGame` publishes the existing `game:over` payload once to the correct room.
- PB-15 phone: team badge, 16 category squares, turn/deadline gating, private mine display, server-owned captures and winning-line highlights, win/loss/draw results, and the existing phone-host replay intent.
- PB-20: `selectTeamSitouts` applies lowest score, slower last correct answer, then latest join. Two-player teams are exempt. The previous sitting-out player returns to play. `prepareTeamSitouts` resets each team's card choice for the next battle.
- PB-20: `teamCardPermission` and `recordTeamCardChoice` restrict card selection to the sitting-out teammate and make that choice final. `submitTeamAnswer` rejects that player's answers without changing their score or locks. `publishTeamSitouts` announces the assignment once per settled battle.
- PB-20 phone: live battle with no answer input for the chooser, available card controls, phase/remaining-count feedback, Mine/Steal target selection through the existing events, and return to normal answering on the next assignment. No vote event was added: SPEC §17.7 defines one final chooser, not a majority vote.

All shared-file changes were explicitly authorized by Reef in chat, limited to these two stories. Theme additions use existing semantic colors and existing fonts/icons. Other members' rule functions and socket handlers remain unchanged.

## Integration required from the owners

Layan (PB-14), after settling a battle and applying its effects:

```js
rooms.set(code, settledRoom);
if (completeTeamGame(io, rooms, code)) return;
publishTeamSitouts(io, rooms, code);
// Then schedule the existing battle-result delay and the next turn.
```

Call `publishTeamSitouts` before the next turn/card window, not after a Lock choice or again during countdown. It is idempotent for the settled `room.round`. At initial game start both sit-out assignments are null. The wrapper expects `room.players` as a Map, `room.joinOrder`, and initialized `board`, `teamPoints`, and `cards` per SPEC §17.

Layan, route Team Mode answer submissions through `submitTeamAnswer` (Classic still uses the existing submission rule). The current Classic socket handler was not rewritten.

Card owners (Danah, Leena, Renad, Layan): check `teamCardPermission` before any card side effects. Validate the existing phase, target, and card effect in your own implementation. On success, call `recordTeamCardChoice` on that valid room, apply/consume your card, and commit the returned room atomically. Reject failures without committing either change. Steal uses `square:choose` with `steal: true`; permit the designated chooser for that card path while keeping ordinary square selection unavailable to sitting-out players. These helpers do not apply, announce, or consume another member's card effect.

Leena / Layan, proposed additions to existing reconnect/room payloads need contract approval:

- Rejoin: include `cardChoices` so a refresh preserves finality, and include `chosen.cardWindowEndsAt` during the card window so the Lock control can restore its deadline.
- Rejoin after game over: include the existing result's `winnerTeam`, `line`, `squares`, and `teamPoints` (the transport helper stores this as `room.teamResult`). The current documented snapshot omits the result fields.
- Replay: include `status: 'lobby'` in the existing `room:players` broadcast. In Team Mode every player remains `out: false`, so that broadcast otherwise cannot distinguish a restart from a connection/host update. The client already merges a supplied status. No new event or unapproved EVENTS.md edit was made here.

Renad owns the big-screen board, team-win view, and lobby team controls. Danah should review the final phone layouts. Reef's new board classes are scoped with `q-team-*` to avoid changing Classic screens.

## Verification

- Run `npm test` for Classic regressions and the new server line, tie-break, sitting-out, choice-permission, answer-blocking, room-isolation, and idempotency cases.
- Run `node --test client/src/player/tests/teamState.test.js` for UI event-state checks.
- Run `npm run build` and `node client/src/theme/check-colors.mjs`.
- Browser fixture: start the client on port 5175 with `VITE_SERVER_URL=http://localhost:3102`, then run `node client/src/player/tests/team-browser.cjs`. It requires Playwright resolvable in the environment and Microsoft Edge. It starts an isolated contract fixture on port 3102, not the production server, and saves images under the temporary `qaffelha-teams` directory (or `QAFFELHA_TEST_OUTPUT`).
- Browser checks cover 320×568, 360×640, 390×844, 768×1024, 1280×720, 1440×900, and 1920×1080; 64px square targets; turn permissions; private mine visibility; waiting for server captures; win/loss/draw; sitting out; Mine/Steal targets; Lock timing; final card choice; refresh; returning to play; and a reduced-height answering viewport.

## Choices for Leena to confirm

The previous sitting-out teammate is excluded from the battle they did not play, so they return for the next battle as §17.7 requires. A card choice becomes final only after a successful server acknowledgement/announcement; picking or cancelling a target before submission does not spend the choice. With no designated chooser, the general card rule allows any connected teammate. Deterministic row-before-column order is used if an externally constructed board contains multiple winning lines; normal play should stop at the first line.

## Still required before Done

- Merge/connect the owner integrations above and obtain Layan's approval for the proposed payload additions.
- Test on at least four real phones in both hosting modes, including real iOS/Android keyboards, disconnects, refresh during card windows/results, and all card effects.
- Check a 12-player game, timing targets, and mines staying private through real transport.
- Obtain Danah's visual approval and a reviewed PR before merging; update Jira only after those acceptance checks.
