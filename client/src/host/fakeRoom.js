// Owner: Renad. TEMPORARY fake server for /host?fake=1 (dev only) until Layan's
// room:create / room:players are merged (EVENTS.md §4). Delete this file afterwards.
// Payloads are shaped exactly like EVENTS.md; nothing here talks to the real server.

const NAMES = ['ريف', 'لين', 'دانة', 'ليان', 'عبدالرحمن محمد', 'سارة', 'نورة', 'فهد', 'جود', 'هيا', 'مشاعل', 'تركي'];
const JOIN_EVERY_MS = 1500;

// Same shape as the room:create ack in screen mode.
export function fakeCreateAck() {
  return { ok: true, code: 'QAFL', hostToken: 'fake-host-token', serverTime: Date.now() };
}

// Calls onPlayers with a room:players payload each time a fake player joins (up to 12).
// Returns a function that stops the simulation.
export function startFakePlayers(onPlayers) {
  const players = [];
  const timer = setInterval(() => {
    if (players.length >= NAMES.length) return clearInterval(timer);
    players.push({ id: `fake-${players.length + 1}`, name: NAMES[players.length], out: false, connected: true });
    onPlayers({ mode: 'screen', hostId: null, players: [...players] });
  }, JOIN_EVERY_MS);
  return () => clearInterval(timer);
}
