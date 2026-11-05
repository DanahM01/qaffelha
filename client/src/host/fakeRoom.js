// Owner: Renad. TEMPORARY fake server for /host?fake=1 (dev only) until Layan's
// room:create / room:players / game:start / round:countdown / round:start / answer:locked / score:update are merged (EVENTS.md §4). Delete this file afterwards.
// Payloads are shaped exactly like EVENTS.md; nothing here talks to the real server.

const NAMES = ['ريف', 'لين', 'دانة', 'ليان', 'عبدالرحمن محمد', 'سارة', 'نورة', 'فهد', 'جود', 'هيا', 'مشاعل', 'تركي'];
const JOIN_EVERY_MS = 1500;
const MIN_PLAYERS = 3;
const COUNTDOWN_MS = 3000;
const ROUND_MS = 20000;
const CATEGORY = { id: 'fruits', title: 'فواكه' };
const WORDS = ['تفاح', 'موز', 'برتقال', 'عنب', 'رمان', 'مانجو', 'كيوي', 'فراولة', 'خوخ', 'تين', 'مشمش', 'كمثرى'];
const ANSWER_EVERY_MS = 1200;
const LOCKED_HIT_EVERY = 4; // every 4th fake answer hits a locked word: −1 and no new chip

// Same shape as the room:create ack in screen mode.
export function fakeCreateAck() {
  return { ok: true, code: 'QAFL', hostToken: 'fake-host-token', serverTime: Date.now() };
}

// Fake players join one by one (room:players) while the room is in the lobby.
// gameStart() answers like the game:start ack, then broadcasts round:countdown and, at startsAt, round:start,
// followed by answer:locked / score:update during the round.
export function startFakeRoom({ onPlayers, onCountdown, onRoundStart, onLocked, onScores }) {
  const players = [];
  let round = 0;
  let countdownTimer = null;
  let roundTimer = null;
  let answerTimer = null;

  function playAnswers() {
    const scores = new Map(players.map((p) => [p.id, 0]));
    const words = [...WORDS];
    let turn = 0;
    answerTimer = setInterval(() => {
      const player = players[turn % players.length];
      turn += 1;
      if (turn % LOCKED_HIT_EVERY === 0) {
        scores.set(player.id, scores.get(player.id) - 1);
      } else {
        scores.set(player.id, scores.get(player.id) + 1);
        onLocked({ word: words.shift(), by: { id: player.id, name: player.name } });
      }
      onScores({ scores: [...scores].map(([id, score]) => ({ id, score })) });
      if (!words.length) clearInterval(answerTimer);
    }, ANSWER_EVERY_MS);
  }

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
      countdownTimer = setTimeout(() => {
        const startsAt = Date.now() + COUNTDOWN_MS;
        onCountdown({ round, startsAt });
        roundTimer = setTimeout(() => {
          onRoundStart({ round, category: CATEGORY, endsAt: startsAt + ROUND_MS });
          playAnswers();
        }, COUNTDOWN_MS);
      }, 0);
      return { ok: true };
    },
    stop() {
      clearInterval(joinTimer);
      clearTimeout(countdownTimer);
      clearTimeout(roundTimer);
      clearInterval(answerTimer);
    },
  };
}
