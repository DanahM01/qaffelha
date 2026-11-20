# Sprint 2 tasks (8 – 21 Nov 2026) — Team Mode

Owner of this file: Danah. Jira (project SCRUM, epic SCRUM-31) is the live board; this is the copy agents can read.
**Sprint goal:** players split into two teams, battle for squares on a 4x4 board, win by completing a full line, and use the Freeze, Lock, Mine and Steal cards.

| Item | Jira | Task | Owner | Start | Due | Hours |
|---|---|---|---|---|---|---|
| PB-14 | SCRUM-18 | 4x4 board state + choose a square + battle on it (server rules + tests) | Layan | 8 Nov | 14 Nov | 8 |
| PB-14 | SCRUM-18 | Add the Team Mode events to `EVENTS.md` (board, teams, cards) | Layan | 8 Nov | 9 Nov | 2 |
| PB-13 | SCRUM-17 | Split players into two teams in the lobby (manual or random), team name + color | Renad | 8 Nov | 14 Nov | 6 |
| PB-13 | SCRUM-17 | Show both teams and team scores on the big screen | Renad | 10 Nov | 14 Nov | 4 |
| PB-15 | SCRUM-19 | Win check: full horizontal or vertical line of captured squares (+ tests) | Reef | 8 Nov | 14 Nov | 5 |
| PB-15 | SCRUM-19 | Phone: my team, the board and the team-win screen | Reef | 10 Nov | 14 Nov | 5 |
| PB-16 | SCRUM-20 | Freeze card: lock a rival keyboard for 3 seconds (server + phone) | Danah | 8 Nov | 14 Nov | 6 |
| PB-28 | SCRUM-32 | Rejoin the room with the same name and score after a refresh | Leena | 8 Nov | 14 Nov | 6 |
| PB-17 | SCRUM-21 | Lock card: the rival team's chosen square becomes harder | Leena | 15 Nov | 20 Nov | 6 |
| PB-18 | SCRUM-22 | Mine card: hidden mine on a square, rival loses points if they lose the battle there | Renad | 15 Nov | 20 Nov | 7 |
| PB-19 | SCRUM-24 | Steal card: win a battle on a rival square to take it | Layan | 15 Nov | 20 Nov | 7 |
| PB-20 | SCRUM-25 | Eliminated players vote on the next card their team uses | Reef | 15 Nov | 20 Nov | 6 |
| Test | — | Play-test Team Mode with real phones, report bugs in Jira | Reef | 19 Nov | 20 Nov | 3 |
| Demo | — | Sprint review demo + screenshots for the report | Leena | 19 Nov | 20 Nov | 2 |

## Start order (dependencies)
1. **First (8–9 Nov):** Layan adds the Team Mode events to `EVENTS.md` so everyone codes against the same names.
2. **Week 1 (8–14 Nov):** board (Layan), teams (Renad), line win (Reef), Freeze card (Danah) and rejoin (Leena) in parallel.
3. **Week 2 (15–20 Nov):** the Lock, Mine and Steal cards and the vote need the board and teams from week 1.
4. **19 Nov:** Sprint Review and Retrospective. Sprint ends 21 Nov.

## Rules for Sprint 2
- Each member builds her own story end to end. Shared files (`server/game.js`, `server/index.js`, `EVENTS.md`): add your own new functions or handlers only, never edit someone else's, and keep your PR small.
- New socket events go into `EVENTS.md` in the same PR, and Layan approves them.
- Branch name: `<member>/<PB-key>-short-title`, PR to `main`, never push to `main`.

---

# Sprint 1 tasks (19 Oct – 1 Nov 2026) — Done

Owner of this file: Danah. Jira is the live board; this is the copy agents can read.

| Item | Jira | Task | Owner | Start | Due | Hours |
|---|---|---|---|---|---|---|
| Setup | — | GitHub repo, README/AGENTS/EVENTS, React + Node/Socket.IO skeleton, Render | Danah | 19 Oct | 20 Oct | 5 |
| Setup | — | MongoDB Atlas cluster, `categories` collection, share URI privately | Danah | 19 Oct | 20 Oct | 2 |
| PB-24 | SCRUM-29 | Visual identity: logo, colors, fonts (`client/src/theme`) | Danah | 20 Oct | 21 Oct | 3 |
| PB-24 | SCRUM-29 | Figma mockups: host screen + phone screens | Danah | 20 Oct | 21 Oct | 4 |
| PB-11 | SCRUM-15 | Arabic normalization (`server/arabic.js`) + tests | Leena | 19 Oct | 21 Oct | 4 |
| PB-11 | SCRUM-15 | Write 30 categories (`database/categories.json`) and seed | Leena | 19 Oct | 24 Oct | 8 |
| PB-11 | SCRUM-15 | Review spelling variants / aliases | Leena | 24 Oct | 26 Oct | 2 |
| PB-01 | SCRUM-5 | Room code + QR + lobby on the big screen | Renad | 21 Oct | 23 Oct | 4 |
| PB-02 | SCRUM-6 | Join page on phone (QR link or code + name) + phone-only host lobby | Reef | 21 Oct | 23 Oct | 5 |
| PB-06 | SCRUM-10 | Connect DB + answer events, match answers + tests | Layan | 21 Oct | 25 Oct | 7 |
| PB-03 | SCRUM-7 | Start button + sync all devices | Renad | 23 Oct | 24 Oct | 3 |
| PB-04 | SCRUM-8 | Category + 20s timer on host screen | Renad | 24 Oct | 26 Oct | 4 |
| PB-05 | SCRUM-9 | Phone answer input | Reef | 24 Oct | 26 Oct | 4 |
| PB-07 | SCRUM-11 | Lock word + 1 point | Layan | 24 Oct | 27 Oct | 3 |
| PB-08 | SCRUM-12 | Locked words + live scoreboard on host screen | Renad | 27 Oct | 28 Oct | 7 |
| PB-09 | SCRUM-13 | −1 for locked word | Layan | 27 Oct | 28 Oct | 3 |
| PB-10 | SCRUM-14 | Eliminate lowest score (tie → slower) | Layan | 28 Oct | 29 Oct | 4 |
| PB-10 | SCRUM-14 | Eliminated screen on phone | Reef | 28 Oct | 29 Oct | 2 |
| PB-12 | SCRUM-16 | Results screen + play again | Reef | 28 Oct | 30 Oct | 5 |
| Test | — | Play-test with real phones, report bugs in Jira | Reef | 31 Oct | 1 Nov | 4 |
| Demo | — | Sprint review demo | Leena | 31 Oct | 1 Nov | 2 |

## Start order (dependencies)
1. **Now, no waiting:** Leena (`arabic.js`, then categories) and Layan (`room:create`, `room:join`, `room:players`, see `EVENTS.md` §4).
2. **Now, with fake data:** Renad (PB-01 lobby) and Reef (PB-02 join pages) build the screens using payloads shaped like `EVENTS.md`, then connect when Layan's step 1 is merged.
3. PB-06 needs Leena's `normalize()` and categories; PB-07/PB-09 need PB-06; PB-10 and PB-12 come last.

