// Owner: Renad. Main screen (TV / laptop): room code, lobby, category, timer, locked words, scoreboard.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket.js';
import HostLobby from './HostLobby.jsx';
import Countdown from './Countdown.jsx';
import { fakeCreateAck, startFakeRoom } from './fakeRoom.js';

// Event names from EVENTS.md §1.
const ROOM_CREATE = 'room:create';
const ROOM_REJOIN = 'room:rejoin';
const ROOM_PLAYERS = 'room:players';
const GAME_START = 'game:start';
const ROUND_COUNTDOWN = 'round:countdown';

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

const request = (event, payload) => socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload);

// EVENTS.md §3: rejoin the stored room first, otherwise create a new screen-mode room.
// On rejoin NOT_FOUND the session is cleared and the caller goes to / (EVENTS.md §1).
async function openRoom() {
  const saved = readSaved();
  if (saved) {
    const res = await request(ROOM_REJOIN, { code: saved.code, hostToken: saved.hostToken });
    if (res.ok) {
      const { state } = res;
      const countdown = state.status === 'countdown' ? { round: state.round, startsAt: state.startsAt } : null;
      // round / roundEnd / over have no host screen yet (PB-04+): wait instead of showing a live «ابدأ».
      const resuming = state.status !== 'lobby' && state.status !== 'countdown';
      return { code: saved.code, serverTime: res.serverTime, players: state.players, countdown, resuming };
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
  return { code: res.code, serverTime: res.serverTime, players: [], countdown: null, resuming: false };
}

export default function HostApp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fake = import.meta.env.DEV && params.get('fake') === '1';

  // Fake mode starts straight in the lobby so the connecting screen never flashes.
  const [status, setStatus] = useState(() => (fake ? 'lobby' : 'connecting')); // connecting | lobby | countdown | resuming | error
  const [code, setCode] = useState(() => (fake ? fakeCreateAck().code : ''));
  const [players, setPlayers] = useState([]);
  const [countdown, setCountdown] = useState(null); // { round, startsAt } from round:countdown
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null); // null | 'NOT_ENOUGH_PLAYERS' | 'FAILED'
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(null); // one request per attempt, even when StrictMode runs the effect twice
  const clockOffset = useRef(0); // serverTime - Date.now(), for the countdown and round timers
  const fakeRoom = useRef(null);

  const showCountdown = (payload) => {
    setCountdown({ round: payload.round, startsAt: payload.startsAt });
    setStarting(false);
    setStartError(null);
    setStatus('countdown');
  };

  useEffect(() => {
    if (fake) {
      const ack = fakeCreateAck();
      clockOffset.current = ack.serverTime - Date.now();
      setCode(ack.code);
      setPlayers([]);
      setStatus('lobby');
      fakeRoom.current = startFakeRoom({ onPlayers: (payload) => setPlayers(payload.players), onCountdown: showCountdown });
      return () => fakeRoom.current.stop();
    }

    let active = true;
    setStatus('connecting');
    const onPlayers = (payload) => setPlayers(payload.players);
    socket.on(ROOM_PLAYERS, onPlayers);
    // Listened to all the time: the server sends it again before every round.
    socket.on(ROUND_COUNTDOWN, showCountdown);

    if (!pending.current) pending.current = openRoom();
    pending.current
      .then((room) => {
        if (!active) return;
        if (room.notFound) return navigate('/', { replace: true });
        clockOffset.current = room.serverTime - Date.now();
        setCode(room.code);
        setPlayers(room.players);
        if (room.countdown) showCountdown(room.countdown);
        else setStatus(room.resuming ? 'resuming' : 'lobby');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      socket.off(ROOM_PLAYERS, onPlayers);
      socket.off(ROUND_COUNTDOWN, showCountdown);
    };
  }, [fake, attempt, navigate]);

  // «ابدأ»: on ok the server sends round:countdown, which switches the screen (EVENTS.md game:start).
  const startGame = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = fake ? fakeRoom.current.gameStart() : await request(GAME_START, { code });
      if (res.ok) return;
      setStartError(res.error === 'NOT_ENOUGH_PLAYERS' ? 'NOT_ENOUGH_PLAYERS' : 'FAILED');
    } catch {
      setStartError('FAILED');
    }
    setStarting(false);
  };

  const retry = () => {
    pending.current = null;
    setStatus('connecting');
    setAttempt((n) => n + 1);
  };

  return (
    <div className="q-app">
      {status === 'lobby' && <HostLobby code={code} players={players} onStart={startGame} starting={starting} startError={startError} />}
      {status === 'countdown' && <Countdown round={countdown.round} startsAt={countdown.startsAt} clockOffset={clockOffset.current} />}
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
