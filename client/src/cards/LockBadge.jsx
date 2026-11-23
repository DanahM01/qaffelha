import { LockIcon } from '../theme/Logo.jsx';

const TEAM_NAMES = { A: 'الفريق الأول', B: 'الفريق الثاني' };
export default function LockBadge({ lockedBy, host = false }) {
  if (!TEAM_NAMES[lockedBy]) return null;
  return <span className="q-badge q-badge--primary" role="status" aria-label="بطاقة القفل فعالة"
    style={host ? { fontSize: 'var(--q-fs-tv-label)', justifyContent: 'center', whiteSpace: 'normal' } : undefined}>
    <LockIcon /> قفل: الإجابة الصحيحة <span className="q-ltr">+2</span> لـ{TEAM_NAMES[lockedBy]}
  </span>;
}
