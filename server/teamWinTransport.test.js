import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeTeamGame } from './index.js';

test('PB-15 completion publishes once to the correct room and preserves unrelated state', () => {
  const board = Array.from({ length: 16 }, (_, id) => ({ id, owner: id < 4 ? 'B' : null }));
  const room = { gameMode: 'teams', status: 'battleEnd', board, players: new Map(), teamPoints: { A: 3, B: 8 } };
  const rooms = new Map([['QAFL', room], ['ZZZZ', { status: 'round' }]]);
  const messages = [];
  const io = { to: (code) => ({ emit: (event, payload) => messages.push({ code, event, payload }) }) };
  assert.equal(completeTeamGame(io, rooms, 'QAFL'), true);
  assert.equal(rooms.get('QAFL').status, 'over');
  assert.equal(room.status, 'battleEnd');
  assert.equal(rooms.get('ZZZZ').status, 'round');
  assert.equal(messages[0].code, 'QAFL');
  assert.equal(messages[0].event, 'game:over');
  assert.equal(messages[0].payload.winnerTeam, 'B');
  assert.equal(completeTeamGame(io, rooms, 'QAFL'), true);
  assert.equal(messages.length, 1);
  assert.equal(completeTeamGame(io, rooms, 'MISSING'), false);
  rooms.set('CLASSIC', { gameMode: 'classic' });
  assert.equal(completeTeamGame(io, rooms, 'CLASSIC'), false);
});
