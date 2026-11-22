import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionRecovery } from '../client/src/sessionRecovery.js';
import { restoreHostSnapshot } from '../client/src/host/restoreHostSnapshot.js';

function harness() {
  const requests = [], jobs = new Map(), snapshots = [], pending = [], errors = [], connections = [];
  let identity = { code: 'QAFL', playerId: 'p1' }, missing = 0, sequence = 0;
  const socket = { connected: true, timeout(ms) { assert.equal(ms, 6000); return this; },
    emit(event, payload, callback) { assert.equal(event, 'room:rejoin'); requests.push({ payload, callback }); } };
  const recovery = createSessionRecovery({ socket, getIdentity: () => identity,
    onSnapshot: (...args) => snapshots.push(args), onMissing: () => { missing++; identity = null; },
    onPending: value => pending.push(value), onError: value => errors.push(value), onConnected: value => connections.push(value),
    schedule(callback, delay) { const id = ++sequence; jobs.set(id, { callback, delay }); return id; },
    cancel(id) { jobs.delete(id); } });
  const success = (status = 'round') => ({ ok: true, serverTime: 5000,
    state: { status, players: [{ id: 'p1', name: 'لينا' }], me: { id: 'p1', score: 3 } } });
  return { recovery, socket, requests, jobs, snapshots, pending, errors, connections, success,
    setIdentity(value) { identity = value; }, get missing() { return missing; } };
}

test('PB-28 applies the authoritative snapshot synchronously before the next live event', () => {
  const h = harness();
  h.recovery.recover();
  assert.deepEqual(h.requests[0].payload, { code: 'QAFL', playerId: 'p1' });
  h.requests[0].callback(null, h.success());
  assert.equal(h.snapshots[0][0].me.score, 3);
  assert.equal(h.snapshots[0][1], 5000);
  assert.deepEqual(h.pending, [true, false]);
  assert.equal(h.jobs.size, 0);
});

test('PB-28 a timed-out acknowledgement retries automatically without changing identity', () => {
  const h = harness();
  h.recovery.recover();
  h.requests[0].callback(new Error('timeout'));
  assert.equal(h.pending.at(-1), true);
  const [[id, retry]] = h.jobs;
  assert.equal(retry.delay, 1000);
  h.jobs.delete(id); retry.callback();
  assert.deepEqual(h.requests[1].payload, h.requests[0].payload);
  h.requests[1].callback(null, h.success());
  assert.equal(h.pending.at(-1), false);
  assert.equal(h.errors.at(-1), '');
});

test('PB-28 disconnect invalidates old callbacks; reconnect restores the newer snapshot', () => {
  const h = harness();
  h.recovery.recover();
  h.socket.connected = false; h.recovery.disconnect();
  h.requests[0].callback(null, h.success('lobby'));
  assert.equal(h.snapshots.length, 0);
  h.socket.connected = true; h.recovery.recover();
  h.requests[1].callback(null, h.success('over'));
  h.requests[0].callback(null, h.success('round'));
  assert.equal(h.snapshots.length, 1);
  assert.equal(h.snapshots[0][0].status, 'over');
});

test('PB-28 repeated manual retries cannot apply an older response', () => {
  const h = harness();
  h.recovery.recover(); h.recovery.recover();
  h.requests[1].callback(null, h.success('round'));
  h.requests[0].callback(null, h.success('lobby'));
  assert.equal(h.snapshots.length, 1);
  assert.equal(h.snapshots[0][0].status, 'round');
});

test('PB-28 missing rooms clear the old identity without scheduling another join', () => {
  const h = harness();
  h.recovery.recover();
  h.requests[0].callback(null, { ok: false, error: 'NOT_FOUND' });
  assert.equal(h.missing, 1);
  assert.equal(h.pending.at(-1), false);
  assert.equal(h.jobs.size, 0);
  h.recovery.recover();
  assert.equal(h.requests.length, 1);
});

test('PB-28 screen disposal cancels retries and ignores all late acknowledgements', () => {
  const h = harness();
  h.recovery.recover();
  h.requests[0].callback(new Error('timeout'));
  h.recovery.dispose();
  assert.equal(h.jobs.size, 0);
  h.requests[0].callback(null, h.success());
  h.recovery.recover();
  assert.equal(h.snapshots.length, 0);
  assert.equal(h.requests.length, 1);
});

test('PB-28 acknowledgements for a different identity are ignored', () => {
  const h = harness();
  h.recovery.recover();
  h.setIdentity({ code: 'ABCD', playerId: 'p2' });
  h.requests[0].callback(null, h.success());
  assert.equal(h.snapshots.length, 0);
});

test('PB-28 malformed replies retry and an offline client never sends a request', () => {
  const h = harness();
  h.socket.connected = false; h.recovery.recover();
  assert.equal(h.requests.length, 0);
  h.socket.connected = true; h.recovery.recover();
  h.requests[0].callback(null, { ok: true });
  assert.equal(h.snapshots.length, 0);
  assert.equal(h.jobs.size, 1);
  h.recovery.disconnect();
  assert.equal(h.jobs.size, 0);
});

test('PB-28 host restores round results and final ranking instead of waiting forever', () => {
  const snapshot = { status: 'roundEnd', round: 2,
    players: [{ id: 'a', name: 'لينا', out: false }, { id: 'b', name: 'ريف', out: true }, { id: 'c', name: 'دانة', out: true }],
    scores: [{ id: 'a', score: 2 }, { id: 'b', score: 1 }, { id: 'c', score: 0 }],
    eliminated: { id: 'b', name: 'ريف' } };
  const restored = restoreHostSnapshot(snapshot);
  assert.equal(restored.resuming, false);
  assert.equal(restored.roundEnd.lastRound, true);
  assert.deepEqual(restored.roundEnd.scores.map(row => row.id), ['a', 'b']);
  assert.equal(restored.roundEnd.scores[0].name, 'لينا');
  const final = { ...snapshot, status: 'over', winner: { id: 'a', name: 'لينا' },
    ranking: [{ id: 'a', name: 'لينا', place: 1 }] };
  assert.deepEqual(restoreHostSnapshot(final).gameOver, { winner: final.winner, ranking: final.ranking });
});
