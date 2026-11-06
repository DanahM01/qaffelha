// Big-screen results (SPEC §6.3), ported from Results in theme/HostScreens.jsx.
import Logo, { CrownIcon } from '../theme/Logo.jsx';

const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// One player is out per round, so the player in place p of n went out in round n - p + 1.
export default function Results({ winner, ranking, onAgain, onHome, busy, error }) {
  const order = [...ranking].sort((a, b) => a.place - b.place);
  const total = order.length;
  return (
    <div className="q-screen-host">
      <div className="q-spread">
        <span className="q-round-label">النتائج</span>
        <div className="q-row" style={{ gap: '1.2rem' }}>
          <button type="button" className="q-btn q-btn--ghost q-btn--sm" style={{ fontSize: 'var(--q-fs-tv-label)' }} onClick={onHome}>رجوع للرئيسية</button>
          <Logo size="3.2vw" />
        </div>
      </div>
      <div className="q-host-grid" style={{ gridTemplateRows: 'minmax(0, 1fr)', minHeight: 0 }}>
        <div className="q-winner q-winner--stage">
          <CrownIcon className="q-winner__crown" />
          <span className="q-tv-label" style={{ color: 'var(--q-text)' }}>بطل قفّلها</span>
          <span className="q-winner__name">{winner.name}</span>
        </div>
        <div className="q-stack" style={{ gap: 'min(2.4vh, 1.4rem)', fontSize: 'calc(var(--q-fs-tv-label) * 0.9)', minHeight: 0 }}>
          <div className="q-side-board" style={{ flex: 1 }}>
            <div className="q-stack" style={{ gap: '0.6em' }}>
              <span className="q-tv-label" style={{ color: 'var(--q-text)' }}>الترتيب النهائي</span>
              <div className="q-flap">
                {order.map((p, i) => (
                  <div key={p.id} className={`q-flap__row ${i === 0 ? 'is-leader' : ''}`} style={{ gridTemplateColumns: '2.2em 1fr auto' }}>
                    <span className="q-flap__tile"><span style={{ animationDelay: `${i * 150}ms` }}>{p.place}</span></span>
                    <span className="q-flap__tile q-flap__tile--name"><span style={{ animationDelay: `${i * 150 + 80}ms` }}>{p.name}</span></span>
                    <span className="q-flap__tile" style={{ fontFamily: 'var(--q-font)', fontSize: '0.8em', paddingInline: '0.7em' }}>
                      <span style={{ animationDelay: `${i * 150 + 160}ms` }}>{p.place === 1 ? 'البطل' : `طلع بالجولة ${AR(total - p.place + 1)}`}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {error && <div className="q-alert" role="alert">ما قدرنا نرجع للغرفة، جرّب مرة ثانية</div>}
          <button type="button" className="q-btn q-btn--primary q-btn--tv q-btn--block" style={{ whiteSpace: 'nowrap' }} onClick={onAgain} disabled={busy}>العب مرة ثانية</button>
        </div>
      </div>
    </div>
  );
}
