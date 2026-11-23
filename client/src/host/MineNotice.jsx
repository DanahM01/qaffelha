// Owner: Renad. PB-18 Mine card notices on the big screen, shown for 3 s on whatever screen is up.
// Only the team and the player are shown: the mined square is never on the big screen (EVENTS.md §6).
import { TEAM_NAMES } from './TeamColumns.jsx';

const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// Above every host screen without moving its layout. .q-card-notice is Freeze-blue by default,
// so the Mine notice uses the cream surface instead (theme tokens only).
const LAYER = { position: 'fixed', insetInline: 0, insetBlockStart: 'var(--q-space-4)', zIndex: 60,
  display: 'flex', justifyContent: 'center', pointerEvents: 'none' };
const MINE_LOOK = { background: 'var(--q-surface)' };

// notice: null | { kind: 'played', team, by: { name }, sequence } | { kind: 'exploded', team, points, sequence }
export default function MineNotice({ notice }) {
  return (
    <div style={LAYER} role="status" aria-live="polite">
      {notice && (
        <span key={notice.sequence} className="q-card-notice q-card-notice--tv" style={MINE_LOOK}>
          {notice.kind === 'played' ? (
            <span>
              <b className={`q-card-notice__team-${notice.team}`}>{notice.by.name}</b>
              {' '}({TEAM_NAMES[notice.team]}) حط لغم
            </span>
          ) : (
            <span>
              انفجر لغم! <b className={`q-card-notice__team-${notice.team}`}>{TEAM_NAMES[notice.team]}</b>
              {' '}<span className="q-ltr">−{AR(Math.abs(notice.points))}</span>
            </span>
          )}
        </span>
      )}
    </div>
  );
}
