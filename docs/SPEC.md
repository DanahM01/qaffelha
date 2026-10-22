# Qaffelha — Detailed Product Specification

Audience: AI coding agents and developers. This is the **one complete requirements document for the whole game**: technology, architecture, every rule, the full flow on every device, every screen, responsive UI, visual identity, accessibility, events, data, workflow, acceptance criteria and testing. It is **authoritative**: if the README, a comment, or your own assumption disagrees with it, follow this file. Product Owner: Leena. Simple Arabic version for humans: [`REQUIREMENTS.md`](REQUIREMENTS.md).

Other files you must also follow:
- **`client/src/theme/BRAND.md`** — the visual identity (colors, fonts, logo, components, motion). For anything visual it is the single source of truth; this file never overrides it.
- **`client/src/theme/FLOW.md`** + `/flow` and `/preview` pages — the approved designs of each screen.
- **`EVENTS.md`** — the exact Socket.IO contract.

Scope of this version: **Sprint 1 (19 Oct – 1 Nov 2026) — Speed Battle**. Sprint 2 items are listed in §17 only so you don't design them out; do not build them.

**How to use this file:** read §0–§2 once to understand the stack, the product and the full flow, then the sections for the part you are building (server: §3–§5, §10; screens: §2.3, §6–§9). Before opening a PR, go through §12 and §15.

---

## 0. Technical stack and architecture

### 0.1 Stack (fixed — do not swap libraries without the team's agreement)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Front-end | **React** (function components + hooks), **Vite** | React 18, Vite 5 | Plain JavaScript (ES modules), no TypeScript in Sprint 1 |
| Routing | **react-router-dom** | 6 | Routes: `/host` big screen, `/play` phone, `*` → `/play` |
| Real-time client | **socket.io-client** | 4 | One shared connection in `client/src/socket.js` |
| QR code | **qrcode.react** | 4 | `<QRCodeSVG value={joinUrl} />` |
| Back-end | **Node.js** + **Express** + **Socket.IO** | Node 20+, Express 4, Socket.IO 4 | ES modules (`"type": "module"`) |
| Database | **MongoDB Atlas** (free M0 cluster) via official **mongodb** driver | driver 6 | No Mongoose. Only the `categories` collection |
| Tests | **node:test** + `node:assert/strict` | built-in | `npm test` from repo root |
| Hosting | **Render** free tier | — | Server = Web Service, client = Static Site |
| Source control / planning | **GitHub** (PR-only to `main`), **Jira** (Scrum board "Qaffelha") | — | |

Not allowed in Sprint 1: Redux, TypeScript, CSS frameworks (Tailwind, Bootstrap), Firebase, Vercel for the server (it does not keep WebSocket connections open).

### 0.2 Architecture

```
 Phone (/play)  ─┐                        ┌─ MongoDB Atlas
 Phone (/play)  ─┼─ Socket.IO (WebSocket) ─┤   (categories only, read at startup)
 Big screen     ─┘        │                └─
 (/host)            Node.js server
                    ├─ index.js   sockets, rooms, timers (Layan)
                    ├─ game.js    pure rule functions (Layan)
                    ├─ arabic.js  normalize() (Leena)
                    └─ in-memory Map<code, Room>
```

- **Server is authoritative.** Clients only send intents (`room:create`, `room:join`, `game:start`, `answer:submit`, …) and render what the server broadcasts. Clients never compute scores, locks, timers or eliminations.
- **Game state lives in server memory** (`Map<code, Room>`). Nothing about rooms or scores is written to MongoDB. A server restart ends all games (acceptable for Sprint 1).
- **Categories:** on startup the server loads all categories from MongoDB into memory, pre-computes `normalize()` for every answer and alias into a `Map<normalized, canonical>` per category, and only writes back `lastUsedAt` when a category is used.
- **Socket.IO rooms:** each game room code is also a Socket.IO room name; broadcasts use `io.to(code).emit(...)`.
- **Time:** all deadlines (`startsAt`, `endsAt`) are server `Date.now()` values. Clients compute `offset = serverTime - Date.now()` once from the ack of `room:join`/`room:create` (include `serverTime` in those acks) and draw timers from that.

### 0.3 Suggested server data shapes

```js
Room = {
  code, mode: 'screen' | 'phone', hostId, status: 'lobby' | 'countdown' | 'round' | 'roundEnd' | 'over',
  players: Map<playerId, Player>, joinOrder: [playerId], eliminatedOrder: [playerId],
  round: 0, category: null, endsAt: null, usedCategoryIds: Set,
  locked: Map<normalizedWord, { word, byId }>, timers: { tick, end }
}
Player = { id, name, socketId, connected, out: false, score: 0, submitted: Set<normalized>, lastCorrectAt: null, joinedAt }
```
`playerId` = `crypto.randomUUID()`. Rule functions in `game.js` take and return plain data (no sockets, no timers) so they are unit-testable.

### 0.4 Environment variables

| Where | Name | Example | Purpose |
|---|---|---|---|
| `server/.env` | `MONGODB_URI` | `mongodb+srv://…/qaffelha` | Atlas connection (never commit) |
| `server/.env` | `PORT` | `3001` | Server port (Render sets it automatically) |
| `server/.env` | `CLIENT_ORIGIN` | `http://localhost:5173` | CORS origin and base of the QR join URL |
| `client/.env` | `VITE_SERVER_URL` | `http://localhost:3001` | Where the client connects |

### 0.5 Local development

```bash
npm run install:all          # installs server/ and client/
cp .env.example server/.env  # fill MONGODB_URI (ask Danah)
npm run seed                 # load database/categories.json into Atlas
npm run dev:server           # http://localhost:3001  (GET /health → { ok: true })
npm run dev:client           # http://localhost:5173/host and /play
npm test                     # server unit tests
```
Testing with real phones: run the client with `npm run dev --prefix client -- --host`, set `VITE_SERVER_URL` and `CLIENT_ORIGIN` to the laptop's LAN IP, all devices on the same Wi-Fi.

### 0.6 Deployment (Render)
- **Server:** Web Service, root `server/`, build `npm install`, start `npm start`, env vars from §0.4, health check `/health`. Free tier sleeps after inactivity; first request can take ~30 s.
- **Client:** Static Site, root `client/`, build `npm install && npm run build`, publish `dist`, env `VITE_SERVER_URL=<server URL>`, rewrite rule `/* → /index.html` so `/host` and `/play` work on refresh.

### 0.7 Coding conventions
- File names: React components `PascalCase.jsx`, everything else `camelCase.js`.
- One component per file; keep screens in their owner's folder (`client/src/host/…`, `client/src/player/…`).
- Use CSS variables and classes from `client/src/theme/theme.css`; no inline hex colors.
- All user-facing text in Arabic; code, comments, commit messages in English.
- Event names only from `EVENTS.md`, written as string constants at the top of the file that uses them.

---

## 1. Glossary

| Term | Meaning |
|---|---|
| Room | One game session, identified by a 4-letter code |
| Host | The person who created the room. Controls Start and Play again |
| Player | Anyone who joined with a name and plays from a phone |
| Mode | `screen` (big screen + phones) or `phone` (phones only) |
| Big screen | The `/host` page on a laptop/TV (mode `screen` only) |
| Phone | The `/play` page on a player's phone |
| Category | A topic such as «فواكه» with a list of accepted answers |
| Round | One category, 20 seconds of answering, ends with one elimination |
| Locked word | An accepted answer that someone already claimed this round |
| Eliminated / out | A player removed from the game; they keep watching |

## 2. Product, devices and the complete flow

### 2.1 The product in one paragraph
A category appears (e.g. «فواكه») with a 20-second timer. Every player types as many words from that category as they can on their own phone. The first player to type a correct word gets **+1** and the word **locks** for everyone; typing a word someone else already locked costs **−1**. **Scores reset to 0 at the start of every round.** At the end of each round the lowest scorer is **eliminated**. Rounds continue with new categories until **one winner** remains.

### 2.2 One website, two ways to play
- There is **one website and one URL** for everyone. Laptops, TVs, tablets and phones all open the same pages. Never build a separate "desktop site" and "mobile site".
- **The site never detects the device type** (no user-agent sniffing, no touch detection, no `isMobile`). The person's choice decides what the device becomes:
  - «العب على شاشة كبيرة» → this device becomes the **big screen** (`screen` mode). Usually a laptop/TV, but it works on any device.
  - «العب بالجوالات بس» → this device's owner is the **host and also a player** (`phone` mode). No big screen exists.
  - «ادخل غرفة» or scanning the QR → this device is a **player's phone**.
- Layout adapts only by available size (§7). There are **no dead ends**: never show «افتح هذا من جهاز ثاني».

| | `screen` mode (big screen) | `phone` mode (phones only) |
|---|---|---|
| Who creates the room | Big screen device, presses «العب على شاشة كبيرة» | Host's phone, presses «العب بالجوالات بس» and types a name |
| Is the host a player? | No | Yes |
| Where QR + code are shown | Big screen | Host's phone (+ «شارك الرابط») |
| Who has «ابدأ» and «العب مرة ثانية» | Big screen | Host's phone only |
| Public info (category, timer, locked words, scores) | Big screen **and** every phone | Every phone |

Server rules and events are identical in both modes.

### 2.3 Complete flow, step by step

**Step 1 — Home (`/`)**: one page for every device (`<Home />`), three choices: «ادخل غرفة», «العب على شاشة كبيرة», «العب بالجوالات بس». On wide areas (≥ 900px) the big-screen button is primary and largest; on narrow areas «ادخل غرفة» is primary. Same component, same buttons, only order/size change.

**Step 2 — Create the room**
- Big screen: room created immediately → big-screen lobby.
- Phones only: host types their name (validation as §3.1) → room created → host-phone lobby.

**Step 3 — Join**
- Lobby shows a large **QR code** encoding `<CLIENT_ORIGIN>/play/CODE`, the 4-letter code in small text under it, the joined names (animated in) and the count. Host phone also shows «شارك الرابط» (Web Share API, fallback copy link).
- Scanning the QR opens `/play/CODE` directly on the **«لقيت الغرفة» screen**: the room is already filled, the player types **only their name** → «ادخل». Players almost never see Home.
- Without a camera: Home → «ادخل غرفة» → type the code → type the name.
- Errors (shown on the field, the player stays on the screen): «الغرفة مو موجودة», «الاسم مأخوذ», «الاسم غير صالح», «اللعبة بدأت», «الغرفة مليانة».

**Step 4 — Waiting**: each name appears on every lobby view as soon as that player joins. Player phone: «انتظر المضيف يبدأ» + the player list (their own name highlighted).

**Step 5 — Start**: only the host has «ابدأ», disabled until **3** players (hint «تحتاجون 3 لاعبين على الأقل»). Pressing it → every device shows a **3, 2, 1** countdown in sync.

**Step 6 — Round (20 s)**
- Big screen: round number, category (large), timer, locked words as price-tag chips with the locker's name, live scoreboard.
- Every phone (same in both modes): top = category + timer; middle = live strip of locked words («موز» + lock icon + «ريف»); small bar = my round score + my rank; bottom = answer input + send button (keyboard stays open).
- After each submission the player sees: **صح +1** (green) · **مقفولة −1** (red, shake) · **مو من الفئة 0** (cream) · **كتبتها قبل 0** (cream, no penalty).

**Step 7 — Round end**: «انتهى الوقت» + round ranking; the lowest is eliminated with the exit animation and «طلع!» stamp (tie rules §3.4). The eliminated player's phone shows «طلعت من اللعبة» and then spectates (same round view, no input). Others see «نجوت!». After 5 s the next round starts.

**Step 8 — Next rounds**: steps 5's countdown → 6 → 7 with a new category; scores back to 0; one player out per round, until one remains.

**Step 9 — Game over**: winner (sunset + crown) + full ranking by elimination order. Host has «العب مرة ثانية» (same players, same code, back to the lobby). Each phone shows the player's own place and the winner.

**Always**: if a phone refreshes or loses signal it returns to exactly where it was (§3.7).

## 3. Game rules (server-side, authoritative)

### 3.1 Room
- Code: 4 uppercase Latin letters, excluding confusing letters `I`, `O` (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ`). Must be unique among live rooms.
- Join URL: `<CLIENT_ORIGIN>/play/CODE`. This is what the QR encodes.
- Players: minimum **3** to start, maximum **12**.
- Names: trimmed, 1–15 characters, unique in the room (compare after `normalize()`), no empty or whitespace-only names.
- Joining is only allowed while the room is in `lobby` state.
- A room with no connected sockets for 10 minutes is deleted.

### 3.2 Round
1. Server picks a category (§3.5), emits `round:countdown` with `startsAt = now + 3000`.
2. At `startsAt` it resets every active player's round score to **0**, clears the locked words, emits `round:start` with `endsAt = startsAt + 20000`.
3. Players submit answers until `endsAt`. Submissions arriving after `endsAt` get `closed`.
4. At `endsAt` the server computes the elimination (§3.4) and emits `round:end`.
5. After **5 seconds** on the results view: if more than one active player remains, go to step 1 with a new category; otherwise emit `game:over`.

### 3.3 Scoring one submission
Let `n = normalize(text)`. Ignore (`wrong`, delta 0) if `n` is empty or longer than 40 characters. Then, in this order:

| Check | Result | Delta |
|---|---|---|
| Sender is out, or round not running | `closed` | 0 |
| `n` is already in this player's own submitted set this round | `repeat` | 0 |
| `n` matches an accepted answer that is **already locked** by someone else | `locked` | −1 |
| `n` matches an accepted answer not yet locked | `correct` | +1, lock it to this player, record `lastCorrectAt = server time` |
| Otherwise | `wrong` | 0 |

- Add `n` to the player's submitted set for every result except `closed`, so a second identical submission is a `repeat`.
- Matching: an answer matches if `normalize(answer)` or `normalize(alias)` equals `n` (§4).
- Scores **can go negative**.
- Lock is first-come by the server's processing order (Node is single-threaded, so this is deterministic).
- After `correct`, broadcast `answer:locked` and `score:update`. After `locked`, broadcast `score:update`.
- Rate limit: max 5 submissions per second per player; extras get `wrong`, delta 0.

### 3.4 Elimination at round end
Among players still in the game:
1. Lowest round score is eliminated.
2. Tie on lowest score → among the tied, eliminate the one whose `lastCorrectAt` is **latest** (slower). A player with no correct answer this round counts as slowest of all.
3. Still tied (e.g. nobody answered correctly) → eliminate the one who **joined the room last**.

Exactly one player is eliminated per round. A disconnected player still counts and can be eliminated.

### 3.5 Category selection
- Pick a random category not used in this room yet; prefer categories with the oldest `lastUsedAt` in the DB; update `lastUsedAt` when used.
- If every category has been used in this room, reset the room's used list.

### 3.6 End of game and ranking
- Game ends when one active player remains: that player is the winner (place 1).
- Ranking is by elimination order: the last player eliminated is place 2, and so on; the first eliminated gets the last place.
- `game:restart` (host only) returns the room to `lobby` with the same players (all back in), clears scores, keeps the code. Disconnected players are dropped.

### 3.7 Reconnection
- On join the client stores `{ code, playerId }` in `sessionStorage`.
- On page load/reconnect it calls `room:rejoin`. If the player still exists, the server re-attaches the socket and acks a full `state` snapshot: `{ status, mode, hostId, players, round, category, endsAt, locked: [{word, by}], scores, me: { out, score } }`.
- The host of `screen` mode rejoins the same way with its stored host token.
- If the host disconnects in `phone` mode, host rights pass to the earliest-joined connected player after 15 seconds.

## 4. Arabic normalization (`server/arabic.js`, owner Leena)

`normalize(text)` must, in order:
1. Trim and collapse inner whitespace to one space.
2. Remove diacritics `ً–ْ`, superscript alef `ٰ`, and tatweel `ـ`.
3. Unify alef forms `أ إ آ ٱ` → `ا`.
4. `ى` → `ي`, `ة` → `ه`, `ؤ` → `و`, `ئ` → `ي`.
5. Remove leading `ال` from each word when the word is longer than 3 letters after removal (so «الأرز» → «ارز», but «ال» alone stays).
6. Convert Arabic-Indic digits `٠-٩` to `0-9`.
7. Lowercase any Latin letters.

Required tests (`server/arabic.test.js`): «الأَرْز» = «ارز», «تفاحة» = «تفاحه», «مصطفى» = «مصطفي», «  موز  » = «موز», «فراولة» = «الفراوله».

## 5. Data (MongoDB Atlas, database `qaffelha`)

Collection `categories`:
```json
{
  "_id": "fruits",
  "title": "فواكه",
  "answers": ["تفاح", "موز", "برتقال"],
  "aliases": { "برتقال": ["برتقاله", "بردقان"] },
  "difficulty": "easy",
  "lastUsedAt": null
}
```
- Sprint 1 target: **30 categories, each with at least 20 answers** (Leena).
- Source file `database/categories.json`; `npm run seed` upserts it.
- Rooms and game state live **in server memory only** (no DB writes during play except `lastUsedAt`).

## 6. Screens (what each state shows)

All UI is Arabic, RTL, and built only from the identity in §8. Designs: `/flow` and `/preview`.

### 6.1 Routes
| Route | Who | Owner |
|---|---|---|
| `/` | Home for every device (`<Home />`) | Danah (theme) |
| `/host/*` | Big screen (screen mode) | Renad |
| `/play` | Join by code (from Home «ادخل غرفة») | Reef |
| `/play/:code` | QR landing «لقيت الغرفة» → name → game | Reef |
| `/play/new` | Phones-only host: name → host lobby → game | Reef |
| `/preview`, `/flow`, `/sim*` | Design references only, not part of the product | Danah |

### 6.2 Home `/`
Logo (animated) + tagline «اكتبها قبلهم… وقفّلها!» + three buttons «ادخل غرفة», «العب على شاشة كبيرة», «العب بالجوالات بس». Ordering per §2.3 step 1, done with container queries only.

### 6.3 Big screen `/host` (Renad)
| State | Shows |
|---|---|
| Lobby | Large QR (≥ 280px or ≥ 30% of the shorter side), room code small under it (`.q-room-code`, LTR), joined names animating in, player count, «ابدأ» (disabled < 3 players with hint) |
| Countdown | 3, 2, 1 full screen |
| Round | Round number, category (`--q-fs-tv-category`), timer (20 lights, warn at 10 s, danger at 5 s), locked-word chips newest first with locker name, live scoreboard sorted by score (leader highlighted, lowest marked danger) |
| Round end | «انتهى الوقت», sorted scores, eliminated player card with «طلع!» stamp and exit animation, «نجوا» list |
| Game over | Winner (sunset + crown), ranking by place, «العب مرة ثانية», «الرئيسية» |

### 6.4 Phone `/play` (Reef)
| State | Shows |
|---|---|
| Join by code | Code input (4 LED letters, LTR) → then name input. Errors inline |
| QR landing `/play/:code` | «لقيت الغرفة» + room code + name input + «ادخل». Errors inline |
| Phones-only host name | Name input + «افتح الغرفة» |
| Lobby (player) | «انتظر المضيف يبدأ» + players (me highlighted) |
| Lobby (phones-only host) | QR + code + «شارك الرابط» + players + «ابدأ» (disabled < 3) |
| Countdown | 3, 2, 1 |
| Round | Top: category + timer. Middle: live locked-words strip. Small bar: my score + my rank. Bottom: input + send (≥ 48px, keyboard stays open). Feedback toast after each submit (§2.3 step 6) |
| Round end | Ranking; «نجوت!» or «طلعت من اللعبة» |
| Spectating (out) | Banner «طلعت من اللعبة — تتفرج», round view without input |
| Game over | My place + winner; phones-only host also gets «العب مرة ثانية» |
| Reconnecting | Small banner «نرجعك للعبة…» while `room:rejoin` runs |

## 7. Responsive UI (every screen must fit every device)

### 7.1 Sizes each screen must support
| Screen type | Designed for | Must also work on |
|---|---|---|
| Home | every device | 320px phones → 4K TVs |
| Big screen `/host` | 1440×900 laptop, 1920×1080 TV | 1024×768, 1280×720, 3840×2160, a phone in landscape |
| Phone `/play` | 390×844 | 320×568, 430×932, 768×1024 tablet, desktop window |

### 7.2 Rules
- **Big screen** is read from ~3 m: use the TV font tokens (`--q-fs-tv-*`, they scale with the smaller of width/height). No fixed px font sizes for TV text. Category, timer, room code and QR visible **without scrolling** at 1280×720 and up.
- **Phone** is used with one thumb: input + send at the bottom, ≥ 48px tall, above `env(safe-area-inset-bottom)`. Use `100dvh` (not `100vh`) so nothing hides behind the on-screen keyboard. Keyboard stays open after sending.
- On wide screens, phone layouts are centered with `max-width: var(--q-player-max)`.
- No horizontal scrolling at any supported size.
- Lists wrap (`flex-wrap`, `auto-fit` grids) so 3 or 12 players fit. Long names (15 letters) and long categories wrap or ellipsize, never overlap.

### 7.3 Techniques
- Wide breakpoint: **900px** of available width; short phones: `max-height: 740px`. Add breakpoints only when a layout actually breaks.
- Prefer `@container` queries on the screen wrapper (so screens also work inside `/preview` and simulators); `@media` acceptable.
- Sizes with `clamp()`, `min()`, `max()`, `%`, `fr`, `cqw/cqh`, `dvh`. Fixed px only for borders, shadows and minimum touch sizes.
- SVG/art scales with its container. Respect `prefers-reduced-motion` in every new animation.

## 8. Visual identity (mandatory — details in `client/src/theme/BRAND.md`)

Style: an 80s TV studio with hand-painted grocery-sign panels — teal night background, cream/mustard/red/green paint, stacked colored shadows, LED numbers, sunset.

1. **No raw colors** in `host/` or `player/` (no hex, `rgb()`, `hsl()`). Only `var(--q-…)` tokens and `.q-…` classes. `node src/theme/check-colors.mjs` (from `client/`) must pass before every PR.
2. Use **role tokens** (`--q-correct`, `--q-surface`, `--q-primary` …), not raw paint tins.
3. Two contexts: dark background → text `--q-text`; cream panels (`.q-card`, `.q-input`, `.q-score-row` …) → text `--q-ink`.
4. **Fonts:** Tajawal (self-hosted in `public/fonts`) + `--q-font-led` for timer/score digits. No other fonts, no Google Fonts.
5. **Logo** only via `<Logo />` with its documented variants; never recolor, stretch or redraw; min height 28px (mark 18px).
6. **Icons** only from `theme/Logo.jsx`. **No emoji in the UI.**
7. **Reuse components:** `.q-btn`, `.q-card`, `.q-input`, `.q-timer`, `.q-lock-chip`, `.q-scoreboard`, `.q-feedback--*`, `.q-room-code`, `.q-tv`, `.q-eliminated`, `.q-winner` … Options are normal-size buttons, not big cards.
8. Game states keep their documented look: correct (green, +1), locked (red, −1, shake), wrong (cream, 0), eliminated (dashed + «طلع!» stamp), winner (sunset + crown). Timer: 20 lights, `is-warn` ≤ 10 s, `is-danger` ≤ 5 s.
9. `<PaintFilters />` and `theme.css` are mounted once in `main.jsx`; don't import them again.
10. Arabic + RTL everywhere; logical CSS properties; room codes, links and numbers use `.q-ltr`.
11. Missing a color, size or component? **Don't invent it** — ask Danah (owner of `client/src/theme/`).

## 9. Accessibility
- Contrast ≥ 4.5:1 for text (use only the token pairs listed in BRAND.md).
- Visible focus on every control; never remove outlines.
- Real `<button>`/`<input>`; `role="timer"` on the timer; `aria-live="polite"` on answer feedback and the locked-words list.
- Tap targets ≥ 48×48px on phones.
- Never rely on color alone: feedback also shows +1 / −1 / 0 and a word.

## 10. Events
The exact contract is [`../EVENTS.md`](../EVENTS.md) (owner Layan). The server validates every payload (types, lengths, room exists, sender is host where required) and answers through the ack with an `error` code instead of throwing. Clients never rename or invent events.

## 11. Non-functional requirements
- Current Safari (iOS) and Chrome (Android, desktop). No app install.
- An answer's result reaches the sender in < 300 ms on normal Wi-Fi; timers in sync across devices within 0.5 s.
- 12 players in one room without lag.
- No secrets in the repo; MongoDB URI only in `server/.env`.
- Server logs one line per room event (create, start, round end, game over); never log answer streams or names in bulk.

## 12. Ownership and workflow
| Folder / file | Owner |
|---|---|
| `client/src/theme/`, `client/src/main.jsx`, `client/src/socket.js`, Home | Danah |
| `client/src/host/` | Renad |
| `client/src/player/` | Reef |
| `server/index.js`, `server/game.js`, `EVENTS.md` | Layan |
| `server/arabic.js`, `database/categories.json`, `server/seed.js` | Leena |

- Edit only your own folder; ask the owner for anything else.
- Branch `<member>/<PB-key>-short-title`; commits start with the PB key; Pull Request to `main` with one review; never push to `main`; never commit `.env`.
- If this spec doesn't cover something: choose the simplest behavior, write it in the PR description, and tell Leena (Product Owner) to confirm.

## 13. Acceptance criteria (Sprint 1 stories)
| ID | Done when |
|---|---|
| PB-01 | A room can be created from Home in both modes; a unique 4-letter code and a scannable QR appear. |
| PB-02 | Scanning the QR opens `/play/CODE` with the room filled; typing a name joins and it appears on all screens within 1 s. Join by typed code also works. All join errors show correctly. |
| PB-03 | «ابدأ» is host-only, disabled under 3 players; pressing it starts the countdown on every device at the same time. |
| PB-04 | Category and 20 s timer show on the big screen and every phone, in sync within 0.5 s. |
| PB-05 | A player can submit many answers in a round; the keyboard stays open. |
| PB-06 | Spelling variants (§4) count as the same answer; unit tests pass. |
| PB-07 | First correct answer gets +1 and the word appears locked with the player's name on all screens. |
| PB-08 | Scores update live everywhere and reset to 0 at each round start. |
| PB-09 | A word locked by someone else gives −1; repeating your own word gives 0 «كتبتها قبل». |
| PB-10 | Exactly one player is eliminated per round using §3.4; they switch to spectating. |
| PB-11 | 30 categories × ≥ 20 answers seeded; categories don't repeat within a game. |
| PB-12 | Game over shows winner and full ranking; «العب مرة ثانية» returns everyone to the lobby with the same code. |
| PB-24 | Every screen follows §7–§9 and BRAND.md; Danah approves the look. |

## 14. Testing
- `server/game.test.js`: every row of the scoring table (§3.3), every tie-break (§3.4), ranking (§3.6), min/max players, name validation.
- `server/arabic.test.js`: all cases in §4.
- Manual play-test (Reef): 3+ real phones, **both modes**, a phone refresh mid-round, a player with no camera joining by code, a long name.

## 15. Definition of Done (check before every PR)
- [ ] Behavior matches §2.3 and §3 exactly; events match `EVENTS.md`.
- [ ] Screen matches the approved design in `/flow` / `/preview`.
- [ ] Checked at **320×568, 390×844, 768×1024, 1280×720, 1440×900, 1920×1080**: no overflow, no horizontal scroll, nothing cut off.
- [ ] Phone screens checked with the on-screen keyboard open.
- [ ] Works with 3 and with 12 players, a 15-letter name and a long category.
- [ ] `check-colors.mjs` passes; no raw colors, no emoji, no new fonts; RTL correct, codes/numbers LTR.
- [ ] No device detection in the code.
- [ ] Server logic has `node:test` tests and `npm test` passes.
- [ ] PR description lists the PB key, what changed, and screenshots of a phone size and a wide size.

## 16. Out of scope for Sprint 1
Accounts, chat, sound effects, custom categories, teams, board, cards, multiple languages.

## 17. Sprint 2 preview (do not build)
Two teams; a 4×4 board of category squares; each square is won by a speed battle between the teams; first team with a full row or column wins. Cards: **Freeze** (opponent can't type for 3 s), **Lock** (a square becomes harder), **Mine** (a square that costs the loser points), **Steal** (take a square from the other team). Colors are already in BRAND.md §7.
