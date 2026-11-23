// Owner: Layan. Transport, room lifecycle and server-owned deadlines.
import express from 'express';
import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import * as teamRules from './game.js';
import { LIMITS, validateName, createPlayer, createRoom, joinError, canStart, prepareCategories,
  selectCategory, startRound, submitAnswer, eliminatePlayer, gameRanking, restartRoom,
  playersPayload, scoresPayload, rejoinSnapshot, playFreeze,
  TEAM_LIMITS, assignTeams, beginTeamGame, beginTeamTurn, chooseSquare, automaticSquare,
  boardPayload, teamScores, submitBoardAnswer, finishTeamBattle, restartTeamRoom } from './game.js';
import { playMine, teamMines, settleMine } from './game.js'; // PB-18 Mine card (Renad)

const EVENTS = Object.freeze({ create: 'room:create', join: 'room:join', rejoin: 'room:rejoin',
  players: 'room:players', start: 'game:start', countdown: 'round:countdown', round: 'round:start',
  submit: 'answer:submit', locked: 'answer:locked', score: 'score:update', end: 'round:end',
  over: 'game:over', restart: 'game:restart',
  card: 'card:play', cardPlayed: 'card:played', frozen: 'player:frozen' });
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEAM_EVENTS = Object.freeze({ set: 'team:set', shuffle: 'team:shuffle', board: 'board:update',
  turn: 'turn:start', choose: 'square:choose', chosen: 'battle:chosen', end: 'battle:end', sitout: 'team:sitout' });
// PB-18: board:mines goes only to the owner team's sockets; mine:exploded goes to everyone.
const MINE_EVENTS = Object.freeze({ mines: 'board:mines', exploded: 'mine:exploded' });
const payloadObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const roomCode = (value) => typeof value === 'string' && /^[A-Za-z]{4}$/.test(value.trim()) ? value.trim().toUpperCase() : null;

export function attachGameHandlers(io, { categories, now = Date.now, schedule = setTimeout,
  cancel = clearTimeout, random = Math.random, log = console.log,
  onCategoryUsed = async () => {},
  resolveTeamGame = room => teamRules.teamGameResult?.(room.board, room.teamPoints, room.cards) ?? null,
  prepareNextTeamBattle = room => teamRules.prepareTeamSitouts?.(room) ?? room }) {
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

  // PB-14: the team lifecycle uses its own phase timer and never enters classic elimination.
  function publishBoard(room) { emit(room, TEAM_EVENTS.board, boardPayload(room)); }
  // PB-18: each socket is in a Socket.IO room named after its id, so this reaches only that team's
  // connected players, never the big screen or the rival team. Offline players get it in room:rejoin.
  function sendMines(room, team) {
    const payload = { mines: teamMines(room, team) };
    for (const player of room.players.values()) {
      if (player.team === team && player.connected && player.socketId) io.to(player.socketId).emit(MINE_EVENTS.mines, payload);
    }
  }
  function beginTurn(code, team) {
    const room = beginTeamTurn(rooms.get(code), team, now());
    rooms.set(code, room);
    emit(room, TEAM_EVENTS.turn, room.turn);
    later(code, 'phase', TEAM_LIMITS.turn, () => {
      const current = rooms.get(code);
      const chosen = automaticSquare(current, now(), random());
      if (chosen) return announceSquare(chosen);
      // PB-15 owns the terminal outcome. If only the rival can steal, give it the turn.
      const rival = team === 'A' ? 'B' : 'A';
      if (current.cards[rival].steal > 0 && current.board.some(square => square.owner === team)) return beginTurn(code, rival);
      current.status = 'battleEnd';
      log(`room ${code} awaiting PB-15 board result`);
    });
  }
  function announceSquare(room, by = null) {
    rooms.set(room.code, room);
    stop(room.code, 'phase');
    if (room.chosen.steal) {
      const representative = room.players.get(room.sitout?.[room.chosen.team]) ??
        [...room.players.values()].find(player => player.team === room.chosen.team);
      emit(room, EVENTS.cardPlayed, { team: room.chosen.team, card: 'steal',
        by: by ?? { id: representative.id, name: representative.name },
        target: room.chosen.squareId });
      publishBoard(room);
    }
    emit(room, TEAM_EVENTS.chosen, { squareId: room.chosen.squareId, team: room.chosen.team,
      steal: room.chosen.steal, cardWindowEndsAt: room.cardWindowEndsAt });
    later(room.code, 'phase', room.cardWindowEndsAt - now(), () => teamCountdown(room.code));
  }
  function teamCountdown(code) {
    const room = rooms.get(code);
    room.status = 'countdown';
    room.round += 1;
    room.startsAt = now() + LIMITS.countdown;
    room.endsAt = null;
    emit(room, EVENTS.countdown, { round: room.round, startsAt: room.startsAt });
    later(code, 'phase', room.startsAt - now(), () => {
      const running = startRound(rooms.get(code));
      rooms.set(code, running);
      const category = running.category;
      const timestamp = now();
      categories = categories.map(entry => entry.id === category.id ? { ...entry, lastUsedAt: timestamp } : entry);
      Promise.resolve().then(() => onCategoryUsed(category.dbId, new Date(timestamp)))
        .catch(() => log('category:lastUsedAt update failed'));
      emit(running, EVENTS.round, { round: running.round, category: { id: category.id, title: category.title },
        endsAt: running.endsAt, squareId: running.chosen.squareId, lockedBy: running.chosen.lockedBy });
      emit(running, EVENTS.score, { ...scoresPayload(running), teamScores: teamScores(running) });
      later(code, 'phase', running.endsAt - now(), () => endTeamBattle(code));
    });
  }
  function endTeamBattle(code) {
    const result = finishTeamBattle(rooms.get(code));
    // PB-18: settle a mine on this square before the result is announced and before PB-15 resolves
    // the game, so board:update and the end-game tie-break both use the points after the −3.
    const mine = settleMine(result.room, result.payload.winnerTeam);
    const room = mine.room;
    rooms.set(code, room);
    emit(room, TEAM_EVENTS.end, result.payload);
    if (mine.exploded) emit(room, MINE_EVENTS.exploded, mine.exploded);
    if (mine.owner) sendMines(room, mine.owner);
    publishBoard(room);
    log(`room ${code} battle ${room.round} end`);
    // PB-15 supplies the pure winning-line/full-board resolver; retain its result for PB-28.
    const outcome = resolveTeamGame(room);
    if (outcome) {
      room.status = 'over';
      room.gameOver = outcome;
      emit(room, EVENTS.over, outcome);
      return;
    }
    const next = prepareNextTeamBattle(room);
    rooms.set(code, next);
    emit(next, TEAM_EVENTS.sitout, { ...next.sitout });
    later(code, 'phase', TEAM_LIMITS.results, () => beginTurn(code, room.chosen.team === 'A' ? 'B' : 'A'));
  }
  function shuffledPlayers(room) {
    const players = room.joinOrder.map(id => ({ ...room.players.get(id), team: null }));
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(random() * (i + 1)));
      [players[i], players[j]] = [players[j], players[i]];
    }
    return assignTeams(players);
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
      if (room.gameMode === 'teams') {
        const counts = { A: 0, B: 0 };
        for (const entry of room.players.values()) if (entry.team in counts) counts[entry.team]++;
        player.team = counts.A <= counts.B ? 'A' : 'B';
      }
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
      if (input.gameMode === 'teams') {
        const source = [...room.players.values()].some(player => player.team === 'A' || player.team === 'B') ?
          room : { ...room, players: shuffledPlayers(room) };
        const result = beginTeamGame(source, categories, Array.from({ length: TEAM_LIMITS.squares }, () => random()));
        if (result.error) return ack({ ok: false, error: result.error });
        rooms.set(room.code, result.room);
        ack({ ok: true });
        publishPlayers(result.room);
        publishBoard(result.room);
        emit(result.room, TEAM_EVENTS.sitout, { ...result.room.sitout });
        beginTurn(room.code, 'A');
        log(`room ${room.code} teams start`);
        return;
      }
      if (!canStart(room)) return ack({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
      room.gameMode = 'classic';
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
      const result = room.gameMode === 'teams' ? (teamRules.submitTeamAnswer ?? submitBoardAnswer)(room, player.id, input.text, now()) :
        submitAnswer(room, player.id, input.text, now());
      rooms.set(room.code, result.room);
      ack(result.ack);
      if (result.word) emit(result.room, EVENTS.locked, { word: result.word, by: { id: player.id, name: player.name } });
      if (result.ack.delta) emit(result.room, EVENTS.score, { ...scoresPayload(result.room),
        ...(room.gameMode === 'teams' ? { teamScores: teamScores(result.room) } : {}) });
    });
    handle(TEAM_EVENTS.set, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      if (!isHost(socket, room)) return ack({ ok: false, error: 'NOT_HOST' });
      if (room.status !== 'lobby') return ack({ ok: false, error: 'STARTED' });
      const player = room.players.get(input.playerId);
      if (!player || !['A', 'B'].includes(input.team)) return ack({ ok: false, error: 'NOT_FOUND' });
      room.gameMode = 'teams';
      const assigned = assignTeams(room.joinOrder.map(id => room.players.get(id)), room.players, false);
      assigned.set(player.id, { ...assigned.get(player.id), team: input.team });
      room.players = assigned;
      ack({ ok: true });
      publishPlayers(room);
    });
    handle(TEAM_EVENTS.shuffle, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      if (!isHost(socket, room)) return ack({ ok: false, error: 'NOT_HOST' });
      if (room.status !== 'lobby') return ack({ ok: false, error: 'STARTED' });
      room.gameMode = 'teams';
      room.players = shuffledPlayers(room);
      ack({ ok: true });
      publishPlayers(room);
    });
    handle(TEAM_EVENTS.choose, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      const player = room?.players.get(socket.data.playerId);
      if (!room || socket.data.code !== room.code || player?.socketId !== socket.id) {
        return ack({ ok: false, error: 'NOT_YOUR_TURN' });
      }
      const result = chooseSquare(room, player.id, input.squareId, input.steal, now());
      if (result.error) return ack({ ok: false, error: result.error });
      ack({ ok: true });
      announceSquare(result.room, result.by);
    });
    handle(EVENTS.card, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      const player = room?.players.get(socket.data.playerId);
      if (!room || socket.data.code !== room.code || player?.socketId !== socket.id) {
        return ack({ ok: false, error: 'NOT_ALLOWED' });
      }
      if (input.card === 'freeze') {
        const result = playFreeze(room, player.id, now(), random());
        if (result.error) return ack({ ok: false, error: result.error });
        rooms.set(room.code, result.room);
        ack({ ok: true });
        emit(result.room, EVENTS.cardPlayed, { team: result.team, card: 'freeze', by: result.by, target: result.target });
        emit(result.room, EVENTS.frozen, { id: result.target.id, until: result.until });
        log(`room ${room.code} card freeze`);
        return;
      }
      if (input.card === 'mine') {
        const result = playMine(room, player.id, input.target, now());
        if (result.error) return ack({ ok: false, error: result.error });
        rooms.set(room.code, result.room);
        ack({ ok: true });
        // The square stays secret: no target for anyone. The owner team learns it from board:mines.
        emit(result.room, EVENTS.cardPlayed, { team: result.team, card: 'mine', by: result.by });
        sendMines(result.room, result.team);
        publishBoard(result.room);
        log(`room ${room.code} card mine`);
        return;
      }
      // lock, mine and steal are added by their own stories (SPEC §17.6).
      ack({ ok: false, error: 'NO_CARD' });
    });
    handle(EVENTS.restart, (input, ack) => {
      const room = rooms.get(roomCode(input.code));
      if (!isHost(socket, room)) return ack({ ok: false, error: 'NOT_HOST' });
      stop(room.code, 'phase');
      const next = room.gameMode === 'teams' ? restartTeamRoom(room) : restartRoom(room);
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
