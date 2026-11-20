import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_EVENTS, applyTeamEvent, myTeam } from '../teamState.js';

test('board updates during a battle preserve the screen and only use supplied owners', () => {
  const state = { status: 'round', endsAt: 5000, players: [{ id: 'p', team: 'B' }] };
  const payload = { board: [{ id: 0, owner: 'A' }], teamPoints: { A: 2, B: 3 }, cards: {} };
  const next = applyTeamEvent(state, TEAM_EVENTS.board, payload);
  assert.equal(next.status, 'round');
  assert.deepEqual(next.board, payload.board);
  assert.equal(next.endsAt, 5000);
  assert.equal(myTeam(next, 'p'), 'B');
  assert.deepEqual(state, { status: 'round', endsAt: 5000, players: [{ id: 'p', team: 'B' }] });
});

test('battle results do not decide a team winner or advance to the next turn locally', () => {
  const payload = { squareId: 3, winnerTeam: null, scores: [], teamScores: { A: 0, B: 0 } };
  const next = applyTeamEvent({ status: 'round', board: [] }, TEAM_EVENTS.end, payload);
  assert.equal(next.status, 'battleEnd');
  assert.equal(next.battleResult.winnerTeam, null);
  assert.deepEqual(next.board, []);
  assert.equal(next.winnerTeam, undefined);
});

test('a new server turn clears the previous chosen square and result', () => {
  const next = applyTeamEvent({ status: 'battleEnd', chosen: { squareId: 3 }, battleResult: {} },
    TEAM_EVENTS.turn, { team: 'B', endsAt: 9000 });
  assert.equal(next.status, 'turn');
  assert.equal(next.chosen, null);
  assert.equal(next.battleResult, null);
  assert.equal(next.turn.team, 'B');
});

test('private mines come only from the targeted payload; team comes from server membership', () => {
  const next = applyTeamEvent({ board: [{ id: 0, owner: null }], mines: [2] }, TEAM_EVENTS.mines, { mines: [7] });
  assert.deepEqual(next.mines, [7]);
  assert.deepEqual(next.board, [{ id: 0, owner: null }]);
  assert.equal(myTeam({ me: { id: 'p', team: 'A' } }, 'p'), 'A');
  assert.equal(myTeam({ me: { id: 'p', team: 'A' } }, 'another'), null);
});
