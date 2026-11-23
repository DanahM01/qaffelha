import useServerSeconds from "./useServerSeconds.js";

// 3-2-1 on the phone, from PhoneCountdown in theme/PhoneSimTv.jsx (number on the sun).
export default function CountdownScreen({ state, offset }) {
  const seconds = useServerSeconds(state.startsAt, offset);
  return (
    <div
      className="q-m-count q-grow"
      style={{ display: "flex", flexDirection: "column", minHeight: "70vh", overflow: "clip" }}
    >
      <div className="q-m-hero">
        <div className="q-m-sun" />
        <span className="q-m-count__round">الجولة {state.round}</span>
        <span
          key={seconds}
          className="q-m-count__n"
          role="timer"
          aria-label="العد التنازلي"
        >
          {seconds || "يلا"}
        </span>
        <span className="q-m-ticket">جهّز أصابعك…</span>
      </div>
    </div>
  );
}
