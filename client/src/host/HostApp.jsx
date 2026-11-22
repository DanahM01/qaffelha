// Owner: Renad. Main screen (TV / laptop): room code, lobby, category, timer, locked words, scoreboard,
// round end and results (Danah).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket.js';
import HostLobby from './HostLobby.jsx';
import Countdown from './Countdown.jsx';
import RoundScreen from './RoundScreen.jsx';
import RoundEnd from './RoundEnd.jsx';
import Results from './Results.jsx';
import { fakeCreateAck, startFakeRoom } from './fakeRoom.js';
import { restoreHostSnapshot } from './restoreHostSnapshot.js';

// Event names from EVENTS.md §1.
const ROOM_CREATE = 'room:create';
const ROOM_REJOIN = 'room:rejoin';
const ROOM_PLAYERS = 'room:players';
const GAME_START = 'game:start';
const ROUND_COUNTDOWN = 'round:countdown';
const ROUND_START = 'round:start';
const ANSWER_LOCKED = 'answer:locked';
const SCORE_UPDATE = 'score:update';
const ROUND_END = 'round:end';
const GAME_OVER = 'game:over';
const GAME_RESTART = 'game:restart';
// Team Mode, EVENTS.md §6.2.
const TEAM_SET = 'team:set';
const TEAM_SHUFFLE = 'team:shuffle';
// Team Mode cards (EVENTS.md §6). Freeze: PB-16 (Danah).
const CARD_PLAYED = 'card:played';
const PLAYER_FROZEN = 'player:frozen';
const NOTICE_MS = 3000;

const STORE_KEY = 'qaffelha';
const ACK_TIMEOUT_MS = 10000;

function readSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY));
    return saved?.code && saved?.hostToken ? saved : null;
  } catch {
    return null;
  }
}

function writeSaved(value) {
  try {
    if (value) sessionStorage.setItem(STORE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    // Storage blocked (private mode): the room still works, it just can't survive a refresh.
  }
}

// The lobby mode only lives on this screen until Start, so it is kept per room in this tab:
// a refresh keeps «فرق», a new room starts on «فردي».
const MODE_KEY = 'qaffelha.gameMode';

function readMode(code) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(MODE_KEY));
    return saved?.code === code && saved.gameMode === 'teams' ? 'teams' : 'classic';
  } catch {
    return 'classic';
  }
}

function writeMode(code, gameMode) {
  try {
    sessionStorage.setItem(MODE_KEY, JSON.stringify({ code, gameMode }));
  } catch {
    // Storage blocked: the choice just resets on refresh.
  }
}

const request = (event, payload) => socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload);

// EVENTS.md §3: rejoin the stored room first, otherwise create a new screen-mode room.
// On rejoin NOT_FOUND the session is cleared and the caller goes to / (EVENTS.md §1).
async function openRoom() {
  const saved = readSaved();
  if (saved) {
    const res = await request(ROOM_REJOIN, { code: saved.code, hostToken: saved.hostToken });
    if (res.ok) {
      return { code: saved.code, serverTime: res.serverTime, ...restoreHostSnapshot(res.state) };
    }
    if (res.error === 'NOT_FOUND') {
      writeSaved(null);
      return { notFound: true };
    }
    throw new Error(res.error);
  }
  const res = await request(ROOM_CREATE, { mode: 'screen' });
  if (!res.ok) throw new Error(res.error);
  writeSaved({ code: res.code, hostToken: res.hostToken });
  return { code: res.code, serverTime: res.serverTime, players: [], countdown: null, roundInfo: null, resuming: false };
}

export default function HostApp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fake = import.meta.env.DEV && params.get('fake') === '1';

  // Fake mode starts straight in the lobby so the connecting screen never flashes.
  const [status, setStatus] = useState(() => (fake ? 'lobby' : 'connecting')); // connecting | lobby | countdown | round | roundEnd | over | resuming | error
  const [code, setCode] = useState(() => (fake ? fakeCreateAck().code : ''));
  const [players, setPlayers] = useState([]);
  const [countdown, setCountdown] = useState(null); // { round, startsAt } from round:countdown
  const [roundInfo, setRoundInfo] = useState(null); // { round, category, endsAt } from round:start
  const [locked, setLocked] = useState([]); // [{ word, by: { id, name } }], newest first
  const [scores, setScores] = useState([]); // [{ id, score }] from score:update; a missing id means 0
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null); // null | 'NOT_ENOUGH_PLAYERS' | 'FAILED'
  const [attempt, setAttempt] = useState(0);
  const [roundEnd, setRoundEnd] = useState(null); // round:end payload + who was still playing
  const [gameOver, setGameOver] = useState(null); // game:over payload
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState(false);
  // The lobby choice «فردي» / «فرق». No event sets it before Start, so the host keeps it
  // (readMode / writeMode) and sends it with game:start (EVENTS.md §6.1).
  const [gameMode, setGameMode] = useState('classic');
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState(false);
  const [cardNotice, setCardNotice] = useState(null); // last card:played, shown for 3 s
  const [frozenIds, setFrozenIds] = useState([]); // players frozen right now (player:frozen)
  const timers = useRef(new Set());
  const playersRef = useRef([]);
  playersRef.current = players;
  const pending = useRef(null); // one request per attempt, even when StrictMode runs the effect twice
  const clockOffset = useRef(0); // serverTime - Date.now(), for the countdown and round timers
  const fakeRoom = useRef(null);

  const showCountdown = (payload) => {
    setCountdown({ round: payload.round, startsAt: payload.startsAt });
    setStarting(false);
    setStartError(null);
    setStatus('countdown');
  };

  const showRound = (payload) => {
    setRoundInfo({ round: payload.round, category: payload.category, endsAt: payload.endsAt });
    setStatus('round');
  };

  // Live round:start: every score is 0 and the locked list is empty (EVENTS.md).
  const startRound = (payload) => {
    setLocked([]);
    setScores([]);
    setFrozenIds([]);
    setCardNotice(null);
    showRound(payload);
  };

  const addLocked = (payload) => setLocked((words) => [{ word: payload.word, by: payload.by }, ...words]);
  const updateScores = (payload) => setScores(payload.scores);

  // round:end lists every player; keep only the ones still playing this round.
  const endRound = (payload) => {
    const before = playersRef.current;
    const active = new Set(before.filter((p) => !p.out).map((p) => p.id));
    const scoresNow = payload.scores.filter((s) => active.size === 0 || active.has(s.id));
    const avatarIndex = Math.max(0, before.findIndex((p) => p.id === payload.eliminated.id));
    setRoundEnd({ round: payload.round, scores: scoresNow, eliminated: payload.eliminated, avatarIndex, lastRound: scoresNow.length <= 2 });
    setStatus('roundEnd');
  };
  const endGame = (payload) => {
    setGameOver(payload);
    setRestarting(false);
    setRestartError(false);
    setStatus('over');
  };

  const later = (callback, delay) => {
    const id = setTimeout(() => { timers.current.delete(id); callback(); }, Math.max(0, delay));
    timers.current.add(id);
  };
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  const showCard = (payload) => {
    const notice = { ...payload, sequence: Date.now() };
    setCardNotice(notice);
    later(() => setCardNotice((current) => (current === notice ? null : current)), NOTICE_MS);
  };
  const freezePlayer = (payload) => {
    setFrozenIds((ids) => [...ids.filter((id) => id !== payload.id), payload.id]);
    later(() => setFrozenIds((ids) => ids.filter((id) => id !== payload.id)),
      payload.until - Date.now() - clockOffset.current);
  };

  useEffect(() => {
    if (fake) {
      const ack = fakeCreateAck();
      clockOffset.current = ack.serverTime - Date.now();
      setCode(ack.code);
      setPlayers([]);
      setStatus('lobby');
      fakeRoom.current = startFakeRoom({
        onPlayers: (payload) => setPlayers(payload.players),
        onCountdown: showCountdown,
        onRoundStart: startRound,
        onLocked: addLocked,
        onScores: updateScores,
      });
      return () => fakeRoom.current.stop();
    }

    let active = true;
    setStatus('connecting');
    const onPlayers = (payload) => setPlayers(payload.players);
    socket.on(ROOM_PLAYERS, onPlayers);
    // Listened to all the time: the server sends it again before every round.
    socket.on(ROUND_COUNTDOWN, showCountdown);
    socket.on(ROUND_START, startRound);
    socket.on(ANSWER_LOCKED, addLocked);
    socket.on(SCORE_UPDATE, updateScores);
    socket.on(ROUND_END, endRound);
    socket.on(GAME_OVER, endGame);
    socket.on(CARD_PLAYED, showCard);
    socket.on(PLAYER_FROZEN, freezePlayer);

    if (!pending.current) pending.current = openRoom();
    pending.current
      .then((room) => {
        if (!active) return;
        if (room.notFound) return navigate('/', { replace: true });
        clockOffset.current = room.serverTime - Date.now();
        setCode(room.code);
        setGameMode(readMode(room.code));
        setPlayers(room.players);
        if (room.roundInfo) {
          setLocked(room.roundInfo.locked);
          setScores(room.roundInfo.scores);
          showRound(room.roundInfo);
        }
        else if (room.countdown) showCountdown(room.countdown);
        else if (room.roundEnd) { setRoundEnd(room.roundEnd); setStatus('roundEnd'); }
        else if (room.gameOver) endGame(room.gameOver);
        else setStatus(room.resuming ? 'resuming' : 'lobby');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      socket.off(ROOM_PLAYERS, onPlayers);
      socket.off(ROUND_COUNTDOWN, showCountdown);
      socket.off(ROUND_START, startRound);
      socket.off(ANSWER_LOCKED, addLocked);
      socket.off(SCORE_UPDATE, updateScores);
      socket.off(ROUND_END, endRound);
      socket.off(GAME_OVER, endGame);
      socket.off(CARD_PLAYED, showCard);
      socket.off(PLAYER_FROZEN, freezePlayer);
    };
  }, [fake, attempt, navigate]);

  // «ابدأ»: on ok the server sends round:countdown, which switches the screen (EVENTS.md game:start).
  const startGame = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = fake ? fakeRoom.current.gameStart(gameMode) : await request(GAME_START, { code, gameMode });
      if (res.ok) return;
      setStartError(res.error === 'NOT_ENOUGH_PLAYERS' ? 'NOT_ENOUGH_PLAYERS' : 'FAILED');
    } catch {
      setStartError('FAILED');
    }
    setStarting(false);
  };

  const changeMode = (mode) => {
    setGameMode(mode);
    if (!fake) writeMode(code, mode);
    setStartError(null);
    setTeamError(false);
  };

  // team:set / team:shuffle (EVENTS.md §6.2). The columns change when room:players comes back.
  const teamRequest = async (send) => {
    if (teamBusy) return;
    setTeamBusy(true);
    setTeamError(false);
    try {
      const res = await send();
      if (!res.ok) setTeamError(true);
    } catch {
      setTeamError(true);
    }
    setTeamBusy(false);
  };
  const moveTeam = (playerId, team) => teamRequest(() => (
    fake ? fakeRoom.current.setTeam(playerId, team) : request(TEAM_SET, { code, playerId, team })
  ));
  const shuffleTeams = () => teamRequest(() => (
    fake ? fakeRoom.current.shuffleTeams() : request(TEAM_SHUFFLE, { code })
  ));

  // «العب مرة ثانية»: same code and players, back to the lobby (EVENTS.md game:restart).
  const playAgain = async () => {
    if (restarting) return;
    setRestarting(true);
    setRestartError(false);
    try {
      const res = await request(GAME_RESTART, { code });
      if (res.ok) {
        setLocked([]);
        setScores([]);
        setRoundEnd(null);
        setGameOver(null);
        setStatus('lobby');
      } else setRestartError(true);
    } catch {
      setRestartError(true);
    }
    setRestarting(false);
  };

  const goHome = () => {
    writeSaved(null);
    navigate('/');
  };

  const retry = () => {
    pending.current = null;
    setStatus('connecting');
    setAttempt((n) => n + 1);
  };

  return (
    <div className="q-app">
      {status === 'lobby' && (
        <HostLobby
          code={code}
          players={players}
          onStart={startGame}
          starting={starting}
          startError={startError}
          gameMode={gameMode}
          onModeChange={changeMode}
          onMoveTeam={moveTeam}
          onShuffle={shuffleTeams}
          teamBusy={teamBusy}
          teamError={teamError}
        />
      )}
      {status === 'countdown' && <Countdown round={countdown.round} startsAt={countdown.startsAt} clockOffset={clockOffset.current} />}
      {status === 'round' && (
        <RoundScreen
          round={roundInfo.round}
          category={roundInfo.category}
          endsAt={roundInfo.endsAt}
          clockOffset={clockOffset.current}
          locked={locked}
          players={players}
          scores={scores}
          cardNotice={cardNotice}
          frozenIds={frozenIds}
        />
      )}
      {status === 'roundEnd' && roundEnd && <RoundEnd {...roundEnd} />}
      {status === 'over' && gameOver && (
        <Results winner={gameOver.winner} ranking={gameOver.ranking} onAgain={playAgain} onHome={goHome} busy={restarting} error={restartError} />
      )}
      {status === 'connecting' && (
        <div className="q-screen-host q-center" style={{ justifyContent: 'center' }}>
          <div className="q-waiting" role="status"><span className="q-waiting__pulse" />نفتح الغرفة…</div>
        </div>
      )}
      {status === 'resuming' && (
        <div className="q-screen-host q-center" style={{ justifyContent: 'center' }}>
          <div className="q-waiting" role="status"><span className="q-waiting__pulse" />نرجعك للعبة…</div>
        </div>
      )}
      {status === 'error' && (
        <div className="q-screen-host q-center" style={{ justifyContent: 'center' }}>
          <div className="q-alert" role="alert">ما قدرنا نفتح الغرفة، تأكد من الاتصال وجرّب مرة ثانية</div>
          <div className="q-row" style={{ gap: 'var(--q-space-4)' }}>
            <button type="button" className="q-btn q-btn--primary q-btn--tv" onClick={retry}>جرّب مرة ثانية</button>
            <button type="button" className="q-btn q-btn--ghost q-btn--tv" onClick={() => navigate('/')}>الرئيسية</button>
          </div>
        </div>
      )}
    </div>
  );
}
