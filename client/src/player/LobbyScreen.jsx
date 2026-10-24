import { QRCodeSVG } from 'qrcode.react';
import Logo, { CrownIcon, ShareIcon } from '../theme/Logo.jsx';

export default function LobbyScreen({ code, players, meId, hostId, isHost, onStart, onShare, busy, message }) {
  const joinUrl = `${window.location.origin}/play/${code}`;
  return <>
    <div className="q-spread"><Logo size={40} /><span className="q-badge q-badge--ink q-ltr">{code}</span></div>
    <h1 className="q-title q-stacked">{isHost ? 'صوّروا وادخلوا!' : 'انتظر المضيف يبدأ'}</h1>
    {isHost && <>
      <div className="q-m-qr"><QRCodeSVG value={joinUrl} size={256} marginSize={4} title="باركود دخول الغرفة" /></div>
      <div className="q-row"><span className="q-muted">أو اكتبوا الكود</span><strong className="q-badge q-badge--ink q-ltr">{code}</strong></div>
      <button type="button" className="q-btn q-btn--success" onClick={onShare}><ShareIcon />شارك الرابط</button>
      {message && <p role="status" className="q-muted">{message}</p>}
      <details><summary>نسخ الرابط يدويًا</summary><div className="q-field"><label className="q-label" htmlFor="join-link">رابط الغرفة</label><input id="join-link" className="q-input q-ltr" readOnly value={joinUrl} onFocus={(event) => event.target.select()} /></div></details>
    </>}
    <h2 className="q-eyebrow">اللاعبين <span className="q-ltr">({players.length}/12)</span></h2>
    <div className="q-player-list" aria-live="polite" aria-label="اللاعبين">
      {players.map((player, index) => <span key={player.id} className={`q-player-chip ${player.id === meId ? 'is-me' : ''}`}>
        <span className={`q-avatar q-avatar--${index % 8 + 1}`} aria-hidden="true">{player.name[0]}</span>
        <span>{player.name}{player.id === meId ? ' (أنت)' : ''}{!player.connected ? ' — انقطع اتصاله' : ''}</span>
        {player.id === hostId && <CrownIcon title="المضيف" />}
      </span>)}
    </div>
    <div className="q-grow" />
    {isHost && <><button type="button" className="q-btn q-btn--primary q-btn--lg q-btn--block" disabled={busy || players.length < 3} onClick={onStart}>ابدأ</button>
      {players.length < 3 && <p className="q-muted">تحتاجون 3 لاعبين على الأقل</p>}</>}
  </>;
}
