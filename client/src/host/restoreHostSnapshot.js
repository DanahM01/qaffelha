// PB-28. Restore display state from the server's snapshot without replaying game rules.
export function restoreHostSnapshot(state) {
  const countdown = state.status === 'countdown' ? { round: state.round, startsAt: state.startsAt } : null;
  const roundInfo = state.status === 'round' ? { round: state.round, category: state.category,
    endsAt: state.endsAt, locked: [...state.locked].reverse(), scores: state.scores } : null;
  const roundEnd = state.status === 'roundEnd' && state.eliminated ? (() => {
    const active = new Set(state.players.filter(player => !player.out || player.id === state.eliminated.id).map(player => player.id));
    const names = new Map(state.players.map(player => [player.id, player.name]));
    const scores = state.scores.filter(score => active.has(score.id))
      .map(score => ({ ...score, name: names.get(score.id) })).sort((a, b) => b.score - a.score);
    return { round: state.round, scores, eliminated: state.eliminated,
      avatarIndex: Math.max(0, state.players.findIndex(player => player.id === state.eliminated.id)),
      lastRound: scores.length <= 2 };
  })() : null;
  const gameOver = state.status === 'over' && state.winner && state.ranking ?
    { winner: state.winner, ranking: state.ranking } : null;
  return { players: state.players, countdown, roundInfo, roundEnd, gameOver,
    resuming: !(state.status === 'lobby' || countdown || roundInfo || roundEnd || gameOver) };
}
