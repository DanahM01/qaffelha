// Owner: Renad. TEMPORARY fake server for /host?fake=1 (dev only) until Layan's
// room:create / room:players / game:start / round:countdown are merged (EVENTS.md §4). Delete this file afterwards.
// Payloads are shaped exactly like EVENTS.md; nothing here talks to the real server.

const NAMES = ['ريف', 'لين', 'دانة', 'ليان', 'عبدالرحمن محمد', 'سارة', 'نورة', 'فهد', 'جود', 'هيا', 'مشاعل', 'تركي'];
const JOIN_EVERY_MS = 1500;
const MIN_PLAYERS = 3;
const COUNTDOWN_MS = 3000;

// Same shape as the room:create ack in screen mode.
export function fakeCreateAck() {
  return { ok: true, code: 'QAFL', hostToken: 'fake-host-token', serverTime: Date.now() };
}

// Fake players join one by one (room:players) while the room is in the lobby.
// gameStart() answers like the game:start ack and then broadcasts round:countdown.
export function startFakeRoom({ onPlayers, onCountdown }) {
  const players = [];
  let round = 0;
  let countdownTimer = null;
  const joinTimer = setInterval(() => {
    if (players.length >= NAMES.length) return clearInterval(joinTimer);
    players.push({ id: `fake-${players.length + 1}`, name: NAMES[players.length], out: false, connected: true });
    onPlayers({ mode: 'screen', hostId: null, players: [...players] });
  }, JOIN_EVERY_MS);

  return {
    gameStart() {
      if (players.length < MIN_PLAYERS) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };
      clearInterval(joinTimer); // joining is only allowed in the lobby (SPEC §3.1)
      round += 1;
      countdownTimer = setTimeout(() => onCountdown({ round, startsAt: Date.now() + COUNTDOWN_MS }), 0);
      return { ok: true };
    },
    stop() {
      clearInterval(joinTimer);
      clearTimeout(countdownTimer);
    },
  };
}
