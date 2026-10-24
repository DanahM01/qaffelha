// Owner: Reef. Phone routes share one server-authoritative session.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../theme/Logo.jsx';
import usePlayerSession from './usePlayerSession.js';
import JoinScreen from './JoinScreen.jsx';
import LobbyScreen from './LobbyScreen.jsx';

export default function PlayerApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = usePlayerSession(navigate);
  const [sharingError, setSharingError] = useState('');
  const segment = location.pathname.split('/')[2] || '';
  const host = segment === 'new';
  const code = host ? '' : segment.toUpperCase();
  const isHost = session.state.mode === 'phone' && session.state.hostId === session.identity?.playerId;

  async function share() {
    const url = `${window.location.origin}/play/${session.identity.code}`;
    setSharingError('');
    try {
      if (navigator.share) await navigator.share({ title: 'قفّلها', url });
      else { await navigator.clipboard.writeText(url); setSharingError('تم نسخ الرابط'); }
    } catch (error) {
      if (error.name !== 'AbortError') setSharingError('ما قدرنا نشارك الرابط. انسخه من الحقل تحت.');
    }
  }

  return <main className="q-app" dir="rtl" lang="ar"><div className="q-screen-player">
    {(session.reconnecting || !session.connected) && <p className="q-alert q-alert--info" role="status">{session.identity ? 'نرجعك للعبة…' : 'جاري الاتصال…'}</p>}
    {session.identity ? <>
      {session.state.status === 'lobby' ? <LobbyScreen code={session.identity.code} players={session.state.players}
        meId={session.identity.playerId} hostId={session.state.hostId} isHost={isHost} onStart={session.start} onShare={share}
        busy={session.busy || session.reconnecting || !session.connected} message={sharingError} />
        : <><Logo size={40} /><p className="q-waiting">استعدوا…</p></>}
      {session.error && <p className="q-field__error" role="alert">{session.error}</p>}
    </> : session.reconnecting ? <Logo size={64} animated /> : <JoinScreen key={`${host}-${code}`} host={host} initialCode={code}
      busy={session.busy || !session.connected} error={session.error} onSubmit={session.join} onBack={() => navigate('/')} clearError={session.clearError} />}
  </div></main>;
}
