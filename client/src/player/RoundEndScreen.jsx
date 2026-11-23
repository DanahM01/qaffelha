import Logo, { DoorIcon, EyeIcon } from "../theme/Logo.jsx";
import RankingList from "./RankingList.jsx";

export default function RoundEndScreen({ state, meId }) {
  const me = state.players.find((player) => player.id === meId);
  const justOut = state.eliminated?.id === meId;
  const out = me?.out || state.me?.out;
  const names = new Map(
    state.players.map((player) => [player.id, player.name]),
  );
  const ranking = [...(state.scores || [])]
    .map((entry) => ({ ...entry, name: entry.name || names.get(entry.id) }))
    .sort((a, b) => b.score - a.score);
  return (
    <>
      <div className="q-m-bar">
        <span className="q-m-end__when">انتهى الوقت · الجولة {state.round}</span>
        <Logo size={30} />
      </div>
      {out ? (
        <div className="q-out-screen" role="status">
          {justOut ? (
            <DoorIcon className="q-out-screen__icon" />
          ) : (
            <EyeIcon className="q-out-screen__icon" />
          )}
          <h1 className="q-title">طلعت من اللعبة</h1>
          <p>تقدر تكمل تتفرج</p>
        </div>
      ) : (
        <div className="q-safe" role="status">
          <h1 className="q-title q-stacked">نجوت!</h1>
        </div>
      )}
      <RankingList
        ranking={ranking}
        meId={meId}
        eliminatedId={state.eliminated?.id}
        scores
      />
      <p className="q-muted q-dots" role="status">
        ننتظر الجولة الجاية أو النتيجة
      </p>
    </>
  );
}
