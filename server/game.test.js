import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, validateName, createPlayer, createRoom, joinError, canStart, prepareCategories,
  selectCategory, startRound, submitAnswer, eliminatePlayer, gameRanking, restartRoom,
  playersPayload, scoresPayload, stateSnapshot, FREEZE_MS, newTeamCards, cardPlayError, freezeTarget,
  playFreeze } from './game.js';

const documents = [{ _id: 'fruit', title: 'فواكه', answers: ['تفاحة', 'موز', 'برتقال'],
  aliases: { برتقال: ['بردقان'] } }];
function fixture(count = 3) {
  const room = createRoom('QAFL', 'phone', null);
  for (let i = 0; i < count; i++) {
    const id = String(i);
    room.players.set(id, createPlayer(id, `لاعب ${i}`, `socket-${i}`, 100 + i));
    room.joinOrder.push(id);
  }
  room.hostId = '0';
  room.startsAt = 1000;
  room.category = prepareCategories(documents)[0];
  return startRound(room);
}

test('names: trim, empty, type, 15-character limit and normalized uniqueness', () => {
  for (const name of [null, 42, '', '   ', 'ا'.repeat(16), 'ـ']) assert.equal(validateName(name).error, 'NAME_INVALID');
  assert.deepEqual(validateName('  ليان  '), { name: 'ليان' });
  assert.equal(validateName('ا'.repeat(15)).name.length, 15);
  assert.equal(validateName('تفاحه', [{ name: 'تفاحة' }]).error, 'NAME_TAKEN');
});

test('room and player defaults, min/max players, lobby-only joins', () => {
  const player = createPlayer('p', 'ليان', 's', 100);
  const phone = createRoom('QAFL', 'phone', null, player);
  assert.equal(phone.hostId, player.id);
  assert.equal(phone.players.get('p'), player);
  assert.equal(createRoom('QAFL', 'screen', 'example-only').hostId, null);
  assert.equal(canStart(phone), false);
  const room = fixture();
  assert.equal(canStart({ ...room, status: 'lobby' }), true);
  assert.equal(canStart(room), false);
  assert.equal(joinError(null, 'ليان'), 'NOT_FOUND');
  assert.equal(joinError(room, 'ليان'), 'STARTED');
  assert.equal(joinError({ ...fixture(12), status: 'lobby' }, 'ليان'), 'FULL');
  assert.equal(joinError({ ...fixture(11), status: 'lobby' }, 'ليان'), null);
  assert.equal(joinError({ ...room, status: 'lobby' }, ' '), 'NAME_INVALID');
  assert.equal(joinError({ ...room, status: 'lobby' }, 'لاعب 0'), 'NAME_TAKEN');
});

test('category indexes include normalized canonical words and aliases', () => {
  const [category] = prepareCategories(documents);
  assert.equal(category.answers.get('تفاحه'), 'تفاحة');
  assert.equal(category.answers.get('بردقان'), 'برتقال');
  assert.equal(category.lastUsedAt, 0);
  assert.deepEqual(prepareCategories([{ _id: 'empty', answers: [] }]), []);
});

test('category selection prefers oldest, breaks ties randomly, avoids repeats and resets exhausted history', () => {
  const categories = [0, 1, 2].map((id) => ({ id: String(id), lastUsedAt: id === 2 ? 10 : 0 }));
  const used = new Set();
  const first = selectCategory(categories, used, 0.9);
  assert.equal(first.category.id, '1');
  assert.equal(used.size, 0);
  const second = selectCategory(categories, first.usedCategoryIds, 0);
  assert.equal(second.category.id, '0');
  const third = selectCategory(categories, second.usedCategoryIds, 0);
  assert.equal(third.category.id, '2');
  const reset = selectCategory(categories, third.usedCategoryIds, 0);
  assert.deepEqual([...reset.usedCategoryIds], ['0']);
  assert.throws(() => selectCategory([], used, 0), /No categories/);
});

test('correct answer locks canonical word, wrong/repeat/locked score correctly without changing inputs', () => {
  const initial = fixture();
  const correct = submitAnswer(initial, '0', 'التفاحة', 1100);
  assert.deepEqual(correct.ack, { result: 'correct', delta: 1, score: 1 });
  assert.equal(initial.players.get('0').score, 0);
  assert.equal(initial.locked.size, 0);
  assert.equal(correct.room.players.get('0').lastCorrectAt, 1100);
  assert.equal(correct.room.locked.get('تفاحه').byId, '0');
  const repeat = submitAnswer(correct.room, '0', 'تفاحة', 1200);
  assert.equal(repeat.ack.result, 'repeat');
  const locked = submitAnswer(repeat.room, '1', 'تفاحه', 1300);
  assert.deepEqual(locked.ack, { result: 'locked', delta: -1, score: -1 });
  const repeatLocked = submitAnswer(locked.room, '1', 'تفاحة', 1400);
  assert.deepEqual(repeatLocked.ack, { result: 'repeat', delta: 0, score: -1 });
  const wrong = submitAnswer(repeatLocked.room, '2', 'سيارة', 1500);
  assert.equal(wrong.ack.result, 'wrong');
  assert.equal(submitAnswer(wrong.room, '2', 'سيارة', 1600).ack.result, 'repeat');
});

test('aliases cannot award a second point or bypass another player’s lock', () => {
  const first = submitAnswer(fixture(), '0', 'بردقان', 1100);
  assert.equal(first.word, 'برتقال');
  const ownAlias = submitAnswer(first.room, '0', 'برتقال', 1200);
  assert.deepEqual(ownAlias.ack, { result: 'repeat', delta: 0, score: 1 });
  assert.equal(submitAnswer(ownAlias.room, '1', 'برتقال', 1300).ack.result, 'locked');
});

test('invalid/long answers, missing players, eliminated players, inactive rounds and deadline', () => {
  const room = fixture();
  for (const text of ['', ' ', null, {}, 'ا'.repeat(41), 'ا'.repeat(1001)]) {
    assert.equal(submitAnswer(room, '0', text, 1100).ack.result, 'wrong');
  }
  assert.equal(submitAnswer(room, 'absent', 'موز', 1100).ack.result, 'closed');
  for (const status of ['lobby', 'countdown', 'roundEnd', 'over']) {
    assert.equal(submitAnswer({ ...room, status }, '0', 'موز', 1100).ack.result, 'closed');
  }
  assert.equal(submitAnswer(room, '0', 'موز', room.endsAt).ack.result, 'closed');
  assert.equal(submitAnswer(room, '0', 'موز', room.endsAt + 1).ack.result, 'closed');
  room.players.get('0').out = true;
  assert.equal(submitAnswer(room, '0', 'موز', 1100).ack.result, 'closed');
});

test('rate limit is per-player, allows five per sliding second and recovers', () => {
  let room = fixture();
  for (let i = 0; i < 5; i++) room = submitAnswer(room, '0', `خطأ${i}`, 1100 + i).room;
  const limited = submitAnswer(room, '0', 'موز', 1200);
  assert.equal(limited.ack.result, 'wrong');
  assert.equal(limited.room.locked.size, 0);
  assert.equal(submitAnswer(limited.room, '1', 'موز', 1200).ack.result, 'correct');
  assert.equal(submitAnswer(limited.room, '0', 'برتقال', 2104).ack.result, 'correct');
});

test('round reset clears scores, locks, submitted words, rate limit and timing history', () => {
  const previous = submitAnswer(fixture(), '0', 'موز', 1100).room;
  const next = startRound({ ...previous, startsAt: 50000 });
  assert.equal(next.endsAt, 50000 + LIMITS.round);
  assert.equal(next.players.get('0').score, 0);
  assert.equal(next.players.get('0').lastCorrectAt, null);
  assert.equal(next.players.get('0').submitted.size, 0);
  assert.deepEqual(next.players.get('0').submissionTimes, []);
  assert.equal(next.locked.size, 0);
  assert.equal(previous.locked.size, 1);
});

test('elimination: lowest, latest correct, no correct, last joined; disconnected players count', () => {
  const cases = [
    [{ score: -1 }, { score: 2 }, { score: 1 }, '0'],
    [{ lastCorrectAt: 1300 }, { lastCorrectAt: 1200 }, { score: 1 }, '0'],
    [{ lastCorrectAt: 1300 }, { lastCorrectAt: null }, { score: 1 }, '1'],
    [{ lastCorrectAt: 1300 }, { lastCorrectAt: 1300 }, { score: 1 }, '1'],
    [{}, {}, { connected: false }, '2'],
  ];
  for (const [a, b, c, expected] of cases) {
    const room = fixture();
    [a, b, c].forEach((patch, index) => Object.assign(room.players.get(String(index)), patch));
    const result = eliminatePlayer(room);
    assert.equal(result.eliminated.id, expected);
    assert.equal([...result.room.players.values()].filter((p) => p.out).length, 1);
    assert.equal(room.players.get(expected).out, false);
  }
});

test('ranking follows reverse elimination order; restart keeps code and connected players only', () => {
  const initial = fixture();
  const first = eliminatePlayer(initial).room;
  const final = eliminatePlayer(first).room;
  assert.deepEqual(gameRanking(final).map(({ id, place }) => [id, place]), [['0', 1], ['1', 2], ['2', 3]]);
  final.players.get('2').connected = false;
  const restarted = restartRoom(final);
  assert.equal(restarted.code, initial.code);
  assert.equal(restarted.hostId, initial.hostId);
  assert.equal(restarted.status, 'lobby');
  assert.equal(restarted.players.size, 2);
  assert.deepEqual(restarted.joinOrder, ['0', '1']);
  assert.equal(restarted.eliminatedOrder.length, 0);
  assert.equal(restarted.category, null);
  assert.equal([...restarted.players.values()].every((p) => !p.out && p.score === 0), true);
});

test('public payloads and reconnect snapshot contain no answer index or private identities', () => {
  const room = submitAnswer(fixture(), '0', 'موز', 1100).room;
  const state = stateSnapshot(room, '0');
  assert.deepEqual(state.category, { id: 'fruit', title: 'فواكه' });
  assert.deepEqual(state.me, { id: '0', out: false, score: 1 });
  assert.deepEqual(state.locked, [{ word: 'موز', by: { id: '0', name: 'لاعب 0' } }]);
  assert.equal(stateSnapshot(room).me, null);
  assert.deepEqual(scoresPayload(room).scores.map((p) => p.score), [1, 0, 0]);
  assert.deepEqual(Object.keys(playersPayload(room).players[0]), ['id', 'name', 'out', 'connected']);
  assert.equal(JSON.stringify(state).includes('socket-'), false);
  assert.equal(JSON.stringify(state).includes('answers'), false);
});

// ---- PB-16 Freeze card (SPEC §17.6) ----
function teamFixture() {
  const room = fixture(4);
  room.gameMode = 'teams';
  room.cards = { A: newTeamCards(), B: newTeamCards() };
  room.sitout = { A: null, B: null };
  ['A', 'A', 'B', 'B'].forEach((team, i) => room.players.set(String(i), { ...room.players.get(String(i)), team }));
  return room; // round is running: startsAt 1000, endsAt 21000
}
function withScores(room, scores) {
  const players = new Map(room.players);
  for (const [id, score] of Object.entries(scores)) players.set(id, { ...players.get(id), score });
  return { ...room, players };
}

test('freeze: who may play it (team mode, own team card, sitting-out rule)', () => {
  const room = teamFixture();
  assert.equal(cardPlayError({ ...room, gameMode: undefined }, '0', 'freeze'), 'NOT_NOW');
  assert.equal(cardPlayError(room, 'nobody', 'freeze'), 'NOT_ALLOWED');
  assert.equal(cardPlayError(room, '0', 'freeze'), null);
  assert.equal(cardPlayError({ ...room, sitout: { A: '1', B: null } }, '0', 'freeze'), 'NOT_ALLOWED');
  assert.equal(cardPlayError({ ...room, sitout: { A: '1', B: null } }, '1', 'freeze'), null);
  assert.equal(cardPlayError({ ...room, cards: { ...room.cards, A: { ...room.cards.A, freeze: 0 } } }, '0', 'freeze'), 'NO_CARD');
});

test('freeze: targets the top-scoring rival, random on ties, skips sitting-out players', () => {
  const room = withScores(teamFixture(), { 0: 5, 1: 0, 2: 2, 3: 4 });
  assert.equal(freezeTarget(room, 'A', 0).id, '3');
  assert.equal(freezeTarget(room, 'B', 0.9).id, '0');
  const tie = withScores(room, { 2: 4, 3: 4 });
  assert.equal(freezeTarget(tie, 'A', 0).id, '2');
  assert.equal(freezeTarget(tie, 'A', 0.99).id, '3');
  assert.equal(freezeTarget({ ...room, sitout: { A: null, B: '3' } }, 'A', 0).id, '2');
  assert.equal(freezeTarget({ ...room, sitout: { A: null, B: '3' }, players: new Map([...room.players].filter(([id]) => id !== '2')) }, 'A', 0), null);
});

test('freeze: blocks the target for exactly 3 seconds, uses the card, never changes the input room', () => {
  const room = withScores(teamFixture(), { 2: 1, 3: 3 });
  const before = room.cards.A.freeze;
  const played = playFreeze(room, '0', 5000, 0);
  assert.equal(played.error, undefined);
  assert.deepEqual(played.target, { id: '3', name: 'لاعب 3' });
  assert.deepEqual(played.by, { id: '0', name: 'لاعب 0' });
  assert.equal(played.team, 'A');
  assert.equal(played.until, 5000 + FREEZE_MS);
  assert.equal(played.room.cards.A.freeze, 0);
  assert.equal(played.room.cards.B.freeze, 1);
  assert.equal(room.cards.A.freeze, before);
  assert.equal(room.players.get('3').frozenUntil, null);
  assert.equal(submitAnswer(played.room, '3', 'موز', 5000).ack.result, 'frozen');
  assert.equal(submitAnswer(played.room, '3', 'موز', 7999).ack.result, 'frozen');
  assert.equal(submitAnswer(played.room, '3', 'موز', 8000).ack.result, 'correct');
  assert.equal(submitAnswer(played.room, '2', 'موز', 5000).ack.result, 'correct');
  assert.equal(stateSnapshot(played.room, '3').me.frozenUntil, 8000);
  assert.equal(playFreeze(played.room, '1', 6000, 0).error, 'NO_CARD');
  assert.equal(playFreeze(played.room, '2', 6000, 0).error, undefined); // team B still has its card
});

test('freeze: only during a running battle and not in its last 3 seconds; reset by next round and restart', () => {
  const room = teamFixture();
  assert.equal(playFreeze({ ...room, status: 'countdown' }, '0', 5000, 0).error, 'NOT_NOW');
  assert.equal(playFreeze(room, '0', room.endsAt - FREEZE_MS, 0).error, 'NOT_NOW');
  assert.equal(playFreeze(room, '0', room.endsAt - FREEZE_MS - 1, 0).error, undefined);
  assert.equal(playFreeze({ ...room, gameMode: 'classic' }, '0', 5000, 0).error, 'NOT_NOW');
  const frozen = playFreeze(room, '0', 5000, 0).room;
  assert.ok([...startRound({ ...frozen, startsAt: 30000 }).players.values()].every((p) => p.frozenUntil === null));
  assert.ok([...restartRoom(frozen).players.values()].every((p) => p.frozenUntil === null));
});
