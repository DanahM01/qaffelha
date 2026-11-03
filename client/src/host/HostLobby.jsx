// Owner: Renad. Big-screen lobby (SPEC §6.3), ported from HostLobby in theme/Preview.jsx.
import { QRCodeSVG } from 'qrcode.react';
import Logo from '../theme/Logo.jsx';
import RoomCode from './RoomCode.jsx';

const MIN_PLAYERS = 3;
const SLOTS = 6;
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function HostLobby({ code, players }) {
  const ready = players.length >= MIN_PLAYERS;
  const slots = Math.max(0, SLOTS - players.length);
  const joinUrl = `${window.location.origin}/play/${code}`;
  const siteUrl = `${window.location.host}/play`;

  return (
    <div className="q-screen-host">
      <div className="q-static" />
      <div className="q-spread">
        <Logo size="max(28px, 3.6vw)" />
        <span className="q-channel__tag" style={{ position: 'static', fontSize: 'var(--q-fs-tv-label)' }}>CH 01 · الغرفة مفتوحة</span>
      </div>
      <div className="q-lobby">
        <div className="q-stack" style={{ gap: 'min(3.4vh, 2rem)' }}>
          <h1 className="q-lobby__title">صوّر وادخل!</h1>
          <ol className="q-steps">
            <li><span className="q-step__n">١</span>افتح كاميرا جوالك</li>
            <li><span className="q-step__n">٢</span>صوّر الباركود</li>
            <li><span className="q-step__n">٣</span>اكتب اسمك وادخل</li>
          </ol>
          <div className="q-row" style={{ gap: '0.8em', fontSize: 'var(--q-fs-tv-label)', color: 'var(--q-text-muted)', fontWeight: 800 }}>
            <span>الكاميرا ما تشتغل؟ ادخل</span>
            <span className="q-ltr" style={{ color: 'var(--q-text)' }}>{siteUrl}</span>
            <span>واكتب</span>
            <RoomCode code={code} small />
          </div>
        </div>
        <div className="q-tv q-lobby__qr">
          <span className="q-tv__antenna" />
          <div className="q-tv__screen is-paper">
            <QRCodeSVG
              value={joinUrl}
              level="M"
              marginSize={2}
              bgColor="transparent"
              fgColor="currentColor"
              title="باركود الغرفة"
              role="img"
              aria-label="باركود الغرفة"
              style={{ color: 'var(--q-ink)' }}
            />
          </div>
          <div className="q-tv__panel"><span className="q-tv__grille" /><span className="q-tv__led" /><span className="q-tv__knob" /><span className="q-tv__knob" /></div>
        </div>
      </div>
      <div className="q-lobby-bar">
        <div className="q-stack" style={{ gap: '0.6em' }}>
          <span className="q-tv-label" style={{ color: 'var(--q-text)' }}>اللاعبين ({AR(players.length)})</span>
          <div className="q-player-list" aria-live="polite">
            {players.map((p, i) => (
              <span key={p.id} className="q-player-chip">
                <span className={`q-avatar q-avatar--${(i % 8) + 1}`} aria-hidden="true">{p.name[0]}</span>
                {p.name}
              </span>
            ))}
            {Array.from({ length: slots }, (_, i) => <span key={i} className="q-slot">{i === 0 ? 'بانتظار…' : ''}</span>)}
          </div>
        </div>
        <div className="q-start">
          {/* Sending game:start is PB-03; here the button only follows the player count. */}
          <button type="button" className="q-btn q-btn--primary q-btn--tv" disabled={!ready}>ابدأ</button>
          <span className="q-start__note">{ready ? 'جاهزين؟' : `تحتاجون ${AR(MIN_PLAYERS)} لاعبين على الأقل`}</span>
        </div>
      </div>
    </div>
  );
}
