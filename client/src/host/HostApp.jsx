// Owner: Renad. Main screen (TV / laptop): room code, lobby, category, timer, locked words, scoreboard.
import Logo from '../theme/Logo.jsx';

export default function HostApp() {
  return (
    <main className="screen">
      <Logo size={96} />
      <p className="muted">شاشة المضيف: قيد البناء</p>
    </main>
  );
}
