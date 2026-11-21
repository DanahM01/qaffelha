// Owner: Renad. Team Mode lobby (SPEC §17.2): «الفريق الأول» (A) and «الفريق الثاني» (B) side by side.
// Pressing a player asks the server to move them (team:set); the columns only change when
// room:players comes back, because the server owns the teams.
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

export const TEAM_NAMES = { A: 'الفريق الأول', B: 'الفريق الثاني' };
const OTHER = { A: 'B', B: 'A' };

// Unassigned players go to the smaller team (A on a tie), like new joiners (SPEC §17.2).
export function nextTeam(player, players) {
  if (player.team === 'A' || player.team === 'B') return OTHER[player.team];
  const a = players.filter((p) => p.team === 'A').length;
  const b = players.filter((p) => p.team === 'B').length;
  return a <= b ? 'A' : 'B';
}

// Buttons keep the chip look; the theme styles .q-player-chip, the browser styles <button>.
const CHIP_BUTTON = { font: 'inherit', cursor: 'pointer' };

function PlayerButton({ player, index, players, onMove, busy }) {
  const to = nextTeam(player, players);
  return (
    <button
      type="button"
      className="q-player-chip"
      style={CHIP_BUTTON}
      disabled={busy}
      onClick={() => onMove(player.id, to)}
      aria-label={`${player.name}: انقل إلى ${TEAM_NAMES[to]}`}
    >
      <span className={`q-avatar q-avatar--${(index % 8) + 1}`} aria-hidden="true">{player.name[0]}</span>
      {player.name}
    </button>
  );
}

// The team name is the first item of its own list, so a column adds no extra row.
function Group({ label, badgeClass, players, all, onMove, busy }) {
  return (
    <div className="q-player-list" style={{ flex: '1 1 0', minWidth: 0, alignItems: 'center', alignContent: 'flex-start' }}>
      <span className={badgeClass}>{label} ({AR(players.length)})</span>
      {players.map((p) => <PlayerButton key={p.id} player={p} index={all.indexOf(p)} players={all} onMove={onMove} busy={busy} />)}
    </div>
  );
}

export default function TeamColumns({ players, onMove, busy = false }) {
  const unassigned = players.filter((p) => p.team !== 'A' && p.team !== 'B');
  const shared = { all: players, onMove, busy };
  return (
    <div className="q-stack" style={{ gap: '0.6em' }} aria-live="polite">
      <div className="q-row" style={{ gap: 'var(--q-space-5)', alignItems: 'flex-start' }}>
        <Group label={TEAM_NAMES.A} badgeClass="q-badge q-badge--team-a" players={players.filter((p) => p.team === 'A')} {...shared} />
        <Group label={TEAM_NAMES.B} badgeClass="q-badge q-badge--team-b" players={players.filter((p) => p.team === 'B')} {...shared} />
      </div>
      {unassigned.length > 0 && <Group label="بدون فريق" badgeClass="q-badge" players={unassigned} {...shared} />}
    </div>
  );
}
