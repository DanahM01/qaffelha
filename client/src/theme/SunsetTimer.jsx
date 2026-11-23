import { useId } from 'react';

/* --------------------------------------------------------------------------
   مؤقت الغروب — شاشة الجولة في الجوال
   الشمس هي المؤقت: تبدأ فوق وتغيب ورا الأفق مع الوقت، والرقم يمشي معها.
   لما تنزل الشمس تحت، الرقم يوقف على خط الأفق عشان يبقى مقروء.

   <SunsetTimer seconds={16} total={20} round={2} />
   ألوان من theme.css بس (متغيرات --q-*)، والكلاسات .q-dusk*
   -------------------------------------------------------------------------- */

const W = 360;
const H = 170;
const HORIZON = 126;          // خط الأفق
const R = 40;                 // نصف قطر الشمس
const TOP = 30 + R;           // مركز الشمس أول الجولة
const SET = HORIZON + R;      // مركز الشمس لما تغيب كامل
const NUM_FLOOR = HORIZON - 18; // أنزل مكان للرقم (فوق الأفق)
// خطوط الغروب داخل الشمس (نسبة لمركزها) — تعطيها شكل شمس الثمانينات
const CUTS = [
  [5, 2],
  [13, 3],
  [22, 4],
  [31, 5],
];
// البحر: شرايط ألوان الغروب تحت الأفق
const SEA = ['--q-stack-1', '--q-stack-2', '--q-stack-3', '--q-stack-2', '--q-stack-3'];

export default function SunsetTimer({ seconds, total = 20, round }) {
  const id = useId().replace(/:/g, '');
  const left = Math.max(0, Math.min(seconds, total));
  const progress = 1 - left / total;
  const cy = TOP + progress * (SET - TOP);
  const numY = Math.min(cy, NUM_FLOOR);
  const state = left <= 5 ? 'is-danger' : left <= 10 ? 'is-warn' : '';

  let y = HORIZON + 4;
  const sea = SEA.map((color, i) => {
    const h = 3 + i;
    const band = <rect key={i} x="0" y={y} width={W} height={h} fill={`var(${color})`} />;
    y += h + 3;
    return band;
  });

  return (
    <div className={`q-dusk ${state}`}>
      {round != null && <span className="q-dusk__round">الجولة {round}</span>}
      <svg
        className="q-dusk__scene"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${id}-sky`}>
            <rect x="0" y="0" width={W} height={HORIZON} />
          </clipPath>
          <clipPath id={`${id}-disc`}>
            <circle cx={W / 2} cy="0" r={R - 1} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-sky)`}>
          <g className="q-dusk__sun" style={{ transform: `translateY(${cy}px)` }}>
            <circle cx={W / 2} cy="0" r={R} className="q-dusk__disc" />
            <g clipPath={`url(#${id}-disc)`}>
              {CUTS.map(([dy, h]) => (
                <rect key={dy} x={W / 2 - R} y={dy} width={R * 2} height={h} className="q-dusk__cut" />
              ))}
            </g>
            <circle cx={W / 2} cy="0" r={R} className="q-dusk__rim" />
          </g>
        </g>
        <rect x="0" y={HORIZON} width={W} height="4" className="q-dusk__horizon" />
        {sea}
        <text
          x={W / 2}
          y="0"
          className="q-dusk__num"
          style={{ transform: `translateY(${numY}px)` }}
        >
          {String(left).padStart(2, '0')}
        </text>
      </svg>
      <span className="q-sr-only" role="timer" aria-live="off">
        باقي {left} ثانية
      </span>
    </div>
  );
}
