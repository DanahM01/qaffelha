/**
 * /sim-phone-tv — نسخة ثانية من محاكي الجوال: نفس الشاشات بس التلفزيون رجع في الأماكن اللي تناسبه
 * (الرئيسية، لقيت الغرفة، الانتظار، العد، نجوت!، المضيف، باركود اللوبي). النسخة الأولى: /sim-phone
 * أنتِ اللاعب: تكتبين إجابات حقيقية، واللاعبين الثانيين «وهميين» يجاوبون لحالهم.
 * جربي:  كود غرفة غلط (أي كود غير QAFL) · الاسم «ريف» مأخوذ · الكود OLD1 = اللعبة بدأت
 * لوحة المحاكاة الصغيرة بالزاوية للتجربة بس — مو جزء من التصميم.
 */
import { useEffect, useRef, useState } from "react";
import "./theme.css";
import Logo, { LockIcon, XIcon, CheckIcon, CrownIcon, DoorIcon, EyeIcon, SendIcon, UsersIcon } from "./Logo.jsx";
import { Home, HostLobby, PhoneHostName, PhoneHostLobby, Avatar, PhoneBack, PhoneTag, PhoneTvBox } from "./Preview.jsx";
import { CATEGORIES, ROUND_SECONDS, AR } from "./Sim.jsx";

const ROOM = "QAFL";
const BOTS = ["ريف", "لين", "رناد", "ليان"];
const norm = (w) => w.trim().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");

function useTicker(active, ms, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [active, ms]);
}

/* ---------- قطع مشتركة ---------- */
const MIN_SLOTS = 6;
function PlayersGrid({ players, meId }) {
  const slots = Math.max(0, MIN_SLOTS - players.length);
  return (
    <div className="q-m-players">
      {players.map((p) => (
        <span key={p.id} className={`q-player-chip ${p.id === meId ? "is-me" : ""}`}><Avatar p={p} /><span>{p.name}</span>{p.host && <CrownIcon />}</span>
      ))}
      {Array.from({ length: slots }, (_, i) => <span key={`s${i}`} className="q-slot">{i === 0 ? "بانتظار…" : ""}</span>)}
    </div>
  );
}
function RoomTiles({ size }) {
  return (
    <div className="q-room-code" aria-label={`كود الغرفة ${ROOM.split("").join(" ")}`}>
      {ROOM.split("").map((c, i) => <span key={i} className="q-room-code__char" style={size ? { fontSize: size } : undefined}>{c}</span>)}
    </div>
  );
}

/* ---------- الشاشات ---------- */
function CodeSlots({ value, onChange, invalid }) {
  const chars = value.toUpperCase().slice(0, 4).split("");
  return (
    <div className={`q-m-code ${invalid ? "is-invalid" : ""}`}>
      <label className="q-label" htmlFor="pc">كود الغرفة</label>
      <div className="q-m-code__slots">
        <input id="pc" maxLength={4} autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" value={value} onChange={(e) => onChange(e.target.value.replace(/\s/g, ""))} aria-invalid={invalid} />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden="true" className={`q-m-code__tile ${chars[i] ? "is-filled" : ""} ${i === Math.min(chars.length, 3) && !chars[3] ? "is-next" : ""}`}>
            {chars[i] && <span key={chars[i] + i}>{chars[i]}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export function JoinCode({ onJoin, onBack }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState({});
  const submit = (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (c === "OLD1") return setErr({ alert: "اللعبة بدأت. انتظر الجولة الجاية أو اطلب من المضيف غرفة جديدة." });
    if (c !== ROOM) return setErr({ code: "الغرفة مو موجودة. تأكد من الكود عند المضيف." });
    if (!n) return setErr({ name: "اكتب اسمك." });
    if (BOTS.includes(n)) return setErr({ name: "الاسم مأخوذ، جرّب اسم ثاني." });
    onJoin(n);
  };
  return (
    <form className="q-m" onSubmit={submit} noValidate>
      <div className="q-m-bar"><PhoneBack onClick={onBack} /><Logo size={30} /></div>
      <div className="q-m-hero" style={{ alignItems: "stretch", gap: "var(--q-space-5)" }}>
        <div className="q-m-head" style={{ textAlign: "center" }}>
          <span className="q-m-eyebrow">الكود عند المضيف</span>
          <h1 className="q-m-title">ادخل الغرفة</h1>
        </div>
        {err.alert && <div className="q-alert" role="alert"><LockIcon />{err.alert}</div>}
        <div className="q-stack" style={{ gap: "var(--q-space-2)" }}>
          <CodeSlots value={code} onChange={(v) => { setCode(v); setErr({}); }} invalid={!!err.code} />
          {err.code && <span className="q-field__error" role="alert"><XIcon />{err.code}</span>}
        </div>
        <div className={`q-field ${err.name ? "is-invalid" : ""}`}>
          <label className="q-label" htmlFor="pn">اسمك</label>
          <input id="pn" className="q-input" placeholder="مثلاً: دانة" maxLength={12} autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); setErr({}); }} aria-invalid={!!err.name} />
          {err.name && <span className="q-field__error" role="alert"><XIcon />{err.name}</span>}
        </div>
      </div>
      <button className="q-btn q-btn--primary q-btn--lg q-btn--block" type="submit">ادخل</button>
    </form>
  );
}

function JoinQr({ onJoin, onBack }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setErr("اكتب اسمك.");
    if (BOTS.includes(n)) return setErr("الاسم مأخوذ، جرّب اسم ثاني.");
    onJoin(n);
  };
  return (
    <form className="q-m q-m-found" onSubmit={submit} noValidate>
      <div className="q-m-bar"><PhoneBack onClick={onBack} /><PhoneTag live>CH 01 · {ROOM}</PhoneTag></div>
      <div className="q-m-hero">
        <PhoneTvBox className="q-m-tv--lg">
          <div className="q-stack q-center q-tv-on" style={{ gap: "var(--q-space-2)" }}>
            <span className="q-m-ticket">لقيت الغرفة!</span>
            <RoomTiles size="2rem" />
          </div>
        </PhoneTvBox>
      </div>
      <h1 className="q-m-title" style={{ textAlign: "center" }}>وش اسمك؟</h1>
      <div className={`q-field ${err ? "is-invalid" : ""}`}>
        <label className="q-sr-only" htmlFor="qn">اسمك</label>
        <input id="qn" className="q-input q-m-name" placeholder="اكتب اسمك" maxLength={12} autoComplete="off" autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} aria-invalid={!!err} />
        {err && <span className="q-field__error" role="alert" style={{ justifyContent: "center" }}><XIcon />{err}</span>}
      </div>
      <button className="q-btn q-btn--primary q-btn--lg q-btn--block" type="submit">ادخل</button>
    </form>
  );
}

export function Waiting({ players, meId }) {
  return (
    <div className="q-m">
      <div className="q-m-bar"><Logo size={30} /><PhoneTag live>CH 01 · {ROOM}</PhoneTag></div>
      <div className="q-m-hero">
        <PhoneTvBox className="q-m-tv--sm">
          <div className="q-stack q-center" style={{ gap: "var(--q-space-2)" }}>
            <span className="q-m-onair"><i />على الهوا</span>
            <h1 className="q-m-title q-m-title--md">دخلت! انتظر المضيف يبدأ</h1>
          </div>
        </PhoneTvBox>
      </div>
      <div className="q-stack" style={{ gap: "var(--q-space-2)" }}>
        <span className="q-m-section-label">اللاعبين <b className="q-ltr">{players.length}</b></span>
        <PlayersGrid players={players} meId={meId} />
      </div>
      <div className="q-m-rules">
        <span className="q-round-label q-m-rules__title">طريقة اللعب</span>
        <ol>
          <li><span className="q-step__n">١</span>الفئة تطلع، وعندك ٢٠ ثانية</li>
          <li><span className="q-step__n">٢</span>اكتب كلمة من الفئة قبل غيرك <em className="is-plus">+1</em></li>
          <li><span className="q-step__n">٣</span>تكتب كلمة أحد قفّلها قبلك <em className="is-minus">−1</em></li>
          <li><span className="q-step__n">٤</span>أقل واحد بالنقاط يطلع</li>
        </ol>
      </div>
    </div>
  );
}

function PhoneCountdown({ n, round }) {
  return (
    <div className="q-m q-m-count">
      <div className="q-m-hero">
        <span className="q-round-label">الجولة {AR(round)}</span>
        <PhoneTvBox className="q-m-tv--lg">
          <span key={n} className="q-m-count__n">{AR(n)}</span>
        </PhoneTvBox>
        <span className="q-m-ticket">جهّز أصابعك…</span>
      </div>
    </div>
  );
}

const FB = {
  correct: { pts: "+1", msg: "صح! قفّلتها عليهم" },
  locked: { pts: "−1", msg: "مقفولة! أحد سبقك عليها" },
  wrong: { pts: "0", msg: "مو من الفئة، جرّب غيرها" },
  repeat: { pts: "0", msg: "كتبتها قبل، ما تنحسب مرتين" },
};
function PhoneRound({ round, category, seconds, locked, me, rank, alive, leader, feedback, spectating, onAnswer }) {
  const cls = seconds <= 5 ? "is-danger" : seconds <= 10 ? "is-warn" : "";
  const [val, setVal] = useState("");
  const inputRef = useRef(null);
  const submit = (e) => {
    e.preventDefault();
    if (!val.trim()) return;
    onAnswer(val);
    setVal("");
    inputRef.current?.focus();
  };
  return (
    <form className={`q-m q-m-round ${seconds <= 5 && seconds > 0 ? "is-danger" : ""}`} onSubmit={submit}>
      <div className={`q-timer q-m-round__top ${cls}`}>
        <span className="q-round-label">الجولة {AR(round)}</span>
        <span className="q-timer__num" role="timer" aria-label={`باقي ${seconds} ثانية`}>{String(seconds).padStart(2, "0")}</span>
      </div>
      <h1 className="q-category" key={category}>{category}</h1>
      <div className={`q-timer ${cls}`} style={{ "--q-progress": seconds / ROUND_SECONDS }}>
        <div className="q-timer__track"><div className="q-timer__fill" /></div>
      </div>

      {spectating ? (
        <div className="q-m-me">
          <span>باقين<b>{alive}</b></span>
          <span className="is-name">المتصدر<b>{leader}</b></span>
        </div>
      ) : (
        <div className="q-m-me">
          <span>نقاطي<b>{me.score}</b></span>
          <span className={rank === alive && alive > 1 ? "is-danger" : ""}>ترتيبي<b>{rank}/{alive}</b></span>
        </div>
      )}

      <div className="q-m-wall">
        <span className="q-m-section-label">انقفلت <b>{locked.length}</b></span>
        <div className="q-m-wall__list">
          {locked.length === 0 && <span className="q-m-wall__empty"><LockIcon />ما انقفل شي للحين… كن أول واحد</span>}
          {[...locked].reverse().map((l) => (
            <span key={l.word} className="q-lock-chip"><LockIcon className="q-lock-chip__icon" />{l.word}<span className="q-lock-chip__by">{l.by}</span></span>
          ))}
        </div>
      </div>

      <div className="q-m-dock">
        <div aria-live="polite">
          {feedback && !spectating && (
            <div key={feedback.k} className={`q-feedback q-feedback--${feedback.kind} q-m-toast`}>
              <span className="q-feedback__pts">{FB[feedback.kind].pts}</span>
              <div className="q-stack" style={{ gap: 0 }}>
                <span className="q-feedback__word">{feedback.word}</span>
                <span className="q-feedback__msg">{FB[feedback.kind].msg}</span>
              </div>
            </div>
          )}
        </div>
        {spectating ? (
          <div className="q-spectate"><EyeIcon />طلعت من اللعبة، تتفرج على الجولة</div>
        ) : (
          <div className="q-answer-bar">
            <label className="q-sr-only" htmlFor="ans">إجابتك</label>
            <input id="ans" ref={inputRef} className="q-input q-input--answer" placeholder="اكتب كلمة…" autoComplete="off" enterKeyHint="send" autoFocus value={val} onChange={(e) => setVal(e.target.value)} disabled={seconds === 0} />
            <button className="q-btn q-btn--primary" aria-label="إرسال" disabled={seconds === 0}><SendIcon size="1.4em" /></button>
          </div>
        )}
      </div>
    </form>
  );
}

function RoundRanking({ ranking, meId, outId, showScore = true }) {
  return (
    <div className="q-flap q-m-flap" role="list">
      {ranking.map((p, i) => (
        <div key={p.id} role="listitem" className={`q-flap__row ${p.id === outId ? "is-danger" : i === 0 ? "is-leader" : ""} ${p.id === meId ? "is-me" : ""}`} style={showScore ? undefined : { gridTemplateColumns: "2.1em 1fr" }}>
          <span className="q-flap__tile"><span style={{ animationDelay: `${i * 110}ms` }}>{i + 1}</span></span>
          <span className="q-flap__tile q-flap__tile--name"><span style={{ animationDelay: `${i * 110 + 50}ms` }}>{p.name}{p.id === meId ? " (أنت)" : ""}</span></span>
          {showScore && <span className="q-flap__tile q-flap__tile--digit"><span style={{ animationDelay: `${i * 110 + 100}ms` }}>{p.score}</span></span>}
        </div>
      ))}
    </div>
  );
}

function PhoneRoundEnd({ round, me, meId, ranking, alive, outPlayer, iAmOut, wasOutBefore }) {
  const out = iAmOut && !wasOutBefore;
  return (
    <div className="q-m q-m-end">
      <div className="q-m-bar"><span className="q-round-label">انتهت الجولة {AR(round)}</span><Logo size={30} /></div>
      {out ? (
        <div className="q-m-hero q-m-out">
          <DoorIcon className="q-m-out__icon" />
          <h1 className="q-m-title q-m-title--xl">طلعت!</h1>
          <span className="q-m-sub">جبت {AR(me.score)} {Math.abs(me.score) === 1 ? "نقطة" : "نقاط"}، تقدر تكمل تتفرج</span>
        </div>
      ) : wasOutBefore ? (
        <div className="q-m-hero">
          <EyeIcon className="q-m-out__icon" />
          <h1 className="q-m-title">طلع {outPlayer.name}</h1>
          <span className="q-m-sub">{alive === 1 ? "باقي لاعب واحد، هو البطل!" : `باقي ${AR(alive)} لاعبين`}</span>
        </div>
      ) : (
        <div className="q-m-hero">
          <PhoneTvBox className="q-m-tv--md">
            <div className="q-stack q-center q-tv-on" style={{ gap: "var(--q-space-1)" }}>
              <h1 className="q-m-title q-m-title--lg">نجوت!</h1>
              <span className="q-stamp">طلع {outPlayer.name}</span>
            </div>
          </PhoneTvBox>
        </div>
      )}
      <span className="q-m-section-label">ترتيب الجولة</span>
      <RoundRanking ranking={ranking} meId={meId} outId={outPlayer.id} />
      <p className="q-m-footnote q-dots">الجولة الجاية بعد شوي</p>
    </div>
  );
}

function PhoneResults({ order, meId, isHost, onAgain, onHome }) {
  const place = order.findIndex((p) => p.id === meId) + 1;
  const winner = order[0];
  const iWon = place === 1;
  return (
    <div className="q-m q-m-results">
      <div className="q-m-bar"><span className="q-round-label">النتائج</span><button type="button" className="q-m-link" onClick={onHome}><span>الرئيسية</span></button></div>
      <div className="q-m-hero q-m-hero--rise">
        <div className="q-m-sun" />
        <CrownIcon className="q-winner__crown" />
        <span className="q-m-eyebrow">{iWon ? "مبروك!" : "البطل"}</span>
        <h1 className="q-m-title q-m-title--xl">{iWon ? "أنت البطل" : winner.name}</h1>
      </div>
      {!iWon && (
        <div className="q-m-me">
          <span>مركزك<b>{place}/{order.length}</b></span>
          <span>طلعت بالجولة<b>{order[place - 1]?.outRound ?? "-"}</b></span>
        </div>
      )}
      <div className="q-m-results__list q-flap q-m-flap" role="list">
        {order.map((p, i) => (
          <div key={p.id} role="listitem" className={`q-flap__row ${i === 0 ? "is-leader" : ""} ${p.id === meId ? "is-me" : ""}`} style={{ gridTemplateColumns: "2.1em 1fr" }}>
            <span className="q-flap__tile"><span style={{ animationDelay: `${i * 120}ms` }}>{i + 1}</span></span>
            <span className="q-flap__tile q-flap__tile--name"><span style={{ animationDelay: `${i * 120 + 60}ms` }}>{p.name}{p.id === meId ? " (أنت)" : ""}</span></span>
          </div>
        ))}
      </div>
      {isHost ? (
        <button className="q-btn q-btn--primary q-btn--lg q-btn--block" onClick={onAgain}>العب مرة ثانية</button>
      ) : (
        <p className="q-m-footnote q-dots">إذا المضيف عاد اللعبة، تدخل معهم على طول</p>
      )}
    </div>
  );
}

function Note({ title, text, onBack }) {
  return (
    <div className="q-m">
      <div className="q-m-bar"><PhoneBack onClick={onBack} /><Logo size={30} /></div>
      <div className="q-m-hero q-m-hero--rise">
        <div className="q-m-sun" />
        <h1 className="q-m-title">{title}</h1>
        <p className="q-m-ticket" style={{ whiteSpace: "normal", maxWidth: "30ch", lineHeight: 1.6 }}>{text}</p>
      </div>
      <button className="q-btn q-btn--primary q-btn--lg q-btn--block" onClick={onBack}>رجوع</button>
    </div>
  );
}

/* ---------- المحاكي ---------- */
export default function PhoneSimTv() {
  const [screen, setScreen] = useState("home");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]); // {id,name,score,lastCorrect,host?}
  const [meId, setMeId] = useState(null);
  const [out, setOut] = useState([]);
  const [round, setRound] = useState(1);
  const [count, setCount] = useState(3);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [locked, setLocked] = useState([]); // {word, n, by, byId}
  const [feedback, setFeedback] = useState(null);
  const [lastOut, setLastOut] = useState(null);
  const [outBefore, setOutBefore] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [cats, setCats] = useState(() => [...CATEGORIES].sort(() => Math.random() - 0.5));
  const category = cats[(round - 1) % cats.length];

  useEffect(() => { document.documentElement.dir = "rtl"; document.documentElement.lang = "ar"; document.title = "قفّلها · محاكي الجوال (تلفزيون)"; }, []);

  const isOut = (id) => out.some((o) => o.id === id);
  const alive = players.filter((p) => !isOut(p.id));
  const me = players.find((p) => p.id === meId) || { score: 0 };
  const sortedAlive = [...alive].sort((a, b) => b.score - a.score || a.lastCorrect - b.lastCorrect);
  const myRank = Math.max(1, sortedAlive.findIndex((p) => p.id === meId) + 1);

  function join(name, host = false) {
    setIsHost(host);
    setPlayers([{ id: 1, name, score: 0, lastCorrect: 0, host }]);
    setMeId(1);
    setScreen(host ? "host-lobby" : "wait");
  }

  // البوتات يدخلون
  useTicker((screen === "wait" || screen === "host-lobby") && players.length < BOTS.length + 1, 1400 / speed, () => {
    setPlayers((ps) => (ps.length > BOTS.length ? ps : [...ps, { id: ps.length + 1, name: BOTS[ps.length - 1], score: 0, lastCorrect: 0 }]));
  });
  // المضيف (وهمي) يبدأ لما يكتملون — في نمط اللاعب
  useEffect(() => {
    if (screen !== "wait" || players.length <= BOTS.length) return undefined;
    const t = setTimeout(() => startGame(), 2500 / speed);
    return () => clearTimeout(t);
  }, [screen, players.length, speed]);

  function startGame() {
    setOut([]); setRound(1); setLastOut(null); setOutBefore(false);
    setCats([...CATEGORIES].sort(() => Math.random() - 0.5));
    setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, lastCorrect: 0 })));
    setCount(3); setScreen("countdown");
  }

  // العد التنازلي
  useTicker(screen === "countdown" && count > 0, 900 / speed, () => setCount((c) => c - 1));
  useEffect(() => {
    if (screen === "countdown" && count === 0) { setSeconds(ROUND_SECONDS); setLocked([]); setFeedback(null); setScreen("round"); }
  }, [screen, count]);

  // الوقت
  useTicker(screen === "round" && seconds > 0, 1000 / speed, () => setSeconds((s) => Math.max(0, s - 1)));
  useEffect(() => { if (screen === "round" && seconds === 0) endRound(); }, [screen, seconds]);

  // البوتات يجاوبون
  useTicker(screen === "round" && seconds > 0, 1700 / speed, () => {
    const bots = alive.filter((p) => p.id !== meId);
    if (!bots.length) return;
    const who = bots[Math.floor(Math.random() * bots.length)];
    const free = category.words.filter((w) => !locked.some((l) => l.n === norm(w)));
    if (Math.random() < 0.2 && locked.length) {
      setPlayers((ps) => ps.map((p) => (p.id === who.id ? { ...p, score: p.score - 1 } : p)));
    } else if (free.length && Math.random() < 0.75) {
      const word = free[Math.floor(Math.random() * free.length)];
      setLocked((ls) => [...ls, { word, n: norm(word), by: who.name, byId: who.id }]);
      setPlayers((ps) => ps.map((p) => (p.id === who.id ? { ...p, score: p.score + 1, lastCorrect: ROUND_SECONDS - seconds } : p)));
    }
  });

  function answer(raw) {
    const n = norm(raw);
    const hit = category.words.find((w) => norm(w) === n);
    let kind = "wrong";
    if (hit) {
      const l = locked.find((x) => x.n === n);
      if (!l) {
        kind = "correct";
        setLocked((ls) => [...ls, { word: hit, n, by: me.name, byId: meId }]);
        setPlayers((ps) => ps.map((p) => (p.id === meId ? { ...p, score: p.score + 1, lastCorrect: ROUND_SECONDS - seconds } : p)));
      } else if (l.byId === meId) {
        kind = "repeat";
      } else {
        kind = "locked";
        setPlayers((ps) => ps.map((p) => (p.id === meId ? { ...p, score: p.score - 1 } : p)));
      }
    }
    setFeedback({ kind, word: hit || raw.trim(), k: Math.random() });
  }

  function endRound() {
    if (screen !== "round") return;
    const loser = [...alive].sort((a, b) => a.score - b.score || b.lastCorrect - a.lastCorrect)[0];
    setOutBefore(isOut(meId));
    setLastOut(loser);
    setOut((o) => [...o, { ...loser, outRound: round }]);
    setScreen("round-end");
  }

  // بعد نهاية الجولة: تلقائي للجولة الجاية أو النتائج
  useEffect(() => {
    if (screen !== "round-end") return undefined;
    const t = setTimeout(() => {
      if (alive.length <= 1) { setScreen("results"); return; }
      setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, lastCorrect: 0 })));
      setRound((r) => r + 1); setCount(3); setScreen("countdown");
    }, 6000);
    return () => clearTimeout(t);
  }, [screen, alive.length, speed]);

  function home() { setScreen("home"); setPlayers([]); setMeId(null); setOut([]); setIsHost(false); }

  const order = [...alive, ...[...out].reverse()];
  const iAmOut = isOut(meId);

  let view = null;
  if (screen === "home") view = <Home tv onJoin={() => setScreen("join-code")} onBigScreen={() => { setPlayers([]); setScreen("big-lobby"); }} onPhones={() => setScreen("host-name")} />;
  // «العب على شاشة كبيرة» من الجوال: تنفتح غرفة وهذا الجوال نفسه يصير الشاشة الكبيرة
  if (screen === "big-lobby") view = <HostLobby players={[]} joinUrl={`${window.location.host}/play`} />;
  if (screen === "join-code") view = <JoinCode onJoin={(n) => join(n)} onBack={home} />;
  if (screen === "join-qr") view = <JoinQr onJoin={(n) => join(n)} onBack={home} />;
  if (screen === "host-name") view = <PhoneHostName tv onBack={home} onOpen={(n) => join(n, true)} />;
  if (screen === "host-lobby") view = <PhoneHostLobby tv players={players.map((p) => ({ ...p }))} onStart={startGame} />;
  if (screen === "wait") view = <Waiting players={players} meId={meId} />;
  if (screen === "countdown") view = <PhoneCountdown n={count} round={round} />;
  if (screen === "round") view = <PhoneRound round={round} category={category.name} seconds={seconds} locked={locked} me={me} rank={myRank} alive={alive.length} leader={sortedAlive[0]?.name} feedback={feedback} spectating={iAmOut} onAnswer={answer} />;
  if (screen === "round-end" && lastOut) view = <PhoneRoundEnd round={round} me={me} meId={meId} ranking={[...sortedAlive, lastOut].map((p) => players.find((x) => x.id === p.id) || p)} alive={alive.length} outPlayer={lastOut} iAmOut={iAmOut} wasOutBefore={outBefore} />;
  if (screen === "results") view = <PhoneResults order={order} meId={meId} isHost={isHost} onAgain={startGame} onHome={home} />;

  return (
    <div className="q-app" dir="rtl" lang="ar" style={{ minHeight: "100vh", padding: screen === "big-lobby" ? 0 : "1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {screen === "big-lobby"
        ? <div style={{ width: "100%", alignSelf: "stretch" }}>{view}</div> /* هذا الجهاز صار الشاشة الكبيرة: تاخذ الصفحة كاملة */
        : <div className="q-device" key={screen === "round" ? "round" : screen}>{view}</div>}

      {/* لوحة المحاكاة — للتجربة بس */}
      <div style={{ order: -1, ...(screen === "big-lobby" ? { position: "fixed", top: 8, zIndex: 100 } : {}), display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", maxWidth: 390, padding: "6px 8px", background: "rgb(0 0 0 / 0.6)", borderRadius: 8, fontSize: 12, color: "#fff", fontFamily: "system-ui" }}>
        <span>محاكاة</span>
        <button onClick={() => setSpeed((s) => (s === 1 ? 3 : 1))} style={{ fontSize: 12 }}>{speed === 1 ? "أسرع ×3" : "سرعة عادية"}</button>
        {screen === "home" && <button onClick={() => setScreen("join-qr")} style={{ fontSize: 12 }}>صوّرت الباركود</button>}
        {screen === "round" && <button onClick={() => setSeconds(0)} style={{ fontSize: 12 }}>أنهِ الجولة</button>}
        {screen === "round" && <span style={{ opacity: 0.8 }}>كلمات: {category.words.filter((w) => !locked.some((l) => l.n === norm(w))).slice(0, 4).join("، ")}…</span>}
        <button onClick={home} style={{ fontSize: 12 }}>من البداية</button>
      </div>
    </div>
  );
}
