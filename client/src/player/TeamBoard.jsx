import { TEAM_NAMES } from "./teamState.js";

export default function TeamBoard({
  board = [],
  selectable = false,
  onChoose,
  line = [],
  mines = [],
  chosenId,
  targets,
}) {
  const byId = new Map(board.map((square) => [square.id, square]));
  return (
    <div
      className="q-team-board"
      role="group"
      aria-label="لوحة الفئات، أربعة صفوف وأربعة أعمدة"
    >
      {Array.from({ length: 16 }, (_, id) => {
        const square = byId.get(id);
        const allowed =
          square &&
          selectable &&
          (targets ? targets.includes(id) : square.owner === null);
        const winning = line?.includes(id);
        const mine = mines.includes(id);
        const owner = TEAM_NAMES[square?.owner] || "مربع حر";
        return (
          <button
            type="button"
            key={id}
            className={`q-btn q-team-board__tile ${square?.owner ? `is-team-${square.owner.toLowerCase()}` : ""} ${winning ? "is-winning" : ""} ${chosenId === id ? "is-chosen" : ""}`}
            disabled={!allowed}
            onClick={() => onChoose?.(id)}
            dir="rtl"
            aria-label={`صف ${Math.floor(id / 4) + 1}، عمود ${(id % 4) + 1}: ${square?.category?.title || "بانتظار الفئة"}، ${owner}${winning ? "، خط الفوز" : ""}${mine ? "، لغم فريقك" : ""}`}
          >
            <span className="q-team-board__title">
              {square?.category?.title || "…"}
            </span>
            <span className="q-team-board__owner">
              {owner}
              {mine ? " · لغم" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
