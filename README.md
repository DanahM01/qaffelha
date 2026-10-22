# قفّلها · Qaffelha

> لعبة ويب جماعية: الفئة تظهر على الشاشة الكبيرة، واللاعبون يدخلون من جوالاتهم ويكتبون أكبر عدد من الإجابات. الإجابة الصحيحة +1 وتنقفل على الكل، ومن يكتب كلمة مقفولة −1، والأقل نقاطاً يطلع كل جولة حتى يبقى فائز واحد.

A real-time Arabic party game, built by a 5-person Scrum team for the SW332 Agile course (Fall 2026). This README is the single source of truth for humans **and** AI coding agents working in this repo. Read it fully before writing code.

---

## 1. How the game works

> Short version below. Simple Arabic explanation for the team: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md). Full detailed spec for agents: [`docs/SPEC.md`](docs/SPEC.md).

**Two modes** (chosen on the one Home page `/`, the same for every device):
- 📺 **Big screen:** a laptop/TV shows the room, the category, locked words and scores; everyone plays from their phones.
- 📱 **Phones only:** no big screen; the host creates the room from their phone and plays too. Every phone shows everything.

**Flow:**
1. Someone opens the site (one URL for every device) and picks a mode on Home → a room is created → a **QR code** + 4-letter code (e.g. `QAFL`) appear.
2. Players scan the QR (opens `/play/QAFL`), type a name, and join. Typing the code by hand (Home → «ادخل غرفة») also works.
3. Host presses **Start** (needs at least 3 players) → 3-2-1 countdown.
4. A **category** (e.g. «فواكه») + **20-second timer**. Players type as many answers as they can:
   - first correct answer → **+1** and the word **locks** for everyone;
   - word already locked by someone else → **−1**;
   - not in the category → 0; your own repeated word → 0.
5. Time's up → the **lowest round score is eliminated** (tie → slower last correct answer).
6. **Scores reset to 0** every round. Repeat with a new category until **one winner** remains → ranking + "Play again".

**Sprint 2 (don't build yet):** two teams, a 4×4 category board, a full line wins; cards Freeze, Lock, Mine, Steal.

## 2. Tech stack

| Part | Tech | Folder |
|---|---|---|
| Host screen + phone UI | React 18 + Vite, react-router | `client/` |
| Real-time server | Node.js 20+, Express, Socket.IO | `server/` |
| Categories database | MongoDB Atlas (free tier) | `database/` + `server/seed.js` |
| Hosting | Render (free) for server and client | |
| Planning | Jira (Scrum board "Qaffelha"), GitHub for code | |

The **server is the referee**: it validates answers, keeps scores, locks words and decides eliminations. The client only displays and sends input. Never trust scores calculated on the client.

## 3. Folder structure and owners

**Rule: you only edit files in your own folder.** If you need something from another folder, ask its owner (or open an issue). Shared event names go in `EVENTS.md` and must be agreed with Layan first.

```
qaffelha/
├── README.md, AGENTS.md, EVENTS.md     Danah (EVENTS.md content: Layan)
├── client/
│   ├── src/main.jsx, src/socket.js     Danah   routing + shared socket
│   ├── public/                         Danah   self-hosted fonts (Tajawal), favicon, app icons
│   ├── src/theme/                      Danah   visual identity: theme.css, Logo.jsx, Home.jsx, BRAND.md, FLOW.md + design pages (/preview, /flow)
│   ├── src/host/                       Renad   big screen (incl. QR + lobby)
│   └── src/player/                     Reef    phone UI (incl. phone-only host controls)
├── server/
│   ├── index.js, game.js (+ tests)     Layan   sockets, rooms, scoring, elimination
│   ├── arabic.js (+ arabic.test.js)    Leena   Arabic normalization
│   └── seed.js                         Leena   loads categories into MongoDB
├── database/
│   ├── schema.md                       Danah   collection design
│   └── categories.json                 Leena   the 30 categories
└── docs/
    ├── REQUIREMENTS.md                 Leena   simple requirements (Arabic, for the team)
    ├── SPEC.md                         Leena   detailed spec (for AI agents)
    ├── brand/qaffelha-brand.pdf        Danah   visual identity guide (PDF, for people)
    ├── UI-REQUIREMENTS.md              Danah   moved into SPEC.md (can be deleted)
    └── TASKS.md                        Danah   Sprint 1 tasks and dates
```

| Member | Scrum role | Owns in Sprint 1 |
|---|---|---|
| Danah | Scrum Master | Repo, project setup, MongoDB setup, visual identity (`client/src/theme`) |
| Leena | Product Owner | 30 categories, Arabic normalization, category review, sprint demo |
| Renad | Development Team | Entire big screen: create room, QR, lobby, round, results (`client/src/host`) |
| Layan | Development Team | Socket.IO server, answer matching, lock/score/elimination (`server/index.js`, `server/game.js`) |
| Reef | Development Team | Entire phone UI incl. phone-only host mode + play-testing (`client/src/player`) |

## 4. Run it locally

Needs **Node.js 20 or newer** (`node -v`). Download the LTS from nodejs.org if you don't have it.

```bash
git clone <repo-url> && cd qaffelha
npm install                      # installs root + server + client in one go
cp server/.env.example server/.env   # put the MongoDB URI from Danah in server/.env
npm run seed                     # load categories into MongoDB (once, Leena/Danah)
npm run dev                      # server :3001 + client :5173 together
                                 # http://localhost:5173 (Home) · /host · /play · /flow
npm test                         # server tests (node --test)
```

`npm run dev:server` / `npm run dev:client` run one side only. The server needs `server/.env` to exist (it can hold the example values until you get the real URI).

To test with real phones on the same Wi-Fi, run `npm run dev --prefix client -- --host`, open `http://<your-laptop-ip>:5173/play`, and set `VITE_SERVER_URL=http://<your-laptop-ip>:3001` in `client/.env`.

## 5. Git workflow

- `main` is protected: **no direct pushes**. Work on a branch, open a Pull Request, get one review, then merge.
- Branch name: `<name>/<jira-key>-short-title`, e.g. `renad/PB-01-room-code`.
- Commit message starts with the Jira key: `PB-07: lock word after first correct answer`.
- Pull `main` before starting each task. Keep PRs small (one story or one task).
- Never commit `.env`, passwords, or the MongoDB URI.

## 6. Coding conventions

- JavaScript (ES modules), React function components and hooks. No TypeScript in Sprint 1.
- All UI text in Arabic, layout RTL. Use classes and variables from `client/src/theme/theme.css`; don't hard-code colors. Run `node src/theme/check-colors.mjs` (from `client/`) before every PR.
- Event names and payloads exactly as in `EVENTS.md`.
- Game rules live in `server/game.js` as plain functions so they can be unit-tested without sockets.
- Answer comparison always goes through `normalize()` from `server/arabic.js`.

## 7. Definition of Done

A story is Done when: it works end-to-end on a real phone + host screen, the PR is reviewed and merged to `main`, server logic has a test, there are no console errors, and the Jira item is moved to Done.

## 8. Sprint 1 (19 Oct – 1 Nov 2026)

**Goal:** a playable Speed Battle: players join a room from their phones, answer the category in 20 seconds, earn points for correct answers, lose points for locked words, and the lowest scorer is eliminated each round until one winner remains.

Stories: PB-01 … PB-12 and PB-24. Detailed tasks, owners and dates: [`docs/TASKS.md`](docs/TASKS.md). Socket contract: [`EVENTS.md`](EVENTS.md). Rules for AI agents: [`AGENTS.md`](AGENTS.md).
