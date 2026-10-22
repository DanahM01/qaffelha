/**
 * /preview — معاينة الهوية البصرية لقفّلها
 * تعرض كل التوكنز والمكوّنات والحالات + مرجع لكل شاشة في /host و /play.
 * رناد وريف: انسخوا الـ markup من "مرجع الشاشات" — كله كلاسات .q-… من theme.css.
 */
import { useEffect, useRef, useState } from "react";
import "./theme.css";
import Logo, { LockIcon, CrownIcon, CheckIcon, XIcon, EyeIcon, DoorIcon, UsersIcon, SendIcon, QrIcon, BigScreenArt, PhonesArt, ShareIcon } from "./Logo.jsx";
import { Home, PhoneTvBox } from "./Home.jsx";
export { Home, PhoneTvBox };

/* ---------------- sample data ---------------- */
const PLAYERS = [
  { id: 1, name: "ريف", score: 5 },
  { id: 2, name: "لين", score: 4 },
  { id: 3, name: "دانة", score: 3 },
  { id: 4, name: "رناد", score: 2 },
  { id: 5, name: "ليان", score: 1 },
];
const LOCKED = [
  { word: "تفاح", by: "ريف" },
  { word: "موز", by: "لين" },
  { word: "رمان", by: "دانة" },
  { word: "مانجو", by: "رناد" },
  { word: "عنب", by: "ليان" },
  { word: "فراولة", by: "ريف" },
  { word: "كيوي", by: "لين" },
];
const ROOM = "QAFL";
const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

const TOKEN_GROUPS = [
  { title: "علب الدهان", tokens: ["--q-primary", "--q-locked", "--q-correct", "--q-stack-1", "--q-stack-3", "--q-accent"] },
  { title: "الاستوديو واللوحات", tokens: ["--q-bg", "--q-panel", "--q-surface", "--q-surface-2", "--q-surface-3", "--q-surface-ink"] },
  { title: "النص", tokens: ["--q-text", "--q-text-muted", "--q-ink", "--q-ink-muted"] },
  { title: "حالات اللعب", tokens: ["--q-correct", "--q-locked", "--q-wrong", "--q-out", "--q-winner", "--q-error"] },
  { title: "المؤقت", tokens: ["--q-timer-ok", "--q-timer-warn", "--q-timer-danger", "--q-timer-off", "--q-timer-led", "--q-timer-led-bg"] },
  { title: "ألوان اللاعبين", tokens: ["--q-p1", "--q-p2", "--q-p3", "--q-p4", "--q-p5", "--q-p6", "--q-p7", "--q-p8"] },
  { title: "سبرنت 2 · الفريقين", tokens: ["--q-team-a", "--q-team-a-soft", "--q-team-b", "--q-team-b-soft", "--q-board-tile"] },
  { title: "سبرنت 2 · البطاقات", tokens: ["--q-card-freeze", "--q-card-lock", "--q-card-mine", "--q-card-steal"] },
];

const SPRINT2_CARDS = [
  { name: "تجميد", token: "--q-card-freeze", note: "يوقف الفريق الثاني جولة" },
  { name: "قفل", token: "--q-card-lock", note: "يقفل مربع" },
  { name: "لغم", token: "--q-card-mine", note: "مربع مفخخ" },
  { name: "سرقة", token: "--q-card-steal", note: "ياخذ مربع" },
];

/* ---------------- helpers ---------------- */
function useCssVar(name) {
  const [v, setV] = useState("");
  useEffect(() => {
    setV(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name]);
  return v;
}

function Swatch({ token }) {
  const value = useCssVar(token);
  return (
    <div className="pv-swatch">
      <div className="pv-swatch__chip" style={{ background: `var(${token})` }} />
      <code className="q-ltr">{token}</code>
      <span className="q-ltr q-muted">{value}</span>
    </div>
  );
}

function Section({ id, title, children, note }) {
  return (
    <section id={id} className="pv-section">
      <header className="pv-section__head">
        <h2>{title}</h2>
        {note && <p className="q-muted">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Timer({ seconds, total = 20 }) {
  const cls = seconds <= 5 ? "is-danger" : seconds <= 10 ? "is-warn" : "";
  return (
    <div className={`q-timer ${cls}`} style={{ "--q-progress": seconds / total }} role="timer" aria-label={`باقي ${seconds} ثانية`}>
      <span className="q-timer__num">{seconds}</span>
      <div className="q-timer__track"><div className="q-timer__fill" /></div>
    </div>
  );
}

function useCountdown(total = 20, running = true) {
  const [s, setS] = useState(total);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setS((x) => (x <= 0 ? total : x - 1)), 1000);
    return () => clearInterval(t);
  }, [total, running]);
  return s;
}

function RoomCode({ code }) {
  return (
    <div className="q-room-code" aria-label={`كود الغرفة ${code.split("").join(" ")}`}>
      {code.split("").map((c, i) => (
        <span key={i} className="q-room-code__char">{c}</span>
      ))}
    </div>
  );
}

export function Avatar({ p }) {
  return <span className={`q-avatar q-avatar--${((p.id - 1) % 8) + 1}`} aria-hidden="true">{p.name[0]}</span>;
}

function Scoreboard({ players, outId, meId, showDanger = true }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const lowest = sorted[sorted.length - 1]?.id;
  return (
    <ol className="q-scoreboard" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {sorted.map((p, i) => {
        const cls = [
          i === 0 && "is-leader",
          showDanger && p.id === lowest && p.id !== outId && "is-danger",
          p.id === outId && "is-out",
          p.id === meId && "is-me",
        ].filter(Boolean).join(" ");
        return (
          <li key={p.id} className={`q-score-row ${cls}`}>
            <span className="q-score-row__rank">{i + 1}</span>
            <Avatar p={p} />
            <span className="q-score-row__name">{p.name}</span>
            <span className="q-score-row__pts">{p.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

function LockChip({ word, by, delay = 0 }) {
  return (
    <span className="q-lock-chip" style={{ animationDelay: `${delay}ms` }}>
      <LockIcon className="q-lock-chip__icon" />
      {word}
      <span className="q-lock-chip__by">{by}</span>
    </span>
  );
}

function Feedback({ kind, word }) {
  const map = {
    correct: { pts: "+1", msg: "صح! قفّلتها عليهم", icon: <CheckIcon /> },
    locked: { pts: "−1", msg: "مقفولة! أحد سبقك عليها", icon: <LockIcon /> },
    wrong: { pts: "0", msg: "مو من الفئة، جرّب غيرها", icon: <XIcon /> },
  };
  const f = map[kind];
  return (
    <div className={`q-feedback q-feedback--${kind}`} role="status" aria-live="polite">
      <span className="q-feedback__pts">{f.pts}</span>
      <div className="q-stack" style={{ gap: 0 }}>
        <span className="q-feedback__word">{word}</span>
        <span className="q-feedback__msg">{f.msg}</span>
      </div>
    </div>
  );
}

/* Frames for the screen references */
/* الإطار يرسم الشاشة بحجم نافذة المتصفح الكامل ثم يصغّرها — فوحدات vw/vh
   تطلع نفس اللي بيشوفه المضيف بالضبط لو فتح /host بملء الشاشة. */
function TvFrame({ label, children }) {
  const boxRef = useRef(null);
  const [view, setView] = useState({ scale: 0.5, ratio: "16 / 9" });
  useEffect(() => {
    const box = boxRef.current;
    const update = () =>
      setView({ scale: box.clientWidth / window.innerWidth, ratio: `${window.innerWidth} / ${window.innerHeight}` });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  return (
    <figure className="pv-figure">
      <div ref={boxRef} className="pv-tv" style={{ aspectRatio: view.ratio }}>
        <div className="pv-tv__inner q-app" style={{ transform: `scale(${view.scale})` }}>{children}</div>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
function PhoneFrame({ label, children }) {
  return (
    <figure className="pv-figure">
      <div className="pv-phone q-app">{children}</div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/* باركود تجريبي (شكله مثل QR بس ما ينقرا) — رناد: استبدلوه بـ <QRCodeSVG value={joinUrl} /> من qrcode.react */
export function QrPlaceholder({ seed = 7 }) {
  const N = 25;
  let x = seed;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const finder = (r, c) => [[0, 0], [0, N - 7], [N - 7, 0]].some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!finder(r, c) && rnd() > 0.52) cells.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />);
  const F = ({ r, c }) => (
    <g transform={`translate(${c} ${r})`}>
      <rect width="7" height="7" rx="1.2" /><rect x="1" y="1" width="5" height="5" rx="0.8" style={{ fill: "var(--q-surface)" }} /><rect x="2" y="2" width="3" height="3" rx="0.6" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} role="img" aria-label="باركود الغرفة" style={{ fill: "var(--q-ink)", shapeRendering: "crispEdges" }}>
      {cells}<F r={0} c={0} /><F r={0} c={N - 7} /><F r={N - 7} c={0} />
      <rect x={N / 2 - 3} y={N / 2 - 3} width="6" height="6" rx="1" style={{ fill: "var(--q-primary)", stroke: "var(--q-ink)", strokeWidth: 0.6 }} />
    </svg>
  );
}

export function HostLobby({ players, joinUrl, onStart }) {
  const MIN = 3;
  const ready = players.length >= MIN;
  const slots = Math.max(0, 6 - players.length);
  return (
    <div className="q-screen-host">
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
            <span className="q-ltr" style={{ color: "var(--q-text)" }}>{joinUrl}</span>
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
        <div className="q-stack" style={{ gap: "0.6em" }}>
          <span className="q-tv-label" style={{ color: "var(--q-text)" }}>اللاعبين ({AR(players.length)})</span>
          <div className="q-player-list">
            {players.map((p) => <span key={p.id} className="q-player-chip"><Avatar p={p} />{p.name}</span>)}
            {Array.from({ length: slots }, (_, i) => <span key={i} className="q-slot">{i === 0 ? "بانتظار…" : ""}</span>)}
          </div>
        </div>
        <div className="q-start">
          <button className="q-btn q-btn--primary q-btn--tv" disabled={!ready} onClick={onStart}>ابدأ</button>
          <span className="q-start__note">{ready ? "جاهزين؟" : `يحتاج ${AR(MIN)} لاعبين على الأقل`}</span>
        </div>
      </div>
    </div>
  );
}

/* نمط «جوالات بس» — جوال المضيف */
export function PhoneBack({ onClick }) {
  return <button type="button" className="q-m-back" aria-label="رجوع" onClick={onClick}><SendIcon /></button>;
}
export function PhoneTag({ children, live }) {
  return <span className="q-m-tag">{live && <span className="q-m-tag__dot" />}{children}</span>;
}
export function PhoneHostName({ onBack, onOpen, tv }) {
  const [name, setName] = useState("");
  const submit = (e) => { e.preventDefault(); onOpen?.(name.trim() || "دانة"); };
  return (
    <form className="q-m q-m-host" onSubmit={submit}>
      <div className="q-m-bar"><PhoneBack onClick={onBack} /><PhoneTag>CH 02 · جوالات بس</PhoneTag></div>
      <div className="q-m-hero">
        {tv ? (
          <PhoneTvBox className="q-m-tv--md"><span className="q-m-tv__art q-glitch"><PhonesArt /></span></PhoneTvBox>
        ) : (<><div className="q-m-sun" /><span className="q-mode__art q-glitch"><PhonesArt /></span></>)}
      </div>
      <div className="q-m-head" style={{ textAlign: "center" }}>
        <h1 className="q-m-title">أنت المضيف</h1>
        <p className="q-m-sub">اكتب اسمك، وأصحابك يدخلون من جوالاتهم</p>
      </div>
      <div className="q-field">
        <label className="q-label" htmlFor="hn">اسمك</label>
        <input id="hn" className="q-input" placeholder="مثلاً: دانة" maxLength={12} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button className="q-btn q-btn--primary q-btn--lg q-btn--block" type="submit">افتح الغرفة</button>
    </form>
  );
}
export function PhoneHostLobby({ players, onStart, tv }) {
  const MIN = 3;
  const ready = players.length >= MIN;
  const slots = Math.max(0, 4 - players.length);
  return (
    <div className="q-m q-m-lobby">
      <div className="q-m-bar"><Logo size={30} /><PhoneTag live>CH 02 · {ROOM}</PhoneTag></div>
      <div className="q-m-head" style={{ textAlign: "center" }}>
        <h1 className="q-m-title q-m-title--md">صوّروا وادخلوا!</h1>
      </div>
      {tv ? (
        <>
          <PhoneTvBox paper className="q-m-tv--qr"><QrPlaceholder seed={11} /></PhoneTvBox>
          <div className="q-stack q-center" style={{ gap: "var(--q-space-2)" }}>
            <span className="q-m-sub">أو اكتبوا الكود</span>
            <div className="q-room-code" aria-label={`كود الغرفة ${ROOM.split("").join(" ")}`}>{ROOM.split("").map((c, i) => <span key={i} className="q-room-code__char">{c}</span>)}</div>
          </div>
        </>
      ) : (
        /* تذكرة الدخول: الباركود فوق، خط تخريم، والكود تحت */
        <div className="q-m-pass">
          <div className="q-m-pass__qr"><QrPlaceholder seed={11} /></div>
          <div className="q-m-pass__cut" />
          <div className="q-m-pass__code"><span className="q-m-pass__label">أو اكتبوا الكود</span><div className="q-room-code" aria-label={`كود الغرفة ${ROOM.split("").join(" ")}`}>{ROOM.split("").map((c, i) => <span key={i} className="q-room-code__char">{c}</span>)}</div></div>
        </div>
      )}
      <button type="button" className={`q-btn q-btn--success q-btn--sm ${tv ? "" : "q-m-pass-share"}`} style={{ alignSelf: "center" }}><ShareIcon size="1.1em" />شارك الرابط</button>
      <div className="q-grow" />
      <div className="q-stack" style={{ gap: "var(--q-space-2)" }}>
        <span className="q-m-section-label">اللاعبين <b className="q-ltr">{players.length}</b></span>
        <div className="q-m-players">
          {players.map((p, i) => <span key={p.id} className={`q-player-chip ${i === 0 ? "is-me" : ""}`}><Avatar p={p} /><span>{p.name}</span>{i === 0 && <CrownIcon />}</span>)}
          {Array.from({ length: slots }, (_, i) => <span key={`s${i}`} className="q-slot">{i === 0 ? "بانتظار…" : ""}</span>)}
        </div>
      </div>
      <div className="q-start" style={{ width: "100%" }}>
        <button className="q-btn q-btn--primary q-btn--lg q-btn--block" disabled={!ready} onClick={onStart}>ابدأ</button>
        <span className="q-start__note">{ready ? "الكل جاهز؟ يلا!" : `يحتاج ${AR(MIN)} لاعبين على الأقل (أنت منهم)`}</span>
      </div>
    </div>
  );
}

/* لوحة النقاط بالأعمدة (اقتراح جديد) */
export function MeterBoard({ players, title = "نقاط الجولة", bumped = {} }) {
  const max = Math.max(5, ...players.map((p) => p.score));
  const live = players.filter((p) => !p.out);
  const top = Math.max(...live.map((p) => p.score));
  const low = Math.min(...live.map((p) => p.score));
  return (
    <div className="q-meters" style={{ "--max": max }}>
      <span className="q-meters__title">{title}</span>
      <div className="q-meters__cols">
        {players.map((p) => {
          const cls = p.out ? "is-out" : p.score === top && top > 0 ? "is-leader" : p.score === low && live.length > 1 ? "is-danger" : "";
          return (
            <div key={p.id} className={`q-meter ${cls} ${bumped[p.id] ? "is-bump" : ""}`} style={{ "--v": Math.max(0, p.score) }}>
              <span key={bumped[p.id]} className="q-meter__pts">{p.score}</span>
              <span className="q-meter__bar" />
              <Avatar p={p} />
              <span className="q-meter__name">{p.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* لوحة النقاط — اقتراحين (تتحرك لحالها عشان تشوفين كيف تتصرف) */
function useFakeScores() {
  const [ps, setPs] = useState([
    { id: 2, name: "لين", score: 3 }, { id: 4, name: "رناد", score: 2 }, { id: 1, name: "ريف", score: 2 },
    { id: 3, name: "دانة", score: 1 }, { id: 5, name: "ليان", score: 0 },
  ]);
  const [hit, setHit] = useState({});
  useEffect(() => {
    const t = setInterval(() => {
      setPs((cur) => {
        const i = Math.floor(Math.random() * cur.length);
        const d = Math.random() < 0.25 ? -1 : 1;
        const next = cur.map((p, j) => (j === i ? { ...p, score: p.score + d > 7 ? 1 : p.score + d } : p));
        setHit({ [cur[i].id]: { d, k: Math.random() } });
        return next;
      });
    }, 1300);
    return () => clearInterval(t);
  }, []);
  return [ps, hit];
}
function rankInfo(players) {
  const top = Math.max(...players.map((p) => p.score));
  const low = Math.min(...players.map((p) => p.score));
  return (p) => (p.score === top && top > 0 ? "is-leader" : p.score === low ? "is-danger" : "");
}
export function FlapBoard({ players, hit = {} }) {
  const cls = rankInfo(players);
  const sorted = [...players].sort((a, b) => b.score - a.score || a.id - b.id);
  const prev = useRef({});
  const moves = {};
  sorted.forEach((p, i) => { const was = prev.current[p.id]; moves[p.id] = was === undefined ? 0 : was - i; });
  useEffect(() => { const m = {}; sorted.forEach((p, i) => { m[p.id] = i; }); prev.current = m; });
  return (
    <div className="q-flap">
      {sorted.map((p, i) => (
        <div key={p.id} className={`q-flap__row ${cls(p)}`}>
          <span className={`q-flap__move ${moves[p.id] > 0 ? "q-flap__move--up" : moves[p.id] < 0 ? "q-flap__move--down" : ""}`}>{moves[p.id] > 0 ? "▲" : moves[p.id] < 0 ? "▼" : ""}</span>
          <span className="q-flap__tile"><span key={i + p.name}>{i + 1}</span></span>
          <span className="q-flap__tile q-flap__tile--name"><span key={p.name + i}>{p.name}</span></span>
          <span className="q-flap__pts">
            {(p.score < 0 ? "-" + Math.abs(p.score) : String(p.score).padStart(2, "0")).split("").map((ch, j) => (
              <span key={j} className="q-flap__tile q-flap__tile--digit"><span key={`${ch}-${p.score}`}>{ch}</span></span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
function ScoreIdeas() {
  const [ps, hit] = useFakeScores();
  return (
    <div className="pv-grid pv-grid--2">
      <FlapBoard players={ps} hit={hit} />
      <p className="q-muted">بلاطات مينا كريمية مثل لوحات المطارات والملاعب القديمة. كل رقم بلاطة لحاله وينقلب لما يتغير، وجنب كل صف سهم ▲ خردلي لما يطلع في الترتيب و▼ لما ينزل. المتصدر صفه خردلي، والأقل أحمر. (هذي اللي في المحاكاة)</p>
    </div>
  );
}

/* ================================================================ */
export default function Preview() {
  const live = useCountdown(20, true);
  const [fb, setFb] = useState({ kind: "correct", word: "تفاح", n: 0 });
  const [exitKey, setExitKey] = useState(0);
  const [winKey, setWinKey] = useState(0);
  const [logoKey, setLogoKey] = useState(0);
  const joinUrl = typeof window !== "undefined" ? `${window.location.host}/play` : "/play";
  const answerRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.title = "قفّلها · معاينة الهوية";
  }, []);

  const fire = (kind) => {
    const words = { correct: "مانجو", locked: "تفاح", wrong: "طماطم" };
    setFb({ kind, word: words[kind], n: fb.n + 1 });
  };

  return (
    <div className="q-app pv" dir="rtl" lang="ar">
      <style>{PREVIEW_CSS}</style>

      <header className="pv-top">
        <Logo size={40} />
        <nav className="pv-nav" aria-label="أقسام المعاينة">
          {[
            ["logo", "الشعار"], ["colors", "الألوان"], ["type", "الخطوط"], ["buttons", "الأزرار"],
            ["fields", "الحقول"], ["cards", "البطاقات"], ["badges", "الشارات"], ["timer", "المؤقت"],
            ["states", "الحالات"], ["scores", "لوحة النقاط"], ["sprint2", "سبرنت 2"], ["host", "شاشة المضيف"], ["player", "شاشة اللاعب"],
          ].map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
        </nav>
      </header>

      <main className="pv-main">
        {/* ---------- Logo ---------- */}
        <Section id="logo" title="الشعار" note="«قفّلها» مدهونة بفرشاة مثل لوحات البقالات، والألف فيها قفل، ووراها ظلال تلفزيون الثمانينات المتراكبة.">
          <div className="pv-grid pv-grid--2">
            <div className="q-card q-card--dark q-center pv-logo-stage">
              <Logo key={logoKey} size={150} animated />
              <button className="q-btn q-btn--ghost q-btn--sm" onClick={() => setLogoKey((k) => k + 1)}>أعد الحركة</button>
            </div>
            <div className="q-card q-card--dark q-center pv-logo-stage">
              <Logo variant="sign" size={170} />
              <code>variant="sign"</code>
            </div>
            <div className="q-card q-center pv-logo-stage">
              <Logo size={100} tone="onLight" />
              <code>tone="onLight"</code>
            </div>
          </div>
          <div className="q-row" style={{ gap: "var(--q-space-6)", marginTop: "var(--q-space-5)" }}>
            <div className="q-stack q-center"><Logo variant="mark" size={96} /><code>variant="mark"</code></div>
                        <div className="q-stack q-center">
              <div className="q-row">
                <img src="/icon-512.png" width="96" height="96" alt="أيقونة التطبيق" />
                <img src="/favicon.svg" width="48" height="48" alt="" />
                <img src="/favicon.svg" width="32" height="32" alt="" />
                <img src="/favicon.svg" width="16" height="16" alt="" />
              </div>
              <code>favicon.svg · icon-192/512.png</code>
            </div>
          </div>
        </Section>

        {/* ---------- Colors ---------- */}
        <Section id="colors" title="لوحة الألوان" note="ليل الاستوديو + علب دهان اللوحات. كل حالة لها لون + رقم كبير (+1 / −1 / 0) + شكل (شطب، إطار متقطع، ختم)، عشان تنقرأ من بعيد وللي عندهم عمى ألوان.">
          {TOKEN_GROUPS.map((g) => (
            <div key={g.title} className="pv-swatch-group">
              <h3>{g.title}</h3>
              <div className="pv-swatches">{g.tokens.map((t) => <Swatch key={t} token={t} />)}</div>
            </div>
          ))}
        </Section>

        {/* ---------- Type ---------- */}
        <Section id="type" title="الخطوط" note="Tajawal بخمسة أوزان (400–900). العناوين 900 مع الظل المتراكب (.q-stacked). الأرقام بخط لمبات (--q-font-led). أحجام التلفزيون تاخذ الأصغر من العرض والارتفاع.">
          <div className="q-stack pv-type">
            <div className="pv-type__row"><code>--q-fs-tv-code</code><span style={{ fontSize: "var(--q-fs-tv-code)", fontWeight: 900, lineHeight: 1 }} className="q-ltr">QAFL</span></div>
            <div className="pv-type__row"><code>--q-fs-tv-category</code><span style={{ fontSize: "var(--q-fs-tv-category)", fontWeight: 900, lineHeight: 1.05 }}>فواكه</span></div>
            <div className="pv-type__row"><code>--q-fs-tv-title</code><span className="q-tv-title">الجولة الثالثة</span></div>
            <div className="pv-type__row"><code>--q-fs-3xl · 900</code><span style={{ fontSize: "var(--q-fs-3xl)", fontWeight: 900 }}>دول عربية</span></div>
            <div className="pv-type__row"><code>--q-fs-2xl · 900</code><span className="q-title">انتظر المضيف يبدأ</span></div>
            <div className="pv-type__row"><code>--q-fs-lg · 700</code><span style={{ fontSize: "var(--q-fs-lg)", fontWeight: 700 }}>اكتب أكبر عدد من الإجابات قبل ما يخلص الوقت</span></div>
            <div className="pv-type__row"><code>--q-fs-md · 400</code><span>الإجابة الصحيحة +1 وتنقفل على الكل، ومن يكتب كلمة مقفولة −1.</span></div>
            <div className="pv-type__row"><code>--q-fs-sm · 700</code><span className="q-eyebrow">كود الغرفة</span></div>
          </div>
        </Section>

        {/* ---------- Buttons ---------- */}
        <Section id="buttons" title="الأزرار" note="لوحات مدهونة بحد حبر 4px وظل صلب. لما تضغط، الزر ينزل مكان ظله. 56px على الأقل للجوال.">
          <div className="q-row">
            <button className="q-btn q-btn--primary">ادخل</button>
            <button className="q-btn q-btn--secondary">انسخ الرابط</button>
            <button className="q-btn">عادي</button>
            <button className="q-btn q-btn--ghost">إلغاء</button>
            <button className="q-btn q-btn--success">إرسال</button>
            <button className="q-btn q-btn--danger">اطرد</button>
          </div>
          <div className="q-row" style={{ marginTop: "var(--q-space-4)" }}>
            <button className="q-btn q-btn--primary q-btn--sm">صغير</button>
            <button className="q-btn q-btn--primary q-btn--lg">كبير</button>
            <button className="q-btn q-btn--primary" disabled>ابدأ (يحتاج لاعبين)</button>
            <button className="q-btn q-btn--primary is-loading">جاري الدخول</button>
          </div>
          <div className="q-row" style={{ marginTop: "var(--q-space-4)" }}>
            <button className="q-btn q-btn--primary q-btn--tv">إنشاء غرفة</button>
            <button className="q-btn q-btn--secondary q-btn--tv">العب مرة ثانية</button>
          </div>
          <div style={{ maxWidth: 380, marginTop: "var(--q-space-4)" }}>
            <button className="q-btn q-btn--primary q-btn--block q-btn--lg">ادخل اللعبة</button>
          </div>
        </Section>

        {/* ---------- Fields ---------- */}
        <Section id="fields" title="الحقول ورسائل الخطأ">
          <div className="pv-grid pv-grid--3">
            <div className="q-stack">
              <div className="q-field">
                <label className="q-label" htmlFor="pv-code">كود الغرفة</label>
                <input id="pv-code" className="q-input q-input--code" maxLength={4} defaultValue="QAFL" autoComplete="off" />
              </div>
              <div className="q-field">
                <label className="q-label" htmlFor="pv-name">اسمك</label>
                <input id="pv-name" className="q-input" placeholder="مثلاً: نورة" maxLength={12} />
              </div>
            </div>
            <div className="q-stack">
              <div className="q-field is-invalid">
                <label className="q-label" htmlFor="pv-code-bad">كود الغرفة</label>
                <input id="pv-code-bad" className="q-input q-input--code" defaultValue="ZZZZ" aria-invalid="true" aria-describedby="pv-err1" />
                <span id="pv-err1" className="q-field__error"><XIcon /> الغرفة غير موجودة</span>
              </div>
              <div className="q-field is-invalid">
                <label className="q-label" htmlFor="pv-name-bad">اسمك</label>
                <input id="pv-name-bad" className="q-input" defaultValue="ريف" aria-invalid="true" aria-describedby="pv-err2" />
                <span id="pv-err2" className="q-field__error"><XIcon /> الاسم مأخوذ، جرّب اسم ثاني</span>
              </div>
            </div>
            <div className="q-stack">
              <div className="q-alert" role="alert"><LockIcon /> اللعبة بدأت، ما تقدر تدخل الحين</div>
              <div className="q-alert" role="alert"><XIcon /> الغرفة غير موجودة</div>
              <div className="q-alert q-alert--info" role="status"><UsersIcon /> انقطع الاتصال، نحاول نرجعك…</div>
              <div className="q-field">
                <label className="q-label" htmlFor="pv-ans">إجابتك</label>
                <div className="q-answer-bar">
                  <input id="pv-ans" ref={answerRef} className="q-input q-input--answer" placeholder="اكتب كلمة…" enterKeyHint="send" />
                  <button className="q-btn q-btn--primary" aria-label="إرسال"><SendIcon size="1.3em" /></button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ---------- Cards ---------- */}
        <Section id="cards" title="البطاقات">
          <div className="pv-grid pv-grid--3">
            <div className="q-card"><h3 className="q-card__title">بطاقة عادية</h3><p className="q-muted">للوحات والقوائم.</p></div>
            <div className="q-card q-card--raised"><h3 className="q-card__title">مرفوعة</h3><p className="q-muted">طبقة ثانية فوق بطاقة.</p></div>
            <div className="q-card q-card--highlight"><h3 className="q-card__title">مميزة</h3><p className="q-muted">للعنصر الأهم في الشاشة.</p></div>
            <div className="q-card q-card--dark"><h3 className="q-card__title">داكنة</h3><p className="q-muted">لوحة فوق خلفية الاستوديو.</p></div>
            <div className="q-card q-card--sign"><h3 className="q-card__title">لوحة بقالة</h3><p>للإعلانات والعناوين المهمة.</p></div>
          </div>
        </Section>

        {/* ---------- Badges ---------- */}
        <Section id="badges" title="الشارات والكلمات المقفولة">
          <div className="q-row">
            <span className="q-badge q-badge--correct"><CheckIcon /> صح +1</span>
            <span className="q-badge q-badge--locked"><LockIcon /> مقفولة −1</span>
            <span className="q-badge q-badge--wrong"><XIcon /> خطأ</span>
            <span className="q-badge q-badge--out">مطرود</span>
            <span className="q-badge q-badge--winner"><CrownIcon /> فائز</span>
            <span className="q-badge q-badge--primary">الجولة 3</span>
            <span className="q-badge q-badge--accent">أنت</span>
            <span className="q-badge q-badge--correct q-badge--solid">+1</span>
            <span className="q-badge q-badge--locked q-badge--solid">−1</span>
          </div>
          <div className="q-lock-wall" style={{ marginTop: "var(--q-space-5)" }}>
            {LOCKED.map((l, i) => <LockChip key={l.word} {...l} delay={i * 90} />)}
          </div>
          <div className="q-player-list" style={{ marginTop: "var(--q-space-5)" }}>
            {PLAYERS.map((p) => (
              <span key={p.id} className={`q-player-chip ${p.id === 3 ? "is-me" : ""}`}><Avatar p={p} />{p.name}</span>
            ))}
          </div>
        </Section>

        {/* ---------- Timer ---------- */}
        <Section id="timer" title="شريط الوقت" note="لوحة أرقام مضيئة + 20 لمبة تطفي وحدة وحدة. خردلي ← برتقالي عند 10 ← أحمر والرقم يرمش عند 5.">
          <div className="q-card"><Timer seconds={live} /></div>
          <div className="pv-grid pv-grid--3" style={{ marginTop: "var(--q-space-4)" }}>
            <div className="q-stack"><Timer seconds={16} /><code>عادي</code></div>
            <div className="q-stack"><Timer seconds={9} /><code>is-warn</code></div>
            <div className="q-stack"><Timer seconds={4} /><code>is-danger</code></div>
          </div>
          <div style={{ marginTop: "var(--q-space-5)" }}>
            <span className="q-eyebrow">كود الغرفة</span>
            <div style={{ marginTop: "var(--q-space-3)" }}><RoomCode code={ROOM} /></div>
          </div>
        </Section>

        {/* ---------- States ---------- */}
        <Section id="states" title="الحالات: صح، مقفولة، خطأ، مطرود، فائز">
          <div className="pv-grid pv-grid--2">
            <div className="q-stack">
              <h3>الرد الفوري (جوال اللاعب)</h3>
              <div className="q-row">
                <button className="q-btn q-btn--success q-btn--sm" onClick={() => fire("correct")}>صح</button>
                <button className="q-btn q-btn--danger q-btn--sm" onClick={() => fire("locked")}>مقفولة</button>
                <button className="q-btn q-btn--sm" onClick={() => fire("wrong")}>خطأ</button>
              </div>
              <Feedback key={fb.n} kind={fb.kind} word={fb.word} />
              <Feedback kind="correct" word="مانجو" />
              <Feedback kind="locked" word="تفاح" />
              <Feedback kind="wrong" word="طماطم" />
            </div>
            <div className="q-stack">
              <h3>لوحة النقاط</h3>
              <Scoreboard players={PLAYERS} meId={3} />
              <div className="q-row">
                <span className="q-score-delta q-score-delta--plus">+1</span>
                <span className="q-score-delta q-score-delta--minus">−1</span>
                <span className="q-muted" style={{ fontSize: "var(--q-fs-sm)" }}>is-leader · is-danger (الأقل) · is-me · is-out</span>
              </div>
            </div>
          </div>

          <div className="pv-grid pv-grid--3" style={{ marginTop: "var(--q-space-6)" }}>
            <div className="q-stack">
              <h3>مطرود (مضيف)</h3>
              <div className="q-eliminated">
                <span className="q-stamp" style={{ fontSize: "var(--q-fs-xl)" }}>طلع!</span>
                <div key={exitKey} className="q-anim-exit q-row" style={{ justifyContent: "center" }}>
                  <Avatar p={PLAYERS[4]} />
                  <span className="q-eliminated__name">ليان</span>
                </div>
              </div>
              <button className="q-btn q-btn--secondary q-btn--sm" onClick={() => setExitKey((k) => k + 1)}>أعد حركة الخروج</button>
            </div>
            <div className="q-stack">
              <h3>طلعت (لاعب)</h3>
              <div className="q-out-screen">
                <DoorIcon className="q-out-screen__icon" />
                <strong style={{ fontSize: "var(--q-fs-xl)" }}>طلعت من اللعبة</strong>
                <span className="q-muted">جبت 1 نقطة · المركز 5</span>
                <span className="q-badge q-badge--accent"><EyeIcon /> تقدر تتفرج</span>
              </div>
            </div>
            <div className="q-stack">
              <h3>فائز</h3>
              <div key={winKey} className="q-winner">
                <CrownIcon className="q-winner__crown" />
                <span className="q-winner__name">ريف</span>
                <span className="q-badge q-badge--winner">بطل قفّلها · 5 نقاط</span>
              </div>
              <button className="q-btn q-btn--secondary q-btn--sm" onClick={() => setWinKey((k) => k + 1)}>أعد حركة الفوز</button>
            </div>
          </div>
        </Section>

        <Section id="scores" title="لوحة النقاط — القلّابات" note="تتحرك لحالها بنقاط وهمية (+1 و−1) عشان تشوفين كيف تتصرف وقت اللعب.">
          <ScoreIdeas />
        </Section>

        {/* ---------- Sprint 2 ---------- */}
        <Section id="sprint2" title="سبرنت 2 — ألوان جاهزة فقط" note="أزرق وبرتقالي للفريقين (يتفرقون حتى مع عمى الألوان). لوحة 4×4 والبطاقات ما تنبني الحين — هذي الألوان بس.">
          <div className="q-row">
            <span className="q-badge q-badge--team-a">الفريق الأزرق</span>
            <span className="q-badge q-badge--team-b">الفريق البرتقالي</span>
            <span className="q-badge q-badge--team-a q-badge--solid">أزرق</span>
            <span className="q-badge q-badge--team-b q-badge--solid">برتقالي</span>
          </div>
          <div className="pv-swatches" style={{ marginTop: "var(--q-space-4)" }}>
            {SPRINT2_CARDS.map((c) => (
              <div key={c.name} className="pv-swatch">
                <div className="pv-swatch__chip" style={{ background: `var(${c.token})` }} />
                <strong>{c.name}</strong>
                <code className="q-ltr">{c.token}</code>
                <span className="q-muted">{c.note}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- Host screens ---------- */}
        <Section id="host" title="مرجع شاشة المضيف /host" note="كل إطار يرسم الشاشة بحجم نافذتك الكاملة ثم يصغّرها، فتشوفون نفس المقاسات اللي بتطلع على التلفزيون. كلها كلاسات من theme.css — انسخوها لـ client/src/host.">
          <div className="pv-frames">
            <TvFrame label="1 · الرئيسية (نفس صفحة الجوال، الترتيب يتغير بالعرض)">
              <Home />
            </TvFrame>

            <TvFrame label="2أ · الانتظار — لسه ما اكتملوا (ابدأ مقفول)">
              <HostLobby players={PLAYERS.slice(0, 2)} joinUrl={joinUrl} />
            </TvFrame>

            <TvFrame label="2ب · الانتظار — جاهزين (ابدأ يشتغل)">
              <HostLobby players={PLAYERS} joinUrl={joinUrl} />
            </TvFrame>

            <TvFrame label="3 · الجولة">
              <div className="q-screen-host">
                <div className="q-spread">
                  <span className="q-round-label">الجولة 2 من 4</span>
                  <Logo size="4vw" variant="mark" />
                </div>
                <Timer seconds={12} />
                <div className="q-host-grid">
                  <div className="q-stack" style={{ gap: "2rem" }}>
                    <h1 className="q-category">فواكه</h1>
                    <div className="q-lock-wall">{LOCKED.map((l, i) => <LockChip key={l.word} {...l} delay={i * 60} />)}</div>
                  </div>
                  <div className="q-card q-card--flat" style={{ fontSize: "var(--q-fs-tv-label)" }}>
                    <h2 className="q-card__title">النقاط</h2>
                    <Scoreboard players={PLAYERS} />
                  </div>
                </div>
              </div>
            </TvFrame>

            <TvFrame label="4 · نهاية الجولة">
              <div className="q-screen-host">
                <div className="q-spread"><span className="q-round-label">انتهت الجولة 2</span><Logo size="4vw" variant="mark" /></div>
                <div className="q-host-grid" style={{ alignItems: "center" }}>
                  <div className="q-eliminated">
                    <span className="q-tv-label" style={{ color: "var(--q-text)" }}>الأقل نقاط في الجولة</span>
                    <div key={exitKey} className="q-anim-exit q-row" style={{ justifyContent: "center", fontSize: "var(--q-fs-tv-body)" }}>
                      <Avatar p={PLAYERS[4]} />
                      <span className="q-eliminated__name">ليان</span>
                    </div>
                    <span key={`s${exitKey}`} className="q-stamp" style={{ fontSize: "var(--q-fs-tv-title)", animationDelay: "1.2s" }}>طلع!</span>
                  </div>
                  <div className="q-card q-card--flat" style={{ fontSize: "var(--q-fs-tv-label)" }}>
                    <Scoreboard players={PLAYERS} outId={5} showDanger={false} />
                  </div>
                </div>
              </div>
            </TvFrame>

            <TvFrame label="5 · النتائج">
              <div className="q-screen-host">
                <div className="q-dots-corner" />
                <div className="q-host-grid" style={{ alignItems: "center" }}>
                  <div key={winKey} className="q-winner">
                    <CrownIcon className="q-winner__crown" />
                    <span className="q-tv-label">بطل قفّلها</span>
                    <span className="q-winner__name">ريف</span>
                  </div>
                  <div className="q-stack" style={{ fontSize: "var(--q-fs-tv-label)" }}>
                    <ol className="q-ranking" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {PLAYERS.map((p, i) => (
                        <li key={p.id} className={`q-score-row ${i === 0 ? "is-leader" : ""}`}>
                          <span className={`q-rank-place q-rank-place--${i + 1}`}>{i + 1}</span>
                          <Avatar p={p} /><span className="q-score-row__name">{p.name}</span>
                          <span className="q-score-row__pts">{p.score}</span>
                        </li>
                      ))}
                    </ol>
                    <button className="q-btn q-btn--primary q-btn--tv">العب مرة ثانية</button>
                  </div>
                </div>
              </div>
            </TvFrame>
          </div>
        </Section>

        {/* ---------- Player screens ---------- */}
        <Section id="player" title="مرجع شاشة اللاعب /play" note="عرض 360. الدخول والانتظار داخل تلفزيون قديم (.q-tv)، والكود بلوحة لمبات (.q-input--led). عمود واحد، والأزرار بعرض الشاشة.">
          <div className="pv-frames pv-frames--phone">
            <PhoneFrame label="0 · الرئيسية (نفس صفحة اللابتوب)">
              <Home />
            </PhoneFrame>

            <PhoneFrame label="جوالات بس ١ · المضيف يكتب اسمه">
              <PhoneHostName />
            </PhoneFrame>

            <PhoneFrame label="جوالات بس ٢ · انتظار — جوال المضيف">
              <PhoneHostLobby players={[{ id: 3, name: "دانة" }, PLAYERS[0]]} />
            </PhoneFrame>

            <PhoneFrame label="جوالات بس ٢ · جاهزين">
              <PhoneHostLobby players={[{ id: 3, name: "دانة" }, PLAYERS[0], PLAYERS[1], PLAYERS[3]]} />
            </PhoneFrame>

            <PhoneFrame label="1 · الدخول">
              <div className="q-screen-player" style={{ minHeight: "100%", gap: "var(--q-space-4)" }}>
                <div className="q-tv">
                  <span className="q-tv__antenna" />
                  <div className="q-tv__screen">
                    <div className="q-static is-burst" />
                    <div className="q-glitch q-tv-on"><Logo size={66} animated /></div>
                  </div>
                  <div className="q-tv__panel">
                    <span className="q-tv__grille" />
                    <span className="q-tv__led" />
                    <span className="q-tv__knob" />
                    <span className="q-tv__knob" />
                  </div>
                </div>
                <p className="q-muted" style={{ textAlign: "center", fontWeight: 800, marginBlockStart: "var(--q-space-3)" }}>اكتب الكود اللي عند المضيف</p>
                <div className="q-field">
                  <label className="q-label" htmlFor="ph-code">كود الغرفة</label>
                  <input id="ph-code" className="q-input q-input--code q-input--led" placeholder="----" defaultValue="QAF" maxLength={4} autoCapitalize="characters" autoComplete="off" />
                </div>
                <div className="q-field is-invalid">
                  <label className="q-label" htmlFor="ph-name">اسمك</label>
                  <input id="ph-name" className="q-input" defaultValue="ريف" aria-invalid="true" />
                  <span className="q-field__error"><XIcon /> الاسم مأخوذ، جرّب اسم ثاني</span>
                </div>
                <div className="q-grow" />
                <button className="q-btn q-btn--primary q-btn--lg q-btn--block">ادخل</button>
              </div>
            </PhoneFrame>

            <PhoneFrame label="2 · الانتظار">
              <div className="q-screen-player" style={{ minHeight: "100%" }}>
                <div className="q-spread"><Logo size={30} /><span className="q-badge q-badge--ink q-ltr">QAFL</span></div>
                <div className="q-tv" style={{ marginBlockStart: "52px" }}>
                  <span className="q-tv__antenna" />
                  <div className="q-tv__screen">
                    <span className="q-stacked" style={{ fontSize: "var(--q-fs-2xl)", lineHeight: 1.15 }}>انتظر المضيف يبدأ</span>
                    <span className="q-dots" style={{ fontWeight: 800, fontSize: "var(--q-fs-sm)" }}>5 لاعبين داخل</span>
                  </div>
                  <div className="q-tv__panel">
                    <span className="q-tv__grille" />
                    <span className="q-tv__led" />
                    <span className="q-tv__knob" />
                    <span className="q-tv__knob" />
                  </div>
                </div>
                <div className="q-player-list" style={{ marginBlockStart: "var(--q-space-4)" }}>
                  {PLAYERS.map((p) => <span key={p.id} className={`q-player-chip ${p.id === 3 ? "is-me" : ""}`}><Avatar p={p} />{p.name}</span>)}
                </div>
              </div>
            </PhoneFrame>

            <PhoneFrame label="3 · الجولة">
              <div className="q-screen-player" style={{ minHeight: "100%", gap: "var(--q-space-4)" }}>
                <div className="q-spread">
                  <span className="q-round-label">الجولة 2</span>
                  <span className="q-my-score">نقاطي <b>3</b></span>
                </div>
                <h1 className="q-category">فواكه</h1>
                <Timer seconds={live} />
                <Feedback key={fb.n} kind={fb.kind} word={fb.word} />
                <div className="q-grow" />
                <div className="q-answer-bar">
                  <label className="q-sr-only" htmlFor="ph-ans">إجابتك</label>
                  <input id="ph-ans" className="q-input q-input--answer" placeholder="اكتب كلمة…" enterKeyHint="send" />
                  <button className="q-btn q-btn--primary" aria-label="إرسال"><SendIcon size="1.3em" /></button>
                </div>
              </div>
            </PhoneFrame>

            <PhoneFrame label="4 · طلعت">
              <div className="q-screen-player" style={{ minHeight: "100%", justifyContent: "center" }}>
                <div className="q-out-screen">
                  <DoorIcon className="q-out-screen__icon" />
                  <h1 className="q-title">طلعت من اللعبة</h1>
                  <span className="q-muted">جبت 1 نقطة في الجولة 2</span>
                </div>
                <div className="q-alert q-alert--info"><EyeIcon /> تقدر تتفرج على الشاشة الكبيرة لين تخلص اللعبة</div>
              </div>
            </PhoneFrame>

            <PhoneFrame label="5 · النتائج">
              <div className="q-screen-player" style={{ minHeight: "100%" }}>
                <div className="q-card q-card--dark q-stack q-center">
                  <span className="q-eyebrow">مركزك</span>
                  <span className="q-stacked" style={{ fontSize: "5rem", lineHeight: 1 }}>3</span>
                  <span className="q-muted">من 5 لاعبين · 3 نقاط</span>
                </div>
                <div className="q-winner" style={{ padding: "var(--q-space-5)" }}>
                  <CrownIcon className="q-winner__crown" />
                  <span className="q-eyebrow">الفائز</span>
                  <span className="q-winner__name">ريف</span>
                </div>
              </div>
            </PhoneFrame>
          </div>
        </Section>
      </main>
    </div>
  );
}

/* Preview-only layout styles (لا تستخدمونها في host/ و player/) */
const PREVIEW_CSS = `
.pv { padding-bottom: 6rem; }
.pv-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
  padding: .7rem 1.25rem; background: var(--q-surface-ink); border-bottom: var(--q-line) solid var(--q-primary); }
.pv-nav { display: flex; gap: .25rem; flex-wrap: wrap; }
.pv-nav a { color: var(--q-text); text-decoration: none; font-weight: 700; font-size: var(--q-fs-sm);
  padding: .3rem .7rem; border-radius: var(--q-radius-pill); }
.pv-nav a:hover { color: var(--q-ink); background: var(--q-primary); }
.pv-main { max-width: 1240px; margin: 0 auto; padding: 0 1rem; }
.pv-section { padding-block: 3rem; border-bottom: 3px dashed var(--q-panel); scroll-margin-top: 72px; }
.pv-section__head { margin-bottom: 1.5rem; display: grid; gap: .35rem; }
.pv-section__head h2 { font-size: var(--q-fs-2xl); font-weight: 900; text-shadow: var(--q-text-stack-sm); }
.pv-section h3 { font-size: var(--q-fs-lg); font-weight: 800; }
.pv-grid { display: grid; gap: 1.25rem; }
.pv-grid--2 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.pv-grid--3 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.pv-logo-stage { min-height: 240px; gap: 1rem; }
.pv-code-on-ink { color: var(--q-primary) !important; }
.pv code { direction: ltr; unicode-bidi: isolate; font-size: var(--q-fs-xs); color: var(--q-primary); font-family: ui-monospace, Menlo, Consolas, monospace; }
.pv-swatch-group { margin-bottom: 1.75rem; display: grid; gap: .75rem; }
.pv-swatches { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.pv-swatch { display: grid; gap: .2rem; font-size: var(--q-fs-sm); }
.pv-swatch__chip { height: 64px; border: var(--q-line) solid var(--q-border); box-shadow: var(--q-shadow-1); }
.pv-type { gap: 1.25rem; }
.pv-type__row { display: grid; grid-template-columns: 11rem 1fr; align-items: baseline; gap: 1rem; overflow: hidden; }
@media (max-width: 640px) { .pv-type__row { grid-template-columns: 1fr; } }
.pv-frames { display: grid; gap: 2rem; }
.pv-frames--phone { grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); justify-items: center; }
.pv-figure { margin: 0; display: grid; gap: .5rem; justify-items: center; max-width: 100%; }
.pv-figure figcaption { color: var(--q-text-muted); font-weight: 800; }
.pv-tv { width: 100%; max-width: 1240px; overflow: hidden; border-radius: var(--q-radius-lg);
  outline: 6px solid var(--q-surface-ink); box-shadow: var(--q-shadow-stack); position: relative; background: var(--q-bg); }
.pv-tv__inner { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; transform-origin: top left; }
.pv-tv__inner .q-screen-host { min-height: 100%; height: 100%; }
.pv-phone { width: 360px; max-width: 100%; height: 740px; overflow: hidden; border-radius: 36px;
  border: 8px solid var(--q-surface-ink); box-shadow: var(--q-shadow-stack); position: relative; }
.pv-phone .q-screen-player { height: 100%; overflow: auto; }
.pv-phone.q-app { min-height: 0; }
`;
