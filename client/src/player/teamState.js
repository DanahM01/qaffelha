// Reef / PB-15: render server payloads without deciding winners or captures.
export const TEAM_EVENTS = Object.freeze({
  board: "board:update",
  mines: "board:mines",
  turn: "turn:start",
  chosen: "battle:chosen",
  end: "battle:end",
  sitout: "team:sitout",
  card: "card:played",
});

export const TEAM_NAMES = Object.freeze({
  A: "الفريق الأول",
  B: "الفريق الثاني",
});

export function myTeam(state, playerId) {
  return (
    state.players?.find((player) => player.id === playerId)?.team ??
    (state.me?.id === playerId ? state.me.team : null) ??
    null
  );
}

export function isSittingOut(state, playerId) {
  const team = myTeam(state, playerId);
  if (!team) return false;
  return state.sitout && Object.hasOwn(state.sitout, team)
    ? state.sitout[team] === playerId
    : Boolean(state.me?.id === playerId && state.me.sittingOut);
}

export function applyTeamEvent(state, event, payload) {
  switch (event) {
    case TEAM_EVENTS.board:
      return {
        ...state,
        gameMode: "teams",
        board: payload.board,
        teamPoints: payload.teamPoints,
        cards: payload.cards,
      };
    case TEAM_EVENTS.mines:
      return { ...state, mines: payload.mines };
    case TEAM_EVENTS.turn:
      return {
        ...state,
        gameMode: "teams",
        status: "turn",
        turn: payload,
        chosen: null,
        battleResult: null,
        cardChoices: {},
        teamScores: { A: 0, B: 0 },
      };
    case TEAM_EVENTS.chosen:
      return { ...state, status: "cardWindow", chosen: payload };
    case TEAM_EVENTS.end:
      return {
        ...state,
        status: "battleEnd",
        battleResult: payload,
        scores: payload.scores,
        teamScores: payload.teamScores,
      };
    case TEAM_EVENTS.sitout:
      return { ...state, sitout: payload };
    case TEAM_EVENTS.card:
      return {
        ...state,
        lastCard: payload,
        cardChoices: state.sitout?.[payload.team]
          ? { ...state.cardChoices, [payload.team]: payload.card }
          : state.cardChoices,
      };
    default:
      return state;
  }
}
