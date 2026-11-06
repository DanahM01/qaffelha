// Owner: Renad. Big-screen round (SPEC §6.3), ported from Round in theme/HostScreens.jsx.
// Locked words and the scoreboard are added here in PB-08.
import RoundTimer from './RoundTimer.jsx';

const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function RoundScreen({ round, category, endsAt, clockOffset }) {
  return (
    <div className="q-screen-host">
      <div className="q-spread">
        <span className="q-round-label">الجولة {AR(round)}</span>
      </div>
      <div className="q-stack" style={{ gap: 'min(4vh, 2.5rem)' }}>
        <RoundTimer endsAt={endsAt} clockOffset={clockOffset} />
        <h1 className="q-category">{category.title}</h1>
      </div>
    </div>
  );
}
