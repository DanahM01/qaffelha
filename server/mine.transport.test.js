// PB-18 Mine card (Renad): Socket.IO transport. Its own small harness: like real Socket.IO,
// every socket is also in a room named after its own id, so per-socket delivery is visible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachGameHandlers } from './index.js';
import { prepareCategories, MINE_PENALTY } from './game.js';

const categories = prepareCategories(Array.from({ length: 20 }, (_, id) => ({
  _id: String(id), title: `فئة ${id}`, answers: ['موز', 'تفاح'], lastUsedAt: id })));

function harness(options = {}) {
  let time = 100000;
  let sequence = 0;
  const jobs = new Map();
  const io = new EventEmitter();
  io.sockets = { sockets: new Map() };
  io.to = (target) => ({ emit(event, payload) {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.memberships.has(target)) socket.received.push({ event, payload });
    }
  } });
  const game = attachGameHandlers(io, {
    categories, now: () => time, random: () => 0, log: () => {},
    schedule(callback, delay) { const id = ++sequence; jobs.set(id, { callback, at: time + delay }); return id; },
    cancel(id) { jobs.delete(id); },
    ...options,
  });
  function connect() {
    const socket = new EventEmitter();
    socket.id = `socket-${++sequence}`;
    socket.data = {};
    socket.memberships = new Set([socket.id]);
    socket.received = [];
    socket.join = (code) => socket.memberships.add(code);
    socket.leave = (code) => socket.memberships.delete(code);
    socket.request = (event, input) => {
      let result;
      socket.emit(event, input, (response) => { result = response; });
      assert.notEqual(result, undefined, `${event} must acknowledge`);
      return result;
    };
    socket.all = (event) => socket.received.filter((message) => message.event === event).map((message) => message.payload);
    socket.latest = (event) => socket.all(event).at(-1);
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
  // A screen-mode room with 4 players: a0, a1 in team A and b0, b1 in team B, started in teams mode.
  function teams(start = true) {
    const host = connect();
    const created = host.request('room:create', { mode: 'screen' });
    const code = created.code;
    const sockets = {};
    for (const name of ['a0', 'b0', 'a1', 'b1']) {
      sockets[name] = connect();
      sockets[name].playerId = sockets[name].request('room:join', { code, name }).playerId;
    }
    for (const name of Object.keys(sockets)) {
      assert.equal(host.request('team:set', { code, playerId: sockets[name].playerId, team: name[0].toUpperCase() }).ok, true);
    }
    if (start) assert.deepEqual(host.request('game:start', { code, gameMode: 'teams' }), { ok: true });
    return { host, code, created, ...sockets, everyone: [host, ...Object.values(sockets)] };
  }
  return { io, game, connect, advance, teams, now: () => time };
}

const forget = (...sockets) => sockets.forEach((socket) => { socket.received = []; });
const sent = (socket, event) => socket.received.some((message) => message.event === event);

// Team A mines square 5 and chooses square 0; nobody answers, so that battle is a draw.
// Then it is team B's turn.
function mineThenDraw(h, g) {
  assert.equal(g.host.latest('turn:start').team, 'A');
  assert.deepEqual(g.a0.request('card:play', { code: g.code, card: 'mine', target: 5 }), { ok: true });
  assert.deepEqual(g.a0.request('square:choose', { code: g.code, squareId: 0 }), { ok: true });
  h.advance(5000 + 3000 + 20000); // card window + countdown + battle
  assert.equal(g.host.latest('battle:end').winnerTeam, null);
  h.advance(4000); // result → next turn
  assert.equal(g.host.latest('turn:start').team, 'B');
}

// Team B chooses square 5 (A's mine) and `winner` answers once, so that team wins the battle.
function battleOnMine(h, g, winner) {
  assert.deepEqual(g.b0.request('square:choose', { code: g.code, squareId: 5 }), { ok: true });
  h.advance(5000 + 3000);
  assert.equal(g.host.latest('round:start').squareId, 5);
  forget(...g.everyone);
  assert.equal(g[winner].request('answer:submit', { code: g.code, text: 'موز' }).result, 'correct');
  h.advance(20000);
}

test('PB-18 card:play mine: ok, card:played has no target, only the owner team gets board:mines', () => {
  const h = harness();
  const g = h.teams();
  forget(...g.everyone);
  assert.deepEqual(g.a0.request('card:play', { code: g.code, card: 'mine', target: 5 }), { ok: true });

  for (const socket of g.everyone) {
    const played = socket.latest('card:played');
    assert.deepEqual(played, { team: 'A', card: 'mine', by: { id: g.a0.playerId, name: 'a0' } });
    assert.equal('target' in played, false);
  }
  assert.deepEqual(g.a0.latest('board:mines'), { mines: [5] });
  assert.deepEqual(g.a1.latest('board:mines'), { mines: [5] });
  for (const socket of [g.host, g.b0, g.b1]) assert.equal(sent(socket, 'board:mines'), false);

  const board = g.host.latest('board:update');
  assert.equal(board.cards.A.mine, 0);
  assert.equal(board.cards.B.mine, 1);
  assert.equal(board.board.every((square) => !('mine' in square)), true);
  // Nothing the big screen or team B received mentions the mined square as a mine.
  for (const socket of [g.host, g.b0, g.b1]) {
    assert.equal(JSON.stringify(socket.received).includes('"mines"'), false);
  }
});

test('PB-18 card:play mine errors: bad targets, rival turn, second Mine, classic mode', () => {
  const h = harness();
  const g = h.teams();
  for (const target of [16, -1, '5', null]) {
    assert.deepEqual(g.a0.request('card:play', { code: g.code, card: 'mine', target }), { ok: false, error: 'BAD_TARGET' });
  }
  assert.deepEqual(g.b0.request('card:play', { code: g.code, card: 'mine', target: 5 }), { ok: false, error: 'NOT_NOW' });
  forget(...g.everyone);
  assert.deepEqual(g.a0.request('card:play', { code: g.code, card: 'mine', target: 5 }), { ok: true });
  assert.deepEqual(g.a1.request('card:play', { code: g.code, card: 'mine', target: 6 }), { ok: false, error: 'NO_CARD' });
  assert.deepEqual(g.a0.request('square:choose', { code: g.code, squareId: 0 }), { ok: true });
  assert.deepEqual(g.a0.request('card:play', { code: g.code, card: 'mine', target: 0 }), { ok: false, error: 'NO_CARD' });
  assert.equal(g.host.all('card:played').length, 1, 'failed plays announce nothing');

  // Errors never change the board or send mine data.
  const fresh = h.teams();
  forget(...fresh.everyone);
  assert.equal(fresh.a0.request('card:play', { code: fresh.code, card: 'mine', target: 99 }).error, 'BAD_TARGET');
  for (const socket of fresh.everyone) assert.equal(socket.received.length, 0);

  const classic = h.teams(false);
  assert.deepEqual(classic.host.request('game:start', { code: classic.code }), { ok: true });
  assert.deepEqual(classic.a0.request('card:play', { code: classic.code, card: 'mine', target: 5 }), { ok: false, error: 'NOT_NOW' });
});

test('PB-18 the rival loses on the mine: −3, mine:exploded to everyone, owner gets the cleared list', () => {
  const h = harness();
  const g = h.teams();
  mineThenDraw(h, g);
  battleOnMine(h, g, 'a0');

  const order = g.host.received.map((message) => message.event)
    .filter((event) => ['battle:end', 'mine:exploded', 'board:update'].includes(event));
  assert.deepEqual(order, ['battle:end', 'mine:exploded', 'board:update']);
  assert.equal(g.host.latest('battle:end').winnerTeam, 'A');
  for (const socket of g.everyone) {
    assert.deepEqual(socket.latest('mine:exploded'), { squareId: 5, team: 'B', points: -MINE_PENALTY });
  }
  const board = g.host.latest('board:update');
  assert.deepEqual(board.teamPoints, { A: 1, B: -3 });
  assert.equal(board.board[5].owner, 'A');
  assert.deepEqual(g.a0.latest('board:mines'), { mines: [] });
  assert.deepEqual(g.a1.latest('board:mines'), { mines: [] });
  for (const socket of [g.host, g.b0, g.b1]) assert.equal(sent(socket, 'board:mines'), false);
});

test('PB-18 the rival wins on the mine: no explosion, no point change, mine removed silently', () => {
  const h = harness();
  const g = h.teams();
  mineThenDraw(h, g);
  battleOnMine(h, g, 'b0');

  for (const socket of g.everyone) assert.equal(sent(socket, 'mine:exploded'), false);
  assert.equal(g.host.latest('battle:end').winnerTeam, 'B');
  assert.deepEqual(g.host.latest('board:update').teamPoints, { A: 0, B: 1 });
  assert.deepEqual(g.a0.latest('board:mines'), { mines: [] });
  for (const socket of [g.host, g.b0, g.b1]) assert.equal(sent(socket, 'board:mines'), false);
  const rejoin = h.connect().request('room:rejoin', { code: g.code, playerId: g.a1.playerId });
  assert.deepEqual(rejoin.state.mines, []);
});

test('PB-18 a draw on the mine keeps it; rejoin shows it to the owner team only', () => {
  const h = harness();
  const g = h.teams();
  mineThenDraw(h, g);
  assert.deepEqual(g.b0.request('square:choose', { code: g.code, squareId: 5 }), { ok: true });
  h.advance(5000 + 3000);
  forget(...g.everyone);
  h.advance(20000);

  assert.equal(g.host.latest('battle:end').winnerTeam, null);
  for (const socket of g.everyone) {
    assert.equal(sent(socket, 'mine:exploded'), false);
    assert.equal(sent(socket, 'board:mines'), false);
  }
  assert.deepEqual(h.connect().request('room:rejoin', { code: g.code, playerId: g.a0.playerId }).state.mines, [5]);
  assert.deepEqual(h.connect().request('room:rejoin', { code: g.code, playerId: g.b1.playerId }).state.mines, []);
  assert.deepEqual(h.connect().request('room:rejoin', { code: g.code, hostToken: g.created.hostToken }).state.mines, []);
});

test('PB-18 the −3 is applied before the PB-15 end-game resolution', () => {
  const seen = [];
  const h = harness({ resolveTeamGame: (room) => { seen.push({ ...room.teamPoints }); return null; } });
  const g = h.teams();
  mineThenDraw(h, g);
  battleOnMine(h, g, 'a0');
  assert.deepEqual(seen.at(-1), { A: 1, B: -3 });
});

test('PB-18 a mine owned by an offline player\'s team still reaches the connected teammate only', () => {
  const h = harness();
  const g = h.teams();
  g.a1.emit('disconnect');
  forget(...g.everyone);
  assert.deepEqual(g.a0.request('card:play', { code: g.code, card: 'mine', target: 7 }), { ok: true });
  assert.deepEqual(g.a0.latest('board:mines'), { mines: [7] });
  assert.equal(sent(g.a1, 'board:mines'), false);
  const back = h.connect();
  assert.deepEqual(back.request('room:rejoin', { code: g.code, playerId: g.a1.playerId }).state.mines, [7]);
});
