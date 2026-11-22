// Owner: Renad. Big-screen lobby (SPEC §6.3), ported from HostLobby in theme/Preview.jsx.
// Team Mode (SPEC §17.2): «فردي» / «فرق» switch, two team columns and «وزّع عشوائي».
import { QRCodeSVG } from 'qrcode.react';
import Logo from '../theme/Logo.jsx';
import RoomCode from './RoomCode.jsx';
import TeamColumns from './TeamColumns.jsx';

const MIN_PLAYERS = 3;
const MIN_TEAM_PLAYERS = 4;
const MIN_PER_TEAM = 2;
const SLOTS = 6;
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

const START_ERRORS = {
  NOT_ENOUGH_PLAYERS: `تحتاجون ${AR(MIN_PLAYERS)} لاعبين على الأقل`,
  FAILED: 'ما قدرنا نبدأ اللعبة، جرّب مرة ثانية',
};
const TEAM_HINTS = {
  players: `الفرق تحتاج ${AR(MIN_TEAM_PLAYERS)} لاعبين على الأقل`,
  perTeam: 'كل فريق يحتاج لاعبين اثنين على الأقل',
};
const TEAM_ERROR = 'ما قدرنا نغيّر الفرق، جرّب مرة ثانية';
const MODES = [
  { id: 'classic', label: 'فردي' },
  { id: 'teams', label: 'فرق' },
];

// Why Start is disabled in the chosen mode, or null when it can start.
function blockedReason(gameMode, players) {
  if (gameMode !== 'teams') return players.length >= MIN_PLAYERS ? null : START_ERRORS.NOT_ENOUGH_PLAYERS;
  if (players.length < MIN_TEAM_PLAYERS) return TEAM_HINTS.players;
  const a = players.filter((p) => p.team === 'A').length;
  const b = players.filter((p) => p.team === 'B').length;
  return a >= MIN_PER_TEAM && b >= MIN_PER_TEAM ? null : TEAM_HINTS.perTeam;
}

// startError: null | 'NOT_ENOUGH_PLAYERS' | 'FAILED' (set by HostApp from the game:start ack).
export default function HostLobby({
  code, players, onStart, starting = false, startError = null,
  gameMode = 'classic', onModeChange, onMoveTeam, onShuffle, teamBusy = false, teamError = false,
}) {
  const teams = gameMode === 'teams';
  const blocked = blockedReason(gameMode, players);
  const ready = blocked === null;
  // If the server refuses while the screen thought Start was fine, keep the hint in the chosen mode.
  const notEnough = blocked ?? (teams ? TEAM_HINTS.perTeam : START_ERRORS.NOT_ENOUGH_PLAYERS);
  const startErrorText = startError === 'NOT_ENOUGH_PLAYERS' ? notEnough : START_ERRORS[startError];
  const slots = Math.max(0, SLOTS - players.length);
  const joinUrl = `${window.location.origin}/play/${code}`;
  const siteUrl = `${window.location.host}/play`;

  return (
    <div className="q-screen-host">
      <div className="q-static" />
      <div className="q-spread">
        <Logo size="max(28px, 3.6vw)" />
        {/* The mode controls sit in the header so the lobby keeps its height (players + Start below). */}
        <div className="q-row" style={{ gap: '0.8em', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div className="q-row" role="group" aria-label="نوع اللعب" style={{ gap: '0.4em' }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`q-btn q-btn--sm ${gameMode === m.id ? 'q-btn--primary' : 'q-btn--secondary'}`}
                aria-pressed={gameMode === m.id}
                disabled={starting}
                onClick={() => onModeChange(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {teams && (
            <button type="button" className={`q-btn q-btn--sm q-btn--secondary ${teamBusy ? 'is-loading' : ''}`} disabled={teamBusy || starting || players.length < 2} onClick={onShuffle}>
              وزّع عشوائي
            </button>
          )}
          <span className="q-channel__tag" style={{ position: 'static', fontSize: 'var(--q-fs-tv-label)' }}>CH 01 · الغرفة مفتوحة</span>
        </div>
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
        <div className="q-stack" style={{ gap: '0.6em', flex: '1 1 0', minWidth: 0 }}>
          <span className="q-tv-label" style={{ color: 'var(--q-text)' }}>
            اللاعبين ({AR(players.length)})
            {teams && <span style={{ color: 'var(--q-text-muted)' }}> · اضغط على اسم اللاعب عشان تنقله للفريق الآخر</span>}
          </span>
          {teams && teamError && <div className="q-alert" role="alert" style={{ fontSize: 'var(--q-fs-tv-label)', alignSelf: 'flex-start' }}>{TEAM_ERROR}</div>}
          {teams ? (
            <TeamColumns players={players} onMove={onMoveTeam} busy={teamBusy || starting} />
          ) : (
            <div className="q-player-list" aria-live="polite">
              {players.map((p, i) => (
                <span key={p.id} className="q-player-chip">
                  <span className={`q-avatar q-avatar--${(i % 8) + 1}`} aria-hidden="true">{p.name[0]}</span>
                  {p.name}
                </span>
              ))}
              {Array.from({ length: slots }, (_, i) => <span key={i} className="q-slot">{i === 0 ? 'بانتظار…' : ''}</span>)}
            </div>
          )}
        </div>
        <div className="q-start">
          {startError && <div className="q-alert" role="alert" style={{ fontSize: 'var(--q-fs-tv-label)' }}>{startErrorText}</div>}
          <button
            type="button"
            className={`q-btn q-btn--primary q-btn--tv ${starting ? 'is-loading' : ''}`}
            disabled={!ready || starting}
            aria-busy={starting}
            onClick={onStart}
          >
            ابدأ
          </button>
          <span className="q-start__note">{ready ? 'جاهزين؟' : blocked}</span>
        </div>
      </div>
    </div>
  );
}
