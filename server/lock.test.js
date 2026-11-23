import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, createPlayer, prepareCategories, beginTeamGame, beginTeamTurn, chooseSquare,
  startRound, playLock, playFreeze, submitBoardAnswer, finishTeamBattle, restartTeamRoom, rejoinSnapshot } from './game.js';

const categories = prepareCategories(Array.from({ length: 16 }, (_, id) => ({ _id: String(id), title: `فئة ${id}`,
  answers: ['موز', 'تفاح', 'برتقال', 'عنب'], aliases: { موز: ['موزة'] } })));
function window() {
  const room = createRoom('QAFL', 'screen', 'test-only');
  for (const [id, team] of [['a0', 'A'], ['b0', 'B'], ['a1', 'A'], ['b1', 'B']]) {
    room.players.set(id, { ...createPlayer(id, id, id, room.players.size), team });
    room.joinOrder.push(id);
  }
  const turn = beginTeamTurn(beginTeamGame(room, categories, Array(16).fill(0)).room, 'A', 9000);
  return chooseSquare(turn, 'a0', 0, false, 10000).room;
}
const running = room => startRound({ ...room, startsAt: 18000 });

test('PB-17 Lock is immutable, spends exactly one card and targets the chosen square including zero', () => {
  const room = window(), before = structuredClone(room);
  const result = playLock(room, 'b0', 10000);
  assert.equal(result.error, undefined);
  assert.equal(result.target, 0);
  assert.equal(result.team, 'B');
  assert.deepEqual(result.by, { id: 'b0', name: 'b0' });
  assert.equal(result.room.chosen.lockedBy, 'B');
  assert.equal(result.room.cards.B.lock, 0);
  assert.equal(result.room.cards.A.lock, 1);
  assert.equal(result.room.cards.B.freeze, 1);
  assert.equal(result.room.cardChoices.B, 'lock');
  assert.equal(playLock(result.room, 'b1', 10001).error, 'NO_CARD');
  assert.deepEqual(room, before);
});

for (const phase of ['lobby', 'turn', 'countdown', 'round', 'battleEnd', 'over']) {
  test(`PB-17 Lock refuses ${phase} without consuming the card`, () => {
    const room = { ...window(), status: phase }, before = structuredClone(room);
    assert.equal(playLock(room, 'b0', 10000).error, 'NOT_NOW');
    assert.deepEqual(room, before);
  });
}

test('PB-17 only the non-choosing team in Team Mode can play; offline and unknown senders cannot', () => {
  const room = window();
  assert.equal(playLock(room, 'a0', 10000).error, 'NOT_ALLOWED');
  assert.equal(playLock(room, 'unknown', 10000).error, 'NOT_ALLOWED');
  assert.equal(playLock({ ...room, gameMode: 'classic' }, 'b0', 10000).error, 'NOT_NOW');
  room.players.get('b0').connected = false;
  assert.equal(playLock(room, 'b0', 10000).error, 'NOT_ALLOWED');
  const turn = beginTeamTurn(room, 'B', 20000);
  const chosen = chooseSquare(turn, 'b1', 1, false, 20001).room;
  assert.equal(playLock(chosen, 'a0', 20001).team, 'A');
});

test('PB-17 deadline is server-owned and exclusive; it cannot reopen or extend the five-second window', () => {
  const room = window();
  assert.equal(playLock(room, 'b0', 14999).error, undefined);
  for (const now of [9999, 15000, 15001, Infinity, NaN]) assert.equal(playLock(room, 'b0', now).error, 'NOT_NOW');
  assert.equal(room.cardWindowEndsAt, 15000);
});

test('PB-17 invalid targets cannot lock a different square or spend a card', () => {
  const room = window();
  for (const target of [1, -1, '0', null, {}, []]) assert.equal(playLock(room, 'b0', 10000, target).error, 'BAD_TARGET');
  assert.equal(playLock(room, 'b0', 10000, 0).error, undefined);
  assert.equal(playLock({ ...room, chosen: null }, 'b0', 10000).error, 'BAD_TARGET');
  assert.equal(room.cards.B.lock, 1);
});

test('PB-17 a sitting-out teammate owns the card choice, and Lock makes that choice final', () => {
  const room = { ...window(), sitout: { A: null, B: 'b1' } };
  assert.equal(playLock(room, 'b0', 10000).error, 'NOT_ALLOWED');
  const played = playLock(room, 'b1', 10000).room;
  assert.equal(playFreeze(running(played), 'b1', 19000, 0).error, 'NOT_ALLOWED');
  assert.equal(playLock({ ...room, cardChoices: { B: 'mine' } }, 'b1', 10000).error, 'NOT_ALLOWED');
});

test('PB-17 accepts a first card choice pre-recorded by the PB-20 adapter', () => {
  const room = { ...window(), sitout: { A: null, B: 'b1' }, cardChoices: { B: 'lock' } };
  assert.equal(playLock(room, 'b1', 10000).room.cards.B.lock, 0);
  const freeze = running({ ...room, cardChoices: { B: 'freeze' } });
  assert.equal(playFreeze(freeze, 'b1', 19000, 0).error, undefined);
});

test('PB-17 doubles new correct answers only; aliases, wrong answers, penalties and the rival keep their rules', () => {
  let room = running(playLock(window(), 'b0', 10000).room);
  const original = structuredClone(room);
  let result = submitBoardAnswer(room, 'b0', 'موز', 19000);
  assert.deepEqual(result.ack, { result: 'correct', delta: 2, score: 2 });
  assert.deepEqual(room, original);
  room = result.room;
  assert.deepEqual(submitBoardAnswer(room, 'b0', 'موزة', 19001).ack, { result: 'repeat', delta: 0, score: 2 });
  result = submitBoardAnswer(room, 'a0', 'موز', 19002);
  assert.deepEqual(result.ack, { result: 'locked', delta: -1, score: -1 });
  room = result.room;
  result = submitBoardAnswer(room, 'a1', 'تفاح', 19003);
  assert.equal(result.ack.delta, 1);
  room = result.room;
  assert.equal(submitBoardAnswer(room, 'b1', 'تفاح', 19004).ack.delta, -1);
  assert.equal(submitBoardAnswer(room, 'b0', 'سيارة', 19005).ack.delta, 0);
  assert.equal(submitBoardAnswer(room, 'b0', 'عنب', room.endsAt).ack.result, 'closed');
  const frozen = { ...room, players: new Map(room.players) };
  frozen.players.set('b0', { ...room.players.get('b0'), frozenUntil: 22000 });
  assert.equal(submitBoardAnswer(frozen, 'b0', 'عنب', 20000).ack.result, 'frozen');
});

test('PB-17 the bonus changes battle capture and team totals, then expires on the next square', () => {
  let room = running(playLock(window(), 'b0', 10000).room);
  for (const [id, word] of [['a0', 'تفاح'], ['a1', 'عنب'], ['b0', 'موز'], ['b1', 'برتقال']]) {
    room = submitBoardAnswer(room, id, word, 19000).room;
  }
  const ended = finishTeamBattle(room);
  assert.equal(ended.payload.winnerTeam, 'B');
  assert.deepEqual(ended.payload.teamScores, { A: 2, B: 4 });
  assert.deepEqual(ended.room.teamPoints, { A: 2, B: 4 });
  assert.equal(ended.room.board[0].owner, 'B');
  const turn = beginTeamTurn(ended.room, 'B', 40000);
  const next = startRound({ ...chooseSquare(turn, 'b0', 1, false, 40001).room, startsAt: 48000 });
  assert.equal(next.chosen.lockedBy, null);
  assert.equal(submitBoardAnswer(next, 'b0', 'موز', 49000).ack.delta, 1);
  assert.equal(next.cards.B.lock, 0);
  assert.equal(restartTeamRoom(ended.room).cards.B.lock, 1);
});

test('PB-17 PB-28 preserves a spent Lock, the active bonus and score without moving the deadline', () => {
  let room = playLock(window(), 'b0', 10000).room;
  let snapshot = rejoinSnapshot(room, 'b0', 11000);
  assert.equal(snapshot.cardWindowEndsAt, 15000);
  assert.equal(snapshot.chosen.lockedBy, 'B');
  assert.equal(snapshot.cards.B.lock, 0);
  room = submitBoardAnswer(running(room), 'b0', 'موز', 19000).room;
  snapshot = rejoinSnapshot(room, 'b0', 20000);
  assert.equal(snapshot.me.score, 2);
  assert.equal(snapshot.chosen.lockedBy, 'B');
  assert.equal(snapshot.endsAt, room.endsAt);
});
