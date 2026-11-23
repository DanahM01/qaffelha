// Owner: Renad. TEMPORARY fake server for /host?fake=1 (dev only) until Layan's
// room:create / room:players / game:start / round:countdown / round:start / answer:locked / score:update are merged (EVENTS.md §4),
// and for Team Mode until team:set / team:shuffle exist on the server (EVENTS.md §6.2). Delete this file afterwards.
// Payloads are shaped exactly like EVENTS.md; nothing here talks to the real server.

const NAMES = ['ريف', 'لين', 'دانة', 'ليان', 'عبدالرحمن محمد', 'سارة', 'نورة', 'فهد', 'جود', 'هيا', 'مشاعل', 'تركي'];
const JOIN_EVERY_MS = 1500;
const MIN_PLAYERS = 3;
const MIN_TEAM_PLAYERS = 4; // teams: at least 4 players and 2 per team (SPEC §17.2)
const MIN_PER_TEAM = 2;
const COUNTDOWN_MS = 3000;
const ROUND_MS = 20000;
const CATEGORY = { id: 'fruits', title: 'فواكه' };
const WORDS = ['تفاح', 'موز', 'برتقال', 'عنب', 'رمان', 'مانجو', 'كيوي', 'فراولة', 'خوخ', 'تين', 'مشمش', 'كمثرى'];
const ANSWER_EVERY_MS = 1200;
const LOCKED_HIT_EVERY = 4; // every 4th fake answer hits a locked word: −1 and no new chip
const MINE_PLAY_MS = 500; // PB-18: fake Mine announced shortly after the countdown starts

// Same shape as the room:create ack in screen mode.
export function fakeCreateAck() {
  return { ok: true, code: 'QAFL', hostToken: 'fake-host-token', serverTime: Date.now() };
}

// Fake players join one by one (room:players) while the room is in the lobby.
// gameStart() answers like the game:start ack, then broadcasts round:countdown and, at startsAt, round:start,
// followed by answer:locked / score:update during the round.
// Team Mode (EVENTS.md §6): players carry a team, new joiners go to the smaller team, and
// setTeam() / shuffleTeams() answer like the team:set / team:shuffle acks. After a teams start
// the fake still plays a classic round; the board and battles are PB-14.
// PB-18 Mine: in a teams game the fake announces a Mine (card:played, no target) during the
// countdown and explodes it (mine:exploded) when the round ends. playMine() / explodeMine()
// trigger them by hand. Like the server, the explosion carries a squareId the host must not show.
export function startFakeRoom({ onPlayers, onCountdown, onRoundStart, onLocked, onScores,
  onCardPlayed = () => {}, onMineExploded = () => {} }) {
  const players = [];
  let round = 0;
  let countdownTimer = null;
  let roundTimer = null;
  let answerTimer = null;
  let gameMode = 'classic';
  let started = false;
  let mineTimer = null;
  let explodeTimer = null;

  const count = (team) => players.filter((p) => p.team === team).length;
  const publish = () => onPlayers({ mode: 'screen', hostId: null, gameMode, players: players.map((p) => ({ ...p })) });

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
    const team = count('A') <= count('B') ? 'A' : 'B';
    players.push({ id: `fake-${players.length + 1}`, name: NAMES[players.length], out: false, connected: true, team });
    publish();
  }, JOIN_EVERY_MS);

  return {
    // Same payload as the server's Mine card:played: no target, for anyone.
    playMine(team = 'A') {
      const by = players.find((p) => p.team === team) ?? players[0];
      onCardPlayed({ team, card: 'mine', by: { id: by.id, name: by.name } });
    },
    // Same payload as the server's mine:exploded: `team` is the team that lost 3 points.
    explodeMine(team = 'B') {
      onMineExploded({ squareId: 5, team, points: -3 });
    },
    setTeam(playerId, team) {
      if (started) return { ok: false, error: 'STARTED' };
      const player = players.find((p) => p.id === playerId);
      if (!player || !['A', 'B'].includes(team)) return { ok: false, error: 'NOT_FOUND' };
      player.team = team;
      publish();
      return { ok: true };
    },
    shuffleTeams() {
      if (started) return { ok: false, error: 'STARTED' };
      const order = [...players].sort(() => Math.random() - 0.5);
      order.forEach((p, i) => { p.team = i % 2 === 0 ? 'A' : 'B'; });
      publish();
      return { ok: true };
    },
    gameStart(mode = 'classic') {
      const teams = mode === 'teams';
      if (players.length < (teams ? MIN_TEAM_PLAYERS : MIN_PLAYERS)) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };
      if (teams && (count('A') < MIN_PER_TEAM || count('B') < MIN_PER_TEAM)) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };
      started = true;
      gameMode = teams ? 'teams' : 'classic';
      clearInterval(joinTimer); // joining is only allowed in the lobby (SPEC §3.1)
      round += 1;
      countdownTimer = setTimeout(() => {
        const startsAt = Date.now() + COUNTDOWN_MS;
        onCountdown({ round, startsAt });
        roundTimer = setTimeout(() => {
          onRoundStart({ round, category: CATEGORY, endsAt: startsAt + ROUND_MS });
          playAnswers();
        }, COUNTDOWN_MS);
        if (teams) {
          mineTimer = setTimeout(() => this.playMine('A'), MINE_PLAY_MS);
          explodeTimer = setTimeout(() => this.explodeMine('B'), COUNTDOWN_MS + ROUND_MS);
        }
      }, 0);
      return { ok: true };
    },
    stop() {
      clearInterval(joinTimer);
      clearTimeout(countdownTimer);
      clearTimeout(roundTimer);
      clearInterval(answerTimer);
      clearTimeout(mineTimer);
      clearTimeout(explodeTimer);
    },
  };
}
