# Instructions for AI coding agents

> Works with any agent (Cursor, Copilot, Codex, Claude Code …). If your agent doesn't read this file automatically, start with: «Read AGENTS.md and follow it».

You are helping one member of the Qaffelha team. Before writing any code:

1. Read **`docs/SPEC.md`** completely. It is the detailed, authoritative specification (rules, screens, states, events, edge cases, acceptance criteria). If anything here or in the README disagrees with SPEC.md, SPEC.md wins.
2. **Before any UI work** also read **`client/src/theme/BRAND.md`** (visual identity, mandatory) and follow SPEC §6–§9 (screens, responsive UI, identity, accessibility). The approved designs of each screen are in `client/src/theme/FLOW.md` and the `/flow` and `/preview` pages.
3. Read `README.md` (stack, folder owners, how to run), `EVENTS.md` (socket contract) and `docs/TASKS.md` (who does what in Sprint 1).
4. Ask the user which member they are if it isn't obvious, and **only create or edit files in that member's folders** (README §3). If a change is needed elsewhere, write down exactly what is needed and tell the user to ask the owner.
5. Never rename or invent socket events. If one is truly needed, propose an addition to `EVENTS.md` for Layan to approve.
6. The server is authoritative: scoring, locking, timers and elimination happen only in `server/`.
7. UI: Arabic text, RTL, styles from `client/src/theme/theme.css` only. No hard-coded colors (`node src/theme/check-colors.mjs` from `client/` must pass), no emoji, no other fonts, no device detection.
8. Game rules are pure functions in `server/game.js`, each with a `node:test` test.
9. Work on a branch `<member>/<PB-key>-short-title`, commit messages start with the PB key, finish with a Pull Request to `main`. Never push to `main`, never commit `.env`.
10. **The repository is PUBLIC.** Never write secrets anywhere in the repo: no MongoDB URI, password, API key or token in code, tests, docs, comments or commit messages. Read them only from `process.env` (server) or `import.meta.env.VITE_*` (client, and only non-secret values). Only `*.env.example` files with fake values may be committed. Before every commit, check `git status` and the diff: if `.env` or anything that looks like a secret (`mongodb+srv://`, `password`, `apiKey`, `token`) appears, stop and tell the user. If a secret was already committed, tell the user to rotate it in MongoDB Atlas; deleting the file is not enough.
11. Don't build Sprint 2 features (teams, board, cards) until the user says Sprint 2 has started.
12. When the spec doesn't cover something, choose the simplest behavior, write it in the PR description, and tell the user so the Product Owner (Leena) can confirm.
