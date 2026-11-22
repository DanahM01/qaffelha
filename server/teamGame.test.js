import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, createPlayer, prepareCategories, startRound, assignTeams, beginTeamGame,
  beginTeamTurn, chooseSquare, automaticSquare, boardPayload, teamScores, submitBoardAnswer,
  finishTeamBattle, restartTeamRoom } from './game.js';

const categories = prepareCategories(Array.from({ length: 20 }, (_, id) => ({
  _id: String(id), title: `فئة ${id}`, answers: ['موز', 'تفاح'], aliases: { موز: ['موزة'] }, lastUsedAt: id })));
function fixture(count = 4) {
  const room = createRoom('QAFL', 'phone', null);
  for (let i = 0; i < count; i++) {
    const id = String(i);
    room.players.set(id, createPlayer(id, `لاعب ${id}`, `socket-${id}`, i));
    room.joinOrder.push(id);
  }
  return room;
}
function board(count = 4) { return beginTeamTurn(beginTeamGame(fixture(count), categories, Array(16).fill(0)).room, 'A', 1000); }
function battle() {
  const room = chooseSquare(board(), '0', 0, false, 1001).room;
  return startRound({ ...room, startsAt: 9000 });
}

test('PB-14 assigns every player, preserves balanced choices, moves latest joiners, never mutates', () => {
  const room = fixture(5);
  for (const player of room.players.values()) player.team = 'A';
  const before = structuredClone(room.players);
  const assigned = assignTeams([...room.players.values()], room.players);
  assert.deepEqual([...assigned.values()].map(player => player.team), ['A', 'A', 'A', 'B', 'B']);
  assert.deepEqual(room.players, before);
  assert.deepEqual(assignTeams([...assigned.values()], assigned), assigned);
  assert.deepEqual([...assignTeams([...fixture().players.values()]).values()].map(player => player.team), ['A', 'B', 'A', 'B']);
});

test('PB-14 requires four players and sixteen unique categories; board follows usage preference', () => {
  assert.equal(beginTeamGame(fixture(3), categories, []).error, 'NOT_ENOUGH_PLAYERS');
  assert.equal(beginTeamGame(fixture(), categories.slice(0, 15), []).error, 'NOT_ENOUGH_CATEGORIES');
  assert.equal(beginTeamGame(fixture(), Array(16).fill(categories[0]), []).error, 'NOT_ENOUGH_CATEGORIES');
  for (const count of [4, 5, 12]) {
    const original = fixture(count), before = structuredClone(original);
    const room = beginTeamGame(original, categories, Array(16).fill(0)).room;
    assert.equal(room.board.length, 16);
    assert.equal(new Set(room.board.map(square => square.category.id)).size, 16);
    assert.deepEqual(room.board.map(square => square.id), Array.from({ length: 16 }, (_, id) => id));
    assert.equal(room.board.every(square => square.owner === null && square.mine === null), true);
    assert.equal(room.board[0].category.id, '0');
    assert.equal(room.cards.A.steal, 1);
    assert.notEqual(room.cards.A, room.cards.B);
    assert.deepEqual(original, before);
  }
});

test('PB-14 turn authorization, deadline, valid square IDs, sitout, first tap, and timeouts', () => {
  const room = board();
  assert.equal(room.turn.endsAt, 16000);
  assert.equal(chooseSquare(room, '1', 0, false, 1001).error, 'NOT_YOUR_TURN');
  assert.equal(chooseSquare(room, 'missing', 0, false, 1001).error, 'NOT_YOUR_TURN');
  assert.equal(chooseSquare(room, '0', 0, false, 16000).error, 'NOT_YOUR_TURN');
  for (const id of [-1, 16, '0', null, {}, 1.5]) assert.equal(chooseSquare(room, '0', id, false, 1001).error, 'BAD_TARGET');
  assert.equal(chooseSquare(room, '0', 0, 'true', 1001).error, 'BAD_TARGET');
  assert.equal(chooseSquare({ ...room, sitout: { A: '0' } }, '0', 0, false, 1001).error, 'SITTING_OUT');
  const offline = structuredClone(room); offline.players.get('0').connected = false;
  assert.equal(chooseSquare(offline, '0', 0, false, 1001).error, 'NOT_YOUR_TURN');
  const chosen = chooseSquare(room, '0', 0, false, 1001).room;
  assert.equal(chosen.cardWindowEndsAt, 6001);
  assert.equal(chosen.status, 'cardWindow');
  assert.equal(chooseSquare(chosen, '2', 1, false, 1002).error, 'NOT_YOUR_TURN');
  const auto = automaticSquare(room, 16000, 0.99);
  assert.equal(auto.chosen.squareId, 15);
  assert.equal(auto.chosen.steal, false);
  assert.equal(room.chosen, null);
});

test('PB-19 steal validates target and inventory, consumes once, preserves prior ownership until victory', () => {
  const room = board(); room.board[0] = { ...room.board[0], owner: 'B' };
  room.board[1] = { ...room.board[1], owner: 'A' };
  assert.equal(chooseSquare(room, '0', 0, false, 1001).error, 'TAKEN');
  for (const id of [1, 2]) assert.equal(chooseSquare(room, '0', id, true, 1001).error, 'BAD_TARGET');
  const before = structuredClone(room);
  const sitting = { ...room, sitout: { A: '0', B: null } };
  assert.equal(chooseSquare(sitting, '0', 0, false, 1001).error, 'SITTING_OUT');
  assert.equal(chooseSquare(sitting, '2', 0, true, 1001).error, 'NOT_ALLOWED');
  assert.equal(chooseSquare(sitting, '0', 0, true, 1001).room.cardChoices.A, 'steal');
  assert.equal(chooseSquare({ ...sitting, cardChoices: { A: 'freeze' } }, '0', 0, true, 1001).error, 'NOT_ALLOWED');
  const result = chooseSquare(room, '0', 0, true, 1001);
  assert.equal(result.room.cards.A.steal, 0);
  assert.equal(result.room.cards.B.steal, 1);
  assert.equal(result.room.board[0].owner, 'B');
  assert.deepEqual(room, before);
  const next = beginTeamTurn(result.room, 'A', 2000);
  assert.equal(chooseSquare(next, '0', 0, true, 2001).error, 'NO_CARD');
  const full = { ...room, board: room.board.map(square => ({ ...square, owner: 'B' })) };
  assert.equal(automaticSquare(full, 16000, 0).chosen.steal, true);
  assert.equal(automaticSquare({ ...full, cards: result.room.cards }, 16000, 0), null);
});

test('PB-14 team scoring shares canonical locks, repeats, penalties, Freeze, sitout and reset', () => {
  let room = battle();
  const correct = submitBoardAnswer(room, '0', 'موز', 9100);
  assert.deepEqual(correct.ack, { result: 'correct', delta: 1, score: 1 }); room = correct.room;
  assert.equal(submitBoardAnswer(room, '0', 'موزة', 9101).ack.result, 'repeat');
  const locked = submitBoardAnswer(room, '2', 'موزة', 9101);
  assert.equal(locked.ack.delta, -1); room = locked.room;
  assert.deepEqual(teamScores(room), { A: 0, B: 0 });
  room = submitBoardAnswer(room, '1', 'تفاح', 9102).room;
  assert.deepEqual(teamScores(room), { A: 0, B: 1 });
  assert.equal(submitBoardAnswer({ ...room, sitout: { A: '0' } }, '0', 'تفاح', 9200).ack.result, 'closed');
  const frozen = structuredClone(room); frozen.players.get('3').frozenUntil = 10000;
  assert.equal(submitBoardAnswer(frozen, '3', 'تفاح', 9999).ack.result, 'frozen');
  assert.equal(submitBoardAnswer(frozen, '3', 'تفاح', 10000).ack.result, 'locked');
  assert.equal(submitBoardAnswer(room, '0', 'تفاح', room.endsAt).ack.result, 'closed');
  assert.equal(submitBoardAnswer({ ...room, status: 'battleEnd' }, '0', 'تفاح', 9200).ack.result, 'closed');
  const reset = startRound({ ...room, startsAt: 40000 });
  assert.deepEqual(teamScores(reset), { A: 0, B: 0 });
  assert.equal(reset.locked.size, 0);
});

test('PB-14 captures by score, then latest correct; nobody correct/exact ties leave square unchanged', () => {
  const cases = [
    [{ score: 2, lastCorrectAt: 9500 }, { score: 1, lastCorrectAt: 9100 }, 'A'],
    [{ score: 1, lastCorrectAt: 9500 }, { score: 1, lastCorrectAt: 9100 }, 'B'],
    [{ score: 0, lastCorrectAt: 9100 }, { score: 0, lastCorrectAt: null }, 'A'],
    [{ score: 0, lastCorrectAt: null }, { score: 0, lastCorrectAt: null }, null],
    [{ score: 1, lastCorrectAt: 9100 }, { score: 1, lastCorrectAt: 9100 }, null],
  ];
  for (const [a, b, winner] of cases) {
    const room = battle();
    Object.assign(room.players.get('0'), a); Object.assign(room.players.get('1'), b);
    room.teamPoints = { A: 10, B: -2 };
    const before = structuredClone(room);
    const result = finishTeamBattle(room);
    assert.equal(result.payload.winnerTeam, winner);
    assert.equal(result.room.board[0].owner, winner);
    assert.equal(result.room.players.size, 4);
    assert.equal([...result.room.players.values()].some(player => player.out), false);
    assert.deepEqual(result.room.teamPoints, { A: 10 + a.score, B: -2 + b.score });
    assert.deepEqual(room, before);
  }
});

test('PB-19 winning transfers ownership; losing or drawing a steal retains the rival square', () => {
  for (const score of [-1, 0, 1]) {
    const room = board(); room.board[0] = { ...room.board[0], owner: 'B' };
    const selected = chooseSquare(room, '0', 0, true, 1001).room;
    const running = startRound({ ...selected, startsAt: 9000 });
    running.players.get('0').score = score;
    const result = finishTeamBattle(running);
    assert.equal(result.room.board[0].owner, score > 0 ? 'A' : 'B');
    assert.equal(result.room.cards.A.steal, 0);
  }
});

test('PB-14 public board redacts mines and answer indexes; restart clears all team phases and drops offline players', () => {
  const room = battle(); room.board[0] = { ...room.board[0], mine: 'A' };
  const payload = boardPayload(room);
  assert.deepEqual(Object.keys(payload.board[0]), ['id', 'category', 'owner']);
  assert.deepEqual(Object.keys(payload.board[0].category), ['id', 'title']);
  assert.equal(JSON.stringify(payload).includes('answers'), false);
  payload.cards.A.freeze = 0;
  assert.equal(room.cards.A.freeze, 1);
  room.players.get('3').connected = false;
  const reset = restartTeamRoom(room);
  assert.equal(reset.code, room.code);
  assert.equal(reset.status, 'lobby');
  assert.equal(reset.players.size, 3);
  assert.equal(reset.board.length, 0);
  assert.equal(reset.chosen, null);
  assert.equal(reset.turn, null);
  assert.equal(reset.cardWindowEndsAt, null);
  assert.deepEqual(reset.teamPoints, { A: 0, B: 0 });
});
