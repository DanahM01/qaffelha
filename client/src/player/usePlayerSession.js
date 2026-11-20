// Owner: Reef. Only sends documented intents; game decisions belong to the server.
import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";
import { TEAM_EVENTS, applyTeamEvent, myTeam } from "./teamState.js";

const CREATE = "room:create";
const JOIN = "room:join";
const REJOIN = "room:rejoin";
const PLAYERS = "room:players";
const START = "game:start";
const COUNTDOWN = "round:countdown";
const ROUND_START = "round:start";
const ANSWER = "answer:submit";
const LOCKED = "answer:locked";
const SCORES = "score:update";
const ROUND_END = "round:end";
const OVER = "game:over";
const RESTART = "game:restart";
const CHOOSE = "square:choose";
const PLAY_CARD = "card:play";
const ERRORS = {
  NOT_FOUND: "الغرفة مو موجودة",
  NAME_TAKEN: "الاسم مأخوذ",
  NAME_INVALID: "الاسم غير صالح",
  STARTED: "اللعبة بدأت",
  FULL: "الغرفة مليانة",
  NOT_HOST: "البدء عند المضيف بس",
  NOT_ENOUGH_PLAYERS: "تحتاجون 3 لاعبين على الأقل",
};
const EMPTY = { status: "lobby", mode: null, hostId: null, players: [] };

function storedIdentity() {
  try {
    const value = JSON.parse(sessionStorage.getItem("qaffelha"));
    return value &&
      /^[A-HJ-NP-Z]{4}$/.test(value.code) &&
      typeof value.playerId === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

export default function usePlayerSession(navigate) {
  const [identity, setIdentity] = useState(storedIdentity);
  const identityRef = useRef(identity);
  const [state, setState] = useState(EMPTY);
  const [connected, setConnected] = useState(socket.connected);
  const [reconnecting, setReconnecting] = useState(Boolean(identity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const roundRef = useRef(null);
  const offset = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const reconnectAction = useRef(null);
  const clearError = useCallback(() => setError(""), []);
  const request = useCallback(
    (event, payload) =>
      new Promise((resolve) => {
        socket
          .timeout(6000)
          .emit(event, payload, (timeout, response) =>
            resolve(timeout ? null : response),
          );
      }),
    [],
  );

  useEffect(() => {
    mounted.current = true;
    const epoch = ++generation.current;
    let reconnectRequest = 0;
    async function reconnect() {
      setConnected(true);
      if (!identityRef.current) return;
      const attempt = ++reconnectRequest;
      setReconnecting(true);
      const response = await request(REJOIN, identityRef.current);
      if (
        !mounted.current ||
        epoch !== generation.current ||
        attempt !== reconnectRequest
      )
        return;
      setReconnecting(false);
      if (!response) {
        setReconnecting(true);
        setError("ما قدرنا نرجعك للغرفة. حاول مرة ثانية.");
        return;
      }
      if (!response.ok) {
        if (response.error === "NOT_FOUND") {
          try {
            sessionStorage.removeItem("qaffelha");
          } catch {
            /* Storage may be unavailable. */
          }
          identityRef.current = null;
          setIdentity(null);
          setState(EMPTY);
          navigate("/", { replace: true });
        } else setError(ERRORS[response.error] || "ما قدرنا نرجعك للغرفة");
        return;
      }
      offset.current = response.serverTime - Date.now();
      roundRef.current =
        response.state.status === "round" ? response.state.endsAt : null;
      setState(response.state);
      setError("");
    }
    const disconnect = () => {
      ++reconnectRequest;
      roundRef.current = null;
      setConnected(false);
      setReconnecting(Boolean(identityRef.current));
    };
    const players = (payload) =>
      setState((current) =>
        current.gameMode !== "teams" &&
        current.status === "over" &&
        payload.players.every((player) => !player.out)
          ? { ...EMPTY, ...payload, scores: [], locked: [], me: null }
          : { ...current, ...payload },
      );
    const countdown = (payload) => {
      roundRef.current = null;
      setFeedback(null);
      setState((current) => ({ ...current, ...payload, status: "countdown" }));
    };
    const roundStart = (payload) => {
      roundRef.current = payload.endsAt;
      setFeedback(null);
      setState((current) => ({
        ...current,
        ...payload,
        status: "round",
        locked: [],
        teamScores: { A: 0, B: 0 },
        scores: current.players.map(({ id }) => ({ id, score: 0 })),
      }));
    };
    const locked = (payload) =>
      setState((current) =>
        current.status === "round"
          ? {
              ...current,
              locked: [
                ...(current.locked || []).filter(
                  (entry) => entry.word !== payload.word,
                ),
                payload,
              ],
            }
          : current,
      );
    const scores = (payload) =>
      setState((current) => ({
        ...current,
        scores: payload.scores,
        ...(payload.teamScores ? { teamScores: payload.teamScores } : {}),
      }));
    const roundEnd = (payload) => {
      roundRef.current = null;
      setFeedback(null);
      setState((current) => ({
        ...current,
        ...payload,
        status: "roundEnd",
        players: current.players.map((player) =>
          player.id === payload.eliminated.id
            ? { ...player, out: true }
            : player,
        ),
        me:
          current.me?.id === payload.eliminated.id
            ? { ...current.me, out: true }
            : current.me,
      }));
    };
    const over = (payload) => {
      roundRef.current = null;
      setFeedback(null);
      setState((current) => ({ ...current, ...payload, status: "over" }));
    };
    socket.on("connect", reconnect);
    socket.on("disconnect", disconnect);
    socket.on(PLAYERS, players);
    socket.on(COUNTDOWN, countdown);
    socket.on(ROUND_START, roundStart);
    socket.on(LOCKED, locked);
    socket.on(SCORES, scores);
    socket.on(ROUND_END, roundEnd);
    socket.on(OVER, over);
    const teamListeners = Object.values(TEAM_EVENTS).map((event) => {
      const listener = (payload) => {
        if (
          event === TEAM_EVENTS.end ||
          event === TEAM_EVENTS.turn ||
          event === TEAM_EVENTS.chosen
        ) {
          roundRef.current = null;
          setFeedback(null);
        }
        setState((current) => applyTeamEvent(current, event, payload));
      };
      socket.on(event, listener);
      return [event, listener];
    });
    reconnectAction.current = reconnect;
    if (socket.connected) reconnect();
    return () => {
      mounted.current = false;
      ++generation.current;
      reconnectAction.current = null;
      socket.off("connect", reconnect);
      socket.off("disconnect", disconnect);
      socket.off(PLAYERS, players);
      socket.off(COUNTDOWN, countdown);
      socket.off(ROUND_START, roundStart);
      socket.off(LOCKED, locked);
      socket.off(SCORES, scores);
      socket.off(ROUND_END, roundEnd);
      socket.off(OVER, over);
      teamListeners.forEach(([event, listener]) => socket.off(event, listener));
    };
  }, [navigate, request]);

  async function join({ code, name, host }) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const response = await request(
      host ? CREATE : JOIN,
      host ? { mode: "phone", name } : { code, name },
    );
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!response) {
      setError("ما وصلنا رد. تأكد من الاتصال وحاول مرة ثانية.");
      return;
    }
    if (!response.ok) {
      setError(ERRORS[response.error] || "ما قدرنا ندخلك الغرفة");
      return;
    }
    const next = {
      code: host ? response.code : code,
      playerId: response.playerId,
    };
    identityRef.current = next;
    setIdentity(next);
    try {
      sessionStorage.setItem("qaffelha", JSON.stringify(next));
    } catch {
      /* Gameplay can continue without persistence. */
    }
    offset.current = response.serverTime - Date.now();
    setState((current) => ({
      ...current,
      status: "lobby",
      ...(host ? { mode: "phone", hostId: next.playerId } : {}),
    }));
    navigate(`/play/${next.code}`, { replace: true });
  }

  async function start() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const response = await request(START, { code: identityRef.current.code });
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!response?.ok)
      setError(
        response
          ? ERRORS[response.error] || "ما قدرنا نبدأ"
          : "ما وصلنا رد. حاول مرة ثانية.",
      );
  }

  async function answer(text) {
    const round = roundRef.current;
    if (!round || !socket.connected || Date.now() + offset.current >= round)
      return;
    const response = await request(ANSWER, {
      code: identityRef.current.code,
      text,
    });
    if (!mounted.current || round !== roundRef.current) return;
    if (!response) {
      setError("ما وصلنا رد على إجابتك. تأكد من الاتصال.");
      return;
    }
    setError("");
    setFeedback({
      result: response.result,
      text,
      delta: response.delta,
      sequence: performance.now(),
    });
    // Scores are rendered from score:update. An older acknowledgement must not overwrite a newer broadcast.
  }

  async function restart() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const response = await request(RESTART, { code: identityRef.current.code });
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!response?.ok) {
      setError(
        response ? "إعادة اللعب عند المضيف بس" : "ما وصلنا رد. حاول مرة ثانية.",
      );
      return;
    }
    setState((current) => ({
      ...current,
      status: "lobby",
      me: null,
      locked: [],
      scores: [],
      eliminated: null,
      winner: null,
      ranking: [],
      winnerTeam: undefined,
      line: null,
      board: [],
      turn: null,
      chosen: null,
      sitout: { A: null, B: null },
      cardChoices: {},
      teamScores: { A: 0, B: 0 },
    }));
  }

  async function chooseSquare(squareId, options = {}) {
    if (pending.current || !socket.connected) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const turnEndsAt = state.turn?.endsAt;
    const response = await request(CHOOSE, {
      code: identityRef.current.code,
      squareId,
      ...(options.steal ? { steal: true } : {}),
    });
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!response?.ok) {
      const messages = {
        NOT_YOUR_TURN: "مو دور فريقك",
        TAKEN: "المربع مأخوذ",
        NO_CARD: "بطاقة السرقة مستخدمة",
        BAD_TARGET: "اختار مربع متاح",
        SITTING_OUT: "أنت تختار بطاقة فريقك هالجولة",
      };
      setError(
        response
          ? messages[response.error] || "ما قدرنا نختار المربع"
          : "ما وصلنا رد. حاول مرة ثانية.",
      );
    }
    if (response?.ok && options.steal)
      setState((current) => {
        if (current.turn?.endsAt !== turnEndsAt) return current;
        const team = myTeam(current, identityRef.current.playerId);
        return current.sitout?.[team]
          ? {
              ...current,
              cardChoices: { ...current.cardChoices, [team]: "steal" },
            }
          : current;
      });
    return Boolean(response?.ok);
  }

  async function playCard(card, target) {
    if (pending.current || !socket.connected) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    const turnEndsAt = state.turn?.endsAt;
    const response = await request(PLAY_CARD, {
      code: identityRef.current.code,
      card,
      ...(target != null ? { target } : {}),
    });
    pending.current = false;
    if (!mounted.current) return false;
    setBusy(false);
    if (!response?.ok) {
      const messages = {
        NO_CARD: "البطاقة مستخدمة",
        NOT_NOW: "مو وقت هالبطاقة",
        NOT_ALLOWED:
          "اختيار البطاقة عند لاعب الفريق اللي يرتاح هالجولة، والاختيار نهائي",
        BAD_TARGET: "اختار مربع مناسب للبطاقة",
      };
      setError(
        response
          ? messages[response.error] || "ما قدرنا نستخدم البطاقة"
          : "ما وصلنا رد. حاول مرة ثانية.",
      );
    } else
      setState((current) => {
        if (current.turn?.endsAt !== turnEndsAt) return current;
        const team = myTeam(current, identityRef.current.playerId);
        return current.sitout?.[team]
          ? {
              ...current,
              cardChoices: { ...current.cardChoices, [team]: card },
            }
          : current;
      });
    return Boolean(response?.ok);
  }

  return {
    identity,
    state,
    connected,
    reconnecting,
    busy,
    error,
    clearError,
    join,
    start,
    offset,
    feedback,
    answer,
    restart,
    chooseSquare,
    playCard,
    retry: () => reconnectAction.current?.(),
  };
}
