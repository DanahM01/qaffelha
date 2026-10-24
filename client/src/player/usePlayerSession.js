// Owner: Reef. Only sends documented intents; game decisions belong to the server.
import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';

const CREATE = 'room:create';
const JOIN = 'room:join';
const REJOIN = 'room:rejoin';
const PLAYERS = 'room:players';
const START = 'game:start';
const COUNTDOWN = 'round:countdown';
const ERRORS = {
  NOT_FOUND: 'الغرفة مو موجودة', NAME_TAKEN: 'الاسم مأخوذ', NAME_INVALID: 'الاسم غير صالح',
  STARTED: 'اللعبة بدأت', FULL: 'الغرفة مليانة', NOT_HOST: 'البدء عند المضيف بس',
  NOT_ENOUGH_PLAYERS: 'تحتاجون 3 لاعبين على الأقل',
};
const EMPTY = { status: 'lobby', mode: null, hostId: null, players: [] };

function storedIdentity() {
  try {
    const value = JSON.parse(sessionStorage.getItem('qaffelha'));
    return value && /^[A-HJ-NP-Z]{4}$/.test(value.code) && typeof value.playerId === 'string' ? value : null;
  } catch { return null; }
}

export default function usePlayerSession(navigate) {
  const [identity, setIdentity] = useState(storedIdentity);
  const identityRef = useRef(identity);
  const [state, setState] = useState(EMPTY);
  const [connected, setConnected] = useState(socket.connected);
  const [reconnecting, setReconnecting] = useState(Boolean(identity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const offset = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const clearError = useCallback(() => setError(''), []);
  const request = useCallback((event, payload) => new Promise((resolve) => {
    socket.timeout(6000).emit(event, payload, (timeout, response) => resolve(timeout ? null : response));
  }), []);

  useEffect(() => {
    mounted.current = true;
    const epoch = ++generation.current;
    async function reconnect() {
      setConnected(true);
      if (!identityRef.current) return;
      setReconnecting(true);
      const response = await request(REJOIN, identityRef.current);
      if (!mounted.current || epoch !== generation.current) return;
      setReconnecting(false);
      if (!response) { setError('ما قدرنا نرجعك للغرفة. حاول مرة ثانية.'); return; }
      if (!response.ok) {
        if (response.error === 'NOT_FOUND') {
          try { sessionStorage.removeItem('qaffelha'); } catch { /* Storage may be unavailable. */ }
          identityRef.current = null; setIdentity(null); setState(EMPTY); navigate('/', { replace: true });
        } else setError(ERRORS[response.error] || 'ما قدرنا نرجعك للغرفة');
        return;
      }
      offset.current = response.serverTime - Date.now();
      setState(response.state); setError('');
    }
    const disconnect = () => { setConnected(false); setReconnecting(Boolean(identityRef.current)); };
    const players = (payload) => setState((current) => ({ ...current, ...payload }));
    const countdown = (payload) => setState((current) => ({ ...current, ...payload, status: 'countdown' }));
    socket.on('connect', reconnect); socket.on('disconnect', disconnect);
    socket.on(PLAYERS, players); socket.on(COUNTDOWN, countdown);
    if (socket.connected) reconnect();
    return () => {
      mounted.current = false; ++generation.current;
      socket.off('connect', reconnect); socket.off('disconnect', disconnect);
      socket.off(PLAYERS, players); socket.off(COUNTDOWN, countdown);
    };
  }, [navigate, request]);

  async function join({ code, name, host }) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const response = await request(host ? CREATE : JOIN, host ? { mode: 'phone', name } : { code, name });
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!response) { setError('ما وصلنا رد. تأكد من الاتصال وحاول مرة ثانية.'); return; }
    if (!response.ok) { setError(ERRORS[response.error] || 'ما قدرنا ندخلك الغرفة'); return; }
    const next = { code: host ? response.code : code, playerId: response.playerId };
    identityRef.current = next; setIdentity(next);
    try { sessionStorage.setItem('qaffelha', JSON.stringify(next)); } catch { /* Gameplay can continue without persistence. */ }
    offset.current = response.serverTime - Date.now();
    setState((current) => ({ ...current, status: 'lobby', ...(host ? { mode: 'phone', hostId: next.playerId } : {}) }));
    navigate(`/play/${next.code}`, { replace: true });
  }

  async function start() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const response = await request(START, { code: identityRef.current.code });
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!response?.ok) setError(response ? ERRORS[response.error] || 'ما قدرنا نبدأ' : 'ما وصلنا رد. حاول مرة ثانية.');
  }

  return { identity, state, connected, reconnecting, busy, error, clearError, join, start, offset };
}
