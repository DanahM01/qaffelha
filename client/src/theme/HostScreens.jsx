/**
 * شاشات الشاشة الكبيرة للمرجع في /flow (العد التنازلي، الجولة، نهاية الجولة، النتائج).
 * تصميم بس: بيانات ثابتة، بدون سيرفر. الشاشات الحقيقية تنبني في client/src/host.
 */
import "./theme.css";
import Logo, { LockIcon, CrownIcon, UsersIcon } from "./Logo.jsx";
import { Avatar, FlapBoard } from "./Preview.jsx";

const ROUND_SECONDS = 20;
const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

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
