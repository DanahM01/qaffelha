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
    submitted: new Set(), lastCorrectAt: null, submissionTimes: [], frozenUntil: null };
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
      submitted: new Set(), lastCorrectAt: null, submissionTimes: [], frozenUntil: null }])) };
}

export function submitAnswer(room, playerId, text, now) {
  const player = room.players.get(playerId);
  const response = (result, delta = 0, nextRoom = room, word = null) => ({
    room: nextRoom, word, ack: { result, delta, score: (player?.score ?? 0) + delta } });
  const n = typeof text === 'string' && text.length <= 1000 ? normalize(text) : '';
  if (!n || [...n].length > 40) return response('wrong');
  if (!player || player.out || room.status !== 'round' || now >= room.endsAt) return response('closed');
  if (player.frozenUntil != null && now < player.frozenUntil) return response('frozen');
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
      submitted: new Set(), lastCorrectAt: null, submissionTimes: [], frozenUntil: null }])),
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
    me: player ? { id: player.id, out: player.out, score: player.score,
      ...(room.gameMode === 'teams' ? { frozenUntil: player.frozenUntil ?? null } : {}) } : null };
}

// ---- Team Mode cards (SPEC §17.6). Owner of the Freeze card: Danah (PB-16). ----
// Room fields used here come from Team Mode (PB-13/PB-14): room.gameMode, player.team,
// room.cards = { A: { freeze, lock, mine, steal }, B: {…} }, room.sitout = { A: id|null, B: id|null }.

export const FREEZE_MS = 3000;

export function newTeamCards() {
  return { freeze: 1, lock: 1, mine: 1, steal: 1 };
}

// Who may play one of their team's cards right now (SPEC §17.6 + §17.7). Returns an error code or null.
export function cardPlayError(room, playerId, card) {
  if (room.gameMode !== 'teams') return 'NOT_NOW';
  const player = room.players.get(playerId);
  if (!player?.team) return 'NOT_ALLOWED';
  const sittingOut = room.sitout?.[player.team] ?? null;
  if (sittingOut && sittingOut !== playerId) return 'NOT_ALLOWED';
  if (!(room.cards?.[player.team]?.[card] > 0)) return 'NO_CARD';
  // PB-17: a sitting-out chooser's Lock is final for this battle, including later cards.
  if (sittingOut && room.cardChoices?.[player.team] && room.cardChoices[player.team] !== card) return 'NOT_ALLOWED';
  return null;
}

// The opposing player with the highest score in this battle (tie → random). Sitting-out players are skipped.
export function freezeTarget(room, team, randomValue) {
  const sittingOut = new Set(Object.values(room.sitout ?? {}).filter(Boolean));
  const rivals = [...room.players.values()].filter((player) =>
    player.team && player.team !== team && !player.out && !sittingOut.has(player.id));
  if (!rivals.length) return null;
  const top = Math.max(...rivals.map((player) => player.score));
  const best = rivals.filter((player) => player.score === top);
  return best[Math.min(Math.floor(randomValue * best.length), best.length - 1)];
}

// Freeze: during a battle, block the top rival's answers for 3 s. One card per team per game.
export function playFreeze(room, playerId, now, randomValue) {
  const error = cardPlayError(room, playerId, 'freeze');
  if (error) return { error };
  if (room.status !== 'round' || room.endsAt == null || now >= room.endsAt - FREEZE_MS) return { error: 'NOT_NOW' };
  const player = room.players.get(playerId);
  const target = freezeTarget(room, player.team, randomValue);
  if (!target) return { error: 'BAD_TARGET' };
  const until = now + FREEZE_MS;
  const players = new Map(room.players);
  players.set(target.id, { ...target, frozenUntil: until });
  const teamCards = room.cards[player.team];
  const cards = { ...room.cards, [player.team]: { ...teamCards, freeze: teamCards.freeze - 1 } };
  return { room: { ...room, players, cards }, team: player.team, until,
    by: { id: player.id, name: player.name }, target: { id: target.id, name: target.name } };
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
  state.cardChoices = { A: room.cardChoices?.A ?? null, B: room.cardChoices?.B ?? null };
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

// PB-14 / PB-19. Team engine; randomness and deadlines are supplied by the transport.
export const TEAM_LIMITS = Object.freeze({ turn: 15000, cards: 5000, results: 4000, squares: 16 });
const otherTeam = team => team === 'A' ? 'B' : 'A';

// Preserve manual assignments; fill gaps and move the latest joiners to balance.
// Callers shuffle the input first when an explicitly random split is requested.
export function assignTeams(players, current = new Map(), balance = true) {
  const result = new Map(players.map(player => [player.id, { ...player,
    team: current.get(player.id)?.team ?? player.team ?? null }]));
  const count = team => [...result.values()].filter(player => player.team === team).length;
  for (const player of result.values()) {
    if (!['A', 'B'].includes(player.team)) player.team = count('A') <= count('B') ? 'A' : 'B';
  }
  while (balance && Math.abs(count('A') - count('B')) > 1) {
    const larger = count('A') > count('B') ? 'A' : 'B';
    const latest = [...result.values()].reverse().find(player => player.team === larger);
    latest.team = otherTeam(larger);
  }
  return result;
}

export function beginTeamGame(room, categories, randomValues) {
  if (room.players.size < 4) return { error: 'NOT_ENOUGH_PLAYERS' };
  if (new Set(categories.map(category => category.id)).size < TEAM_LIMITS.squares) return { error: 'NOT_ENOUGH_CATEGORIES' };
  const ordered = room.joinOrder.map(id => room.players.get(id));
  const players = assignTeams(ordered, room.players);
  const board = [];
  let used = new Set();
  for (let id = 0; id < TEAM_LIMITS.squares; id++) {
    const selected = selectCategory(categories, used, randomValues[id]);
    used = selected.usedCategoryIds;
    board.push({ id, category: selected.category, owner: null, mine: null });
  }
  return { room: { ...room, players, gameMode: 'teams', board, usedCategoryIds: used,
    round: 0, category: null, startsAt: null, endsAt: null, locked: new Map(), eliminatedOrder: [],
    cards: { A: newTeamCards(), B: newTeamCards() }, teamPoints: { A: 0, B: 0 },
    sitout: { A: null, B: null }, cardChoices: {}, chosen: null, turn: null, cardWindowEndsAt: null, gameOver: null } };
}

export function beginTeamTurn(room, team, now) {
  return { ...room, status: 'turn', turn: { team, endsAt: now + TEAM_LIMITS.turn },
    chosen: null, cardWindowEndsAt: null, startsAt: null, endsAt: null };
}

export function chooseSquare(room, playerId, squareId, steal, now) {
  const player = room.players.get(playerId);
  if (room.gameMode !== 'teams' || room.status !== 'turn' || !player?.connected ||
      player.team !== room.turn?.team || now >= room.turn.endsAt) return { error: 'NOT_YOUR_TURN' };
  // Choosing a Steal is the designated chooser's card action, not an ordinary square tap.
  if (room.sitout?.[player.team] === playerId && !steal) return { error: 'SITTING_OUT' };
  const square = Number.isInteger(squareId) ? room.board.find(entry => entry.id === squareId) : null;
  if (!square || (steal !== undefined && typeof steal !== 'boolean')) return { error: 'BAD_TARGET' };
  if (steal) {
    if (square.owner !== otherTeam(player.team)) return { error: 'BAD_TARGET' };
    if (!(room.cards[player.team].steal > 0)) return { error: 'NO_CARD' };
    const error = cardPlayError(room, playerId, 'steal');
    if (error) return { error };
    if (room.sitout?.[player.team] && room.cardChoices?.[player.team]) return { error: 'NOT_ALLOWED' };
  } else if (square.owner) return { error: 'TAKEN' };
  return { room: selectTeamSquare(room, square, Boolean(steal), now),
    ...(steal ? { by: { id: player.id, name: player.name } } : {}) };
}

function selectTeamSquare(room, square, steal, now) {
  const team = room.turn.team;
  return { ...room, status: 'cardWindow', category: square.category,
    cardWindowEndsAt: now + TEAM_LIMITS.cards,
    chosen: { squareId: square.id, team, steal, lockedBy: null },
    cardChoices: steal ? { ...room.cardChoices, [team]: 'steal' } : room.cardChoices,
    cards: steal ? { ...room.cards, [team]: { ...room.cards[team], steal: room.cards[team].steal - 1 } } : room.cards };
}

// A full board may still have a legal Steal turn. The timeout uses it only if no free square exists.
export function automaticSquare(room, now, randomValue) {
  let squares = room.board.filter(square => !square.owner);
  const steal = !squares.length;
  if (steal && room.cards[room.turn.team].steal > 0) {
    squares = room.board.filter(square => square.owner === otherTeam(room.turn.team));
  }
  if (!squares.length) return null;
  const square = squares[Math.min(Math.floor(randomValue * squares.length), squares.length - 1)];
  return selectTeamSquare(room, square, steal, now);
}

export function boardPayload(room) {
  return { board: room.board.map(({ id, category, owner }) => ({ id,
    category: { id: category.id, title: category.title }, owner })),
    teamPoints: { ...room.teamPoints }, cards: { A: { ...room.cards.A }, B: { ...room.cards.B } } };
}

export function teamScores(room) {
  const scores = { A: 0, B: 0 };
  for (const player of room.players.values()) if (player.team in scores) scores[player.team] += player.score;
  return scores;
}

// Adapter around the classic matching engine keeps classic rules and Freeze unchanged.
export function submitBoardAnswer(room, playerId, text, now) {
  const player = room.players.get(playerId);
  if (!player?.team || room.sitout?.[player.team] === playerId) {
    return { room, word: null, ack: { result: 'closed', delta: 0, score: player?.score ?? 0 } };
  }
  const result = submitAnswer(room, playerId, text, now);
  // PB-17: only a new correct answer earns the extra point; penalties/repeats stay unchanged.
  if (room.gameMode !== 'teams' || result.ack.result !== 'correct' || room.chosen?.lockedBy !== player.team) return result;
  const players = new Map(result.room.players);
  players.set(playerId, { ...players.get(playerId), score: result.ack.score + 1 });
  return { ...result, room: { ...result.room, players },
    ack: { ...result.ack, delta: 2, score: result.ack.score + 1 } };
}

// PB-17 Lock: the non-choosing team doubles its correct answers for this battle only.
export function playLock(room, playerId, now, target) {
  const error = cardPlayError(room, playerId, 'lock');
  if (error) return { error };
  const player = room.players.get(playerId);
  if (!player.connected || player.out) return { error: 'NOT_ALLOWED' };
  if (room.status !== 'cardWindow' || !Number.isFinite(now) || !Number.isFinite(room.cardWindowEndsAt) ||
      now >= room.cardWindowEndsAt || now < room.cardWindowEndsAt - TEAM_LIMITS.cards) return { error: 'NOT_NOW' };
  const chosen = room.chosen;
  if (!chosen || !['A', 'B'].includes(chosen.team) || !room.board?.some(square => square.id === chosen.squareId) ||
      (target !== undefined && target !== chosen.squareId)) return { error: 'BAD_TARGET' };
  if (chosen.team === player.team) return { error: 'NOT_ALLOWED' };
  if (chosen.lockedBy) return { error: 'NOT_NOW' };
  const team = player.team;
  return { room: { ...room, chosen: { ...chosen, lockedBy: team },
    cards: { ...room.cards, [team]: { ...room.cards[team], lock: room.cards[team].lock - 1 } },
    cardChoices: { ...room.cardChoices, [team]: 'lock' } },
    team, by: { id: player.id, name: player.name }, target: chosen.squareId };
}

export function finishTeamBattle(room) {
  const scores = teamScores(room);
  const latest = team => {
    const times = [...room.players.values()].filter(player => player.team === team && player.lastCorrectAt != null)
      .map(player => player.lastCorrectAt);
    return times.length ? Math.max(...times) : null;
  };
  let winnerTeam = scores.A > scores.B ? 'A' : scores.B > scores.A ? 'B' : null;
  if (!winnerTeam) {
    const a = latest('A'), b = latest('B');
    if (a !== b) winnerTeam = a == null ? 'B' : b == null ? 'A' : a < b ? 'A' : 'B';
  }
  const board = room.board.map(square => square.id === room.chosen.squareId && winnerTeam ?
    { ...square, owner: winnerTeam } : square);
  return { room: { ...room, board, status: 'battleEnd', teamPoints: {
    A: room.teamPoints.A + scores.A, B: room.teamPoints.B + scores.B } },
    payload: { squareId: room.chosen.squareId, winnerTeam, teamScores: scores,
      scores: [...room.players.values()].map(({ id, name, team, score }) => ({ id, name, team, score })) } };
}

export function restartTeamRoom(room) {
  const next = restartRoom(room);
  return { ...next, board: [], turn: null, chosen: null, cardWindowEndsAt: null, gameOver: null,
    cards: { A: newTeamCards(), B: newTeamCards() }, teamPoints: { A: 0, B: 0 },
    sitout: { A: null, B: null }, cardChoices: {} };
}

// Reef / PB-15. Board identity is square.id, not array order.
function validTeamBoard(board) {
  return Array.isArray(board) && board.length === 16 &&
    new Set(board.map((square) => square?.id)).size === 16 &&
    board.every((square) => Number.isInteger(square?.id) && square.id >= 0 && square.id < 16 &&
      [null, 'A', 'B'].includes(square.owner));
}

export function findWinningLine(board) {
  if (!validTeamBoard(board)) return null;
  const owners = new Map(board.map(({ id, owner }) => [id, owner]));
  const lines = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => row * 4 + col))
    .concat(Array.from({ length: 4 }, (_, col) => Array.from({ length: 4 }, (_, row) => row * 4 + col)));
  for (const line of lines) {
    const team = owners.get(line[0]);
    if (team && line.every((id) => owners.get(id) === team)) return { team, line };
  }
  return null;
}

export function teamGameResult(board, teamPoints = { A: 0, B: 0 }, cards = {}) {
  if (!validTeamBoard(board)) return null;
  const squares = { A: 0, B: 0 };
  for (const square of board) if (square.owner) squares[square.owner]++;
  const points = { A: teamPoints.A ?? 0, B: teamPoints.B ?? 0 };
  const winning = findWinningLine(board);
  if (winning) return { winnerTeam: winning.team, line: winning.line, squares, teamPoints: points };
  if (board.some((square) => square.owner === null)) return null;
  // A full board is not final while either team can still steal an opposing square.
  if ((cards.A?.steal > 0 && squares.B > 0) || (cards.B?.steal > 0 && squares.A > 0)) return null;
  const difference = squares.A - squares.B || points.A - points.B;
  return { winnerTeam: difference > 0 ? 'A' : difference < 0 ? 'B' : null,
    line: null, squares, teamPoints: points };
}

// Reef / PB-20. Previous sitting-out players return next battle and are not
// ranked as zero-point participants in the battle they did not play.
export function selectTeamSitouts(players, joinOrder, previous = {}) {
  const result = { A: null, B: null };
  const allPlayers = [...players];
  for (const team of ['A', 'B']) {
    const members = allPlayers.filter((player) => player.team === team);
    if (members.length <= 2) continue;
    const eligible = members.filter((player) => player.id !== previous[team]);
    eligible.sort((a, b) => a.score - b.score ||
      (b.lastCorrectAt ?? Infinity) - (a.lastCorrectAt ?? Infinity) ||
      joinOrder.indexOf(b.id) - joinOrder.indexOf(a.id));
    result[team] = eligible[0]?.id ?? null;
  }
  return result;
}

export function prepareTeamSitouts(room) {
  return { ...room, sitout: selectTeamSitouts(room.players.values(), room.joinOrder, room.sitout), cardChoices: {} };
}

export function teamCardPermission(room, playerId) {
  const player = room.players.get(playerId);
  if (room.gameMode !== 'teams' || !player?.connected || !['A', 'B'].includes(player.team)) return 'NOT_ALLOWED';
  const chooser = room.sitout?.[player.team];
  if (chooser && chooser !== playerId) return 'NOT_ALLOWED';
  if (chooser && room.cardChoices?.[player.team]) return 'NOT_ALLOWED';
  return null;
}

// Call only after the owning card's phase/target/effect validation succeeds.
// This records PB-20 finality; the card owner still applies and consumes it.
export function recordTeamCardChoice(room, playerId, card) {
  const error = teamCardPermission(room, playerId);
  if (error) return { room, error };
  const team = room.players.get(playerId).team;
  if (!['freeze', 'lock', 'mine', 'steal'].includes(card)) return { room, error: 'BAD_TARGET' };
  if (!(room.cards?.[team]?.[card] > 0)) return { room, error: 'NO_CARD' };
  return { room: { ...room, cardChoices: { ...room.cardChoices, [team]: card } }, error: null };
}

export function submitTeamAnswer(room, playerId, text, now) {
  const player = room.players.get(playerId);
  if (room.gameMode === 'teams' && player && room.sitout?.[player.team] === playerId) {
    return { room, word: null, ack: { result: 'closed', delta: 0, score: player.score } };
  }
  return room.gameMode === 'teams' ? submitBoardAnswer(room, playerId, text, now) : submitAnswer(room, playerId, text, now);
}

// Reef / PB-20: enforce chooser finality around Danah's unchanged Freeze rule.
export function playTeamFreeze(room, playerId, now, randomValue) {
  const choice = recordTeamCardChoice(room, playerId, 'freeze');
  if (choice.error) return { error: choice.error };
  return playFreeze(choice.room, playerId, now, randomValue);}
// PB-18 Mine card (Renad). A hidden mine on a free square: if the rival team loses the battle
// there it loses MINE_PENALTY team points; if the rival wins there the mine is removed silently.
export const MINE_PENALTY = 3;

// Own team's turn only: before choosing (`turn`) or after it (`cardWindow`). Not the chosen square.
export function playMine(room, playerId, squareId, now) {
  const error = cardPlayError(room, playerId, 'mine');
  if (error) return { error };
  const player = room.players.get(playerId);
  const team = player.team;
  const ownTurn = room.status === 'turn' && room.turn?.team === team && now < room.turn.endsAt;
  const ownWindow = room.status === 'cardWindow' && room.chosen?.team === team && now < room.cardWindowEndsAt;
  if (!ownTurn && !ownWindow) return { error: 'NOT_NOW' };
  // PB-20: a sitting-out chooser's card choice is final, as for Steal in chooseSquare.
  if (room.sitout?.[team] && room.cardChoices?.[team]) return { error: 'NOT_ALLOWED' };
  const square = Number.isInteger(squareId) ? room.board.find(entry => entry.id === squareId) : null;
  if (!square || square.owner || square.mine || square.id === room.chosen?.squareId) return { error: 'BAD_TARGET' };
  return { room: { ...room,
    board: room.board.map(entry => entry.id === square.id ? { ...entry, mine: team } : entry),
    cards: { ...room.cards, [team]: { ...room.cards[team], mine: room.cards[team].mine - 1 } },
    cardChoices: { ...room.cardChoices, [team]: 'mine' } },
    team, by: { id: player.id, name: player.name } };
}

// The squares a team has mined; only that team may see them (board:mines).
export function teamMines(room, team) {
  return (room.board ?? []).filter(square => square.mine === team).map(square => square.id);
}

// Runs after finishTeamBattle, on the battled square. `owner` tells the caller whose mine list changed.
// A draw (no winner) keeps the mine for now; the Product Owner still has to confirm that case.
export function settleMine(room, winnerTeam) {
  const square = room.board?.find(entry => entry.id === room.chosen?.squareId);
  if (!square?.mine || !winnerTeam) return { room };
  const owner = square.mine;
  const board = room.board.map(entry => entry.id === square.id ? { ...entry, mine: null } : entry);
  if (winnerTeam !== owner) return { room: { ...room, board }, owner };
  const rival = otherTeam(owner);
  return { room: { ...room, board, teamPoints: { ...room.teamPoints, [rival]: room.teamPoints[rival] - MINE_PENALTY } },
    owner, exploded: { squareId: square.id, team: rival, points: -MINE_PENALTY } };
}
