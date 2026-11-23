// PB-18 Mine card (Renad): pure rules in game.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, createPlayer, prepareCategories, startRound, beginTeamGame, beginTeamTurn, chooseSquare,
  boardPayload, submitBoardAnswer, finishTeamBattle, rejoinSnapshot,
  MINE_PENALTY, playMine, teamMines, settleMine } from './game.js';

const categories = prepareCategories(Array.from({ length: 20 }, (_, id) => ({
  _id: String(id), title: `فئة ${id}`, answers: ['موز', 'تفاح'], lastUsedAt: id })));
// Players '0' and '2' are team A, '1' and '3' are team B (assignTeams fills the smaller team).
function fixture(count = 4) {
  const room = createRoom('QAFL', 'screen', 'token');
  for (let i = 0; i < count; i++) {
    const id = String(i);
    room.players.set(id, createPlayer(id, `لاعب ${id}`, `socket-${id}`, i));
    room.joinOrder.push(id);
  }
  return room;
}
// Team A's turn from t=1000 (ends at 16000).
function turnA() { return beginTeamTurn(beginTeamGame(fixture(), categories, Array(16).fill(0)).room, 'A', 1000); }
// Team A chose square 0 at t=1001; its card window ends at 6001.
function windowA() { return chooseSquare(turnA(), '0', 0, false, 1001).room; }
function withMine(room, squareId, team) {
  return { ...room, board: room.board.map(square => square.id === squareId ? { ...square, mine: team } : square) };
}

test('PB-18 places a mine on its own turn, uses the card, records the choice and never mutates', () => {
  const room = turnA();
  const result = playMine(room, '0', 5, 2000);
  assert.equal(result.error, undefined);
  assert.equal(result.team, 'A');
  assert.deepEqual(result.by, { id: '0', name: 'لاعب 0' });
  assert.equal(result.room.board[5].mine, 'A');
  assert.equal(result.room.board.filter(square => square.mine).length, 1);
  assert.equal(result.room.cards.A.mine, 0);
  assert.deepEqual(result.room.cards.B, room.cards.B);
  assert.equal(result.room.cardChoices.A, 'mine');
  assert.equal(room.board[5].mine, null);
  assert.equal(room.cards.A.mine, 1);
  assert.deepEqual(room.cardChoices, {});
});

test('PB-18 places a mine in its own card window, after choosing', () => {
  const result = playMine(windowA(), '2', 3, 2000);
  assert.equal(result.error, undefined);
  assert.equal(result.room.board[3].mine, 'A');
  assert.equal(result.room.status, 'cardWindow');
});

test('PB-18 refuses the rival turn, the rival card window, expired phases, other phases and classic mode', () => {
  assert.equal(playMine(turnA(), '1', 5, 2000).error, 'NOT_NOW');
  assert.equal(playMine(windowA(), '1', 5, 2000).error, 'NOT_NOW');
  assert.equal(playMine(turnA(), '0', 5, 16000).error, 'NOT_NOW');
  assert.equal(playMine(windowA(), '0', 5, 6001).error, 'NOT_NOW');
  const countdown = { ...windowA(), status: 'countdown' };
  assert.equal(playMine(countdown, '0', 5, 2000).error, 'NOT_NOW');
  const round = startRound({ ...windowA(), startsAt: 9000 });
  assert.equal(playMine(round, '0', 5, 9500).error, 'NOT_NOW');
  assert.equal(playMine({ ...windowA(), status: 'battleEnd' }, '0', 5, 2000).error, 'NOT_NOW');
  assert.equal(playMine(fixture(), '0', 5, 2000).error, 'NOT_NOW');
});

test('PB-18 respects sitting out (only the chooser plays, once) and refuses a second Mine', () => {
  const sitting = { ...turnA(), sitout: { A: '2', B: null } };
  assert.equal(playMine(sitting, '0', 5, 2000).error, 'NOT_ALLOWED');
  assert.equal(playMine(sitting, '2', 5, 2000).error, undefined);
  const alreadyChose = { ...sitting, cardChoices: { A: 'steal' } };
  assert.equal(playMine(alreadyChose, '2', 5, 2000).error, 'NOT_ALLOWED');
  const once = playMine(turnA(), '0', 5, 2000).room;
  assert.equal(playMine(once, '2', 6, 2000).error, 'NO_CARD');
});

test('PB-18 target must be a valid, free, unmined square that is not the chosen one', () => {
  for (const squareId of [16, -1, '5', 2.5, null, undefined]) {
    assert.equal(playMine(turnA(), '0', squareId, 2000).error, 'BAD_TARGET', `target ${String(squareId)}`);
  }
  const owned = { ...turnA(), board: turnA().board.map(square => square.id === 4 ? { ...square, owner: 'B' } : square) };
  assert.equal(playMine(owned, '0', 4, 2000).error, 'BAD_TARGET');
  assert.equal(playMine(withMine(turnA(), 6, 'B'), '0', 6, 2000).error, 'BAD_TARGET');
  const window = windowA();
  assert.equal(playMine(window, '0', window.chosen.squareId, 2000).error, 'BAD_TARGET');
  assert.equal(window.cards.A.mine, 1);
});

test('PB-18 mines stay hidden: boardPayload never shows them, rejoin shows only the owner team', () => {
  const room = playMine(turnA(), '0', 5, 2000).room;
  const payload = boardPayload(room);
  assert.equal(payload.board.every(square => !('mine' in square)), true);
  assert.equal(payload.cards.A.mine, 0);
  assert.deepEqual(rejoinSnapshot(room, '0', 2000).mines, [5]);
  assert.deepEqual(rejoinSnapshot(room, '2', 2000).mines, [5]);
  assert.deepEqual(rejoinSnapshot(room, '1', 2000).mines, []);
  assert.deepEqual(rejoinSnapshot(room, undefined, 2000).mines, []);
});

test('PB-18 teamMines lists only that team\'s squares', () => {
  const room = withMine(withMine(turnA(), 5, 'A'), 9, 'B');
  assert.deepEqual(teamMines(room, 'A'), [5]);
  assert.deepEqual(teamMines(room, 'B'), [9]);
  assert.deepEqual(teamMines({ board: [] }, 'A'), []);
});

// A battle on square 5, which team A mined, with chosen = 5.
function battleOnMine(teamPoints) {
  return { ...withMine(windowA(), 5, 'A'), status: 'battleEnd', chosen: { squareId: 5, team: 'B', steal: false, lockedBy: null }, teamPoints };
}

test('PB-18 the rival loses on the mine: it loses 3 team points, the mine explodes and is cleared', () => {
  const room = battleOnMine({ A: 4, B: 5 });
  const result = settleMine(room, 'A');
  assert.equal(MINE_PENALTY, 3);
  assert.deepEqual(result.exploded, { squareId: 5, team: 'B', points: -3 });
  assert.equal(result.owner, 'A');
  assert.deepEqual(result.room.teamPoints, { A: 4, B: 2 });
  assert.equal(result.room.board[5].mine, null);
  assert.equal(room.board[5].mine, 'A');
  assert.deepEqual(room.teamPoints, { A: 4, B: 5 });
});

test('PB-18 team points may go negative', () => {
  assert.deepEqual(settleMine(battleOnMine({ A: 0, B: 1 }), 'A').room.teamPoints, { A: 0, B: -2 });
  assert.deepEqual(settleMine(battleOnMine({ A: 0, B: 0 }), 'A').room.teamPoints, { A: 0, B: -3 });
});

test('PB-18 the rival wins on the mine: removed silently, no points change', () => {
  const result = settleMine(battleOnMine({ A: 4, B: 5 }), 'B');
  assert.equal(result.exploded, undefined);
  assert.equal(result.owner, 'A');
  assert.deepEqual(result.room.teamPoints, { A: 4, B: 5 });
  assert.equal(result.room.board[5].mine, null);
});

test('PB-18 a draw keeps the mine; a square without a mine changes nothing', () => {
  const room = battleOnMine({ A: 4, B: 5 });
  const draw = settleMine(room, null);
  assert.equal(draw.room, room);
  assert.equal(draw.room.board[5].mine, 'A');
  assert.equal(draw.exploded, undefined);
  assert.equal(draw.owner, undefined);
  const plain = { ...room, chosen: { ...room.chosen, squareId: 6 } };
  assert.equal(settleMine(plain, 'A').room, plain);
});

test('PB-18 full flow with the real engine: A mines square 5, B battles there and loses', () => {
  // Team A's turn: mine square 5, then choose square 0 (the battle on 0 is not part of this test).
  const mined = playMine(turnA(), '0', 5, 2000).room;
  // Team B's turn: B chooses square 5 without knowing about the mine.
  const chosen = chooseSquare(beginTeamTurn(mined, 'B', 30000), '1', 5, false, 30001).room;
  let battle = startRound({ ...chosen, startsAt: 40000 });
  battle = submitBoardAnswer(battle, '0', 'موز', 41000).room;
  const finished = finishTeamBattle(battle);
  assert.equal(finished.payload.winnerTeam, 'A');
  assert.deepEqual(finished.room.teamPoints, { A: 1, B: 0 });
  const settled = settleMine(finished.room, finished.payload.winnerTeam);
  assert.deepEqual(settled.exploded, { squareId: 5, team: 'B', points: -3 });
  assert.deepEqual(settled.room.teamPoints, { A: 1, B: -3 });
  assert.equal(settled.room.board[5].owner, 'A');
  assert.equal(settled.room.board[5].mine, null);
  assert.deepEqual(teamMines(settled.room, 'A'), []);
});
