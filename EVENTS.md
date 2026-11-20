# Socket.IO events (contract)

Owner: **Layan** (server). **Renad** (big screen, `client/src/host`) and **Reef** (phone, `client/src/player`) code against this file.
Changing a name or a payload = tell everyone first and update this file **in the same PR**. Full rules behind each event: [`docs/SPEC.md`](docs/SPEC.md) §3.

- `C→S` = client sends to server, always with an **ack callback** (the server answers through it, never throws).
- `S→C` = server broadcasts to every socket in the room (`io.to(code).emit(...)`).
- All times (`serverTime`, `startsAt`, `endsAt`) are server `Date.now()` in ms. Clients compute `offset = serverTime - Date.now()` once and draw every timer from it.

## 1. Events

### Room and lobby
| Event | Dir | Sent by | Payload → ack | Meaning |
|---|---|---|---|---|
| `room:create` | C→S | host | `{ mode: 'screen' }` → `{ ok, code, hostToken, serverTime }`<br>`{ mode: 'phone', name }` → `{ ok, code, playerId, serverTime }` or `{ ok: false, error }` | Create a room. In `screen` mode the device is only a display (not a player) and keeps `hostToken` to reconnect. In `phone` mode the host is also a player. Errors: `NAME_INVALID` |
| `room:join` | C→S | player | `{ code, name }` → `{ ok, playerId, serverTime }` or `{ ok: false, error }` | Join from `/play/CODE` (QR) or by typed code. Errors: `NOT_FOUND`, `NAME_TAKEN`, `NAME_INVALID`, `STARTED`, `FULL` |
| `room:rejoin` | C→S | anyone | `{ code, playerId }` or `{ code, hostToken }` → `{ ok, state, serverTime }` or `{ ok: false, error: 'NOT_FOUND' }` | After a refresh or lost signal. `state` = full snapshot (below). On `NOT_FOUND` the client clears `sessionStorage` and goes to `/` |
| `room:players` | S→C | server | `{ mode, hostId, players: [{ id, name, out, connected }] }` | Sent on every join, leave, reconnect, elimination or host change. `hostId` is `null` in `screen` mode |

### Game
| Event | Dir | Sent by | Payload → ack | Meaning |
|---|---|---|---|---|
| `game:start` | C→S | host | `{ code }` → `{ ok }` or `{ ok: false, error }` | Start. Errors: `NOT_HOST`, `NOT_ENOUGH_PLAYERS` (min 3). On success the server immediately sends `round:countdown` |
| `round:countdown` | S→C | server | `{ round, startsAt }` | Show 3-2-1; `startsAt = now + 3000` |
| `round:start` | S→C | server | `{ round, category: { id, title }, endsAt }` | Round begins. Every score is now **0** and the locked list is empty. `endsAt = startsAt + 20000` |
| `answer:submit` | C→S | player | `{ code, text }` → `{ result, delta, score }` | One typed word. `result`: `correct` (+1), `locked` (−1), `wrong` (0), `repeat` (0, you already typed it), `closed` (0, round over or you are out). More than 5 per second → `wrong` |
| `answer:locked` | S→C | server | `{ word, by: { id, name } }` | A word was locked. Big screen: chips list. Phone: live strip |
| `score:update` | S→C | server | `{ scores: [{ id, score }] }` | Sent after every `correct` or `locked` |
| `round:end` | S→C | server | `{ round, scores: [{ id, name, score }], eliminated: { id, name } }` | Time is up. Exactly one player is out (tie → slower last correct answer → joined last). Next `round:countdown` comes 5 s later, or `game:over` |
| `game:over` | S→C | server | `{ winner: { id, name }, ranking: [{ id, name, place }] }` | One player left. Ranking by elimination order |
| `game:restart` | C→S | host | `{ code }` → `{ ok }` or `{ ok: false, error: 'NOT_HOST' }` | «العب مرة ثانية»: same code, same connected players, back to lobby. Server then sends `room:players` |

### `state` snapshot (ack of `room:rejoin`)
```js
{ status: 'lobby' | 'countdown' | 'round' | 'roundEnd' | 'over',
  mode, hostId, players: [{ id, name, out, connected }],
  round, category: { id, title } | null, startsAt, endsAt,
  locked: [{ word, by: { id, name } }], scores: [{ id, score }],
  me: { id, out, score } | null }   // null for the screen-mode host
```

### Team Mode (Sprint 2 — rules in SPEC §17)
See **§6** at the end of this file.

## 2. Who listens to what

| Event | Big screen (Renad) | Phone (Reef) |
|---|---|---|
| `room:players` | Lobby names + count, «ابدأ» enabled at 3 | Lobby list (me highlighted); phone host «ابدأ» |
| `round:countdown` | 3-2-1 | 3-2-1 |
| `round:start` | Category + timer, clear chips and scores | Category + timer, clear strip, my score 0, input enabled |
| `answer:submit` ack | — | Feedback toast (+1 / −1 / 0) and my score |
| `answer:locked` | Add chip (newest first) | Add to live strip |
| `score:update` | Live scoreboard | My score + my rank |
| `round:end` | Ranking + «طلع!» card | «نجوت!» or «طلعت من اللعبة» → spectate |
| `game:over` | Winner + ranking + «العب مرة ثانية» | My place + winner (phone host: «العب مرة ثانية») |

## 3. Client storage
- After `room:join` / phone `room:create`: `sessionStorage.qaffelha = { code, playerId }`.
- After screen `room:create`: `sessionStorage.qaffelha = { code, hostToken }`.
- On every page load: if `sessionStorage.qaffelha` exists → `room:rejoin` first.

## 4. Build order for the server (Layan)
1. `room:create`, `room:join`, `room:players` → Renad and Reef can test the lobby with real phones.
2. `game:start`, `round:countdown`, `round:start`, `round:end` with a fixed test category → screens can test a full round.
3. `answer:submit`, `answer:locked`, `score:update` with `normalize()` from `server/arabic.js` and categories from MongoDB (PB-06, PB-07, PB-09).
4. Elimination, `game:over`, `game:restart`, `room:rejoin`, phone host hand-over after 15 s (PB-10, PB-12).

Until step 1 is merged, Renad and Reef build their screens with fake data shaped exactly like the payloads above.

## 5. Example
```js
// client
socket.emit('room:join', { code: 'QAFL', name: 'ريف' }, (res) => {
  if (!res.ok) return showError(res.error);        // NOT_FOUND, NAME_TAKEN …
  offset = res.serverTime - Date.now();
  sessionStorage.qaffelha = JSON.stringify({ code: 'QAFL', playerId: res.playerId });
});

// server
socket.on('room:join', ({ code, name }, ack) => {
  const room = rooms.get(code);
  if (!room) return ack({ ok: false, error: 'NOT_FOUND' });
  // … validate, add player, socket.join(code)
  ack({ ok: true, playerId, serverTime: Date.now() });
  io.to(code).emit('room:players', playersPayload(room));
});
```


## 6. Team Mode events (Sprint 2)
Rules: [`docs/SPEC.md`](docs/SPEC.md) §17. Owner of the contract: **Layan**. Every event below exists only when `gameMode = 'teams'`; classic events in §1 are unchanged except where noted.

### 6.1 Changes to existing events
| Event | Change |
|---|---|
| `game:start` | Payload `{ code, gameMode: 'classic' \| 'teams' }` (default `classic`; not `mode`, which is `screen`/`phone`). Teams: error `NOT_ENOUGH_PLAYERS` if < 4 players or < 2 per team |
| `room:players` | Also `gameMode`, and each player has `team: 'A' \| 'B' \| null` |
| `round:start` | In teams mode also `{ squareId, lockedBy: 'A' \| 'B' \| null }` |
| `answer:submit` | Extra results: `frozen` (0, you are frozen), `closed` also when you sit out. Lock bonus: `delta` is `+2` for the locking team |
| `score:update` | In teams mode also `{ teamScores: { A, B } }` (this battle) |
| `game:over` | In teams mode `{ winnerTeam: 'A' \| 'B' \| null, line: [squareIds] \| null, squares: { A, B }, teamPoints: { A, B } }` |

### 6.2 New events
| Event | Dir | Sent by | Payload → ack | Meaning |
|---|---|---|---|---|
| `team:set` | C→S | host | `{ code, playerId, team }` → `{ ok }` or `{ ok: false, error }` | Lobby only. Move a player. Errors `NOT_HOST`, `STARTED`, `NOT_FOUND` |
| `team:shuffle` | C→S | host | `{ code }` → `{ ok }` | Lobby only. Random balanced split. Server then sends `room:players` |
| `board:update` | S→C | server | `{ board: [{ id, category: { id, title }, owner }], teamPoints: { A, B }, cards: { A: {freeze,lock,mine,steal}, B: {…} } }` | Full board after start and after every change. Mines are **not** in this payload |
| `board:mines` | S→C | server (to one team only) | `{ mines: [squareId] }` | Your team's hidden mines. Sent only to sockets of that team |
| `turn:start` | S→C | server | `{ team, endsAt }` | Turn team chooses a square before `endsAt` (15 s) or the server picks |
| `square:choose` | C→S | player | `{ code, squareId, steal? }` → `{ ok }` or `{ ok: false, error }` | Errors `NOT_YOUR_TURN`, `TAKEN`, `NO_CARD` (steal), `BAD_TARGET`, `SITTING_OUT` |
| `battle:chosen` | S→C | server | `{ squareId, team, steal, cardWindowEndsAt }` | Square chosen; 5 s card window, then `round:countdown` |
| `card:play` | C→S | player | `{ code, card: 'freeze' \| 'lock' \| 'mine' \| 'steal', target? }` → `{ ok }` or `{ ok: false, error }` | Errors `NO_CARD`, `NOT_NOW`, `NOT_ALLOWED`, `BAD_TARGET`. `steal` is played through `square:choose` |
| `card:played` | S→C | server | `{ team, card, by: { id, name }, target? }` | Announce a card. For `mine`, sent **without** `target` to the other team |
| `player:frozen` | S→C | server | `{ id, until }` | Freeze card hit this player until `until` (server ms) |
| `mine:exploded` | S→C | server | `{ squareId, team, points: -3 }` | The team that lost on a mined square lost 3 team points |
| `team:sitout` | S→C | server | `{ A: playerId \| null, B: playerId \| null }` | Sent before every battle |
| `battle:end` | S→C | server | `{ squareId, winnerTeam: 'A' \| 'B' \| null, teamScores: { A, B }, scores: [{ id, name, team, score }] }` | Replaces `round:end` in teams mode. Next: `turn:start` after 4 s, or `game:over` |

### 6.3 `state` snapshot additions (ack of `room:rejoin`, teams mode)
```js
{ ...classic snapshot,
  gameMode: 'teams',               // mode stays 'screen' | 'phone'
  status: 'lobby' | 'turn' | 'cardWindow' | 'countdown' | 'round' | 'battleEnd' | 'over',
  players: [{ id, name, out, connected, team }],
  board: [{ id, category: { id, title }, owner }],
  mines: [squareId],              // only my team's
  turn: { team, endsAt } | null,
  chosen: { squareId, team, steal, lockedBy } | null,
  cards: { A: { freeze, lock, mine, steal }, B: { … } },
  teamPoints: { A, B },
  sitout: { A: id | null, B: id | null },
  frozenUntil: number | null,     // for me
  me: { id, team, score, sittingOut } | null }
```

### 6.4 Who listens to what (teams mode)
| Event | Big screen | Phone |
|---|---|---|
| `board:update` | Board grid, team points, cards left | Board grid, my team's cards |
| `board:mines` | — (never shown on the big screen) | Mine icon on my team's mined squares |
| `turn:start` | «دور الفريق …» + 15 s bar | My team: board tappable; other team: read-only |
| `battle:chosen` | Enlarge square, 5 s card bar | Lock button for the non-choosing team |
| `card:played` | 3 s announcement | Toast |
| `player:frozen` | Ice icon on that player | If me: frozen overlay 3-2-1, input disabled |
| `team:sitout` | Mark sitting-out players | If me: sit-out screen with card buttons |
| `battle:end` | Square fills with team color, both scores | «فريقك أخذ المربع!» / «الخصم أخذ المربع» |
| `mine:exploded` | Explosion on the square, −3 | Toast |
| `game:over` | Winning line + winner team + Play Again | «فاز فريقك!» / «خسر فريقك» |
