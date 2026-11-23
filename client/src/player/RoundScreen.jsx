import { useRef, useState } from "react";
import { socket } from "../socket.js";
import { EyeIcon, LockIcon, ReactionSticker, REACTION_LABELS, SendIcon, SnowflakeIcon } from "../theme/Logo.jsx";
import useServerSeconds from "./useServerSeconds.js";
import { isSittingOut } from "./teamState.js";
import LockBadge from "../cards/LockBadge.jsx";

const MESSAGES = {
  correct: "صح! قفّلتها عليهم",
  locked: "مقفولة! أحد سبقك عليها",
  wrong: "مو من الفئة، جرّب غيرها",
  repeat: "كتبتها قبل، ما تنحسب مرتين",
  closed: "انتهى وقت الإجابة",
  frozen: "متجمّد! استنى ثواني",
};
const TEAM_NAMES = { A: "الفريق الأول", B: "الفريق الثاني" };
// Sticker reactions (EVENTS.md §7): only for players who are out or sitting out.
const REACTIONS = ["laugh", "fire", "shock"];
const REACTION_GAP_MS = 400;

function ReactionBar() {
  const [busy, setBusy] = useState(false);
  function send(reaction) {
    if (busy) return;
    setBusy(true);
    socket.emit("reaction:send", { reaction });
    setTimeout(() => setBusy(false), REACTION_GAP_MS);
  }
  return (
    <div className="q-react-bar" role="group" aria-label="تفاعل مع اللعب">
      {REACTIONS.map((reaction) => (
        <button
          key={reaction}
          type="button"
          className="q-react-btn"
          disabled={busy}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => send(reaction)}
        >
          <ReactionSticker kind={reaction} className="q-react-btn__sticker" />
          <span className="q-react-btn__label">{REACTION_LABELS[reaction]}</span>
        </button>
      ))}
    </div>
  );
}

export default function RoundScreen({
  state,
  meId,
  offset,
  feedback,
  disabled,
  onAnswer,
  onCard,
  cardBusy,
  cardNotice,
}) {
  const seconds = useServerSeconds(state.endsAt, offset);
  const frozenSeconds = useServerSeconds(state.frozenUntil, offset);
  const [text, setText] = useState("");
  const input = useRef(null);
  const scores = new Map(
    (state.scores || []).map((entry) => [entry.id, entry.score]),
  );
  const me = state.players.find((player) => player.id === meId);
  const sittingOut = state.gameMode === "teams" && isSittingOut(state, meId);
  const out =
    state.gameMode === "teams" ? sittingOut : me?.out || state.me?.out;
  const active = state.players.filter((player) => !player.out);
  const score = scores.get(meId) ?? state.me?.score ?? 0;
  const rank =
    1 + active.filter((player) => (scores.get(player.id) || 0) > score).length;
  const timerClass =
    seconds <= 5 ? "is-danger" : seconds <= 10 ? "is-warn" : "";
  const frozen = frozenSeconds > 0;
  const closed = disabled || seconds === 0 || out || frozen;
  // Freeze card (PB-16, SPEC §17.6): Team Mode only, during the battle, not in its last 3 seconds.
  const team = me?.team ?? state.me?.team ?? null;
  const teams = state.gameMode === "teams" && Boolean(team);
    const freezeLeft = state.cards?.[team]?.freeze ?? 1;
  const chooserId = state.sitout?.[team] ?? null;
  const sittingOut = chooserId;
  const mayPlayCard = !chooserId || chooserId === meId;
  const canReact = out || (teams && chooserId === meId);
  const canFreeze =
    teams && !disabled && !cardBusy && freezeLeft > 0 && mayPlayCard && !state.cardChoices?.[team] && seconds > 3;

  function submit(event) {
    event.preventDefault();
    if (closed || !text.trim()) return;
    onAnswer(text.trim());
    setText("");
    input.current?.focus();
  }
  return (
    <>
      <div className={`q-timer q-m-round__top ${timerClass}`}>
        <span className="q-round-label">الجولة {state.round}</span>
        <span
          className="q-timer__num"
          role="timer"
          aria-label={`باقي ${seconds} ثانية`}
        >
          {String(seconds).padStart(2, "0")}
        </span>
      </div>
      <h1 className="q-category">{state.category?.title}</h1>
      {teams && <LockBadge lockedBy={state.chosen?.lockedBy ?? state.lockedBy} />}
      <div
        className={`q-timer ${timerClass}`}
        style={{ "--q-progress": Math.min(seconds, 20) / 20 }}
        aria-hidden="true"
      >
        <div className="q-timer__track">
          <div className="q-timer__fill" />
        </div>
      </div>
      <div className="q-m-me">
        <span>
          نقاطي<b className="q-ltr">{score}</b>
        </span>
        <span>
          {out ? "باقين" : "ترتيبي"}
          <b className="q-ltr">
            {out ? active.length : `${rank}/${active.length}`}
          </b>
        </span>
      </div>
      <div className="q-m-wall">
        <span className="q-m-section-label">
          انقفلت <b>{state.locked?.length || 0}</b>
        </span>
        <div
          className="q-m-wall__list"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="الكلمات المقفولة"
        >
          {!state.locked?.length && (
            <span className="q-m-wall__empty">
              <LockIcon />
              ما انقفل شي للحين…
            </span>
          )}
          {[...(state.locked || [])].reverse().map((entry) => (
            <span className="q-lock-chip" key={entry.word}>
              <LockIcon className="q-lock-chip__icon" />
              {entry.word}
              <span className="q-lock-chip__by">{entry.by.name}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="q-m-dock">
        <div aria-live="polite" role="status">
          {cardNotice?.card === "freeze" && (
            <div key={cardNotice.sequence} className="q-card-notice q-m-toast">
              <SnowflakeIcon />
              <span>
                {cardNotice.target?.id === meId
                  ? `${cardNotice.by.name} جمّدك!`
                  : `${cardNotice.by.name} (${TEAM_NAMES[cardNotice.team]}) جمّد ${cardNotice.target?.name}`}
              </span>
            </div>
          )}
          {feedback && !out && (
            <div
              key={feedback.sequence}
              className={`q-feedback q-feedback--${["correct", "locked", "repeat", "frozen"].includes(feedback.result) ? feedback.result : "wrong"} q-m-toast`}
            >
              <span className="q-feedback__pts">
                {feedback.delta > 0
                  ? `+${feedback.delta}`
                  : feedback.delta < 0
                    ? `−${Math.abs(feedback.delta)}`
                    : "0"}
              </span>
              <div className="q-stack">
                <span className="q-feedback__word">{feedback.text}</span>
                <span className="q-feedback__msg">
                  {MESSAGES[feedback.result]}
                </span>
              </div>
            </div>
          )}
        </div>
                {canReact && <ReactionBar />}
        {teams && (
            <div className="q-card-play">
              <button
                type="button"
                className="q-btn q-btn--sm q-card-btn q-card-btn--freeze"
                disabled={!canFreeze}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => onCard("freeze")}
                aria-label="بطاقة التجميد: تجمّد أقوى لاعب في الخصم 3 ثواني"
              >
                <SnowflakeIcon />
                تجميد
                <span className="q-card-btn__left">
                  {freezeLeft > 0 ? "×1" : "انلعبت"}
                </span>
              </button>
            </div>
          )}
        {out ? (
          <p className="q-spectate">
            <EyeIcon />
            {sittingOut
              ? "ترتاح هالجولة — تتابع وتختار بطاقة فريقك"
              : "طلعت من اللعبة — تتفرج"}
          </p>
        ) : (
          <>

          <div className="q-frozen-wrap">
          {frozen && (
            <div className="q-frozen" role="alert">
              <SnowflakeIcon />
              <span>تجمّدت!</span>
              <span className="q-frozen__num q-ltr">{frozenSeconds}</span>
            </div>
          )}
          <form className="q-answer-bar" onSubmit={submit}>
            <label className="q-sr-only" htmlFor="answer">
              إجابتك
            </label>
            <input
              ref={input}
              id="answer"
              className="q-input q-input--answer"
              placeholder="اكتب كلمة…"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="send"
              autoFocus
              maxLength={200}
              value={text}
              readOnly={closed}
              aria-disabled={closed}
              onChange={(event) => setText(event.target.value)}
            />
            <button
              type="submit"
              className="q-btn q-btn--primary"
              aria-label="إرسال"
              disabled={closed || !text.trim()}
              onPointerDown={(event) => event.preventDefault()}
            >
              <SendIcon size="1.4em" />
            </button>
          </form>
          </div>
          </>
        )}
      </div>
    </>
  );
}
