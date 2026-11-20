// Owner: Layan. Pure rules: inputs are never changed; time/randomness come from callers.
import { normalize } from './arabic.js';

export const LIMITS = Object.freeze({ minPlayers: 3, maxPlayers: 12, countdown: 3000, round: 20000, results: 5000 });

export function validateName(name, players = []) {
  if (typeof name !== 'string') return { error: 'NAME_INVALID' };
  const trimmed = name.trim();
  if (!trimmed || [...trimmed].length > 15 || !normalize(trimmed)) return { error: 'NAME_INVALID' };
  if ([...players].some((player) => normalize(player.name) === normalize(trimmed))) return { error: 'NAME_TAKEN' };
  return { name: trimmed };
}

export function createPlayer(id, name, socketId, joinedAt) {
  return { id, name, socketId, joinedAt, connected: true, out: false, score: 0,
    submitted: new Set(), lastCorrectAt: null, submissionTimes: [] };
}

export function createRoom(code, mode, hostToken, player = null) {
  return { code, mode, hostToken, hostSocketId: null, hostId: player?.id ?? null, status: 'lobby',
    players: new Map(player ? [[player.id, player]] : []), joinOrder: player ? [player.id] : [],
    eliminatedOrder: [], round: 0, category: null, startsAt: null, endsAt: null,
    usedCategoryIds: new Set(), locked: new Map() };
}

export function joinError(room, name) {
  if (!room) return 'NOT_FOUND';
  if (room.status !== 'lobby') return 'STARTED';
  if (room.players.size >= LIMITS.maxPlayers) return 'FULL';
  return validateName(name, room.players.values()).error ?? null;
}

export function canStart(room) {
  return room.status === 'lobby' && [...room.players.values()].filter((p) => !p.out).length >= LIMITS.minPlayers;
}

export function prepareCategories(documents) {
  return documents.map((document) => {
    const answers = new Map();
    for (const word of document.answers ?? []) {
      answers.set(normalize(word), word);
      for (const alias of document.aliases?.[word] ?? []) answers.set(normalize(alias), word);
    }
    return { id: String(document._id), title: document.title, answers,
      lastUsedAt: document.lastUsedAt == null ? 0 : new Date(document.lastUsedAt).getTime(), dbId: document._id };
  }).filter((category) => category.answers.size > 0);
}

export function selectCategory(categories, used, randomValue) {
  let remaining = categories.filter((category) => !used.has(category.id));
  const usedCategoryIds = remaining.length ? new Set(used) : new Set();
  if (!remaining.length) remaining = categories;
  if (!remaining.length) throw new Error('No categories available');
  const oldest = Math.min(...remaining.map((category) => category.lastUsedAt));
  const preferred = remaining.filter((category) => category.lastUsedAt === oldest);
  const category = preferred[Math.min(Math.floor(randomValue * preferred.length), preferred.length - 1)];
  usedCategoryIds.add(category.id);
  return { category, usedCategoryIds };
}

export function startRound(room) {
  return { ...room, status: 'round', endsAt: room.startsAt + LIMITS.round, locked: new Map(),
    players: new Map([...room.players].map(([id, player]) => [id, { ...player, score: 0,
      submitted: new Set(), lastCorrectAt: null, submissionTimes: [] }])) };
}

export function submitAnswer(room, playerId, text, now) {
  const player = room.players.get(playerId);
  const response = (result, delta = 0, nextRoom = room, word = null) => ({
    room: nextRoom, word, ack: { result, delta, score: (player?.score ?? 0) + delta } });
  const n = typeof text === 'string' && text.length <= 1000 ? normalize(text) : '';
  if (!n || [...n].length > 40) return response('wrong');
  if (!player || player.out || room.status !== 'round' || now >= room.endsAt) return response('closed');
  const updated = { ...player, submitted: new Set(player.submitted),
    submissionTimes: player.submissionTimes.filter((time) => time > now - 1000) };
  const nextRoom = { ...room, players: new Map(room.players), locked: new Map(room.locked) };
  nextRoom.players.set(playerId, updated);
  if (updated.submissionTimes.length >= 5) {
    updated.submitted.add(n);
    return response('wrong', 0, nextRoom);
  }
  updated.submissionTimes.push(now);
  if (updated.submitted.has(n)) return response('repeat', 0, nextRoom);
  updated.submitted.add(n);
  const word = room.category.answers.get(n);
  if (!word) return response('wrong', 0, nextRoom);
  const key = normalize(word);
  const lock = room.locked.get(key);
  // Aliases share a canonical lock, including aliases submitted by its owner.
  if (lock?.byId === playerId) return response('repeat', 0, nextRoom);
  const result = lock ? 'locked' : 'correct';
  const delta = lock ? -1 : 1;
  updated.score += delta;
  if (!lock) {
    updated.lastCorrectAt = now;
    nextRoom.locked.set(key, { word, byId: playerId });
  }
  return response(result, delta, nextRoom, lock ? null : word);
}

export function eliminatePlayer(room) {
  const active = [...room.players.values()].filter((player) => !player.out);
  active.sort((a, b) => a.score - b.score ||
    (b.lastCorrectAt ?? Infinity) - (a.lastCorrectAt ?? Infinity) ||
    room.joinOrder.indexOf(b.id) - room.joinOrder.indexOf(a.id));
  const eliminated = active[0];
  if (!eliminated) throw new Error('No active player');
  const players = new Map(room.players);
  players.set(eliminated.id, { ...eliminated, out: true });
  return { room: { ...room, players, status: 'roundEnd', eliminatedOrder: [...room.eliminatedOrder, eliminated.id] },
    eliminated: { id: eliminated.id, name: eliminated.name } };
}

export function gameRanking(room) {
  const winner = [...room.players.values()].find((player) => !player.out);
  return [winner?.id, ...[...room.eliminatedOrder].reverse()].filter(Boolean).map((id, index) => ({
    id, name: room.players.get(id).name, place: index + 1 }));
}

export function restartRoom(room) {
  const players = [...room.players.values()].filter((player) => player.connected);
  return { ...room, status: 'lobby', round: 0, category: null, startsAt: null, endsAt: null,
    locked: new Map(), usedCategoryIds: new Set(), eliminatedOrder: [],
    players: new Map(players.map((player) => [player.id, { ...player, out: false, score: 0,
      submitted: new Set(), lastCorrectAt: null, submissionTimes: [] }])),
    joinOrder: room.joinOrder.filter((id) => players.some((player) => player.id === id)) };
}

export function playersPayload(room) {
  return { mode: room.mode, hostId: room.hostId, status: room.status,
    ...(room.gameMode === 'teams' ? { gameMode: 'teams' } : {}),
    players: [...room.players.values()].map(({ id, name, out, connected, team }) => ({ id, name, out, connected,
      ...(room.gameMode === 'teams' ? { team: team ?? null } : {}) })) };
}

export function scoresPayload(room) {
  return { scores: [...room.players.values()].map(({ id, score }) => ({ id, score })) };
}

export function stateSnapshot(room, playerId) {
  const player = room.players.get(playerId);
  return { ...playersPayload(room), status: room.status, round: room.round,
    category: room.category ? { id: room.category.id, title: room.category.title } : null,
    startsAt: room.startsAt, endsAt: room.endsAt, ...scoresPayload(room),
    locked: [...room.locked.values()].map(({ word, byId }) => ({ word,
      by: { id: byId, name: room.players.get(byId).name } })),
    me: player ? { id: player.id, out: player.out, score: player.score } : null };
}

// PB-28: allowlist the state needed to restore a screen; never serialize the room itself.
export function rejoinSnapshot(room, playerId, now) {
  const state = stateSnapshot(room, playerId);
  if (room.gameMode !== 'teams') {
    if (room.status === 'roundEnd') {
      const eliminated = room.players.get(room.eliminatedOrder.at(-1));
      state.eliminated = eliminated ? { id: eliminated.id, name: eliminated.name } : null;
    }
    if (room.status === 'over') {
      state.ranking = gameRanking(room);
      const winner = state.ranking[0];
      state.winner = winner ? { id: winner.id, name: winner.name } : null;
    }
    return state;
  }

  // These fields follow EVENTS.md §6.3; PB-14 supplies the team engine.
  const player = room.players.get(playerId);
  const team = player?.team === 'A' || player?.team === 'B' ? player.team : null;
  const sitout = { A: room.sitout?.A ?? null, B: room.sitout?.B ?? null };
  state.gameMode = 'teams';
  state.players = state.players.map(entry => ({ ...entry, team: room.players.get(entry.id).team ?? null }));
  state.board = (room.board ?? []).map(square => ({ id: square.id,
    category: { id: square.category.id, title: square.category.title }, owner: square.owner ?? null }));
  state.mines = team ? (room.board ?? []).filter(square => square.mine === team).map(square => square.id) : [];
  state.turn = room.turn ? { team: room.turn.team, endsAt: room.turn.endsAt } : null;
  state.chosen = room.chosen ? { squareId: room.chosen.squareId, team: room.chosen.team,
    steal: Boolean(room.chosen.steal), lockedBy: room.chosen.lockedBy ?? null } : null;
  state.cardWindowEndsAt = room.cardWindowEndsAt ?? room.chosen?.cardWindowEndsAt ?? null;
  state.cards = Object.fromEntries(['A', 'B'].map(id => [id,
    Object.fromEntries(['freeze', 'lock', 'mine', 'steal'].map(card => [card, room.cards?.[id]?.[card] ?? 0]))]));
  state.teamPoints = { A: room.teamPoints?.A ?? 0, B: room.teamPoints?.B ?? 0 };
  state.sitout = sitout;
  state.frozenUntil = player?.frozenUntil > now ? player.frozenUntil : null;
  state.me = player ? { id: player.id, team, out: player.out, score: player.score,
    sittingOut: team !== null && sitout[team] === player.id } : null;
  if (room.status === 'over' && room.gameOver) {
    const result = room.gameOver;
    state.winnerTeam = result.winnerTeam;
    state.line = result.line ? [...result.line] : null;
    state.squares = { A: result.squares.A, B: result.squares.B };
  }
  return state;
}
