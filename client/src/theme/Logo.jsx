/**
 * قفّلها — Logo
 * الكلمة مدهونة بفرشاة، والألف فيها قفل، ووراها ظلال متراكبة برتقالي/أحمر/بنفسجي.
 *
 * <Logo />                   الشعار الأساسي — فوق الخلفية الداكنة (الافتراضي)
 * <Logo variant="sign" />    لوحة بقالة: أخضر بإطار أحمر
 * <Logo variant="mark" />    القفل بس (الأيقونات، زوايا الشاشة)
 * <Logo tone="onLight" />    فوق خلفية فاتحة: حروف حبر بدون ظلال
 * <Logo size={120} />        الارتفاع بالبكسل أو أي قيمة CSS ("10vw")
 * <Logo animated />          الظلال تطلع ورا بعض والقفل يتهزهز
 *
 * <PaintFilters />           ركّبوه مرة وحدة (موجود في main.jsx): يفعّل الحواف
 *                            المدهونة لكلاسات theme.css
 */
import { useEffect, useId } from "react";

const WORD = "M1037 -160H1130V0H1022Q957 0 910 -30Q859 0 794 0H650Q616 0 586 -10Q555 0 522 0H372V-160H436Q431 -185 431 -207Q431 -272 470 -316Q498 -399 565 -447Q632 -495 721 -495Q844 -495 921 -418Q993 -345 993 -231V-204Q993 -178 1002 -169Q1011 -160 1037 -160ZM794 -160Q818 -160 823 -166Q828 -173 828 -204V-231Q828 -282 799 -311Q770 -340 718 -340Q700 -340 680 -335Q741 -292 741 -207Q741 -185 736 -160ZM586 -168Q631 -184 631 -223Q631 -268 586 -268Q541 -268 541 -223Q541 -184 586 -168Z M1437 -160H1530V0H1422Q1351 0 1301 -36Q1246 0 1170 0H1110V-160H1163Q1201 -160 1214 -174Q1228 -189 1228 -229V-557L1393 -645V-204Q1393 -178 1402 -169Q1411 -160 1437 -160Z M1812 -515Q1775 -515 1752 -538Q1729 -562 1729 -599Q1729 -636 1752 -658Q1775 -681 1812 -681Q1849 -681 1872 -658Q1894 -636 1894 -599Q1894 -561 1872 -538Q1849 -515 1812 -515ZM2000 -160H2118V0H1906Q1851 0 1814 -8Q1777 0 1722 0H1510V-160H1628Q1607 -207 1607 -252Q1607 -354 1668 -417Q1725 -475 1814 -475Q1916 -475 1974 -401Q2021 -340 2021 -252Q2021 -207 2000 -160ZM1814 -176Q1861 -207 1861 -263Q1861 -320 1814 -320Q1767 -320 1767 -264Q1767 -206 1814 -176Z M2326 -515Q2289 -515 2266 -538Q2243 -562 2243 -599Q2243 -636 2266 -658Q2289 -681 2326 -681Q2363 -681 2386 -658Q2408 -636 2408 -599Q2408 -561 2386 -538Q2363 -515 2326 -515ZM2506 -515Q2469 -515 2446 -538Q2423 -562 2423 -599Q2423 -636 2446 -658Q2469 -681 2506 -681Q2543 -681 2566 -658Q2588 -636 2588 -599Q2588 -561 2566 -538Q2543 -515 2506 -515ZM2098 0V-160H2219Q2205 -197 2205 -238Q2205 -350 2268 -416Q2324 -475 2415 -475Q2508 -475 2561 -415Q2607 -364 2607 -282V-196Q2607 -108 2555 -54Q2503 0 2413 0ZM2442 -288Q2442 -320 2415 -320Q2367 -320 2367 -244Q2367 -160 2415 -160Q2442 -160 2442 -192Z";
const SHADDA = "M1894 -956 1986 -1007V-881Q1986 -841 1957 -816Q1928 -790 1882 -790Q1848 -790 1824 -804Q1796 -790 1764 -790Q1719 -790 1690 -816Q1662 -841 1662 -881V-936L1754 -987V-888Q1754 -878 1766 -878Q1778 -878 1778 -888V-946L1870 -997V-888Q1870 -878 1882 -878Q1894 -878 1894 -888Z";
const LOCK_BODY = "M110 -370 H372 Q412 -370 412 -330 V-40 Q412 0 372 0 H110 Q70 0 70 -40 V-330 Q70 -370 110 -370 Z";
const KEYHOLE = "M241 -265 a48 48 0 0 0 -28 87 l-14 108 h84 l-14 -108 a48 48 0 0 0 -28 -87 z";
const SHACKLE = "M151 -360 V-560 a90 90 0 0 1 180 0 V-360";

const C = {
  cream: "var(--q-cream-100)",
  ink: "var(--q-ink-900)",
  mustard: "var(--q-mustard-400)",
  red: "var(--q-red-500)",
  orange: "var(--q-orange-500)",
  plum: "var(--q-plum-600)",
  green: "var(--q-green-600)",
};

function Lock({ fill, keyFill, animated }) {
  return (
    <g transform="rotate(9 241 -185)">
      <g className={animated ? "q-logo__lock" : undefined}>
        <path d={SHACKLE} fill="none" style={{ stroke: fill }} strokeWidth="74" strokeLinecap="round" />
        <path d={LOCK_BODY} style={{ fill }} />
        {keyFill && <path d={KEYHOLE} style={{ fill: keyFill }} />}
      </g>
    </g>
  );
}

function Word({ fill, shadda, keyFill, animated }) {
  return (
    <>
      <path d={WORD} style={{ fill }} />
      <path d={SHADDA} style={{ fill: shadda }} />
      <Lock fill={fill} keyFill={keyFill} animated={animated} />
    </>
  );
}

/* ظلال متراكبة: كل طبقة نسخة مزاحة يسار-تحت */
function Stacked({ children, step = 18, animated }) {
  const layers = [C.plum, C.red, C.orange];
  return (
    <>
      <g className={animated ? "q-logo__stack" : undefined}>
        {layers.map((c, i) => (
          <g key={c} transform={`translate(${-(3 - i) * step} ${(3 - i) * step})`}>
            {children(c)}
          </g>
        ))}
      </g>
    </>
  );
}

function Rough({ id }) {
  return (
    <filter id={id} x="-5%" y="-10%" width="110%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="4" />
      <feDisplacementMap in="SourceGraphic" scale="26" />
    </filter>
  );
}

export default function Logo({
  variant = "full",
  size = 64,
  tone = "onDark",
  animated = false,
  title = "قفّلها",
  className = "",
  style,
  ...rest
}) {
  const fid = `q-logo-rough-${useId().replace(/:/g, "")}`;
  const h = typeof size === "number" ? `${size}px` : size;
  const common = {
    role: "img",
    "aria-label": title,
    xmlns: "http://www.w3.org/2000/svg",
    className: `q-logo q-logo--${variant} ${className}`.trim(),
    style: { height: h, width: "auto", display: "block", overflow: "visible", ...style },
    ...rest,
  };

  if (variant === "mark") {
    return (
      <svg viewBox="-120 -800 640 900" {...common}>
        <defs><Rough id={fid} /></defs>
        <g filter={`url(#${fid})`}>
          <Stacked step={22} animated={animated}>{(c) => <Lock fill={c} />}</Stacked>
          <Lock fill={C.cream} keyFill={C.mustard} animated={animated} />
        </g>
      </svg>
    );
  }

  if (variant === "sign") {
    return (
      <svg viewBox="-220 -1300 3060 1560" {...common}>
        <defs><Rough id={fid} /></defs>
        <g filter={`url(#${fid})`}>
          <rect x="-170" y="-1250" width="2960" height="1460" style={{ fill: C.green }} />
          <rect x="-110" y="-1190" width="2840" height="1340" fill="none" strokeWidth="70" style={{ stroke: C.red }} />
          <g transform="translate(40 -60)">
            <Word fill={C.cream} shadda={C.mustard} keyFill={C.red} animated={animated} />
          </g>
        </g>
      </svg>
    );
  }

  if (tone === "onLight") {
    return (
      <svg viewBox="20 -1100 2640 1180" {...common}>
        <defs><Rough id={fid} /></defs>
        <g filter={`url(#${fid})`}>
          <Word fill={C.ink} shadda={C.red} keyFill={C.mustard} animated={animated} />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="-60 -1100 2720 1260" {...common}>
      <defs><Rough id={fid} /></defs>
      <g filter={`url(#${fid})`} transform="skewX(-6)">
        <Stacked animated={animated}>{(c) => <Word fill={c} shadda={c} />}</Stacked>
        <Word fill={C.cream} shadda={C.mustard} keyFill={C.red} animated={animated} />
      </g>
    </svg>
  );
}

/* فلاتر الحواف المدهونة — ركّبوه مرة وحدة بأعلى التطبيق */
export function PaintFilters() {
  useEffect(() => {
    document.documentElement.classList.add("q-painted");
    return () => document.documentElement.classList.remove("q-painted");
  }, []);
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <filter id="q-rough" x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="7" />
      </filter>
      <filter id="q-rough-soft" x="-3%" y="-6%" width="106%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="3" />
      </filter>
    </svg>
  );
}

/* --------------------------------------------------------------------------
   أيقونات الهوية — stroke icons تأخذ لون النص (currentColor)
   import Logo, { LockIcon, CrownIcon } from "../theme/Logo.jsx";
   -------------------------------------------------------------------------- */
function Icon({ children, size = "1em", title, className = "", ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      aria-label={title}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const LockIcon = (p) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="currentColor" stroke="none" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icon>
);
export const CrownIcon = (p) => (
  <Icon {...p} viewBox="0 0 32 24">
    <path d="M3 8l6 5 7-9 7 9 6-5-2.5 13h-21z" fill="currentColor" />
  </Icon>
);
export const CheckIcon = (p) => (<Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>);
export const XIcon = (p) => (<Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>);
export const EyeIcon = (p) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const DoorIcon = (p) => (
  <Icon {...p}>
    <path d="M14 4h4.5v16H14M10 8l-4 4 4 4M6 12h9" />
  </Icon>
);
export const UsersIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 20a6.5 6.5 0 0 0-3-5.5" />
  </Icon>
);
export const SendIcon = (p) => (<Icon {...p}><path d="M20 12H5M11 5l-7 7 7 7" /></Icon>);
export const TvIcon = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
    <path d="M8 2.5l4 4.5 4-4.5M7 20.5v1.5M17 20.5v1.5" />
  </Icon>
);
export const PhoneIcon = (p) => (
  <Icon {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </Icon>
);
export const QrIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3h-1" />
  </Icon>
);

/* --------------------------------------------------------------------------
   رسومات القنوات (اختيار النمط) — داخل .q-channel__screen
   -------------------------------------------------------------------------- */
const ink = { stroke: "var(--q-ink-900)", strokeWidth: 4, strokeLinejoin: "round" };
function MiniPhone({ x, y, fill, r = 0, cls = "q-art-bob" }) {
  return (
    <g className={cls} transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-13" y="-22" width="26" height="44" rx="6" style={{ fill, ...ink }} />
      <rect x="-8" y="-15" width="16" height="24" rx="2" style={{ fill: "var(--q-cream-100)" }} />
      <path d="M-4 15h8" style={{ stroke: "var(--q-ink-900)", strokeWidth: 3, strokeLinecap: "round" }} />
    </g>
  );
}

/* 📺 شاشة كبيرة: تلفزيون فيه شمس الغروب + جوالات حوله */
export function BigScreenArt() {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <g transform="translate(100 62)">
        <path d="M-14 -44l14 12 14-12" style={{ fill: "none", ...ink }} strokeLinecap="round" />
        <rect x="-62" y="-32" width="124" height="80" rx="12" style={{ fill: "var(--q-ink-900)", ...ink }} />
        <clipPath id="q-art-tv"><rect x="-54" y="-24" width="108" height="64" rx="9" /></clipPath>
        <g clipPath="url(#q-art-tv)">
          <rect x="-54" y="-24" width="108" height="64" style={{ fill: "var(--q-teal-800)" }} />
          <circle cx="0" cy="44" r="46" style={{ fill: "var(--q-plum-600)" }} />
          <circle cx="0" cy="44" r="37" style={{ fill: "var(--q-red-500)" }} />
          <circle cx="0" cy="44" r="28" style={{ fill: "var(--q-orange-500)" }} />
          <circle cx="0" cy="44" r="19" style={{ fill: "var(--q-mustard-400)" }} />
          <text x="0" y="6" textAnchor="middle" style={{ fill: "var(--q-cream-100)", font: "900 22px Tajawal, sans-serif" }}>فواكه</text>
        </g>
      </g>
      <MiniPhone x={34} y={124} fill="var(--q-mustard-400)" r={-12} />
      <MiniPhone x={78} y={130} fill="var(--q-red-500)" r={-4} />
      <MiniPhone x={122} y={130} fill="var(--q-green-600)" r={4} />
      <MiniPhone x={166} y={124} fill="var(--q-orange-500)" r={12} />
    </svg>
  );
}

/* 📱 جوالات بس: جوالات في دائرة حول قفل */
export function PhonesArt() {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <circle cx="100" cy="75" r="50" style={{ fill: "none", stroke: "var(--q-cream-100)", strokeWidth: 3, strokeDasharray: "6 8", opacity: 0.6 }} />
      <g transform="translate(100 78) scale(0.075) translate(-241 185)">
        <g transform="rotate(9 241 -185)">
          <path d={SHACKLE} fill="none" style={{ stroke: "var(--q-cream-100)" }} strokeWidth="80" strokeLinecap="round" />
          <path d={LOCK_BODY} style={{ fill: "var(--q-cream-100)" }} />
          <path d={KEYHOLE} style={{ fill: "var(--q-red-500)" }} />
        </g>
      </g>
      <MiniPhone x={100} y={28} fill="var(--q-mustard-400)" />
      <MiniPhone x={152} y={76} fill="var(--q-green-600)" r={90} />
      <MiniPhone x={100} y={124} fill="var(--q-red-500)" r={180} />
      <MiniPhone x={48} y={76} fill="var(--q-orange-500)" r={-90} />
    </svg>
  );
}
export const ShareIcon = (p) => (
  <Icon {...p}>
    <circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" />
    <path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4" />
  </Icon>
);
