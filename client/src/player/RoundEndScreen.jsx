import Logo, { DoorIcon, EyeIcon } from '../theme/Logo.jsx';
import RankingList from './RankingList.jsx';

export default function RoundEndScreen({ state, meId }) {
  const me = state.players.find((player) => player.id === meId);
  const justOut = state.eliminated?.id === meId;
  const out = me?.out || state.me?.out;
  const names = new Map(state.players.map((player) => [player.id, player.name]));
  const ranking = [...(state.scores || [])].map((entry) => ({ ...entry, name: entry.name || names.get(entry.id) }))
    .sort((a, b) => b.score - a.score);
  return <>
    <div className="q-spread"><span className="q-round-label">انتهت الجولة {state.round}</span><Logo size={36} /></div>
    <h1 className="q-title q-stacked">انتهى الوقت!</h1>
    {out ? <div className="q-out-screen" role="status">
      {justOut ? <DoorIcon className="q-out-screen__icon" /> : <EyeIcon className="q-out-screen__icon" />}
      <h2 className="q-title">طلعت من اللعبة</h2>
      {justOut && <span className="q-stamp">طلع!</span>}
      <p>تقدر تكمل تتفرج</p>
    </div> : <div className="q-safe"><h2 className="q-title q-stacked">نجوت!</h2></div>}
    {state.eliminated && <p className="q-badge q-badge--out">طلع {state.eliminated.name}</p>}
    <RankingList ranking={ranking} meId={meId} eliminatedId={state.eliminated?.id} scores />
    <p className="q-muted q-dots" role="status">ننتظر الجولة الجاية أو النتيجة</p>
  </>;
}
