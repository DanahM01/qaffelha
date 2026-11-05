# Reef's Sprint 1 phone tasks

PB-02, PB-05, PB-10 (phone UI), and PB-12 (phone UI) are implemented in this folder. Production server integration and real-device acceptance are still pending. These changes do not implement server game rules or change the shared theme.

## Verification performed

- Production client build and the shared color checker pass.
- Existing server test passes.
- Browser contract fixtures verify code entry, QR landing, phone hosting, all five join errors, response timeouts, session restoration, transport reconnection, 15-character names, 12-player lists, and host-only controls.
- Round checks cover a server clock 60 seconds ahead, countdown, four answer results, retained input focus, locked words, elimination, spectator restoration, winner/ranking, and returning to the same lobby after replay.
- Layout checks cover 320×568, 390×844, 768×1024, 1280×720, 1440×900, and 1920×1080. A 390×400 viewport also verifies the answer dock under reduced available height. This does not replace checking a real mobile keyboard.
- Screenshots were visually reviewed against BRAND.md and the bundled brand PDF. Only existing theme classes and the documented timer progress variable are used.

## Repeating the browser checks

The fixtures run separately from the production server. They return predetermined contract payloads; they are not a game implementation. They listen on port 3101 and require the client on port 5174 with `VITE_SERVER_URL=http://localhost:3101`.

Start the client in PowerShell:

```powershell
$env:VITE_SERVER_URL='http://localhost:3101'
npm run dev --prefix client -- --host 127.0.0.1 --port 5174
```

With Playwright resolvable through `NODE_PATH` (or already installed in the environment) and Microsoft Edge available, run these commands sequentially in another terminal:

```powershell
node client/src/player/tests/join-browser.cjs
node client/src/player/tests/browser.cjs
```

The scripts save screenshots in the system temporary directory by default. `QAFFELHA_TEST_OUTPUT` can select another output folder. No dependency manifests were changed because those files belong to Danah.

## Required coordination

Layan: `server/index.js` still has no room/game handlers and `server/game.js` is empty. Implement the existing EVENTS.md contract before end-to-end acceptance with the real server.

Layan: propose extending the existing `room:rejoin` state snapshot with `eliminated: { id, name } | null`, `winner: { id, name } | null`, and `ranking: [{ id, name, place }]`. The documented snapshot currently cannot restore all round-end/final results after a refresh. The client displays the available state and a clear missing-ranking message instead of inventing results. No socket event was added or renamed.

Leena: the simplest unspecified display choices are shared rank for equal live scores, stable server order for tied round-end scores, and a six-second acknowledgement timeout with retry. A post-game `room:players` broadcast with every player back in marks the return to the lobby for non-hosts, as the existing restart contract specifies no separate lobby event.

Danah: confirm the final phone look and any remaining design differences; theme files remain unchanged. Renad owns the big-screen results and replay UI.

## Reef's real-phone acceptance checklist

- [ ] Play with at least four real phones in both screen and phones-only modes.
- [ ] Test Safari on iOS and Chrome on Android, including the software keyboard staying open after repeated sends.
- [ ] Scan the real QR and join another phone by manually typing the code.
- [ ] Refresh during countdown, answering, spectating, round end, and final results (after the snapshot extension).
- [ ] Disconnect/reconnect a phone; verify phone-host transfer from the server after 15 seconds.
- [ ] Test 3 and 12 players, long names/categories, expired rooms, full rooms, and negative scores.
- [ ] Verify results arrive within 300 ms and timers agree within 0.5 seconds on normal Wi-Fi.
- [ ] Report issues in Jira, obtain Danah's visual approval, and request a PR review before merging.

Automated fixtures cover the UI paths, but no real-phone session, latency acceptance, or production multiplayer acceptance is claimed here.
