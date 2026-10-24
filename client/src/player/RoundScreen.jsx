import { useRef, useState } from "react";
import { EyeIcon, LockIcon, SendIcon } from "../theme/Logo.jsx";
import useServerSeconds from "./useServerSeconds.js";

const MESSAGES = {
  correct: "صح! قفّلتها عليهم",
  locked: "مقفولة! أحد سبقك عليها",
  wrong: "مو من الفئة، جرّب غيرها",
  repeat: "كتبتها قبل، ما تنحسب مرتين",
  closed: "انتهى وقت الإجابة",
};

export default function RoundScreen({
  state,
  meId,
  offset,
  feedback,
  disabled,
  onAnswer,
}) {
  const seconds = useServerSeconds(state.endsAt, offset);
  const [text, setText] = useState("");
  const input = useRef(null);
  const scores = new Map(
    (state.scores || []).map((entry) => [entry.id, entry.score]),
  );
  const me = state.players.find((player) => player.id === meId);
  const out = me?.out || state.me?.out;
  const active = state.players.filter((player) => !player.out);
  const score = scores.get(meId) ?? state.me?.score ?? 0;
  const rank =
    1 + active.filter((player) => (scores.get(player.id) || 0) > score).length;
  const timerClass =
    seconds <= 5 ? "is-danger" : seconds <= 10 ? "is-warn" : "";
  const closed = disabled || seconds === 0 || out;

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
          {feedback && !out && (
            <div
              key={feedback.sequence}
              className={`q-feedback q-feedback--${["correct", "locked", "repeat"].includes(feedback.result) ? feedback.result : "wrong"} q-m-toast`}
            >
              <span className="q-feedback__pts">
                {feedback.delta > 0 ? "+1" : feedback.delta < 0 ? "−1" : "0"}
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
        {out ? (
          <p className="q-spectate">
            <EyeIcon />
            طلعت من اللعبة — تتفرج
          </p>
        ) : (
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
        )}
      </div>
    </>
  );
}
