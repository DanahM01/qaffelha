import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachGameHandlers, createGameServer } from './index.js';
import { prepareCategories } from './game.js';

// Exercise the real event handlers with deterministic time and room delivery.
function harness() {
  let time = 100000;
  let sequence = 0;
  const jobs = new Map();
  const io = new EventEmitter();
  io.sockets = { sockets: new Map() };
  io.to = (code) => ({ emit(event, payload) {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.memberships.has(code)) socket.received.push({ event, payload });
    }
  } });
  const used = [];
  const logs = [];
  const game = attachGameHandlers(io, {
    categories: prepareCategories([{ _id: 'fruit', title: 'فواكه', answers: ['موز', 'تفاح', 'برتقال'] }]),
    now: () => time, random: () => 0, log: (line) => logs.push(line),
    onCategoryUsed: async (...args) => used.push(args),
    schedule(callback, delay) { const id = ++sequence; jobs.set(id, { callback, at: time + delay }); return id; },
    cancel(id) { jobs.delete(id); },
  });
  function connect() {
    const socket = new EventEmitter();
    socket.id = `socket-${++sequence}`;
    socket.data = {};
    socket.memberships = new Set();
    socket.received = [];
    socket.join = (code) => socket.memberships.add(code);
    socket.leave = (code) => socket.memberships.delete(code);
    socket.request = (event, input) => {
      let result;
      socket.emit(event, input, (response) => { result = response; });
      assert.notEqual(result, undefined, `${event} must acknowledge`);
      return result;
    };
    socket.latest = (event) => socket.received.findLast((message) => message.event === event)?.payload;
    socket.disconnect = () => { socket.emit('disconnect'); io.sockets.sockets.delete(socket.id); };
    io.sockets.sockets.set(socket.id, socket);
    io.emit('connection', socket);
    return socket;
  }
  function advance(milliseconds) {
    const target = time + milliseconds;
    while (true) {
      const next = [...jobs].filter(([, job]) => job.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      time = next[1].at;
      jobs.delete(next[0]);
      next[1].callback();
    }
    time = target;
  }
  function lobby(mode = 'screen') {
    const host = connect();
    const created = host.request('room:create', { mode, name: 'ليان' });
    const players = mode === 'phone' ? [host] : [];
    while (players.length < 3) {
      const socket = connect();
      socket.identity = socket.request('room:join', { code: created.code, name: `لاعب ${players.length}` });
      players.push(socket);
    }
    return { host, created, players, code: created.code };
  }
  return { ...game, connect, lobby, advance, used, jobs, logs };
}

for (const mode of ['screen', 'phone']) test(`${mode}: full synchronized game, scoring, elimination, ranking and restart`, async () => {
  const h = harness();
  const { host, code, players } = h.lobby(mode);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  assert.equal(host.latest('room:players').players.length, 3);
  assert.deepEqual(host.request('game:start', { code }), { ok: true });
  const countdown = host.latest('round:countdown');
  assert.equal(countdown.startsAt, 103000);
  assert.deepEqual(host.request('game:start', { code }), { ok: true });
  h.advance(2999);
  assert.equal(host.latest('round:start'), undefined);
  h.advance(1);
  assert.equal(host.latest('round:start').endsAt, 123000);
  for (const player of players) assert.deepEqual(player.latest('round:start'), host.latest('round:start'));
  assert.deepEqual(players[0].request('answer:submit', { code, text: 'موز' }), { result: 'correct', delta: 1, score: 1 });
  assert.deepEqual(players[1].request('answer:submit', { code, text: 'موز' }), { result: 'locked', delta: -1, score: -1 });
  assert.equal(players[2].latest('answer:locked').word, 'موز');
  assert.equal(players[2].latest('score:update').scores[1].score, -1);
  h.advance(20000);
  assert.equal(host.latest('round:end').eliminated.id, players[1].data.playerId);
  assert.equal(host.latest('room:players').players[1].out, true);
  assert.equal(players[1].request('answer:submit', { code, text: 'تفاح' }).result, 'closed');
  h.advance(5000);
  assert.equal(host.latest('round:countdown').round, 2);
  h.advance(3000);
  assert.equal(h.rooms.get(code).players.get(players[0].data.playerId).score, 0);
  players[0].request('answer:submit', { code, text: 'تفاح' });
  h.advance(20000);
  assert.equal(host.latest('round:end').eliminated.id, players[2].data.playerId);
  h.advance(4999);
  assert.equal(host.latest('game:over'), undefined);
  h.advance(1);
  const over = host.latest('game:over');
  assert.equal(over.winner.id, players[0].data.playerId);
  assert.deepEqual(over.ranking.map((entry) => entry.place), [1, 2, 3]);
  assert.deepEqual(host.request('game:restart', { code }), { ok: true });
  assert.equal(h.rooms.get(code).status, 'lobby');
  assert.equal(host.latest('room:players').players.every((player) => !player.out), true);
  assert.equal(h.jobs.size, 0);
  await Promise.resolve();
  assert.equal(h.used.length, 2);
  assert.equal(h.logs.some((line) => line.includes('game over')), true);
  h.dispose();
});

test('payload validation, all join errors, host authorization, no-ack calls and room isolation', () => {
  const h = harness();
  const outsider = h.connect();
  for (const value of [null, [], 42, {}, { mode: 'other' }, { mode: 'phone', name: '' }]) {
    assert.equal(outsider.request('room:create', value).ok, false);
  }
  const host = h.connect();
  const { code } = host.request('room:create', { mode: 'screen' });
  assert.equal(host.request('game:start', { code }).error, 'NOT_ENOUGH_PLAYERS');
  assert.equal(outsider.request('room:join', { code: 'XXXX', name: 'ليان' }).error, 'NOT_FOUND');
  assert.equal(outsider.request('room:join', { code, name: {} }).error, 'NAME_INVALID');
  const first = h.connect();
  first.request('room:join', { code: code.toLowerCase(), name: 'تفاحة' });
  assert.equal(outsider.request('room:join', { code, name: 'تفاحه' }).error, 'NAME_TAKEN');
  for (let i = 1; i < 12; i++) h.connect().request('room:join', { code, name: `لاعب ${i}` });
  assert.equal(outsider.request('room:join', { code, name: 'ليان' }).error, 'FULL');
  assert.equal(first.request('game:start', { code }).error, 'NOT_HOST');
  assert.equal(first.request('game:restart', { code }).error, 'NOT_HOST');
  host.request('game:start', { code });
  assert.equal(outsider.request('room:join', { code, name: 'ليان' }).error, 'STARTED');
  assert.equal(outsider.request('answer:submit', { code, text: 'موز' }).result, 'closed');
  assert.equal(outsider.received.length, 0);
  assert.doesNotThrow(() => outsider.emit('room:join', null));
  assert.doesNotThrow(() => outsider.emit('answer:submit', null));
  h.dispose();
  assert.equal(h.jobs.size, 0);
});

test('player rejoin restores state and revokes the replaced socket', () => {
  const h = harness();
  const { host, code, players } = h.lobby();
  host.request('game:start', { code });
  h.advance(3000);
  const old = players[0];
  const playerId = old.data.playerId;
  old.request('answer:submit', { code, text: 'موز' });
  const replacement = h.connect();
  const ack = replacement.request('room:rejoin', { code, playerId });
  assert.equal(ack.ok, true);
  assert.equal(ack.state.status, 'round');
  assert.equal(ack.state.me.score, 1);
  assert.equal(ack.state.endsAt, 123000);
  assert.equal(ack.state.locked.length, 1);
  assert.equal(ack.state.category.answers, undefined);
  assert.equal(old.memberships.size, 0);
  assert.equal(old.request('answer:submit', { code, text: 'تفاح' }).result, 'closed');
  old.disconnect();
  assert.equal(h.rooms.get(code).players.get(playerId).connected, true);
  replacement.disconnect();
  assert.equal(host.latest('room:players').players[0].connected, false);
  const reconnect = h.connect();
  assert.equal(reconnect.request('room:rejoin', { code, playerId }).state.me.id, playerId);
  assert.equal(reconnect.request('room:rejoin', { code, playerId: 'missing' }).error, 'NOT_FOUND');
  h.dispose();
});

for (const status of ['lobby', 'countdown', 'round', 'roundEnd', 'over']) {
  for (const mode of ['screen', 'phone']) test(`PB-28: ${mode} player refresh restores ${status} without creating an identity`, () => {
    const h = harness();
    try {
      const { host, code, players } = h.lobby(mode);
      const old = players[0];
      const playerId = old.data.playerId;
      const room = h.rooms.get(code);
      const name = room.players.get(playerId).name;
      if (status !== 'lobby') host.request('game:start', { code });
      if (['round', 'roundEnd', 'over'].includes(status)) {
        h.advance(3000);
        old.request('answer:submit', { code, text: 'موز' });
      }
      if (status === 'roundEnd') h.advance(20000);
      if (status === 'over') h.advance(53000);
      const before = h.rooms.get(code);
      const score = before.players.get(playerId).score;
      const endsAt = before.endsAt;
      old.disconnect();
      const fresh = h.connect();
      const ack = fresh.request('room:rejoin', { code, playerId });
      assert.equal(ack.ok, true);
      assert.equal(ack.state.status, status);
      assert.equal(ack.state.me.id, playerId);
      assert.equal(ack.state.me.score, score);
      assert.equal(ack.state.players.find(player => player.id === playerId).name, name);
      assert.equal(ack.state.players.length, 3);
      assert.equal(h.rooms.get(code).players.size, 3);
      assert.equal(ack.state.endsAt, endsAt);
      if (status === 'roundEnd') assert.deepEqual(ack.state.eliminated, host.latest('round:end').eliminated);
      if (status === 'over') {
        assert.deepEqual(ack.state.winner, host.latest('game:over').winner);
        assert.deepEqual(ack.state.ranking, host.latest('game:over').ranking);
      }
    } finally { h.dispose(); }
  });
}

test('PB-28: eliminated refresh stays out and repeated refreshes preserve the same slot', () => {
  const h = harness();
  try {
    const { host, code } = h.lobby();
    host.request('game:start', { code });
    h.advance(23000);
    const { id } = host.latest('round:end').eliminated;
    for (let i = 0; i < 3; i++) {
      const fresh = h.connect();
      const ack = fresh.request('room:rejoin', { code, playerId: id });
      assert.equal(ack.state.me.out, true);
      assert.equal(ack.state.eliminated.id, id);
      assert.equal(ack.state.players.length, 3);
      assert.equal(fresh.request('answer:submit', { code, text: 'موز' }).result, 'closed');
      fresh.disconnect();
    }
  } finally { h.dispose(); }
});

test('screen host rejoins with its private identity and old host loses controls', () => {
  const h = harness();
  const { host, created, code } = h.lobby();
  const replacement = h.connect();
  assert.equal(replacement.request('room:rejoin', { code, hostToken: 'invalid' }).error, 'NOT_FOUND');
  const ack = replacement.request('room:rejoin', { code, hostToken: created.hostToken });
  assert.equal(ack.state.me, null);
  assert.equal(ack.state.hostId, null);
  assert.equal(host.request('game:start', { code }).error, 'NOT_HOST');
  assert.equal(replacement.request('game:start', { code }).ok, true);
  h.dispose();
});

test('phone host handover waits 15 seconds and a timely reconnect cancels it', () => {
  const h = harness();
  const { host, code, created, players } = h.lobby('phone');
  host.disconnect();
  h.advance(14999);
  assert.equal(h.rooms.get(code).hostId, created.playerId);
  const replacement = h.connect();
  replacement.request('room:rejoin', { code, playerId: created.playerId });
  h.advance(1);
  assert.equal(h.rooms.get(code).hostId, created.playerId);
  replacement.disconnect();
  h.advance(15000);
  assert.equal(h.rooms.get(code).hostId, players[1].data.playerId);
  assert.equal(players[1].latest('room:players').hostId, players[1].data.playerId);
  const oldHost = h.connect();
  oldHost.request('room:rejoin', { code, playerId: created.playerId });
  assert.equal(oldHost.request('game:start', { code }).error, 'NOT_HOST');
  assert.equal(players[1].request('game:start', { code }).ok, true);
  h.dispose();
});

test('empty rooms expire after ten minutes; reconnect cancels cleanup', () => {
  const h = harness();
  const host = h.connect();
  const created = host.request('room:create', { mode: 'screen' });
  host.disconnect();
  h.advance(599999);
  assert.equal(h.rooms.has(created.code), true);
  const replacement = h.connect();
  replacement.request('room:rejoin', { code: created.code, hostToken: created.hostToken });
  h.advance(1);
  assert.equal(h.rooms.has(created.code), true);
  replacement.disconnect();
  h.advance(600000);
  assert.equal(h.rooms.has(created.code), false);
  assert.equal(h.jobs.size, 0);
  assert.equal(h.connect().request('room:rejoin', { code: created.code, hostToken: created.hostToken }).error, 'NOT_FOUND');
});

test('restart cancels pending round timers and drops disconnected players', () => {
  const h = harness();
  const { host, code, players } = h.lobby();
  host.request('game:start', { code });
  players[2].disconnect();
  host.request('game:restart', { code });
  h.advance(30000);
  assert.equal(h.rooms.get(code).status, 'lobby');
  assert.equal(h.rooms.get(code).players.size, 2);
  assert.equal(host.latest('round:start'), undefined);
  assert.equal(host.request('game:start', { code }).error, 'NOT_ENOUGH_PLAYERS');
  h.dispose();
});

test('HTTP health endpoint runs with the real Express and Socket.IO server', async (t) => {
  const server = createGameServer({ categories: prepareCategories([{ _id: 'fruit', title: 'فواكه', answers: ['موز'] }]) });
  t.after(() => { server.dispose(); return new Promise((resolve) => server.io.close(resolve)); });
  await new Promise((resolve) => server.http.listen(0, '127.0.0.1', resolve));
  const response = await fetch(`http://127.0.0.1:${server.http.address().port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('real Socket.IO polling transport delivers acknowledgements, room broadcasts and host authorization', async (t) => {
  const server = createGameServer({ log: () => {},
    categories: prepareCategories([{ _id: 'fruit', title: 'فواكه', answers: ['موز'] }]) });
  t.after(() => { server.dispose(); return new Promise((resolve) => server.io.close(resolve)); });
  await new Promise((resolve) => server.http.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.http.address().port}/socket.io/?EIO=4&transport=polling`;
  async function connect() {
    const handshake = await (await fetch(base)).text();
    assert.equal(handshake[0], '0');
    const { sid } = JSON.parse(handshake.slice(1));
    const url = `${base}&sid=${encodeURIComponent(sid)}`;
    const received = [];
    let nextId = 0;
    async function send(body) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body,
        signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      await response.text();
    }
    async function poll() {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      const packets = (await response.text()).split('\x1e');
      for (const packet of packets) if (packet.startsWith('42')) received.push(JSON.parse(packet.slice(2)));
      return packets;
    }
    await send('40');
    assert.equal((await poll()).some((packet) => packet.startsWith('40')), true);
    return { received, async request(event, input) {
      const id = nextId++;
      await send(`42${id}${JSON.stringify([event, input])}`);
      const prefix = `43${id}[`;
      for (let attempt = 0; attempt < 5; attempt++) {
        const ack = (await poll()).find((packet) => packet.startsWith(prefix));
        if (ack) return JSON.parse(ack.slice(2 + String(id).length))[0];
      }
      assert.fail(`Missing acknowledgement for ${event}`);
    } };
  }
  const host = await connect();
  const created = await host.request('room:create', { mode: 'screen' });
  assert.equal(created.ok, true);
  const player = await connect();
  const joined = await player.request('room:join', { code: created.code, name: 'ليان' });
  assert.equal(joined.ok, true);
  assert.deepEqual(await player.request('game:start', { code: created.code }), { ok: false, error: 'NOT_HOST' });
  assert.deepEqual(await host.request('game:start', { code: created.code }), { ok: false, error: 'NOT_ENOUGH_PLAYERS' });
  assert.equal(host.received.some(([event, payload]) => event === 'room:players' && payload.players.length === 1), true);
  const rejoined = await player.request('room:rejoin', { code: created.code, playerId: joined.playerId });
  assert.equal(rejoined.state.me.id, joined.playerId);
  assert.equal(rejoined.state.status, 'lobby');
});
