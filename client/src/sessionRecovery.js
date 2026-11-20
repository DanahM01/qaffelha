// PB-28. Apply a rejoin snapshot inside its acknowledgement, before later live events.
const REJOIN = 'room:rejoin';
const RETRY_MESSAGE = 'ما قدرنا نرجعك للغرفة. بنحاول مرة ثانية…';

export function createSessionRecovery({ socket, getIdentity, onSnapshot, onMissing,
  onPending, onError, onConnected, schedule = setTimeout, cancel = clearTimeout }) {
  let active = true;
  let version = 0;
  let failures = 0;
  let timer = null;
  const clearRetry = () => { if (timer !== null) cancel(timer); timer = null; };

  function recover() {
    if (!active) return;
    clearRetry();
    const identity = getIdentity();
    const attempt = ++version;
    onConnected(socket.connected);
    if (!identity || !socket.connected) { onPending(Boolean(identity)); return; }
    onPending(true);
    socket.timeout(6000).emit(REJOIN, identity, (error, response) => {
      const current = getIdentity();
      if (!active || attempt !== version || !socket.connected || !current ||
          current.code !== identity.code || current.playerId !== identity.playerId ||
          current.hostToken !== identity.hostToken) return;
      if (!error && response?.ok === false && response.error === 'NOT_FOUND') {
        failures = 0;
        onMissing();
        onError('');
        onPending(false);
        return;
      }
      if (error || !response?.ok || !response.state || !Array.isArray(response.state.players) ||
          !Number.isFinite(response.serverTime)) {
        onError(RETRY_MESSAGE);
        const delay = Math.min(1000 * 2 ** Math.min(failures++, 4), 10000);
        timer = schedule(() => { timer = null; recover(); }, delay);
        return;
      }
      failures = 0;
      onSnapshot(response.state, response.serverTime);
      onError('');
      onPending(false);
    });
  }

  function disconnect() {
    if (!active) return;
    ++version;
    clearRetry();
    onConnected(false);
    onPending(Boolean(getIdentity()));
  }
  return { recover, disconnect, dispose() { active = false; ++version; clearRetry(); } };
}
