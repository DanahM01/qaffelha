// Big-screen round end (SPEC §6.3), ported from RoundEndV2 in theme/SimV2.jsx.
// The server moves on by itself 5 s later (round:countdown or game:over), so there is no button.
import Logo from '../theme/Logo.jsx';
import Scoreboard from './Scoreboard.jsx';

const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function RoundEnd({ round, scores, eliminated, avatarIndex, lastRound }) {
  const out = scores.find((s) => s.id === eliminated.id) || { ...eliminated, score: 0 };
  const points = Math.abs(out.score);
  return (
    <div className="q-screen-host q-host-fit">
      <div className="q-static is-burst" />
      <div className="q-spread">
        <span className="q-round-label">انتهت الجولة {AR(round)}</span>
        <Logo size="3.2vw" />
      </div>
      <div className="q-host-grid">
        <div className="q-host-round__main">
          <div className="q-out-stage">
            <div className="q-out-stage__sun" />
            <span className="q-tv-label q-out-stage__eyebrow">انتهى الوقت! وأقل واحد بالنقاط…</span>
            <div className="q-out-stage__who">
              <span className={`q-avatar q-avatar--${(avatarIndex % 8) + 1}`} aria-hidden="true">{out.name[0]}</span>
              <span className="q-out-stage__name">{out.name}</span>
            </div>
            <span className="q-out-stage__stamp">طلع!</span>
            <span className="q-out-stage__meta">
              جاب <span className="q-ltr">{out.score < 0 ? '−' : ''}{AR(points)}</span> {points === 1 ? 'نقطة' : 'نقاط'} بالجولة
            </span>
          </div>
          <div className="q-waiting" role="status" style={{ alignSelf: 'center', fontSize: 'var(--q-fs-tv-label)' }}>
            <span className="q-waiting__pulse" />
            {lastRound ? 'نطلع الفائز…' : 'الجولة الجاية بعد شوي…'}
          </div>
        </div>
        <div className="q-side-board">
          <Scoreboard players={scores} scores={scores} title="ترتيب الجولة" />
        </div>
      </div>
    </div>
  );
}
