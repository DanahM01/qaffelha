// Owner: Renad. 20 lights + LED seconds (.q-timer, SPEC §8). Drawn from the server's endsAt;
// it never ends the round itself, it only holds at 00 until the server moves on.
import { useEffect, useState } from 'react';

const ROUND_SECONDS = 20;
const WARN_SECONDS = 10;
const DANGER_SECONDS = 5;
const TICK_MS = 100;

function secondsLeft(endsAt, clockOffset) {
  if (!Number.isFinite(endsAt)) return 0;
  const ms = endsAt - (Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0));
  return Math.min(ROUND_SECONDS, Math.max(0, Math.ceil(ms / 1000)));
}

export default function RoundTimer({ endsAt, clockOffset }) {
  const [seconds, setSeconds] = useState(() => secondsLeft(endsAt, clockOffset));

  useEffect(() => {
    setSeconds(secondsLeft(endsAt, clockOffset));
    const timer = setInterval(() => setSeconds(secondsLeft(endsAt, clockOffset)), TICK_MS);
    return () => clearInterval(timer);
  }, [endsAt, clockOffset]);

  const state = seconds <= DANGER_SECONDS ? 'is-danger' : seconds <= WARN_SECONDS ? 'is-warn' : '';

  return (
    <div className={`q-timer ${state}`} style={{ '--q-progress': seconds / ROUND_SECONDS }} role="timer">
      <span className="q-timer__num">{String(seconds).padStart(2, '0')}</span>
      <div className="q-timer__track"><div className="q-timer__fill" /></div>
    </div>
  );
}
