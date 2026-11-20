// Owner: Reef. Phone routes share one server-authoritative session.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "../theme/Logo.jsx";
import usePlayerSession from "./usePlayerSession.js";
import JoinScreen from "./JoinScreen.jsx";
import LobbyScreen from "./LobbyScreen.jsx";
import CountdownScreen from "./CountdownScreen.jsx";
import RoundScreen from "./RoundScreen.jsx";
import RoundEndScreen from "./RoundEndScreen.jsx";
import ResultsScreen from "./ResultsScreen.jsx";
import TeamBadge from "./TeamBadge.jsx";
import TeamResultsScreen from "./TeamResultsScreen.jsx";
import TeamBoardScreen from "./TeamBoardScreen.jsx";
import TeamCardChoices from "./TeamCardChoices.jsx";
import { myTeam } from "./teamState.js";

export default function PlayerApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = usePlayerSession(navigate);
  const [sharingError, setSharingError] = useState("");
  const [targetCard, setTargetCard] = useState(null);
  useEffect(() => {
    setTargetCard(null);
  }, [session.state.status, session.state.turn?.endsAt]);
  const segment = location.pathname.split("/")[2] || "";
  const host = segment === "new";
  const code = host ? "" : segment.toUpperCase();
  const isHost =
    session.state.mode === "phone" &&
    session.state.hostId === session.identity?.playerId;

  async function share() {
    const url = `${window.location.origin}/play/${session.identity.code}`;
    setSharingError("");
    try {
      if (navigator.share) await navigator.share({ title: "قفّلها", url });
      else {
        await navigator.clipboard.writeText(url);
        setSharingError("تم نسخ الرابط");
      }
    } catch (error) {
      if (error.name !== "AbortError")
        setSharingError("ما قدرنا نشارك الرابط. خلهم يكتبون الكود.");
    }
  }

  const round = session.identity && session.state.status === "round";
  const teams = session.identity && session.state.gameMode === "teams";
  const team = myTeam(session.state, session.identity?.playerId);
  const targets = targetCard
    ? (session.state.board || [])
        .filter((square) =>
          targetCard === "mine"
            ? square.owner === null &&
              !(session.state.mines || []).includes(square.id)
            : square.owner && square.owner !== team,
        )
        .map((square) => square.id)
    : undefined;
  const busy = session.busy || session.reconnecting || !session.connected;
  function selectCard(card) {
    if (card === "mine" || card === "steal") setTargetCard(card);
    else void session.playCard(card);
  }
  async function chooseSquare(id) {
    const accepted =
      targetCard === "mine"
        ? await session.playCard("mine", id)
        : await session.chooseSquare(id, { steal: targetCard === "steal" });
    if (accepted) setTargetCard(null);
  }
  const cardChoices = teams && (
    <TeamCardChoices
      state={session.state}
      meId={session.identity.playerId}
      offset={session.offset}
      busy={busy}
      onCard={selectCard}
      targetCard={targetCard}
      onCancel={() => setTargetCard(null)}
    />
  );
  return (
    <main className="q-app" dir="rtl" lang="ar">
      <div
        className={
          round
            ? `q-home q-m q-m-round ${teams ? "q-team-round" : ""}`
            : teams && session.state.status !== "lobby"
              ? "q-screen-player q-team-screen"
              : "q-screen-player"
        }
      >
        {(session.reconnecting || !session.connected) && (
          <p className="q-alert q-alert--info" role="status">
            {session.identity ? "نرجعك للعبة…" : "جاري الاتصال…"}
          </p>
        )}
        {session.reconnecting && session.connected && session.error && (
          <button type="button" className="q-btn" onClick={session.retry}>
            حاول مرة ثانية
          </button>
        )}
        {session.identity ? (
          <>
            {session.state.gameMode === "teams" &&
              session.state.status !== "over" && (
                <TeamBadge
                  state={session.state}
                  meId={session.identity.playerId}
                />
              )}
            {session.state.status === "lobby" ? (
              <LobbyScreen
                code={session.identity.code}
                players={session.state.players}
                meId={session.identity.playerId}
                hostId={session.state.hostId}
                isHost={isHost}
                onStart={session.start}
                onShare={share}
                busy={
                  session.busy || session.reconnecting || !session.connected
                }
                message={sharingError}
              />
            ) : teams &&
              ["turn", "cardWindow", "battleEnd"].includes(
                session.state.status,
              ) ? (
              <TeamBoardScreen
                state={session.state}
                meId={session.identity.playerId}
                offset={session.offset}
                busy={busy}
                onChoose={chooseSquare}
                targets={targets}
              >
                {cardChoices}
              </TeamBoardScreen>
            ) : session.state.status === "countdown" ? (
              <CountdownScreen state={session.state} offset={session.offset} />
            ) : round ? (
              <>
                {teams && (
                  <>
                    <div className="q-m-me q-team-points">
                      <span>
                        نقاط الأول<b>{session.state.teamScores?.A ?? 0}</b>
                      </span>
                      <span>
                        نقاط الثاني<b>{session.state.teamScores?.B ?? 0}</b>
                      </span>
                    </div>
                    {cardChoices}
                  </>
                )}
                <RoundScreen
                  key={session.state.endsAt}
                  state={session.state}
                  meId={session.identity.playerId}
                  offset={session.offset}
                  feedback={session.feedback}
                  disabled={!session.connected || session.reconnecting}
                  onAnswer={session.answer}
                />
              </>
            ) : session.state.status === "roundEnd" ? (
              <RoundEndScreen
                state={session.state}
                meId={session.identity.playerId}
              />
            ) : session.state.status === "over" ? (
              session.state.gameMode === "teams" ? (
                <TeamResultsScreen
                  state={session.state}
                  meId={session.identity.playerId}
                  isHost={isHost}
                  busy={
                    session.busy || session.reconnecting || !session.connected
                  }
                  onAgain={session.restart}
                />
              ) : (
                <ResultsScreen
                  state={session.state}
                  meId={session.identity.playerId}
                  isHost={isHost}
                  busy={
                    session.busy || session.reconnecting || !session.connected
                  }
                  onAgain={session.restart}
                />
              )
            ) : (
              <>
                <Logo size={40} />
                <p className="q-waiting">استعدوا…</p>
              </>
            )}
            {session.error && (
              <p className="q-field__error" role="alert">
                {session.error}
              </p>
            )}
          </>
        ) : session.reconnecting ? (
          <Logo size={64} animated />
        ) : (
          <JoinScreen
            key={`${host}-${code}`}
            host={host}
            initialCode={code}
            busy={session.busy || !session.connected}
            error={session.error}
            onSubmit={session.join}
            onBack={() => navigate("/")}
            clearError={session.clearError}
          />
        )}
      </div>
    </main>
  );
}
