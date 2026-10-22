# Sprint 1 tasks (19 Oct – 1 Nov 2026)

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

