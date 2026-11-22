// Owner: Renad. Big-screen round (SPEC §6.3), ported from RoundV2 in theme/SimV2.jsx.
import { useEffect, useState } from 'react';
import RoundTimer from './RoundTimer.jsx';
import LockedWords from './LockedWords.jsx';
import Scoreboard from './Scoreboard.jsx';
import { SnowflakeIcon } from '../theme/Logo.jsx';

const TEAM_NAMES = { A: 'الفريق الأول', B: 'الفريق الثاني' };

const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// A phone in landscape is too short for the stacked layout, so it keeps two columns.
// Taller screens never match, so they get the theme's layout with no inline style at all.
const SHORT_SCREEN = '(max-height: 500px)';
const SHORT_COLUMNS = { gridTemplateColumns: 'minmax(0, 1fr) 43vw' };

function useShortScreen() {
  const [short, setShort] = useState(() => window.matchMedia(SHORT_SCREEN).matches);
  useEffect(() => {
    const query = window.matchMedia(SHORT_SCREEN);
    const update = () => setShort(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return short;
}

export default function RoundScreen({ round, category, endsAt, clockOffset, locked, players, scores, cardNotice = null, frozenIds = [] }) {
  const short = useShortScreen();

  return (
    <div className="q-screen-host q-host-fit q-host-round">
      <div className="q-spread">
        <span className="q-round-label">الجولة {AR(round)}</span>
        <div aria-live="polite" role="status">
          {cardNotice?.card === 'freeze' && (
            <span key={cardNotice.sequence} className="q-card-notice q-card-notice--tv">
              <SnowflakeIcon />
              <span>
                <b className={`q-card-notice__team-${cardNotice.team}`}>{cardNotice.by.name}</b>
                {' '}({TEAM_NAMES[cardNotice.team]}) جمّد <b>{cardNotice.target?.name}</b> ٣ ثواني
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="q-host-grid" style={short ? SHORT_COLUMNS : undefined}>
        <div className="q-host-round__main">
          <RoundTimer endsAt={endsAt} clockOffset={clockOffset} />
          <h1 className="q-category">{category.title}</h1>
          <LockedWords locked={locked} />
        </div>
        <div className="q-side-board"><Scoreboard players={players} scores={scores} frozenIds={frozenIds} /></div>
      </div>
    </div>
  );
}
