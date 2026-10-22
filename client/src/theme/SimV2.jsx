/**
 * /sim-v2 — نسخة ثانية من محاكي الشاشة الكبيرة (النسخة الأولى: /sim ما تغيّرت)
 * التعديلات:
 *  ١) «طلع!» صارت لحظة كاملة: الاسم ضخم وعليه الختم، وشمس حمرا «تغيب» وراه (الفائز شمسه تطلع، اللي طلع شمسه تغيب).
 *  ٢) الكلمات المقفولة تعبّي مكانها: تبدأ كبيرة وتصغر شوي كل ما زادت.
 *  ٣) لوحة النقاط: الأحمر بس على اللي بيطلع فعلاً (نفس قاعدة التعادل)، والنقاط بلاطة وحدة بدون صفر قدام الرقم.
 *  ٤) اللوبي: زر «ابدأ» كبير وواضح.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./theme.css";
import Logo, { LockIcon, UsersIcon } from "./Logo.jsx";
import { Home, PhoneHostName, PhoneHostLobby, Avatar, QrPlaceholder } from "./Preview.jsx";
import { JoinCode, Waiting } from "./PhoneSim.jsx";
import { NAMES, CATEGORIES, ROUND_SECONDS, AR, Countdown, Results } from "./Sim.jsx";

const ROOM = "QAFL";
const JOIN_URL = typeof window !== "undefined" ? `${window.location.host}/play` : "/play";

function useTicker(active, ms, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [active, ms]);
}

/* نفس قاعدة الطلوع: الأقل نقاط، والتعادل يطلع اللي آخر إجابة صحيحة له أبطأ */
const pickLoser = (ps) => [...ps].sort((a, b) => a.score - b.score || b.lastCorrect - a.lastCorrect)[0];

/* ---------------- القلّابات (نسخة ٢) ---------------- */
function FlapBoardV2({ players, dangerId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.lastCorrect - b.lastCorrect || a.id - b.id);
  const leaderId = sorted[0] && sorted[0].score > 0 && (sorted.length < 2 || sorted[0].score > sorted[1].score) ? sorted[0].id : null;
  const prev = useRef({});
  const moves = {};
  sorted.forEach((p, i) => { const was = prev.current[p.id]; moves[p.id] = was === undefined ? 0 : was - i; });
  useEffect(() => { const m = {}; sorted.forEach((p, i) => { m[p.id] = i; }); prev.current = m; });
  return (
    <div className="q-flap q-flap--v2">
      {sorted.map((p, i) => (
        <div key={p.id} className={`q-flap__row ${p.id === dangerId ? "is-danger" : p.id === leaderId ? "is-leader" : ""}`}>
          <span className={`q-flap__move ${moves[p.id] > 0 ? "q-flap__move--up" : moves[p.id] < 0 ? "q-flap__move--down" : ""}`} aria-hidden="true">{moves[p.id] > 0 ? "▲" : moves[p.id] < 0 ? "▼" : ""}</span>
          <span className="q-flap__tile"><span key={i + p.name}>{i + 1}</span></span>
          <span className="q-flap__tile q-flap__tile--name"><span key={p.name + i}>{p.name}</span></span>
          <span className="q-flap__tile q-flap__tile--score"><span key={`${p.id}-${p.score}`}>{p.score < 0 ? `−${Math.abs(p.score)}` : p.score}</span></span>
        </div>
      ))}
    </div>
  );
}

function Board({ players, title, dangerId }) {
  return (
    <div className="q-stack" style={{ gap: "0.6em", fontSize: "var(--q-fs-tv-label)" }}>
      <span className="q-tv-label" style={{ color: "var(--q-text)" }}>{title}</span>
      <FlapBoardV2 players={players} dangerId={dangerId} />
    </div>
  );
}

/* ---------------- الشاشات ---------------- */
function HostLobbyV2({ players, onStart }) {
  const MIN = 3;
  const ready = players.length >= MIN;
  const slots = Math.max(0, 6 - players.length);
  return (
    <div className="q-screen-host q-host-fit q-lobby-v2">
      <div className="q-static" />
      <div className="q-spread">
        <Logo size="3.6vw" />
        <span className="q-channel__tag" style={{ position: "static", fontSize: "var(--q-fs-tv-label)" }}>CH 01 · الغرفة مفتوحة</span>
      </div>
      <div className="q-lobby">
        <div className="q-stack" style={{ gap: "min(3.4vh, 2rem)" }}>
          <h1 className="q-lobby__title">صوّر وادخل!</h1>
          <ol className="q-steps">
            <li><span className="q-step__n">١</span>افتح كاميرا جوالك</li>
            <li><span className="q-step__n">٢</span>صوّر الباركود</li>
            <li><span className="q-step__n">٣</span>اكتب اسمك وادخل</li>
          </ol>
          <div className="q-row" style={{ gap: "0.8em", fontSize: "var(--q-fs-tv-label)", color: "var(--q-text-muted)", fontWeight: 800 }}>
            <span>الكاميرا ما تشتغل؟ ادخل</span>
            <span className="q-ltr" style={{ color: "var(--q-text)" }}>{JOIN_URL}</span>
            <span>واكتب</span>
            <div className="q-room-code q-room-code--sm">{ROOM.split("").map((c, i) => <span key={i} className="q-room-code__char">{c}</span>)}</div>
          </div>
        </div>
        <div className="q-tv q-lobby__qr">
          <span className="q-tv__antenna" />
          <div className="q-tv__screen is-paper"><QrPlaceholder /></div>
          <div className="q-tv__panel"><span className="q-tv__grille" /><span className="q-tv__led" /><span className="q-tv__knob" /><span className="q-tv__knob" /></div>
        </div>
      </div>
      <div className="q-lobby-bar">
        <div className="q-stack" style={{ gap: "0.6em", minWidth: 0 }}>
          <span className="q-tv-label" style={{ color: "var(--q-text)" }}>اللاعبين ({AR(players.length)})</span>
          <div className="q-player-list">
            {players.map((p) => <span key={p.id} className="q-player-chip"><Avatar p={p} />{p.name}</span>)}
            {Array.from({ length: slots }, (_, i) => <span key={i} className="q-slot">{i === 0 ? "بانتظار…" : ""}</span>)}
          </div>
        </div>
        <div className={`q-start q-start--big ${ready ? "is-ready" : ""}`}>
          <span className="q-start__note">{ready ? `${AR(players.length)} لاعبين جاهزين` : `يحتاج ${AR(MIN)} لاعبين على الأقل`}</span>
          <button className="q-btn q-btn--primary q-btn--tv" disabled={!ready} onClick={onStart}>ابدأ</button>
        </div>
      </div>
    </div>
  );
}

function RoundV2({ round, category, seconds, locked, players, alive }) {
  const cls = seconds <= 5 ? "is-danger" : seconds <= 10 ? "is-warn" : "";
  // يبدأ كبير ويصغر لين كل الكلمات تدخل بالمكان (بدون تمرير)
  const SIZES = ["is-xl", "is-lg", "is-md", "is-sm"];
  const wallRef = useRef(null);
  const [sizeIdx, setSizeIdx] = useState(0);
  useLayoutEffect(() => {
    const el = wallRef.current;
    if (!el) return;
    if (locked.length === 0 && sizeIdx !== 0) { setSizeIdx(0); return; }
    if (el.scrollHeight > el.clientHeight + 1 && sizeIdx < SIZES.length - 1) setSizeIdx(sizeIdx + 1);
  });
  const size = SIZES[sizeIdx];
  const dangerId = players.length > 1 && locked.length > 0 ? pickLoser(players)?.id : null;
  return (
    <div className="q-screen-host q-host-fit q-host-round">
      <div className="q-spread">
        <span className="q-round-label">الجولة {AR(round)}</span>
        <span className="q-badge q-badge--ink"><UsersIcon /> باقي {AR(alive)} لاعبين</span>
      </div>
      <div className="q-host-grid">
        <div className="q-host-round__main">
          <div className={`q-timer ${cls}`} style={{ "--q-progress": seconds / ROUND_SECONDS }} role="timer" aria-label={`باقي ${seconds} ثانية`}>
            <span className="q-timer__num">{String(seconds).padStart(2, "0")}</span>
            <div className="q-timer__track"><div className="q-timer__fill" /></div>
          </div>
          <h1 className="q-category">{category}</h1>
          <div ref={wallRef} className={`q-lock-wall q-lock-wall--fill ${size}`}>
            {locked.length === 0 && <span className="q-tv-label">أول واحد يكتب كلمة صحيحة يقفّلها…</span>}
            {[...locked].reverse().map((l) => (
              <span key={l.word} className="q-lock-chip"><LockIcon className="q-lock-chip__icon" />{l.word}<span className="q-lock-chip__by">{l.by}</span></span>
            ))}
          </div>
        </div>
        <div className="q-side-board"><Board players={players} title="نقاط الجولة" dangerId={dangerId} /></div>
      </div>
    </div>
  );
}

function RoundEndV2({ round, players, out, isFinal, onNext, tie }) {
  return (
    <div className="q-screen-host q-host-fit">
      <div className="q-static is-burst" />
      <div className="q-spread">
        <span className="q-round-label">انتهت الجولة {AR(round)}</span>
        <Logo size="3.2vw" />
      </div>
      <div className="q-host-grid">
        <div className="q-host-round__main">
          <div className="q-out-stage">
            <div className="q-out-stage__sun" />
            <span className="q-tv-label q-out-stage__eyebrow">انتهى الوقت! وأقل واحد بالنقاط…</span>
            <div className="q-out-stage__who">
              <Avatar p={out} />
              <span className="q-out-stage__name">{out.name}</span>
            </div>
            <span className="q-out-stage__stamp">طلع!</span>
            <span className="q-out-stage__meta">
              {tie ? "تعادل! وطلع اللي تأخر بآخر إجابة صحيحة" : <>جاب <span className="q-ltr">{out.score < 0 ? "−" : ""}{AR(Math.abs(out.score))}</span> {Math.abs(out.score) === 1 ? "نقطة" : "نقاط"} بالجولة</>}
            </span>
          </div>
          <button className="q-btn q-btn--primary q-btn--tv" style={{ alignSelf: "center" }} onClick={onNext}>{isFinal ? "شوف الفائز" : "الجولة الجاية"}</button>
        </div>
        <div className="q-side-board"><Board players={players} title="ترتيب الجولة" dangerId={out.id} /></div>
      </div>
    </div>
  );
}

function Note({ title, text, onBack }) {
  return (
    <div className="q-screen-host q-center" style={{ justifyContent: "center" }}>
      <div className="q-card q-stack q-center" style={{ maxWidth: 640, fontSize: "var(--q-fs-tv-label)" }}>
        <h2 className="q-card__title" style={{ fontSize: "1.4em" }}>{title}</h2>
        <p>{text}</p>
        <button className="q-btn q-btn--primary" onClick={onBack}>رجوع</button>
      </div>
    </div>
  );
}

/* ---------------- المحاكي ---------------- */
export default function SimV2() {
  const [screen, setScreen] = useState("home");
  const [joinName, setJoinName] = useState("");
  const [players, setPlayers] = useState([]);
  const [out, setOut] = useState([]);
  const [round, setRound] = useState(1);
  const [count, setCount] = useState(3);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [locked, setLocked] = useState([]);
  const [speed, setSpeed] = useState(1);
  const [lastOut, setLastOut] = useState(null);
  const [zap, setZap] = useState(0);
  const [tie, setTie] = useState(false);
  const shuffle = () => [...CATEGORIES].sort(() => Math.random() - 0.5);
  const [catOrder, setCatOrder] = useState(shuffle);
  const category = catOrder[(round - 1) % catOrder.length];

  useEffect(() => {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
    document.title = "قفّلها · محاكي ٢";
  }, []);

  const go = (s) => { setScreen(s); setZap((z) => z + 1); };
  const alive = players.filter((p) => !out.some((o) => o.id === p.id));

  useTicker(screen === "lobby" && players.length < NAMES.length, 1500 / speed, () => {
    setPlayers((ps) => (ps.length >= NAMES.length ? ps : [...ps, { id: ps.length + 1, name: NAMES[ps.length], score: 0, lastCorrect: 0 }]));
  });
  useTicker(screen === "phones-lobby" && players.length < 4, 1500 / speed, () => {
    setPlayers((ps) => (ps.length >= 4 ? ps : [...ps, { id: ps.length + 1, name: ["دانة", "ريف", "لين", "رناد"][ps.length], score: 0, lastCorrect: 0 }]));
  });

  useTicker(screen === "countdown" && count > 0, 900 / speed, () => setCount((c) => c - 1));
  useEffect(() => {
    if (screen === "countdown" && count === 0) { setSeconds(ROUND_SECONDS); setLocked([]); go("round"); }
  }, [screen, count]);

  useTicker(screen === "round" && seconds > 0, 1000 / speed, () => setSeconds((s) => Math.max(0, s - 1)));
  useEffect(() => {
    if (screen === "round" && seconds === 0) endRound();
  }, [screen, seconds]);

  useTicker(screen === "round" && seconds > 0, 1100 / speed, () => {
    const live = players.filter((p) => !out.some((o) => o.id === p.id));
    if (!live.length) return;
    const who = live[Math.floor(Math.random() * live.length)];
    const free = category.words.filter((w) => !locked.some((l) => l.word === w));
    if (Math.random() < 0.22 && locked.length > 0) {
      setPlayers((ps) => ps.map((p) => (p.id === who.id ? { ...p, score: p.score - 1 } : p)));
    } else if (free.length && Math.random() < 0.8) {
      const word = free[Math.floor(Math.random() * free.length)];
      setLocked((ls) => [...ls, { word, by: who.name }]);
      setPlayers((ps) => ps.map((p) => (p.id === who.id ? { ...p, score: p.score + 1, lastCorrect: ROUND_SECONDS - seconds } : p)));
    }
  });

  function endRound() {
    if (screen !== "round") return;
    const live = players.filter((p) => !out.some((o) => o.id === p.id));
    const loser = pickLoser(live);
    setTie(live.filter((p) => p.score === loser.score).length > 1);
    setLastOut({ ...loser, outRound: round });
    setOut((o) => [...o, { ...loser, outRound: round }]);
    go("round-end");
  }

  function nextRound() {
    const live = alive.filter((p) => p.id !== lastOut?.id);
    if (live.length <= 1) { go("results"); return; }
    setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, lastCorrect: 0 })));
    setRound((r) => r + 1);
    setCount(3);
    go("countdown");
  }

  function start() {
    setOut([]); setRound(1); setCount(3); setLastOut(null); setCatOrder(shuffle());
    setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, lastCorrect: 0 })));
    go("countdown");
  }

  function resetAll() {
    setPlayers([]); setOut([]); setRound(1); setLastOut(null); go("home");
  }

  const liveForBoard = players.filter((p) => !out.some((o) => o.id === p.id) || p.id === lastOut?.id);
  const winner = alive[0];
  const order = winner ? [winner, ...[...out].reverse()] : [...out].reverse();

  let view = null;
  if (screen === "home") view = <Home onJoin={() => go("join")} onBigScreen={() => { setPlayers([]); go("lobby"); }} onPhones={() => go("phones-name")} />;
  if (screen === "lobby") view = <HostLobbyV2 players={players} onStart={start} />;
  if (screen === "countdown") view = <Countdown n={count} round={round} />;
  if (screen === "round") view = <RoundV2 round={round} category={category.name} seconds={seconds} locked={locked} players={alive} alive={alive.length} />;
  if (screen === "round-end" && lastOut) view = <RoundEndV2 round={round} players={liveForBoard} out={lastOut} isFinal={alive.length <= 1} onNext={nextRound} tie={tie} />;
  if (screen === "results" && winner) view = <Results winner={winner} order={order} onAgain={() => { go("lobby"); setOut([]); setRound(1); }} onHome={resetAll} />;

  const phone = screen === "phones-name" || screen === "phones-lobby";
  // «ادخل غرفة» من هذا الجهاز نفسه: نفس شاشة دخول اللاعب بعرض الصفحة
  const joinView = screen === "join" ? <JoinCode onJoin={(n) => { setJoinName(n); go("joined"); }} onBack={() => go("home")} />
    : screen === "joined" ? <Waiting players={[{ id: 1, name: "ريف" }, { id: 2, name: "لين" }, { id: 99, name: joinName }]} meId={99} /> : null;

  return (
    <div className="q-app" dir="rtl" lang="ar">
      {!phone && !joinView && <div key={zap}>{view}</div>}
      {joinView && <div key={zap} style={{ height: "100dvh" }}>{joinView}</div>}
      {phone && (
        <div className="q-center" style={{ minHeight: "100vh", padding: "2rem" }}>
          <div key={zap} className="q-app" style={{ width: 390, height: 844, maxHeight: "92vh", minHeight: 0, overflow: "hidden", border: "8px solid var(--q-surface-ink)", borderRadius: 36, boxShadow: "var(--q-shadow-stack)" }}>
            {screen === "phones-name" && <PhoneHostName onBack={() => go("home")} onOpen={() => { setPlayers([]); go("phones-lobby"); }} />}
            {screen === "phones-lobby" && <PhoneHostLobby players={players} onStart={() => go("phones-note")} />}
          </div>
        </div>
      )}
      {screen === "phones-note" && <Note title="بعد «ابدأ» في جوالات بس" text="الجولة تنعرض في جوالات اللاعبين نفسها — نصممها مع شاشات الجوال." onBack={resetAll} />}

      {/* لوحة المحاكاة — للتجربة بس */}
      <div style={{ position: "fixed", insetInlineEnd: 12, bottom: 12, zIndex: 100, display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", background: "rgb(0 0 0 / 0.55)", borderRadius: 8, fontSize: 12, color: "#fff", fontFamily: "system-ui" }}>
        <span>محاكاة ٢</span>
        <button onClick={() => setSpeed((s) => (s === 1 ? 3 : 1))} style={{ fontSize: 12 }}>{speed === 1 ? "أسرع ×3" : "سرعة عادية"}</button>
        {screen === "round" && <button onClick={() => setSeconds(0)} style={{ fontSize: 12 }}>أنهِ الجولة</button>}
        <button onClick={resetAll} style={{ fontSize: 12 }}>من البداية</button>
      </div>
    </div>
  );
}
