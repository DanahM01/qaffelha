import { useEffect, useState } from 'react';
import { LockIcon } from '../theme/Logo.jsx';

const TEAM_NAMES = { A: 'الفريق الأول', B: 'الفريق الثاني' };
const LAYER = { position: 'fixed', insetInline: 0, insetBlockStart: 'var(--q-space-4)', zIndex: 60,
  display: 'flex', justifyContent: 'center', pointerEvents: 'none', paddingInline: 'var(--q-space-3)' };

export default function LockNotice({ notice, host = false }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(notice?.card === 'lock');
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  return <div style={LAYER} role="status" aria-live="polite">
    {visible && notice?.card === 'lock' && <span className={`q-card-notice ${host ? 'q-card-notice--tv' : ''}`}
      style={{ background: 'var(--q-card-lock)', color: 'var(--q-ink)', maxWidth: '100%' }}>
      <LockIcon /> <span>{notice.by.name} فعّل القفل لـ{TEAM_NAMES[notice.team]}</span>
    </span>}
  </div>;
}
