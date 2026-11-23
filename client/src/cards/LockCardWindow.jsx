import Logo from '../theme/Logo.jsx';
import useServerSeconds from '../player/useServerSeconds.js';
import LockBadge from './LockBadge.jsx';

const TEAM_NAMES = { A: 'الفريق الأول', B: 'الفريق الثاني' };

export default function LockCardWindow({ state, meId, offset, disabled = false, onCard, host = false }) {
  const seconds = useServerSeconds(state.cardWindowEndsAt, offset);
  const chosen = state.chosen;
  const square = state.board?.find(entry => entry.id === chosen?.squareId);
  const team = state.players?.find(player => player.id === meId)?.team ?? state.me?.team;
  const left = state.cards?.[team]?.lock ?? 0;
  const sittingOut = state.sitout?.[team];
  const permitted = !sittingOut || sittingOut === meId;
  const finalChoice = sittingOut && state.cardChoices?.[team];
  const rival = TEAM_NAMES[team] && team !== chosen?.team;
  const canLock = rival && permitted && !finalChoice && !disabled && seconds > 0 && left > 0 && !chosen?.lockedBy;
  return <section className={host ? 'q-screen-host q-center q-stack' : 'q-stack'} aria-label="نافذة بطاقات المواجهة"
    style={{ gap: 'var(--q-space-4)' }}>
    <Logo size={host ? 'min(14vw, 9vh)' : 48} />
    <h1 className="q-title" style={host ? { fontSize: 'var(--q-fs-tv-body)', margin: 0 } : undefined}>ينتظر بطاقات…</h1>
    <div className="q-card q-stack" style={{ gap: 'var(--q-space-3)', width: 'min(100%, 48rem)' }}>
      <h2 className="q-card__title" style={host ? { fontSize: 'var(--q-fs-tv-title)', margin: 0 } : undefined}>{square?.category.title ?? state.category?.title ?? 'المربع المختار'}</h2>
      <p style={{ margin: 0 }}>{TEAM_NAMES[chosen?.team]} اختار المربع <span className="q-ltr">{(chosen?.squareId ?? 0) + 1}</span></p>
      <p style={{ margin: 0 }}>نافذة البطاقات: <b role="timer" aria-label="وقت استخدام البطاقة" className="q-ltr">{seconds}</b> ثوانٍ</p>
      <LockBadge lockedBy={chosen?.lockedBy} host={host} />
      {!host && rival && !chosen?.lockedBy && <>
        <p>بطاقة القفل تخلي كل إجابة صحيحة لفريقك بنقطتين في هالمواجهة.</p>
        <button type="button" className="q-btn q-btn--primary q-btn--block" disabled={!canLock}
          onClick={() => { if (canLock) onCard('lock'); }}>استخدم بطاقة القفل</button>
        {!permitted && <p>البطاقة عند لاعب فريقك اللي يرتاح هالجولة</p>}
        {left === 0 && <p>فريقك استخدم بطاقة القفل</p>}
      </>}
      {(host || !rival) && !chosen?.lockedBy && <p style={{ margin: 0 }}>الفريق المنافس يقدر يستخدم بطاقة القفل قبل بدء المواجهة.</p>}
    </div>
  </section>;
}
