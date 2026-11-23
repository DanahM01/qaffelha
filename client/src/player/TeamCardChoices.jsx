import { isSittingOut, myTeam } from "./teamState.js";
import useServerSeconds from "./useServerSeconds.js";

export const CARD_NAMES = {
  freeze: "تجميد",
  lock: "قفل",
  mine: "لغم",
  steal: "سرقة",
};

export default function TeamCardChoices({
  state,
  meId,
  offset,
  busy,
  onCard,
  targetCard,
  onCancel,
}) {
  const team = myTeam(state, meId);
  const frozenWindow = useServerSeconds(
    state.endsAt ? state.endsAt - 3000 : 0,
    offset,
  );
  const cardWindow = useServerSeconds(state.cardWindowEndsAt ?? state.chosen?.cardWindowEndsAt, offset);
  const turnWindow = useServerSeconds(state.turn?.endsAt, offset);
  if (!team || !["turn", "cardWindow", "round"].includes(state.status))
    return null;
  const out = isSittingOut(state, meId);
  const chooser = state.sitout?.[team];
  const permitted = !chooser || out;
  const finalChoice = chooser && state.cardChoices?.[team];
  const phase = {
    freeze: state.status === "round" && frozenWindow > 0,
    lock:
      state.status === "cardWindow" &&
      state.chosen?.team !== team &&
      cardWindow > 0,
    mine:
      state.turn?.team === team &&
      ((state.status === "turn" && turnWindow > 0) ||
        (state.status === "cardWindow" && cardWindow > 0)),
    steal:
      state.status === "turn" && state.turn?.team === team && turnWindow > 0,
  };
  return (
    <section className="q-team-cards" aria-label="بطاقات الفريق">
      <p className="q-team-cards__heading" role="status">
        {out
          ? "أنت تختار بطاقة فريقك"
          : permitted
            ? "بطاقات فريقك"
            : "البطاقة عند لاعب فريقك اللي يرتاح هالجولة"}
      </p>
      {permitted && (
        <div className="q-team-cards__buttons">
          {Object.entries(CARD_NAMES).filter(([card]) => card !== "freeze").map(([card, title]) => (
            <button
              type="button"
              className="q-btn"
              key={card}
              disabled={
                busy ||
                Boolean(finalChoice) ||
                !phase[card] ||
                !(state.cards?.[team]?.[card] > 0)
              }
              onClick={() => onCard(card)}
              aria-label={`${title}، المتبقي ${state.cards?.[team]?.[card] ?? 0}`}
            >
              {title}
              <span className="q-ltr">{state.cards?.[team]?.[card] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      {finalChoice && (
        <p className="q-muted" role="status">
          اختيارك: {CARD_NAMES[finalChoice]} — تم تثبيته لهالجولة
        </p>
      )}
      {targetCard && (
        <div className="q-spread">
          <p role="status">
            اختار {targetCard === "mine" ? "مربع حر للغم" : "مربع للخصم للسرقة"}
          </p>
          <button className="q-btn" type="button" onClick={onCancel}>
            إلغاء
          </button>
        </div>
      )}
    </section>
  );
}
