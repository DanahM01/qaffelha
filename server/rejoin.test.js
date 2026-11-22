import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, createRoom, rejoinSnapshot } from './game.js';

function teamRoom(status = 'round') {
  const room = createRoom('QAFL', 'screen', 'private-example');
  room.gameMode = 'teams';
  room.status = status;
  const a = { ...createPlayer('a', 'لينا', 'socket-a', 1), team: 'A', score: 5, frozenUntil: 12000 };
  const b = { ...createPlayer('b', 'ريف', 'socket-b', 2), team: 'B', score: -1 };
  room.players = new Map([['a', a], ['b', b]]);
  room.board = [{ id: 0, category: { id: 'fruit', title: 'فواكه', answers: ['موز'] }, owner: null, mine: 'A' },
    { id: 1, category: { id: 'cities', title: 'مدن' }, owner: 'B', mine: 'B' }];
  room.turn = { team: 'B', endsAt: 15000 };
  room.chosen = { squareId: 0, team: 'B', steal: false, lockedBy: 'A' };
  room.cardWindowEndsAt = 14000;
  room.cards = { A: { freeze: 0, lock: 0, mine: 1, steal: 1 }, B: { freeze: 1, lock: 1, mine: 0, steal: 1 } };
  room.teamPoints = { A: 10, B: 3 };
  room.sitout = { A: 'a', B: null };
  return room;
}

for (const status of ['lobby', 'turn', 'cardWindow', 'countdown', 'round', 'battleEnd', 'over']) {
  test(`PB-28 team snapshot restores ${status} and only the requesting team's mines`, () => {
    const room = teamRoom(status);
    const before = structuredClone(room);
    const a = rejoinSnapshot(room, 'a', 10000);
    assert.equal(a.status, status);
    assert.equal(a.mode, 'screen');
    assert.equal(a.gameMode, 'teams');
    assert.equal(a.players.find(player => player.id === 'a').name, 'لينا');
    assert.deepEqual(a.me, { id: 'a', team: 'A', out: false, score: 5, sittingOut: true });
    assert.equal(a.frozenUntil, 12000);
    assert.deepEqual(a.cards, room.cards);
    assert.deepEqual(a.teamPoints, room.teamPoints);
    assert.deepEqual(a.turn, room.turn);
    assert.deepEqual(a.chosen, room.chosen);
    assert.equal(a.cardWindowEndsAt, 14000);
    assert.deepEqual(a.mines, [0]);
    assert.deepEqual(rejoinSnapshot(room, 'b', 10000).mines, [1]);
    const screen = rejoinSnapshot(room, undefined, 10000);
    assert.equal(screen.me, null);
    assert.deepEqual(screen.mines, []);
    assert.equal(screen.frozenUntil, null);
    for (const square of a.board) assert.deepEqual(Object.keys(square), ['id', 'category', 'owner']);
    const json = JSON.stringify(a);
    for (const privateValue of ['private-example', 'socket-a', 'socket-b', 'answers']) assert.equal(json.includes(privateValue), false);
    assert.deepEqual(room, before);
    // Mutating a serialized acknowledgement must not mutate the live room.
    a.cards.A.lock = 99;
    a.board[0].category.title = 'changed';
    a.teamPoints.A = 999;
    assert.deepEqual(room, before);
  });
}

test('PB-28 expired freeze is not restarted by a refresh', () => {
  const room = teamRoom();
  assert.equal(rejoinSnapshot(room, 'a', 12000).frozenUntil, null);
  assert.equal(rejoinSnapshot(room, 'a', 13000).frozenUntil, null);
  assert.equal(room.players.get('a').frozenUntil, 12000);
});

test('PB-28 team game-over result is restored from the retained server event', () => {
  const room = teamRoom('over');
  room.gameOver = { winnerTeam: 'B', line: [0, 1, 2, 3], squares: { A: 3, B: 5 } };
  const state = rejoinSnapshot(room, 'a', 10000);
  assert.equal(state.winnerTeam, 'B');
  assert.deepEqual(state.line, [0, 1, 2, 3]);
  assert.deepEqual(state.squares, { A: 3, B: 5 });
  state.line.push(4);
  state.squares.A = 0;
  assert.deepEqual(room.gameOver.line, [0, 1, 2, 3]);
  assert.equal(room.gameOver.squares.A, 3);
});
