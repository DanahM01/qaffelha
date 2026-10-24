import { Link } from 'react-router-dom';
import { CrownIcon } from '../theme/Logo.jsx';
import RankingList from './RankingList.jsx';

export default function ResultsScreen({ state, meId, isHost, busy, onAgain }) {
  const place = state.ranking?.find((player) => player.id === meId)?.place;
  return <>
    <div className="q-spread"><span className="q-round-label">النتائج</span><Link className="q-btn q-btn--ghost" to="/">الرئيسية</Link></div>
    <div className="q-winner"><CrownIcon className="q-winner__crown" />
      <h1 className="q-title">{state.winner?.id === meId ? 'أنت البطل!' : 'بطل قفّلها'}</h1>
      {state.winner && <span className="q-winner__name">{state.winner.name}</span>}
    </div>
    {place != null && <p className="q-my-score">مركزك <b className="q-ltr">{place}/{state.ranking.length}</b></p>}
    {state.ranking?.length ? <RankingList ranking={[...state.ranking].sort((a, b) => a.place - b.place)} meId={meId} />
      : <p className="q-alert q-alert--info" role="status">انتهت اللعبة. تفاصيل الترتيب غير متاحة بعد إعادة الاتصال.</p>}
    {isHost ? <button type="button" className="q-btn q-btn--primary q-btn--lg q-btn--block" disabled={busy} onClick={onAgain}>العب مرة ثانية</button>
      : <p className="q-muted q-dots" role="status">انتظر المضيف يعيد اللعبة</p>}
  </>;
}
