// Owner: Danah (theme). Small mute button on Home and the big screen.
// Not shown on phone game screens, so it never covers the answer bar. The choice is remembered.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isMuted, onMuteChange, setMuted } from './sound.js';

export default function SoundToggle() {
  const [muted, setState] = useState(isMuted);
  const { pathname } = useLocation();
  useEffect(() => onMuteChange(setState), []);
  if (pathname !== '/' && !pathname.startsWith('/host')) return null;
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? 'شغّل الصوت' : 'اكتم الصوت'}
      title={muted ? 'شغّل الصوت' : 'اكتم الصوت'}
      style={{
        position: 'fixed',
        insetInlineStart: 12,
        bottom: 12,
        zIndex: 50,
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '1px solid rgba(255,176,32,.4)',
        background: 'rgba(20,20,24,.75)',
        color: '#FFB020',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
        {muted ? (
          <>
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </>
        ) : (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 5a10 10 0 0 1 0 14" />
          </>
        )}
      </svg>
    </button>
  );
}
