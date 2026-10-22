/**
 * /flow — كل شاشة لحالها بمقاسها الحقيقي، للنقل لفيقما بإضافة html.to.design
 * افتحي /flow للقائمة، وكل رابط يفتح شاشة وحدة.
 * لابتوب/تلفزيون: 1440×900   ·   جوال: 390×844
 */
import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import "./theme.css";
import { Home, HostLobby, PhoneHostName, PhoneHostLobby } from "./Preview.jsx";
import { Countdown, Round, RoundEnd, Results } from "./HostScreens.jsx";

const P = [
  { id: 1, name: "ريف" }, { id: 2, name: "لين" }, { id: 3, name: "دانة" }, { id: 4, name: "رناد" }, { id: 5, name: "ليان" },
];
const URL = typeof window !== "undefined" ? `${window.location.host}/play` : "/play";

export const SCREENS = [
  { key: "home-desktop", group: "الرئيسية (صفحة وحدة)", title: "الرئيسية — شاشة عريضة", device: "tv", el: <Home />, next: "العب على شاشة كبيرة ← host-lobby-empty · العب بالجوالات بس ← phones-host-name · ادخل غرفة ← (جوال) الدخول بالكود ثم الاسم" },
  { key: "home-mobile", group: "الرئيسية (صفحة وحدة)", title: "الرئيسية — جوال (نفس الصفحة بعرض 390)", device: "phone", el: <Home />, next: "ادخل غرفة ← الدخول بالكود ثم الاسم · العب بالجوالات بس ← phones-host-name · العب على شاشة كبيرة ← host-lobby-empty (هذا الجهاز يصير الشاشة الكبيرة)" },
  { key: "host-lobby-empty", group: "شاشة كبيرة", title: "الانتظار — لسه ما اكتملوا", device: "tv", el: <HostLobby players={P.slice(0, 2)} joinUrl={URL} />, next: "(يدخل لاعب ثالث) ← host-lobby-ready" },
  { key: "host-lobby-ready", group: "شاشة كبيرة", title: "الانتظار — جاهزين", device: "tv", el: <HostLobby players={P} joinUrl={URL} />, next: "ابدأ ← host-countdown" },
  { key: "host-countdown", group: "شاشة كبيرة", title: "العد التنازلي", device: "tv", el: <Countdown n={3} round={1} />, next: "(تلقائي) ← host-round" },
  { key: "host-round", group: "شاشة كبيرة", title: "الجولة", device: "tv", el: <Round round={2} category="فواكه" seconds={9} alive={5} deltas={{}} locked={[{ word: "تفاح", by: "ريف" }, { word: "موز", by: "لين" }, { word: "رمان", by: "دانة" }, { word: "مانجو", by: "رناد" }, { word: "عنب", by: "ليان" }, { word: "فراولة", by: "ريف" }]} players={P.map((p, i) => ({ ...p, score: [3, 2, 1, 1, -1][i] }))} />, next: "(خلص الوقت) ← host-round-end" },
  { key: "host-round-end", group: "شاشة كبيرة", title: "نهاية الجولة — طلع!", device: "tv", el: <RoundEnd round={2} out={{ ...P[4], score: -1 }} players={P.map((p, i) => ({ ...p, score: [3, 2, 1, 1, -1][i] }))} isFinal={false} onNext={() => {}} />, next: "الجولة الجاية ← host-countdown · (آخر جولة) شوف الفائز ← host-results" },
  { key: "host-results", group: "شاشة كبيرة", title: "النتائج", device: "tv", el: <Results winner={P[0]} order={[P[0], { ...P[1], outRound: 4 }, { ...P[2], outRound: 3 }, { ...P[3], outRound: 2 }, { ...P[4], outRound: 1 }]} onAgain={() => {}} onHome={() => {}} />, next: "العب مرة ثانية ← host-lobby-ready · رجوع للرئيسية ← home-desktop" },
  { key: "phones-host-name", group: "جوالات بس", title: "المضيف يكتب اسمه", device: "phone", el: <PhoneHostName />, next: "افتح الغرفة ← phones-host-lobby · رجوع ← home-mobile" },
  { key: "phones-host-lobby", group: "جوالات بس", title: "الانتظار — جوال المضيف", device: "phone", el: <PhoneHostLobby players={[{ id: 3, name: "دانة" }, P[0]]} />, next: "(يدخل لاعب ثالث) ← phones-host-lobby-ready" },
  { key: "phones-host-lobby-ready", group: "جوالات بس", title: "الانتظار — جاهزين", device: "phone", el: <PhoneHostLobby players={[{ id: 3, name: "دانة" }, P[0], P[1], P[3]]} />, next: "ابدأ ← العد التنازلي (قريباً)" },
];

export default function Flow() {
  const { screen } = useParams();
  const s = SCREENS.find((x) => x.key === screen);
  useEffect(() => { document.documentElement.dir = "rtl"; document.documentElement.lang = "ar"; document.title = s ? `قفّلها · ${s.title}` : "قفّلها · الفلو"; }, [s]);

  if (s) {
    const size = s.device === "tv" ? { width: 1440, height: 900 } : { width: 390, height: 844 };
    return (
      <div className="q-app" dir="rtl" style={{ ...size, minHeight: 0, overflow: "hidden", position: "relative" }}>
        <style>{`.q-flow-shot .q-screen-host, .q-flow-shot .q-screen-player, .q-flow-shot .q-home { min-height: ${size.height}px; height: ${size.height}px; }`}</style>
        <div className="q-flow-shot" style={size}>{s.el}</div>
      </div>
    );
  }

  return (
    <div className="q-app" dir="rtl" style={{ padding: "2rem", minHeight: "100vh" }}>
      <h1 className="q-stacked" style={{ fontSize: "var(--q-fs-3xl)" }}>الفلو — شاشة شاشة</h1>
      <p className="q-muted" style={{ marginBlock: "0.5rem 1.5rem" }}>كل رابط يفتح شاشة وحدة بمقاسها. انقليها لفيقما بإضافة html.to.design (لابتوب 1440×900، جوال 390×844).</p>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 1100 }}>
        <thead><tr>{["#", "المجموعة", "الشاشة", "المقاس", "الرابط", "الأزرار تودي على"].map((h) => <th key={h} style={{ textAlign: "start", padding: "0.5rem", borderBottom: "2px dashed var(--q-text-muted)" }}>{h}</th>)}</tr></thead>
        <tbody>
          {SCREENS.map((x, i) => (
            <tr key={x.key}>
              <td style={{ padding: "0.5rem" }}>{i + 1}</td>
              <td style={{ padding: "0.5rem" }}>{x.group}</td>
              <td style={{ padding: "0.5rem" }}>{x.title}</td>
              <td style={{ padding: "0.5rem" }} className="q-ltr">{x.device === "tv" ? "1440×900" : "390×844"}</td>
              <td style={{ padding: "0.5rem" }}><Link to={`/flow/${x.key}`} style={{ color: "var(--q-primary)" }} className="q-ltr">/flow/{x.key}</Link></td>
              <td style={{ padding: "0.5rem", color: "var(--q-text-muted)", fontSize: "var(--q-fs-sm)" }}>{x.next}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
