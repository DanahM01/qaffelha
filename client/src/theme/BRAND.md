# قفّلها · الهوية البصرية

> استوديو تلفزيون من الثمانينات، ولوحاته مرسومة باليد مثل لوحات البقالات.
> ليل أخضر مزرق، دهان كريمي وخردلي وأحمر وأخضر، ظلال ملونة متراكبة، أرقام مضيئة، شمس غروب، وبطاقات أسعار.

شوفوا كل شي حي على **`/preview`** (مع `npm run dev:client`).

| الملف | وش فيه |
|---|---|
| `theme.css` | كل المتغيرات (`--q-…`) وكل الكلاسات المشتركة (`.q-…`) والحركات |
| `Home.jsx` | الرئيسية `<Home />` اللي على `/` (صفحة المنتج، مو تصميم بس) |
| `Logo.jsx` | `<Logo />` + `<PaintFilters />` + أيقونات (`LockIcon`, `CrownIcon`, `CheckIcon`, `XIcon`, `EyeIcon`, `DoorIcon`, `UsersIcon`, `SendIcon`, `TvIcon`, `PhoneIcon`, `QrIcon`) + رسومات النمطين (`BigScreenArt`, `PhonesArt`) |
| `FLOW.md` | فلو اللعبة المعتمد + وش تصمم وش باقي |
| `icon.svg` | أيقونة الموقع (نفس `public/favicon.svg`) |
| `Preview.jsx` | صفحة `/preview`: كل العناصر والحالات + مرجع لكل شاشة في `/host` و `/play` |
| `check-colors.mjs` | يفحص إن ما فيه لون مباشر في `host/` و `player/` |
| `public/` | `favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `logo.svg`, `site.webmanifest`, `fonts/` |

---

## 1. القواعد (لرناد وريف ولأي AI agent)

1. **ممنوع أي لون مباشر داخل `host/` و `player/`**، لا hex ولا `rgb()` ولا `hsl()`. استخدموا `var(--q-…)` أو كلاس `.q-…`.
   افحصوا قبل الـ PR: `node src/theme/check-colors.mjs` (من مجلد `client`).
2. استخدموا **الأدوار** (`--q-correct`, `--q-surface` …) مو علب الدهان الخام (`--q-green-600` …).
3. **انتبهوا للسياقين:** الخلفية داكنة ونصها `--q-text` (كريمي)، واللوحات الكريمية (`.q-card`, `.q-input`, `.q-score-row` …) نصها `--q-ink` (حبر). الكلاسات تضبط هذا لحالها.
4. `<PaintFilters />` مركّب مرة وحدة في `main.jsx`. هو اللي يعطي الحواف «المدهونة». لا تحذفونه ولا تكررونه.
5. كل شي RTL. استخدموا الخصائص المنطقية (`margin-inline-start` …). كود الغرفة والروابط والأرقام: `.q-ltr`.
6. لو تحتاجون لون أو كلاس مو موجود، اطلبوه من دانة.

```jsx
import Logo, { LockIcon, CrownIcon } from "../theme/Logo.jsx";
// theme.css و PaintFilters مستوردين في main.jsx — لا تكررونهم
```

---

## 2. الشعار

«قفّلها» بحروف كريمية مدهونة بفرشاة (حوافها مو مستقيمة)، **والألف فيها قفل**. الشدّة خردلية، وثقب المفتاح أحمر، ووراها **ثلاث ظلال متراكبة**: برتقالي ثم أحمر ثم بنفسجي، مايلة شوي مثل عناوين برامج الثمانينات.
الحروف مسارات من Tajawal Black، فما تعتمد على تحميل الخط.

| الاستخدام | الكود |
|---|---|
| الأساسي (فوق الخلفية الداكنة) | `<Logo size={120} />` |
| مع حركة (رئيسية المضيف) | `<Logo size="min(26vw, 42vh)" animated />` |
| لوحة بقالة: أخضر بإطار أحمر | `<Logo variant="sign" size={160} />` |
| القفل بس | `<Logo variant="mark" size={40} />` |
| فوق خلفية فاتحة | `<Logo tone="onLight" />` |

- لا تغيرون ألوانه ولا ترتيب الظلال، ولا تمطّونه.
- أقل حجم: الأساسي 28px ارتفاع، القفل 18px.

---

## 3. الألوان

### علب الدهان والاستوديو

| المتغير | القيمة | الاستخدام |
|---|---|---|
| `--q-bg` | `#0f3a40` | ليل الاستوديو: خلفية كل الشاشات |
| `--q-panel` | `#16505a` | لوحات داكنة فوق الخلفية |
| `--q-surface` / `-2` / `-3` | `#fbf4dc` / `#f1e6c4` / `#e3d4a8` | لوحات المينا الكريمية |
| `--q-surface-ink` / `--q-border` | `#1a1a1a` | حبر: الحدود، اللوحات السودا |
| `--q-text` | `#fbf4dc` | النص فوق الخلفية الداكنة |
| `--q-text-muted` | `#a9c4bf` | نص ثانوي فوق الداكن |
| `--q-ink` / `--q-ink-muted` | `#1a1a1a` / `#5a5346` | النص فوق اللوحات الكريمية |
| `--q-primary` | `#f2b928` | خردلي: الزر الأساسي، المتصدر، المؤقت |
| `--q-stack-1/2/3` | `#e8703a` / `#c8392b` / `#5e2a5c` | الظل المتراكب (برتقالي، أحمر، بنفسجي) |
| `--q-accent` | `#276aa5` | أزرق: «أنت» في القوائم |

### حالات اللعب

| الحالة | الشكل | الكلاسات |
|---|---|---|
| صح (+1) | لوحة خضرا `--q-correct` و «+1» خردلي كبير | `.q-feedback--correct` `.q-badge--correct` |
| مقفولة (−1) | لوحة حمرا `--q-locked` و «−1» كبير + هزّة | `.q-feedback--locked` `.q-badge--locked` |
| خطأ (0) | لوحة كريمية `--q-wrong` و «0» رمادي، بدون خصم | `.q-feedback--wrong` `.q-badge--wrong` |
| مطرود | إطار متقطع + الاسم مشطوب + ختم «طلع!» + حركة خروج | `.q-eliminated` `.q-stamp` `.q-score-row.is-out` `.q-out-screen` |
| فائز | شمس الغروب تطلع + الاسم بالظل المتراكب + تاج | `.q-winner` `.q-badge--winner` `.q-rank-place--1` |
| رسالة خطأ | نص `--q-error` أو لوحة حمرا | `.q-field__error` `.q-alert` |

### المؤقت

لوحة أرقام مضيئة (`--q-timer-led` على `--q-timer-led-bg`) + **20 لمبة** تطفي وحدة كل ثانية.

| الوقت | الكلاس | لون اللمبات |
|---|---|---|
| 20 → 11 | — | `--q-timer-ok` خردلي |
| 10 → 6 | `is-warn` | `--q-timer-warn` برتقالي |
| 5 → 0 | `is-danger` | `--q-timer-danger` أحمر + الرقم يرمش |

### ألوان اللاعبين

`--q-p1` … `--q-p8` عبر `.q-avatar--1` … `.q-avatar--8` (اللاعب n ياخذ `((n-1) % 8) + 1`).

### التباين

| النص | الخلفية | النسبة |
|---|---|---|
| كريمي | الخلفية | 11.2:1 |
| ثانوي | الخلفية | 6.7:1 |
| حبر | الكريمي | 15.8:1 |
| حبر | الخردلي | 9.7:1 |
| كريمي | الأخضر | 5.8:1 |
| كريمي | الأحمر | 4.7:1 |

«+1» الخردلي فوق الأخضر 3.6:1، وهو مسموح لأنه رقم كبير جداً.

---

## 4. الخطوط

**Tajawal** 400 / 500 / 700 / 800 / 900، مستضاف في `public/fonts` (الرخصة OFL في `public/fonts/OFL.txt`).
الأرقام المضيئة (المؤقت، النقاط) بخط `--q-font-led` (monospace).

| المتغير | الاستخدام |
|---|---|
| `--q-fs-tv-code` | كود الغرفة |
| `--q-fs-tv-category` | اسم الفئة، اسم الفائز |
| `--q-fs-tv-timer` | رقم المؤقت |
| `--q-fs-tv-title` / `-body` / `-label` | عناوين ونص المضيف |
| `--q-fs-3xl` … `--q-fs-xs` | الجوال |

أحجام التلفزيون تاخذ الأصغر من العرض والارتفاع. العناوين الكبيرة: `.q-stacked` أو `text-shadow: var(--q-text-stack)`.

---

## 5. المكوّنات

| العنصر | الكلاسات |
|---|---|
| أغلفة الشاشات | `.q-app` + `.q-screen-host` (فيها خطوط شاشة تلقائياً) أو `.q-screen-player` |
| شمس الغروب | `<div className="q-sunset" />` كأول عنصر في `.q-screen-host` |
| تخطيط | `.q-stack` `.q-row` `.q-spread` `.q-center` `.q-grow` `.q-host-grid` |
| أزرار | `.q-btn` + `--primary` `--secondary` `--ink` `--ghost` `--success` `--danger` + `--sm` `--lg` `--tv` `--block` + `is-loading` + `disabled` |
| حقول | `.q-field` `.q-label` `.q-input` (`--code` `--answer`) `.q-field.is-invalid` `.q-field__error` `.q-answer-bar` |
| تنبيهات | `.q-alert` `.q-alert--info` |
| لوحات | `.q-card` (`--flat` `--raised` `--highlight` `--dark` `--ink` `--sign`) |
| شارات | `.q-badge` + `--correct` `--locked` `--wrong` `--out` `--winner` `--primary` `--accent` `--ink` `--team-a` `--team-b` |
| كلمة مقفولة | `.q-lock-wall` > `.q-lock-chip` (`__icon` `__by`): بطاقة سعر |
| مؤقت | `.q-timer` (`style="--q-progress: 0..1"`, `is-warn`, `is-danger`) > `.q-timer__num` + `.q-timer__track` > `.q-timer__fill` |
| كود الغرفة | `.q-room-code` > `.q-room-code__char` × 4، والرابط `.q-join-link` |
| لاعبين | `.q-avatar--n` `.q-player-chip` (`is-me`) `.q-player-list` |
| النقاط | `.q-scoreboard` > `.q-score-row` (`__rank` `__name` `__pts`; `is-leader` `is-danger` `is-out` `is-me`) + `.q-score-delta--plus/minus` |
| ردة فعل اللاعب | `.q-feedback--correct/locked/wrong` (`__pts` `__word` `__msg`) + اختياري `.q-flash--correct/locked` |
| نقاطي | `.q-my-score` |
| الفئة والجولة | `.q-category` `.q-round-label` `.q-stacked` |
| طرد | `.q-eliminated` (`__name`) + `.q-stamp` + `.q-anim-exit` · حذف صف: `.q-anim-exit-away` · شاشة اللاعب: `.q-out-screen` |
| فوز | `.q-winner` (`__crown` `__name`) `.q-ranking` `.q-rank-place--1/2/3` |
| انتظار | `.q-waiting` > `.q-waiting__pulse` · `.q-dots` |
| تلفزيون أسود (دخول وانتظار اللاعب؛ اللون من `--q-tv-body`) | `.q-tv` > `.q-tv__antenna` + `.q-tv__screen` + `.q-tv__panel` (`__grille` `__led` `__knob`) |
| كود الغرفة بلمبات | `.q-input--code.q-input--led` |
| وشوشة التلفزيون | `.q-static` (تشويش؛ `is-burst` = قوي أول ثانية) · `.q-glitch` (الشعار يرجف ويتقطع) · `.q-tv-on` (حركة تشغيل التلفزيون) |
| الرئيسية الموحدة (كل الأجهزة) | `<Home />` من `Home.jsx` · `.q-home` (الترتيب بالعرض: ≥ 900px الشاشة الكبيرة أساسي، أقل «ادخل غرفة» أساسي) |
| اختيار النمط (الرئيسية) | `.q-mode` > `.q-mode__art` (`<BigScreenArt />` أو `<PhonesArt />`) + زر `.q-btn` |
| فاصل «أو» / تلميح | `.q-or` · `.q-hint` (مع `<QrIcon />`) |
| حواف مدهونة إضافية | `.q-paint` (قوية) · `.q-paint-soft` (خفيفة) |

أمثلة كاملة لكل شاشة في `/preview` (قسم «مرجع شاشة المضيف» وقسم «مرجع شاشة اللاعب»).

```jsx
const cls = s <= 5 ? "is-danger" : s <= 10 ? "is-warn" : "";
<div className={`q-timer ${cls}`} style={{ "--q-progress": s / 20 }} role="timer">
  <span className="q-timer__num">{String(s).padStart(2, "0")}</span>
  <div className="q-timer__track"><div className="q-timer__fill" /></div>
</div>
```

لإعادة تشغيل حركة (رد فوري، طرد، فوز): غيّروا `key` العنصر.

---

## 6. الحركة

| الحركة | وين |
|---|---|
| `q-slap` | الفئة تنضرب على الشاشة |
| `q-lock-in` | بطاقة السعر تطيح لما تنقفل كلمة |
| `q-pop` + `q-shake` | الرد الفوري؛ المقفولة تهتز |
| `q-join` | لاعب جديد دخل |
| `q-exit` / `q-exit-away` | الطرد |
| `q-stamp` | ختم «طلع!» |
| `q-rise` | شمس الغروب تطلع (الرئيسية والفائز) |
| `q-blink` | آخر 5 ثواني، ونقطة الانتظار |
| `<Logo animated />` | الظلال تطلع ورا بعض والقفل يتهزهز |

كلها تحترم `prefers-reduced-motion`.

---

## 7. سبرنت 2 (ألوان جاهزة — لا تبنون الشاشات الحين)

| العنصر | المتغير | القيمة |
|---|---|---|
| الفريق الأزرق | `--q-team-a` (+ `-soft` `-ink`) | `#276aa5` |
| الفريق البرتقالي | `--q-team-b` (+ `-soft` `-ink`) | `#e8703a` |
| مربع اللوحة 4×4 | `--q-board-tile` / `--q-board-tile-border` | `#fbf4dc` / `#1a1a1a` |
| تجميد | `--q-card-freeze` | `#9cc8ec` |
| قفل | `--q-card-lock` | `#f2b928` |
| لغم | `--q-card-mine` / `--q-card-mine-bg` | `#c8392b` / `#1a1a1a` |
| سرقة | `--q-card-steal` | `#5e2a5c` |

أزرق × برتقالي لأنهم يختلفون في اللون والإضاءة، فيتفرقون حتى مع عمى الألوان.
