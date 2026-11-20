import { TEAM_NAMES, myTeam } from './teamState.js';

export default function TeamBadge({ state, meId }) {
  const team = myTeam(state, meId);
  if (!team) return <p className="q-muted" role="status">بانتظار توزيع الفرق</p>;
  return <span className={`q-badge q-badge--team-${team.toLowerCase()}`}>
    فريقك: {TEAM_NAMES[team]}
  </span>;
}
