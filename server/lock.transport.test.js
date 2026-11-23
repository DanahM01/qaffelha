import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachGameHandlers } from './index.js';
import { prepareCategories } from './game.js';

// Exercise the production transport with deterministic phase deadlines, like the PB-14/PB-18 checks.
function harness() {
  let time = 100000, sequence = 0;
  const jobs = new Map(), io = new EventEmitter();
  io.sockets = { sockets: new Map() };
  io.to = target => ({ emit(event, payload) {
    for (const socket of io.sockets.sockets.values()) if (socket.memberships.has(target)) socket.received.push({ event, payload });
  } });
  const game = attachGameHandlers(io, { now: () => time, random: () => 0, log: () => {},
    categories: prepareCategories(Array.from({ length: 16 }, (_, id) => ({ _id: String(id), title: `فئة ${id}`,
      answers: ['موز', 'تفاح', 'برتقال'] }))),
    schedule(callback, delay) { const id = ++sequence; jobs.set(id, { callback, at: time + delay }); return id; },
    cancel(id) { jobs.delete(id); } });
  function connect() {
    const socket = new EventEmitter();
    Object.assign(socket, { id: `socket-${++sequence}`, data: {}, memberships: new Set(), received: [] });
    socket.memberships.add(socket.id);
    socket.join = code => socket.memberships.add(code);
    socket.leave = code => socket.memberships.delete(code);
    socket.request = (event, input) => {
      let ack; socket.emit(event, input, response => { ack = response; });
      assert.notEqual(ack, undefined, `${event} must acknowledge`); return ack;
    };
    socket.all = event => socket.received.filter(message => message.event === event).map(message => message.payload);
    socket.latest = event => socket.all(event).at(-1);
    io.sockets.sockets.set(socket.id, socket); io.emit('connection', socket); return socket;
  }
  function advance(ms) {
    const target = time + ms;
    while (true) {
      const next = [...jobs].filter(([, job]) => job.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      jobs.delete(next[0]); time = next[1].at; next[1].callback();
    }
    time = target;
  }
  const host = connect(), created = host.request('room:create', { mode: 'screen' }), code = created.code;
  const players = {};
  for (const name of ['a0', 'b0', 'a1', 'b1']) {
    const socket = connect(); socket.playerId = socket.request('room:join', { code, name }).playerId;
    assert.equal(host.request('team:set', { code, playerId: socket.playerId, team: name[0].toUpperCase() }).ok, true);
    players[name] = socket;
  }
  assert.equal(host.request('game:start', { code, gameMode: 'teams' }).ok, true);
  return { game, host, code, created, ...players, connect, advance };
}

test('PB-17 one Lock announcement and inventory update precede a +2 battle with synchronized badges', () => {
  const h = harness();
  try {
    assert.equal(h.a0.request('square:choose', { code: h.code, squareId: 0 }).ok, true);
    const deadline = h.host.latest('battle:chosen').cardWindowEndsAt;
    assert.deepEqual(h.a0.request('card:play', { code: h.code, card: 'lock' }), { ok: false, error: 'NOT_ALLOWED' });
    assert.deepEqual(h.b0.request('card:play', { code: h.code, card: 'lock' }), { ok: true });
    assert.deepEqual(h.b1.request('card:play', { code: h.code, card: 'lock' }), { ok: false, error: 'NO_CARD' });
    for (const socket of [h.host, h.a0, h.a1, h.b0, h.b1]) {
      assert.equal(socket.all('card:played').length, 1);
      assert.deepEqual(socket.latest('card:played'), { team: 'B', card: 'lock', by: { id: h.b0.playerId, name: 'b0' }, target: 0 });
      assert.equal(socket.latest('board:update').cards.B.lock, 0);
    }
    const fresh = h.connect();
    const window = fresh.request('room:rejoin', { code: h.code, playerId: h.b0.playerId }).state;
    assert.equal(window.cardWindowEndsAt, deadline);
    assert.equal(window.chosen.lockedBy, 'B');
    assert.equal(window.players.length, 4);
    h.advance(8000);
    assert.equal(fresh.latest('round:start').lockedBy, 'B');
    assert.equal(fresh.latest('round:start').squareId, 0);
    assert.deepEqual(fresh.request('answer:submit', { code: h.code, text: 'موز' }), { result: 'correct', delta: 2, score: 2 });
    assert.equal(h.host.latest('score:update').teamScores.B, 2);
    const roundDeadline = fresh.latest('round:start').endsAt;
    const refreshed = h.connect().request('room:rejoin', { code: h.code, playerId: h.b0.playerId }).state;
    assert.equal(refreshed.me.score, 2);
    assert.equal(refreshed.me.team, 'B');
    assert.equal(refreshed.endsAt, roundDeadline);
    h.advance(20000);
    assert.equal(h.host.latest('battle:end').winnerTeam, 'B');
    assert.equal(h.host.latest('battle:end').teamScores.B, 2);
    h.advance(4000);
    assert.equal(h.b1.request('square:choose', { code: h.code, squareId: 1 }).ok, true);
    h.advance(8000);
    assert.equal(h.b1.latest('round:start').lockedBy, null);
    assert.equal(h.b1.request('answer:submit', { code: h.code, text: 'موز' }).delta, 1);
    assert.equal(h.host.request('game:restart', { code: h.code }).ok, true);
    const reset = h.connect().request('room:rejoin', { code: h.code, playerId: h.b1.playerId }).state;
    assert.equal(reset.status, 'lobby');
    assert.equal(reset.cards.B.lock, 1);
  } finally { h.game.dispose(); }
});

test('PB-17 stale, foreign, host and malformed card requests never consume a Lock', () => {
  const h = harness();
  try {
    assert.equal(h.b0.request('card:play', { code: h.code, card: 'lock' }).error, 'NOT_NOW');
    h.a0.request('square:choose', { code: h.code, squareId: 0 });
    assert.equal(h.host.request('card:play', { code: h.code, card: 'lock' }).error, 'NOT_ALLOWED');
    assert.equal(h.connect().request('card:play', { code: h.code, card: 'lock' }).error, 'NOT_ALLOWED');
    assert.equal(h.b0.request('card:play', { code: 'XXXX', card: 'lock' }).error, 'NOT_ALLOWED');
    assert.equal(h.b0.request('card:play', { code: h.code, card: 'lock', target: '0' }).error, 'BAD_TARGET');
    h.advance(5000);
    assert.equal(h.b0.request('card:play', { code: h.code, card: 'lock' }).error, 'NOT_NOW');
    assert.equal(h.game.rooms.get(h.code).cards.B.lock, 1);
    assert.equal(h.host.all('card:played').length, 0);
  } finally { h.game.dispose(); }
});

test('PB-17 accepts the final millisecond, but repeated rejoin cannot extend the card window', () => {
  const h = harness();
  try {
    h.a0.request('square:choose', { code: h.code, squareId: 0 });
    h.advance(4999);
    assert.equal(h.b0.request('card:play', { code: h.code, card: 'lock' }).ok, true);
    h.advance(1);
    assert.equal(h.host.latest('round:countdown').startsAt, 108000);
    const state = h.connect().request('room:rejoin', { code: h.code, playerId: h.b0.playerId }).state;
    assert.equal(state.status, 'countdown');
    assert.equal(state.chosen.lockedBy, 'B');
    assert.equal(state.cardWindowEndsAt, 105000);
  } finally { h.game.dispose(); }
});
