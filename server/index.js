// Owner: Layan. Transport, room lifecycle and server-owned deadlines.
import express from 'express';
import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import { LIMITS, validateName, createPlayer, createRoom, joinError, canStart, prepareCategories,
  selectCategory, startRound, submitAnswer, eliminatePlayer, gameRanking, restartRoom,
  playersPayload, scoresPayload, rejoinSnapshot } from './game.js';

const EVENTS = Object.freeze({ create: 'room:create', join: 'room:join', rejoin: 'room:rejoin',
  players: 'room:players', start: 'game:start', countdown: 'round:countdown', round: 'round:start',
  submit: 'answer:submit', locked: 'answer:locked', score: 'score:update', end: 'round:end',
  over: 'game:over', restart: 'game:restart' });
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const payloadObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const roomCode = (value) => typeof value === 'string' && /^[A-Za-z]{4}$/.test(value.trim()) ? value.trim().toUpperCase() : null;

export function attachGameHandlers(io, { categories, now = Date.now, schedule = setTimeout,
  cancel = clearTimeout, random = Math.random, log = console.log,
  onCategoryUsed = async () => {} }) {
  if (!categories.length) throw new Error('No categories available');
  const rooms = new Map();
  const timers = new Map();
  const emit = (room, event, payload) => io.to(room.code).emit(event, payload);
  const publishPlayers = (room) => emit(room, EVENTS.players, playersPayload(room));
  function stop(code, key) {
    const handles = timers.get(code);
    if (handles?.[key] != null) { cancel(handles[key]); delete handles[key]; }
  }
  function later(code, key, delay, callback) {
    stop(code, key);
    const handles = timers.get(code) ?? {};
    timers.set(code, handles);
    handles[key] = schedule(() => { delete handles[key]; if (rooms.has(code)) callback(); }, Math.max(0, delay));
    handles[key]?.unref?.();
  }
  function deleteRoom(code) {
    for (const key of Object.keys(timers.get(code) ?? {})) stop(code, key);
    timers.delete(code);
    rooms.delete(code);
  }
  function maintainConnections(room) {
    if (room.hostSocketId || [...room.players.values()].some((player) => player.connected)) stop(room.code, 'cleanup');
    else if (timers.get(room.code)?.cleanup == null) later(room.code, 'cleanup', 600000, () => deleteRoom(room.code));
    if (room.mode !== 'phone') return;
    if (room.players.get(room.hostId)?.connected) { stop(room.code, 'host'); return; }
    if (timers.get(room.code)?.host == null) later(room.code, 'host', 15000, () => {
      const current = rooms.get(room.code);
      const next = current.joinOrder.find((id) => current.players.get(id)?.connected);
      if (next) { current.hostId = next; publishPlayers(current); }
    });
  }
  function detach(socket) {
    const { code, playerId, screenHost } = socket.data;
    const room = rooms.get(code);
    if (room) {
      if (screenHost && room.hostSocketId === socket.id) room.hostSocketId = null;
      const player = room.players.get(playerId);
      if (player?.socketId === socket.id) { player.connected = false; player.socketId = null; }
      socket.leave(code);
      publishPlayers(room);
      maintainConnections(room);
    }
    socket.data = {};
  }
  function bind(socket, room, player = null) {
    if (socket.data.code) detach(socket);
    const previousId = player ? player.socketId : room.hostSocketId;
    const previous = io.sockets.sockets.get(previousId);
    if (previous && previous.id !== socket.id) {
      previous.leave(room.code);
      previous.data = {};
    }
    if (player) { player.socketId = socket.id; player.connected = true; }
    else room.hostSocketId = socket.id;
    socket.data = { code: room.code, playerId: player?.id, screenHost: !player };
    socket.join(room.code);
    maintainConnections(room);
  }
  function isHost(socket, room) {
    if (!room || socket.data.code !== room.code) return false;
    return room.mode === 'screen' ? room.hostSocketId === socket.id :
      room.players.get(room.hostId)?.socketId === socket.id;
  }
  function countdown(code) {
    const room = rooms.get(code);
    const chosen = selectCategory(categories, room.usedCategoryIds, random());
    const timestamp = now();
    const lastUsedAt = new Date(timestamp);
    // Update the shared in-memory preference immediately; persistence never delays a round.
    const nextCategory = { ...chosen.category, lastUsedAt: timestamp };
    categories = categories.map((category) => category.id === nextCategory.id ? nextCategory : category);
    room.category = nextCategory;
    room.usedCategoryIds = chosen.usedCategoryIds;
    room.status = 'countdown';
    room.round += 1;
    room.startsAt = timestamp + LIMITS.countdown;
    room.endsAt = null;
    Promise.resolve().then(() => onCategoryUsed(chosen.category.dbId, lastUsedAt))
      .catch(() => log('category:lastUsedAt update failed'));
    emit(room, EVENTS.countdown, { round: room.round, startsAt: room.startsAt });
    later(code, 'phase', room.startsAt - now(), () => {
      const running = startRound(rooms.get(code));
      rooms.set(code, running);
      emit(running, EVENTS.round, { round: running.round,
        category: { id: running.category.id, title: running.category.title }, endsAt: running.endsAt });
      later(code, 'phase', running.endsAt - now(), () => endRound(code));
    });
  }
  function endRound(code) {
    const result = eliminatePlayer(rooms.get(code));
    const room = result.room;
    rooms.set(code, room);
    emit(room, EVENTS.end, { round: room.round,
      scores: [...room.players.values()].map(({ id, name, score }) => ({ id, name, score }))
        .sort((a, b) => b.score - a.score), eliminated: result.eliminated });
    publishPlayers(room);
    log(`room ${code} round ${room.round} end`);
    later(code, 'phase', LIMITS.results, () => {
      const current = rooms.get(code);
      if ([...current.players.values()].filter((player) => !player.out).length > 1) return countdown(code);
      current.status = 'over';
      const ranking = gameRanking(current);
      emit(current, EVENTS.over, { winner: { id: ranking[0].id, name: ranking[0].name }, ranking });
      log(`room ${code} game over`);
    });
  }

  io.on('connection', (socket) => {
    // Missing acknowledgements and malformed payloads never throw into Socket.IO.
    function handle(event, callback) {
      socket.on(event, (input, ack) => {
        const respond = typeof ack === 'function' ? ack : () => {};
        callback(payloadObject(input), respond);
      });
    }
    handle(EVENTS.create, (input, ack) => {
      if (!['screen', 'phone'].includes(input.mode)) return ack({ ok: false, error: 'NAME_INVALID' });
      const name = input.mode === 'phone' ? validateName(input.name) : {};
      if (name.error) return ack({ ok: false, error: name.error });
      let code;
      do { code = Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (rooms.has(code));
      const player = input.mode === 'phone' ? createPlayer(randomUUID(), name.name, socket.id, now()) : null;
      const room = createRoom(code, input.mode, input.mode === 'screen' ? randomUUID() : null, player);
      rooms.set(code, room);
      bind(socket, room, player);
      ack({ ok: true, code, ...(player ? { playerId: player.id } : { hostToken: room.hostToken }), serverTime: now() });
      publishPlayers(room);
      log(`room ${code} create`);
    });
    handle(EVENTS.join, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      const error = joinError(room, input.name);
      if (error) return ack({ ok: false, error });
      const player = createPlayer(randomUUID(), input.name.trim(), socket.id, now());
      // Leave an old identity before adding the new identity to the destination room.
      if (socket.data.code) detach(socket);
      room.players.set(player.id, player);
      room.joinOrder.push(player.id);
      bind(socket, room, player);
      ack({ ok: true, playerId: player.id, serverTime: now() });
      publishPlayers(room);
    });
    handle(EVENTS.rejoin, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      const player = typeof input.playerId === 'string' ? room?.players.get(input.playerId) : null;
      const screenHost = room?.mode === 'screen' && typeof input.hostToken === 'string' && input.hostToken === room.hostToken;
      if (!room || (!player && !screenHost)) return ack({ ok: false, error: 'NOT_FOUND' });
      bind(socket, room, player);
      const serverTime = now();
      ack({ ok: true, state: rejoinSnapshot(room, player?.id, serverTime), serverTime });
      publishPlayers(room);
    });
    handle(EVENTS.start, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      if (!isHost(socket, room)) return ack({ ok: false, error: 'NOT_HOST' });
      // Duplicate start requests are idempotent and cannot create extra timers.
      if (room.status !== 'lobby') return ack({ ok: true });
      if (!canStart(room)) return ack({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
      ack({ ok: true });
      log(`room ${room.code} start`);
      countdown(room.code);
    });
    handle(EVENTS.submit, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      const player = room?.players.get(socket.data.playerId);
      if (!room || socket.data.code !== room.code || player?.socketId !== socket.id) {
        return ack({ result: 'closed', delta: 0, score: 0 });
      }
      const result = submitAnswer(room, player.id, input.text, now());
      rooms.set(room.code, result.room);
      ack(result.ack);
      if (result.word) emit(result.room, EVENTS.locked, { word: result.word, by: { id: player.id, name: player.name } });
      if (result.ack.delta) emit(result.room, EVENTS.score, scoresPayload(result.room));
    });
    handle(EVENTS.restart, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      if (!isHost(socket, room)) return ack({ ok: false, error: 'NOT_HOST' });
      stop(room.code, 'phase');
      const next = restartRoom(room);
      rooms.set(room.code, next);
      ack({ ok: true });
      publishPlayers(next);
      maintainConnections(next);
    });
    socket.on('disconnect', () => detach(socket));
  });
  return { rooms, dispose() { for (const code of rooms.keys()) deleteRoom(code); } };
}

export function createGameServer(options) {
  const app = express();
  const http = createServer(app);
  const io = new Server(http, { cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' } });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  const game = attachGameHandlers(io, options);
  return { app, http, io, ...game };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const collection = client.db().collection('categories');
    const categories = prepareCategories(await collection.find({}).toArray());
    const server = createGameServer({ categories,
      onCategoryUsed: (_id, lastUsedAt) => collection.updateOne({ _id }, { $set: { lastUsedAt } }) });
    server.http.listen(process.env.PORT || 3001, () => console.log('Qaffelha server ready'));
    const shutdown = () => {
      server.dispose();
      server.io.close(() => { void client.close(); });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch {
    await client.close();
    // Driver errors can contain credentials; never print the connection error.
    throw new Error('Server startup failed: check MongoDB configuration and seeded categories');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
