/**
 * الرئيسية <Home /> — صفحة المنتج الفعلية على "/" (مو صفحة تصميم بس).
 * main.jsx يربط الأزرار: ادخل غرفة ← /play · العب على شاشة كبيرة ← /host · العب بالجوالات بس ← /play/new
 */
import Logo, { BigScreenArt, PhonesArt } from "./Logo.jsx";

/* تلفزيون مصغّر لشاشات الجوال (نسخة التلفزيون) */
export function PhoneTvBox({ children, paper, off, burst, className = "" }) {
  return (
    <div className={`q-tv q-m-tv ${className}`}>
      <span className="q-tv__antenna" />
      <div className={`q-tv__screen ${paper ? "is-paper" : ""} ${off ? "is-off" : ""}`}>{burst && <div className="q-static is-burst" />}{children}</div>
      <div className="q-tv__panel"><span className="q-tv__grille" /><span className="q-tv__led" /><span className="q-tv__knob" /><span className="q-tv__knob" /></div>
    </div>
  );
}

/* الرئيسية: صفحة وحدة لكل الأجهزة (رابط واحد للموقع).
   نفس الأزرار الثلاثة دايماً، والترتيب والحجم يتغيرون بعرض الشاشة بس (container query في theme.css):
   عريضة ≥ 900px: «العب على شاشة كبيرة» هو الأساسي · أضيق: «ادخل غرفة» هو الأساسي.
   tv = التلفزيون الأسود حول الشعار في العرض الضيق (نسخة التلفزيون). */
export function Home({ onJoin, onBigScreen, onPhones, tv }) {
  return (
    <div className="q-home">
      <div className="q-home__in">
        <div className="q-sunburst q-home__wide" />
        <div className="q-static is-burst q-home__wide" />
        <div className="q-m-hero q-home__hero">
          {tv ? (
            <PhoneTvBox burst className="q-m-tv--lg q-home__narrow"><div className="q-glitch q-tv-on"><Logo size={74} animated /></div></PhoneTvBox>
          ) : <div className="q-m-sun q-home__narrow" />}
          <div className={`q-glitch q-tv-on q-home__logo ${tv ? "q-home__wide" : ""}`}><Logo size="var(--_logo)" animated /></div>
          <span className="q-m-ticket q-home__ticket">اكتبها قبلهم… وقفّلها!</span>
        </div>
        <div className="q-home__actions">
          <button type="button" className="q-btn q-home__btn q-home__btn--join" onClick={onJoin}>ادخل غرفة</button>
          <div className="q-or q-home__or">أو افتح غرفة جديدة</div>
          <div className="q-home__modes">
            <div className="q-mode q-home__mode--big"><span className="q-mode__art"><BigScreenArt /></span><button type="button" className="q-btn q-home__btn q-home__btn--big" onClick={onBigScreen}>العب على شاشة كبيرة</button></div>
            <div className="q-mode q-home__mode--phones"><span className="q-mode__art"><PhonesArt /></span><button type="button" className="q-btn q-home__btn q-home__btn--phones" onClick={onPhones}>العب بالجوالات بس</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
