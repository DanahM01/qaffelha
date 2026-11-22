import TeamBoard from "./TeamBoard.jsx";
import { TEAM_NAMES, myTeam, isSittingOut } from "./teamState.js";
import useServerSeconds from "./useServerSeconds.js";

export default function TeamBoardScreen({
  state,
  meId,
  offset,
  busy,
  onChoose,
  children,
  targets,
}) {
  const team = myTeam(state, meId);
  const window = state.status === "cardWindow";
  const seconds = useServerSeconds(
    window ? (state.cardWindowEndsAt ?? state.chosen?.cardWindowEndsAt) : state.turn?.endsAt,
    offset,
  );
  const sittingOut = isSittingOut(state, meId);
  const choosing =
    state.status === "turn" &&
    state.turn?.team === team &&
    !sittingOut &&
    seconds > 0 &&
    !busy;
  const result = state.battleResult;
  const title =
    state.status === "battleEnd"
      ? result?.winnerTeam === null
        ? "ما أحد أخذ المربع"
        : result?.winnerTeam === team
          ? "فريقك أخذ المربع!"
          : "الخصم أخذ المربع"
      : window
        ? "ينتظر بطاقات…"
        : `دور ${TEAM_NAMES[state.turn?.team] || "الفريق"}`;
  return (
    <>
      <h1 className="q-team-heading" role="status">
        {title}
      </h1>
      {state.status !== "battleEnd" && (
        <span
          className="q-team-deadline"
          role="timer"
          aria-label={`باقي ${seconds} ثانية`}
        >
          <b>{seconds}</b> ثواني
        </span>
      )}
      <div className="q-m-me">
        <span>
          نقاط الأول<b>{state.teamPoints?.A ?? 0}</b>
        </span>
        <span>
          نقاط الثاني<b>{state.teamPoints?.B ?? 0}</b>
        </span>
      </div>
      <TeamBoard
        board={state.board}
        mines={state.mines}
        chosenId={state.chosen?.squareId}
        selectable={targets ? !busy && targets.length > 0 : choosing}
        targets={targets}
        onChoose={onChoose}
      />
      {children}
    </>
  );
}
