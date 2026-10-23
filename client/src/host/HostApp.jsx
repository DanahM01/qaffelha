// Owner: Renad. Main screen (TV / laptop): room code, lobby, category, timer, locked words, scoreboard.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket.js';
import HostLobby from './HostLobby.jsx';
import { fakeCreateAck, startFakePlayers } from './fakeRoom.js';

// Event names from EVENTS.md §1.
const ROOM_CREATE = 'room:create';
const ROOM_REJOIN = 'room:rejoin';
const ROOM_PLAYERS = 'room:players';

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
    if (res.ok) return { code: saved.code, serverTime: res.serverTime, players: res.state.players };
    if (res.error === 'NOT_FOUND') {
      writeSaved(null);
      return { notFound: true };
    }
    throw new Error(res.error);
  }
  const res = await request(ROOM_CREATE, { mode: 'screen' });
  if (!res.ok) throw new Error(res.error);
  writeSaved({ code: res.code, hostToken: res.hostToken });
  return { code: res.code, serverTime: res.serverTime, players: [] };
}

export default function HostApp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fake = import.meta.env.DEV && params.get('fake') === '1';

  // Fake mode starts straight in the lobby so the connecting screen never flashes.
  const [status, setStatus] = useState(() => (fake ? 'lobby' : 'connecting')); // connecting | lobby | error
  const [code, setCode] = useState(() => (fake ? fakeCreateAck().code : ''));
  const [players, setPlayers] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(null); // one request per attempt, even when StrictMode runs the effect twice
  const clockOffset = useRef(0); // serverTime - Date.now(), for the round timers (PB-04)

  useEffect(() => {
    if (fake) {
      const ack = fakeCreateAck();
      clockOffset.current = ack.serverTime - Date.now();
      setCode(ack.code);
      setPlayers([]);
      setStatus('lobby');
      return startFakePlayers((payload) => setPlayers(payload.players));
    }

    let active = true;
    setStatus('connecting');
    const onPlayers = (payload) => setPlayers(payload.players);
    socket.on(ROOM_PLAYERS, onPlayers);

    if (!pending.current) pending.current = openRoom();
    pending.current
      .then((room) => {
        if (!active) return;
        if (room.notFound) return navigate('/', { replace: true });
        clockOffset.current = room.serverTime - Date.now();
        setCode(room.code);
        setPlayers(room.players);
        setStatus('lobby');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      socket.off(ROOM_PLAYERS, onPlayers);
    };
  }, [fake, attempt, navigate]);

  const retry = () => {
    pending.current = null;
    setStatus('connecting');
    setAttempt((n) => n + 1);
  };

  return (
    <div className="q-app">
      {status === 'lobby' && <HostLobby code={code} players={players} />}
      {status === 'connecting' && (
        <div className="q-screen-host q-center" style={{ justifyContent: 'center' }}>
          <div className="q-waiting" role="status"><span className="q-waiting__pulse" />نفتح الغرفة…</div>
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
