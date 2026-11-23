import { TEAM_NAMES } from "../player/teamState.js";

/* --------------------------------------------------------------------------
   شريط الفريقين — نفس الشريط في الجولة واللوحة والنتيجة
   خانة فريقك تتلوّن بلونه وعليها «فريقك».

   <TeamStrip team="B" values={{ A: 3, B: 5 }} />
   <TeamStrip team="B" values={state.squares} notes={{ A: "4 نقاط", B: "6 نقاط" }} />
   -------------------------------------------------------------------------- */
export default function TeamStrip({ team, values, notes, label = "نقاط الفرق", fallback = 0 }) {
  return (
    <div className="q-m-teams" aria-label={label}>
      {["A", "B"].map((id) => (
        <span
          key={id}
          className={`q-m-teams__cell q-m-teams__cell--${id.toLowerCase()}${id === team ? " is-mine" : ""}`}
        >
          {id === team && <i className="q-m-teams__mine">فريقك</i>}
          <span className="q-m-teams__name">
            {TEAM_NAMES[id]}
            {notes?.[id] != null && <small>{notes[id]}</small>}
          </span>
          <b>{values?.[id] ?? fallback}</b>
        </span>
      ))}
    </div>
  );
}
