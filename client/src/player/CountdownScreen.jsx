import useServerSeconds from './useServerSeconds.js';

export default function CountdownScreen({ state, offset }) {
  const seconds = useServerSeconds(state.startsAt, offset);
  return <div className="q-grow q-stack q-center">
    <span className="q-round-label">الجولة {state.round}</span>
    <span key={seconds} className="q-m-count__n" role="timer" aria-label="العد التنازلي">{seconds || 'يلا'}</span>
    <span className="q-m-ticket">جهّز أصابعك…</span>
  </div>;
}
