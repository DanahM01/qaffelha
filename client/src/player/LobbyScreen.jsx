import { QRCodeSVG } from "qrcode.react";
import Logo, { CrownIcon, ShareIcon } from "../theme/Logo.jsx";

export default function LobbyScreen({
  code,
  players,
  meId,
  hostId,
  isHost,
  onStart,
  onShare,
  busy,
  message,
}) {
  const joinUrl = `${window.location.origin}/play/${code}`;
  if (!isHost) return <GuestWaiting code={code} players={players} meId={meId} hostId={hostId} />;
  const ready = players.length >= 3;
  const slots = Math.max(0, 4 - players.length);
  // Phone host lobby, from PhoneHostLobby in theme/Preview.jsx: a ticket with the QR on top and the code below.
  return (
    <div className="q-m-lobby q-grow" style={{ display: "flex", flexDirection: "column", gap: "var(--q-space-3)" }}>
      <div className="q-m-bar">
        <Logo size={30} />
        <span className="q-m-tag q-ltr">
          <span className="q-m-tag__dot" />
          CH 02 · {code}
        </span>
      </div>
      <h1 className="q-m-title q-m-title--md" style={{ textAlign: "center" }}>
        صوّروا وادخلوا!
      </h1>
      <div className="q-m-pass">
        <div className="q-m-pass__qr">
          <QRCodeSVG value={joinUrl} size={256} marginSize={1} bgColor="transparent" title="باركود دخول الغرفة" />
        </div>
        <div className="q-m-pass__cut" />
        <div className="q-m-pass__code">
          <span className="q-m-pass__label">أو اكتبوا الكود</span>
          <div className="q-room-code" aria-label={`كود الغرفة ${code.split("").join(" ")}`}>
            {code.split("").map((c, i) => (
              <span key={i} className="q-room-code__char">{c}</span>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="q-btn q-btn--success q-btn--sm q-m-pass-share"
        style={{ alignSelf: "center" }}
        onClick={onShare}
      >
        <ShareIcon size="1.1em" />
        شارك الرابط
      </button>
      {message && (
        <p role="status" className="q-muted" style={{ textAlign: "center" }}>
          {message}
        </p>
      )}
      <div className="q-grow" />
      <div className="q-stack" style={{ gap: "var(--q-space-2)" }}>
        <span className="q-m-section-label">
          اللاعبين <b className="q-ltr">{players.length}/12</b>
        </span>
        <div className="q-m-players" aria-live="polite" aria-label="اللاعبين">
          {players.map((player, index) => (
            <span key={player.id} className={`q-player-chip ${player.id === meId ? "is-me" : ""}`}>
              <span className={`q-avatar q-avatar--${(index % 8) + 1}`} aria-hidden="true">
                {player.name[0]}
              </span>
              <span title={player.name}>
                {player.name}
                {!player.connected ? " — انقطع" : ""}
              </span>
              {player.id === hostId && <CrownIcon title="المضيف" />}
            </span>
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <span key={`slot-${i}`} className="q-slot">
              {i === 0 ? "بانتظار…" : ""}
            </span>
          ))}
        </div>
      </div>
      <div className="q-start" style={{ width: "100%" }}>
        <button
          type="button"
          className="q-btn q-btn--primary q-btn--lg q-btn--block"
          disabled={busy || !ready}
          onClick={onStart}
        >
          ابدأ
        </button>
        <span className="q-start__note">
          {ready ? "الكل جاهز؟ يلا!" : "تحتاجون 3 لاعبين على الأقل (أنت منهم)"}
        </span>
      </div>
    </div>
  );
}

// Guest lobby, from the design in theme/PhoneSim.jsx (Waiting): on-air tag, big title, players, how to play.
function GuestWaiting({ code, players, meId, hostId }) {
  const slots = Math.max(0, 4 - players.length);
  return (
    <>
      <div className="q-m-bar">
        <Logo size={30} />
        <span className="q-m-tag q-ltr">
          <span className="q-m-tag__dot" />
          CH 01 · {code}
        </span>
      </div>
      <div
        className="q-m-hero"
        style={{ gap: "var(--q-space-4)", minHeight: "min(15rem, 62vw)", marginInline: "calc(var(--q-space-4) * -1)", overflowX: "clip" }}
      >
        <div className="q-m-sun" style={{ "--_w": "min(105%, 26rem)" }} />
        <h1 className="q-m-title" style={{ fontSize: "clamp(1.9rem, 9vw, 2.8rem)" }}>
          دخلت!
          <br />
          انتظر المضيف يبدأ
        </h1>
      </div>
      <div className="q-stack" style={{ gap: "var(--q-space-2)" }}>
        <span className="q-m-section-label">
          اللاعبين <b className="q-ltr">{players.length}/12</b>
        </span>
        <div className="q-m-players" aria-live="polite" aria-label="اللاعبين">
          {players.map((player, index) => (
            <span
              key={player.id}
              className={`q-player-chip ${player.id === meId ? "is-me" : ""}`}
            >
              <span
                className={`q-avatar q-avatar--${(index % 8) + 1}`}
                aria-hidden="true"
              >
                {player.name[0]}
              </span>
              <span title={player.name}>
                {player.name}
                {player.id === meId ? " (أنت)" : ""}
                {!player.connected ? " — انقطع" : ""}
              </span>
              {player.id === hostId && <CrownIcon title="المضيف" />}
            </span>
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <span key={`slot-${i}`} className="q-slot">
              {i === 0 ? "بانتظار…" : ""}
            </span>
          ))}
        </div>
      </div>
      <details className="q-m-rules">
        <summary className="q-round-label q-m-rules__title">طريقة اللعب</summary>
        <ol>
          <li>
            <span className="q-step__n">1</span>الفئة تطلع، وعندك 20 ثانية
          </li>
          <li>
            <span className="q-step__n">2</span>اكتب كلمة من الفئة قبل غيرك{" "}
            <em className="is-plus">+1</em>
          </li>
          <li>
            <span className="q-step__n">3</span>تكتب كلمة أحد قفّلها قبلك{" "}
            <em className="is-minus">−1</em>
          </li>
          <li>
            <span className="q-step__n">4</span>أقل واحد بالنقاط يطلع
          </li>
        </ol>
      </details>
    </>
  );
}
