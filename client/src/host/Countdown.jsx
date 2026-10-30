// Owner: Renad. 3-2-1 before each round (SPEC §6.3), ported from Countdown in theme/HostScreens.jsx.
// Drawn from the server's startsAt so every device shows the same number (EVENTS.md: offset = serverTime - Date.now()).
import { useEffect, useState } from 'react';

const TICK_MS = 100;
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// Stays on 1 after startsAt until round:start replaces this screen (PB-04).
// A missing or invalid startsAt shows 3 instead of NaN.
function secondsLeft(startsAt, clockOffset) {
  if (!Number.isFinite(startsAt)) return 3;
  const ms = startsAt - (Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0));
  return Math.min(3, Math.max(1, Math.ceil(ms / 1000)));
}

export default function Countdown({ round, startsAt, clockOffset }) {
  const [n, setN] = useState(() => secondsLeft(startsAt, clockOffset));

  useEffect(() => {
    setN(secondsLeft(startsAt, clockOffset));
    const timer = setInterval(() => setN(secondsLeft(startsAt, clockOffset)), TICK_MS);
    return () => clearInterval(timer);
  }, [startsAt, clockOffset]);

  return (
    <div className="q-screen-host q-center" style={{ justifyContent: 'center' }}>
      <div className="q-sunburst" />
      <div className="q-stack q-center" style={{ gap: '2vh' }}>
        <span className="q-round-label">الجولة {AR(round)}</span>
        <span key={n} role="timer" aria-live="polite" className="q-stacked" style={{ fontSize: 'min(34vh, 22vw)', lineHeight: 1, animation: 'q-stamp 600ms var(--q-ease-out) both' }}>{AR(n)}</span>
        <span className="q-tv-label" style={{ color: 'var(--q-text)' }}>استعدوا…</span>
      </div>
    </div>
  );
}
