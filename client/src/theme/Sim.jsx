/**
 * /sim — محاكي فلو الشاشة الكبيرة (لابتوب/تلفزيون)
 * كل الأزرار تشتغل، واللاعبين «وهميين» يدخلون ويجاوبون لحالهم.
 * لوحة المحاكاة الصغيرة بالزاوية للتجربة بس (تسريع الوقت، تخطي) — مو جزء من التصميم.
 */
import { useEffect, useRef, useState } from "react";
import "./theme.css";
import Logo, { LockIcon, CrownIcon, UsersIcon } from "./Logo.jsx";
import { Home, HostLobby, PhoneHostName, PhoneHostLobby, Avatar, FlapBoard } from "./Preview.jsx";
import { JoinCode, Waiting } from "./PhoneSim.jsx";

export const NAMES = ["ريف", "لين", "دانة", "رناد", "ليان", "نورة"];
export const CATEGORIES = [
  { name: "فواكه", words: ["تفاح", "موز", "رمان", "مانجو", "عنب", "فراولة", "كيوي", "خوخ", "بطيخ", "تين", "مشمش", "أناناس", "برتقال", "ليمون", "جوافة"] },
  { name: "دول عربية", words: ["السعودية", "مصر", "الأردن", "الكويت", "قطر", "عمان", "تونس", "المغرب", "لبنان", "العراق", "الجزائر", "ليبيا", "السودان", "اليمن", "البحرين"] },
  { name: "حيوانات", words: ["أسد", "جمل", "حصان", "قطة", "نمر", "فيل", "زرافة", "ذئب", "صقر", "غزال", "أرنب", "دب", "ثعلب", "قرد", "حمار"] },
  { name: "أكلات شعبية", words: ["كبسة", "جريش", "مرقوق", "قرصان", "مطازيز", "حنيني", "معصوب", "سليق", "مندي", "مضغوط", "عصيدة", "هريس", "لقيمات", "كليجا", "مطبق"] },
  { name: "ألوان", words: ["أحمر", "أزرق", "أخضر", "أصفر", "بنفسجي", "برتقالي", "وردي", "بني", "رمادي", "أسود", "أبيض", "سماوي", "كحلي", "ذهبي", "فضي"] },
];
export const ROUND_SECONDS = 20;
const JOIN_URL = typeof window !== "undefined" ? `${window.location.host}/play` : "/play";
export const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

function useTicker(active, ms, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [active, ms]);
}

/* ---------------- screens ---------------- */
export function Countdown({ n, round }) {
  return (
    <div className="q-screen-host q-center" style={{ justifyContent: "center" }}>
      <div className="q-sunburst" />
      <div className="q-stack q-center" style={{ gap: "2vh" }}>
        <span className="q-round-label">الجولة {AR(round)}</span>
        <span key={n} className="q-stacked" style={{ fontSize: "min(34vh, 22vw)", lineHeight: 1, animation: "q-stamp 600ms var(--q-ease-out) both" }}>{AR(n)}</span>
        <span className="q-tv-label" style={{ color: "var(--q-text)" }}>استعدوا…</span>
      </div>
    </div>
  );
}

function Scoreboard({ players, deltas, title }) {
  const hit = {};
  Object.entries(deltas).forEach(([id, d]) => { hit[id] = { d: d.v, k: d.k }; });
  return (
    <div className="q-stack" style={{ gap: "0.6em", fontSize: "var(--q-fs-tv-label)" }}>
      <span className="q-tv-label" style={{ color: "var(--q-text)" }}>{title}</span>
      <FlapBoard players={players} hit={hit} />
    </div>
  );
}

export function Round({ round, category, seconds, locked, players, deltas, alive }) {
  const cls = seconds <= 5 ? "is-danger" : seconds <= 10 ? "is-warn" : "";
  return (
    <div className="q-screen-host">
      <div className="q-spread">
        <span className="q-round-label">الجولة {AR(round)}</span>
        <span className="q-badge q-badge--ink"><UsersIcon /> باقي {AR(alive)} لاعبين</span>
      </div>
      <div className="q-host-grid">
        <div className="q-stack" style={{ gap: "min(4vh, 2.5rem)" }}>
          <div className={`q-timer ${cls}`} style={{ "--q-progress": seconds / ROUND_SECONDS }} role="timer">
            <span className="q-timer__num">{String(seconds).padStart(2, "0")}</span>
            <div className="q-timer__track"><div className="q-timer__fill" /></div>
          </div>
          <h1 className="q-category">{category}</h1>
          <div className="q-lock-wall">
            {locked.length === 0 && <span className="q-tv-label">أول واحد يكتب كلمة صحيحة يقفّلها…</span>}
            {locked.map((l) => (
              <span key={l.word} className="q-lock-chip"><LockIcon className="q-lock-chip__icon" />{l.word}<span className="q-lock-chip__by">{l.by}</span></span>
            ))}
          </div>
        </div>
        <div className="q-side-board"><Scoreboard players={players} deltas={deltas} title="نقاط الجولة" /></div>
      </div>
    </div>
  );
}

export function RoundEnd({ round, players, out, isFinal, onNext, tie }) {
  return (
    <div className="q-screen-host">
      <div className="q-static is-burst" />
      <div className="q-spread">
        <span className="q-round-label">انتهت الجولة {AR(round)}</span>
        <Logo size="3.2vw" />
      </div>
      <div className="q-host-grid">
        <div className="q-stack" style={{ gap: "min(3vh, 1.8rem)" }}>
          <h1 className="q-stacked" style={{ fontSize: "var(--q-fs-tv-title)" }}>انتهى الوقت!</h1>
          <div className="q-eliminated" style={{ flex: 1, justifyContent: "center" }}>
            <span className="q-tv-label" style={{ color: "var(--q-text)" }}>الأقل نقاط في الجولة</span>
            <div className="q-anim-exit q-row" style={{ justifyContent: "center", fontSize: "var(--q-fs-tv-body)" }}>
              <Avatar p={out} />
              <span className="q-eliminated__name">{out.name}</span>
            </div>
            <span className="q-stamp" style={{ fontSize: "var(--q-fs-tv-title)", animationDelay: "1.2s" }}>طلع!</span>
            {tie && <span className="q-badge q-badge--ink" style={{ fontSize: "var(--q-fs-tv-label)", whiteSpace: "normal" }}>تعادل! وطلع اللي تأخر بآخر إجابة صحيحة</span>}
          </div>
          <button className="q-btn q-btn--primary q-btn--tv" style={{ alignSelf: "center" }} onClick={onNext}>{isFinal ? "شوف الفائز" : "الجولة الجاية"}</button>
        </div>
        <div className="q-side-board"><Scoreboard players={players} deltas={{}} title="ترتيب الجولة" /></div>
      </div>
    </div>
  );
}

export function Results({ winner, order, onAgain, onHome }) {
  return (
    <div className="q-screen-host">
      <div className="q-spread">
        <span className="q-round-label">النتائج</span>
        <div className="q-row" style={{ gap: "1.2rem" }}>
          <button className="q-btn q-btn--ghost q-btn--sm" style={{ fontSize: "var(--q-fs-tv-label)" }} onClick={onHome}>رجوع للرئيسية</button>
          <Logo size="3.2vw" />
        </div>
      </div>
      <div className="q-host-grid" style={{ gridTemplateRows: "minmax(0, 1fr)", minHeight: 0 }}>
        <div className="q-winner q-winner--stage">
          <CrownIcon className="q-winner__crown" />
          <span className="q-tv-label" style={{ color: "var(--q-text)" }}>بطل قفّلها</span>
          <span className="q-winner__name">{winner.name}</span>
        </div>
        <div className="q-stack" style={{ gap: "min(2.4vh, 1.4rem)", fontSize: "calc(var(--q-fs-tv-label) * 0.9)", minHeight: 0 }}>
          <div className="q-side-board" style={{ flex: 1 }}>
            <div className="q-stack" style={{ gap: "0.6em" }}>
              <span className="q-tv-label" style={{ color: "var(--q-text)" }}>الترتيب النهائي</span>
              <div className="q-flap">
                {order.map((p, i) => (
                  <div key={p.id} className={`q-flap__row ${i === 0 ? "is-leader" : ""}`} style={{ gridTemplateColumns: "2.2em 1fr auto" }}>
                    <span className="q-flap__tile"><span style={{ animationDelay: `${i * 150}ms` }}>{i + 1}</span></span>
                    <span className="q-flap__tile q-flap__tile--name"><span style={{ animationDelay: `${i * 150 + 80}ms` }}>{p.name}</span></span>
                    <span className="q-flap__tile" style={{ fontFamily: "var(--q-font)", fontSize: "0.8em", paddingInline: "0.7em" }}><span style={{ animationDelay: `${i * 150 + 160}ms` }}>{i === 0 ? "البطل" : `طلع بالجولة ${AR(p.outRound)}`}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button className="q-btn q-btn--primary q-btn--tv q-btn--block" style={{ whiteSpace: "nowrap" }} onClick={onAgain}>العب مرة ثانية</button>
        </div>
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

/* ---------------- simulator ---------------- */
export default function Sim() {
  const [screen, setScreen] = useState("home");
  const [joinName, setJoinName] = useState("");
  const [players, setPlayers] = useState([]); // {id,name,score,lastCorrect}
  const [out, setOut] = useState([]); // eliminated order
  const [round, setRound] = useState(1);
  const [count, setCount] = useState(3);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [locked, setLocked] = useState([]);
  const [deltas, setDeltas] = useState({});
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
    document.title = "قفّلها · محاكي";
  }, []);

  const go = (s) => { setScreen(s); setZap((z) => z + 1); };
  const alive = players.filter((p) => !out.some((o) => o.id === p.id));

  // lobby: players join one by one
  useTicker(screen === "lobby" && players.length < NAMES.length, 1500 / speed, () => {
    setPlayers((ps) => (ps.length >= NAMES.length ? ps : [...ps, { id: ps.length + 1, name: NAMES[ps.length], score: 0, lastCorrect: 0 }]));
  });
  useTicker(screen === "phones-lobby" && players.length < 4, 1500 / speed, () => {
    setPlayers((ps) => (ps.length >= 4 ? ps : [...ps, { id: ps.length + 1, name: ["دانة", "ريف", "لين", "رناد"][ps.length], score: 0, lastCorrect: 0 }]));
  });

  // countdown
  useTicker(screen === "countdown" && count > 0, 900 / speed, () => setCount((c) => c - 1));
  useEffect(() => {
    if (screen === "countdown" && count === 0) { setSeconds(ROUND_SECONDS); setLocked([]); setDeltas({}); go("round"); }
  }, [screen, count]);

  // round clock
  useTicker(screen === "round" && seconds > 0, 1000 / speed, () => setSeconds((s) => Math.max(0, s - 1)));
  useEffect(() => {
    if (screen === "round" && seconds === 0) endRound();
  }, [screen, seconds]);

  // bots answering
  useTicker(screen === "round" && seconds > 0, 1100 / speed, () => {
    const live = players.filter((p) => !out.some((o) => o.id === p.id));
    if (!live.length) return;
    const who = live[Math.floor(Math.random() * live.length)];
    const free = category.words.filter((w) => !locked.some((l) => l.word === w));
    const lockedHit = Math.random() < 0.22 && locked.length > 0;
    if (lockedHit) {
      setPlayers((ps) => ps.map((p) => (p.id === who.id ? { ...p, score: p.score - 1 } : p)));
      setDeltas((d) => ({ ...d, [who.id]: { v: -1, k: Math.random() } }));
    } else if (free.length && Math.random() < 0.8) {
      const word = free[Math.floor(Math.random() * free.length)];
      setLocked((ls) => [...ls, { word, by: who.name }]);
      setPlayers((ps) => ps.map((p) => (p.id === who.id ? { ...p, score: p.score + 1, lastCorrect: ROUND_SECONDS - seconds } : p)));
      setDeltas((d) => ({ ...d, [who.id]: { v: 1, k: Math.random() } }));
    }
  });

  function endRound() {
    if (screen !== "round") return;
    const live = players.filter((p) => !out.some((o) => o.id === p.id));
    // الأقل نقاط يطلع؛ التعادل: اللي آخر إجابة صحيحة له أبطأ
    const loser = [...live].sort((a, b) => a.score - b.score || b.lastCorrect - a.lastCorrect)[0];
    setTie(live.filter((p) => p.score === loser.score).length > 1);
    setLastOut({ ...loser, outRound: round });
    setOut((o) => [...o, { ...loser, outRound: round }]);
    go("round-end");
  }

  function nextRound() {
    const live = alive.filter((p) => p.id !== lastOut?.id);
    if (live.length <= 1) { go("results"); return; }
    setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, lastCorrect: 0 }))); // النقاط تتصفر كل جولة
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
  if (screen === "lobby") view = <HostLobby players={players} joinUrl={JOIN_URL} onStart={start} />;
  if (screen === "countdown") view = <Countdown n={count} round={round} />;
  if (screen === "round") view = <Round round={round} category={category.name} seconds={seconds} locked={locked} players={alive} deltas={deltas} alive={alive.length} />;
  if (screen === "round-end" && lastOut) view = <RoundEnd round={round} players={liveForBoard} out={lastOut} isFinal={alive.length <= 1} onNext={nextRound} tie={tie} />;
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
        <span>محاكاة</span>
        <button onClick={() => setSpeed((s) => (s === 1 ? 3 : 1))} style={{ fontSize: 12 }}>{speed === 1 ? "أسرع ×3" : "سرعة عادية"}</button>
        {screen === "round" && <button onClick={() => setSeconds(0)} style={{ fontSize: 12 }}>أنهِ الجولة</button>}
        <button onClick={resetAll} style={{ fontSize: 12 }}>من البداية</button>
      </div>
    </div>
  );
}
