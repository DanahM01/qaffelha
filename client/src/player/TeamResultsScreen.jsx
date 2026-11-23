import { Link } from "react-router-dom";
import { CrownIcon } from "../theme/Logo.jsx";
import { TEAM_NAMES, myTeam } from "./teamState.js";
import TeamStrip from "../theme/TeamStrip.jsx";
import TeamBoard from "./TeamBoard.jsx";

export default function TeamResultsScreen({
  state,
  meId,
  isHost,
  busy,
  onAgain,
}) {
  const team = myTeam(state, meId);
  const winner = state.winnerTeam;
  const available = winner === null || winner === "A" || winner === "B";
  const title = !available
    ? "انتهت اللعبة"
    : winner === null
      ? "تعادل الفريقين!"
      : winner === team
        ? "فاز فريقك!"
        : team
          ? "خسر فريقك"
          : `فاز ${TEAM_NAMES[winner]}!`;
  const winners = state.players.filter((player) => player.team === winner);
  return (
    <>
      <div className="q-spread">
        <span className="q-round-label">نتيجة الفرق</span>
        <Link className="q-btn q-btn--ghost" to="/">
          الرئيسية
        </Link>
      </div>
      <div
        className={!winner ? "q-card q-card--dark q-center" : "q-winner"}
        role="status"
      >
        {winner && <CrownIcon className="q-winner__crown" />}
        <h1 className="q-title">{title}</h1>
        {winner && (
          <span className={`q-badge q-badge--team-${winner.toLowerCase()}`}>
            {TEAM_NAMES[winner]}
          </span>
        )}
        {winner && winners.length > 0 && (
          <p className="q-winner__names">
            {winners.map((player) => player.name).join(" · ")}
          </p>
        )}
      </div>
      {!available && (
        <p className="q-alert q-alert--info">
          تفاصيل النتيجة غير متاحة بعد إعادة الاتصال.
        </p>
      )}
      {state.board?.length === 16 && (
        <TeamBoard board={state.board} line={state.line} />
      )}
      <TeamStrip
        team={team}
        label="مربعات ونقاط الفرق"
        values={state.squares}
        fallback="—"
        notes={
          state.teamPoints
            ? { A: `${state.teamPoints.A ?? 0} نقطة`, B: `${state.teamPoints.B ?? 0} نقطة` }
            : undefined
        }
      />
      {isHost ? (
        <button
          type="button"
          className="q-btn q-btn--primary q-btn--lg q-btn--block"
          disabled={busy}
          onClick={onAgain}
        >
          العب مرة ثانية
        </button>
      ) : (
        <p className="q-muted q-dots" role="status">
          انتظر المضيف يعيد اللعبة
        </p>
      )}
    </>
  );
}
