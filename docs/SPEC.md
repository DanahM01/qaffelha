# Qaffelha — Detailed Product Specification

Audience: AI coding agents and developers. This is the **one complete requirements document for the whole game**: technology, architecture, every rule, the full flow on every device, every screen, responsive UI, visual identity, accessibility, events, data, workflow, acceptance criteria and testing. It is **authoritative**: if the README, a comment, or your own assumption disagrees with it, follow this file. Product Owner: Leena. Simple Arabic version for humans: [`REQUIREMENTS.md`](REQUIREMENTS.md).

Other files you must also follow:
- **`client/src/theme/BRAND.md`** — the visual identity (colors, fonts, logo, components, motion). For anything visual it is the single source of truth; this file never overrides it.
- **`client/src/theme/FLOW.md`** + `/flow` and `/preview` pages — the approved designs of each screen.
- **`EVENTS.md`** — the exact Socket.IO contract.

Scope of this version: **Sprint 1 (19 Oct – 1 Nov 2026) — Speed Battle** (done, §0–§16) and **Sprint 2 (8 – 21 Nov 2026) — Team Mode** (§17). Everything in §0–§16 still applies to Team Mode unless §17 says otherwise. Who builds what in Sprint 2: `docs/TASKS.md`.

**How to use this file:** read §0–§2 once to understand the stack, the product and the full flow, then the sections for the part you are building (server: §3–§5, §10; screens: §2.3, §6–§9). Before opening a PR, go through §12 and §15.

---

## 0. Technical stack and architecture

### 0.1 Stack (fixed — do not swap libraries without the team's agreement)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Front-end | **React** (function components + hooks), **Vite** | React 18, Vite 5 | Plain JavaScript (ES modules), no TypeScript in Sprint 1 |
| Routing | **react-router-dom** | 6 | Routes: `/` Home, `/host/*` big screen, `/play/*` phone (`/play`, `/play/:code`, `/play/new`), `*` → `/` (full list §6.1) |
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
npm run dev:client           # http://localhost:5173 (Home), /host, /play, /flow
npm test                     # server unit tests
```
Testing with real phones: run the client with `npm run dev --prefix client -- --host`, set `VITE_SERVER_URL` and `CLIENT_ORIGIN` to the laptop's LAN IP, all devices on the same Wi-Fi.

### 0.6 Deployment (Render)
- **Server:** Web Service, root `server/`, build `npm install`, start `npm start`, env vars from §0.4, health check `/health`. Free tier sleeps after inactivity; first request can take ~30 s.
- **Client:** Static Site, root `client/`, build `npm install && npm run build`, publish `dist`, env `VITE_SERVER_URL=<server URL>`, rewrite rule `/* → /index.html` so `/host`, `/play/CODE` and every other route work on refresh.

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
| `/preview`, `/flow` | Design references only, not part of the product | Danah |

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
- Prefer `@container` queries on the screen wrapper (so screens also work inside `/preview` and `/flow`); `@media` acceptable.
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
- **Security (the repository is public):** no secrets in the repo, ever. The MongoDB URI lives only in `server/.env` locally and in Render's environment settings in production. Code reads secrets from `process.env` only. Client env vars (`VITE_*`) are bundled into the public site, so they must never hold secrets. Only `*.env.example` files with fake values are committed. `.gitignore` blocks `.env` and `.env.*`. A leaked secret must be rotated in Atlas immediately (removing the file does not remove it from Git history).
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
- [ ] No secrets in the diff (`.env`, `mongodb+srv://`, passwords, keys, tokens); only `*.env.example` with fake values.
- [ ] PR description lists the PB key, what changed, and screenshots of a phone size and a wide size.

## 16. Out of scope (Sprint 1 and Sprint 2)
Accounts, stats and leaderboard (PB-22), custom categories (PB-23), extra animations (PB-21), chat, multiple languages. Sound effects were added in Sprint 1 (PB-25).

## 17. Sprint 2 — Team Mode (8 – 21 Nov 2026)

Classic mode (§2–§3) stays exactly as it is. Team Mode is a second game mode in the same room, lobby, server and screens. Colors of the two teams: BRAND.md §7. Events: `EVENTS.md` §6.

### 17.1 Words
| Word | Meaning |
|---|---|
| Team | `A` or `B`. Every player is in exactly one team. |
| Board | 4×4 = 16 squares. Each square has its own category. |
| Square | `{ id: 0..15, category: { id, title }, owner: null \| 'A' \| 'B', mine: null \| 'A' \| 'B' }`. `id = row * 4 + col`. |
| Turn | The team whose turn it is chooses the next square. |
| Battle | One speed round (§3.2–§3.3) played on one square by both teams together. |
| Team points | Running total of all points a team scored in all battles of this game. Shown on screens; used only for tie-breaks and the Mine card. |
| Card | One-time power. Each team has one of each per game: `freeze`, `lock`, `mine`, `steal`. |
| Sitting out | After each battle, the lowest scorer of each team sits out the next battle (PB-20). |

### 17.2 Lobby and teams (PB-13, Renad)
1. The host chooses the mode in the lobby: «فردي» (classic, default) or «فرق». `game:start` sends `{ code, mode: 'classic' | 'teams' }`.
2. Teams needs **at least 4 players and at least 2 in each team**; otherwise `NOT_ENOUGH_PLAYERS`. Max 12 players as before.
3. In the lobby the host can move a player to team A or B (`team:set`) or press «وزّع عشوائي» (`team:shuffle`). New joiners go to the smaller team. Teams are always visible: big screen shows two columns in team colors; each phone shows «فريقك: أ» or «فريقك: ب» in the team color.
4. If the host presses Start in teams mode with unbalanced teams (difference > 1), the server rebalances by moving the latest joiners. If nobody was assigned, the server splits randomly. The server function is `assignTeams(players, current)` in `server/game.js` (pure, tested).
5. Team names on screens: «الفريق الأول» (A) and «الفريق الثاني» (B).

### 17.3 Board and turns (PB-14, Layan)
1. On start the server picks **16 different categories** (same source as §3.5) and builds the board. All squares are free; no mines.
2. Team A has the first turn. The server sends `board:update` and then `turn:start { team }`.
3. Any connected, not-sitting-out player of the turn team taps a **free** square on their phone (`square:choose`). First valid tap wins; later taps get `NOT_YOUR_TURN` or `TAKEN`. The other team's phones show the board read-only with «دور الفريق …».
4. If nobody chooses within **15 s**, the server picks a random free square.
5. After a square is chosen: `battle:chosen { squareId, team }`, then a **5 s window for cards** (§17.6), then the normal 3-2-1 countdown and a 20 s battle.

### 17.4 Battle (PB-14, Layan)
1. A battle uses the classic round engine: same matching (`normalize()`), same locks, +1 correct, −1 for a word locked by anyone, 0 for repeat/wrong. Player scores reset to 0 at the start of every battle (as in classic).
2. **No elimination in Team Mode.** `round:end` is replaced by `battle:end`.
3. Battle result: team battle score = sum of its players' points in this battle (after Lock bonus, §17.6). Higher score captures the square (`owner = team`). Tie: the team whose last correct answer came **later** loses. Nobody scored at all → the square stays free.
4. Both teams' battle scores are added to their team points.
5. After `battle:end` the big screen and phones show the result for 4 s, then the next turn goes to the **other** team (even if the turn team lost).

### 17.5 Winning (PB-15, Reef)
1. After every battle: if a team owns all 4 squares of any **row** or any **column**, it wins immediately (`game:over` with `winnerTeam`). Diagonals do not count.
2. If no free square is left (and no steal is possible) and nobody has a line: the team with more squares wins; equal squares → more team points; still equal → draw (`winnerTeam: null`).
3. Pure function `findWinningLine(board)` → `{ team, line: [ids] } | null` in `server/game.js` with tests for every row, every column, no line, and a full board.
4. Big screen: highlight the winning line, «فاز الفريق الأول!», list of the winning team's players, «العب مرة ثانية». Phone: «فاز فريقك!» or «خسر فريقك», plus the same Play Again flow as classic.

### 17.6 Cards
General rules:
- Each team has `{ freeze: 1, lock: 1, mine: 1, steal: 1 }` at game start. A used card is gone. `card:play { code, card, target? }` → ack `{ ok }` or `{ ok: false, error }` with `NO_CARD`, `NOT_NOW`, `NOT_ALLOWED`, `BAD_TARGET`.
- **Who may play a card:** if the team has a sitting-out player (§17.7), only that player; otherwise any player of the team.
- Every played card is announced to everyone with `card:played { team, card, by: { id, name }, target? }` and shown on the big screen for 3 s.

| Card | Story / owner | When | Effect |
|---|---|---|---|
| **Freeze** «تجميد» | PB-16 Danah | During a battle (after `round:start`, before `endsAt − 3 s`) | Freezes the **opponent player with the highest score in this battle** (tie → random) for **3 s**. Their `answer:submit` gets `result: 'frozen'` (0). Their phone shows a frozen overlay with a 3-2-1. Server sends `player:frozen { id, until }`. |
| **Lock** «قفل» | PB-17 Leena | Only by the team that did **not** choose the square, during the 5 s card window after `battle:chosen` | In this battle each correct answer of the **locking team** is worth **+2** instead of +1. The square shows a lock badge during the battle. Server includes `lockedBy` in `round:start`. |
| **Mine** «لغم» | PB-18 Renad | On your own turn, before or after choosing (any time during your turn) | Secretly place a mine on a **free** square (`target = squareId`). Only your team sees it. If the **other** team later battles on that square and **loses**, it loses **3 team points** and the mine explodes (`mine:exploded { squareId, team }`). If the other team wins there, the mine is removed silently. Max one mine per square. |
| **Steal** «سرقة» | PB-19 Layan | On your own turn, instead of a free square | Choose a square **owned by the other team** (`square:choose { squareId, steal: true }`). Battle as usual: win → the square becomes yours; lose → it stays theirs. The card is used either way. |

### 17.7 Sitting out and card choice (PB-20, Reef)
1. After every battle, in each team the player with the lowest battle score sits out the next battle (tie → slower last correct answer → joined last). Teams with only 2 players never sit anyone out.
2. A sitting-out player cannot answer (`answer:submit` → `closed`) and sees «أنت تختار بطاقة فريقك» with the team's remaining cards as buttons, plus the live battle.
3. Only the sitting-out player can play the team's card during that battle or card window. Their choice is final.
4. In the next battle they play normally again.
5. Server sends `team:sitout { A: id | null, B: id | null }` before each battle.

### 17.8 Reconnection (PB-28, Leena)
1. Applies to both modes. After a refresh or lost signal, the phone rejoins with the same `playerId`, name, team, scores, sitting-out state and frozen state (§3.7 + `room:rejoin`).
2. The `state` snapshot also includes `mode`, `teams`, `board` (without the other team's mines), `turn`, `cards`, `teamPoints`, `sitout`, `frozenUntil` (EVENTS.md §6.3).
3. A disconnected player stays in their team. If the turn team has no connected player, the server picks a random square after 15 s (§17.3).
4. Tests: rejoin in lobby, during a battle, during the card window, and after `game:over`.

### 17.9 Screens
| Screen | Big screen (`/host`) | Phone (`/play`) |
|---|---|---|
| Lobby (teams) | Mode switch, two team columns, «وزّع عشوائي», Start | My team badge in team color |
| Board | 4×4 grid: free squares show the category title; owned squares filled with team color; turn banner «دور الفريق …»; team points and remaining cards of both teams | Same grid, tappable on my team's turn; my team's mines visible; card buttons |
| Card window | Chosen square enlarged, 5 s bar, «ينتظر بطاقات…» | Lock button (other team only) |
| Battle | Classic round screen + chosen square title + team scores side by side + card announcements | Classic round screen + team score bar + Freeze button; frozen overlay when frozen; sit-out screen when sitting out |
| Battle end | Winner team of the square, both battle scores, square fills with team color | «فريقك أخذ المربع!» / «الخصم أخذ المربع» |
| Game over | Winning line highlighted, «فاز الفريق …», Play Again | «فاز فريقك!» / «خسر فريقك» |

All Team Mode screens follow §7 (responsive), §8 (identity) and §9 (accessibility). The 4×4 board must fit a 360×640 phone without scrolling; squares ≥ 64px on phones; category text may wrap to 2 lines and then ellipsis.

### 17.10 Acceptance criteria (Sprint 2 stories)
| Story | Done when |
|---|---|
| PB-13 | The host can choose Team Mode, move players between teams or shuffle, and Start refuses fewer than 2 per team. Every phone shows its team. |
| PB-14 | A 4×4 board with 16 different categories appears; only the turn team can choose a free square; a battle on it gives the square to the higher-scoring team; turns alternate. |
| PB-15 | A full row or column ends the game for that team; a full board without a line is decided by squares, then team points, then draw. |
| PB-16 | Freeze blocks the top opponent's answers for exactly 3 s and is usable once per team per game. |
| PB-17 | Lock doubles the locking team's correct answers in that battle and can only be played by the non-choosing team in the card window. |
| PB-18 | A hidden mine costs the rival 3 team points when they lose on it; only the owner team sees it. |
| PB-19 | A team can battle for a rival square with Steal and takes it if it wins. |
| PB-20 | The lowest scorer of each team sits out the next battle and is the only one who can play the team's cards. |
| PB-28 | Refreshing a phone at any moment returns it to the same team, scores and screen. |

### 17.11 Build order (dependencies)
1. **Layan first:** add the §6 events to `EVENTS.md` (already listed there — keep names exactly), then teams model + board + turns + battles (PB-14) on the server.
2. **In parallel with fake data shaped like EVENTS.md §6:** Renad lobby teams (PB-13), Reef board/line win screens (PB-15), Danah Freeze UI (PB-16), Leena rejoin (PB-28).
3. **After PB-14 is merged:** Lock (PB-17), Mine (PB-18), Steal (PB-19), Sitting out (PB-20).
4. Each card: server rule as a pure function in `server/game.js` + `node:test` tests + its UI on both screens.
