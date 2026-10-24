export default function RankingList({ ranking, meId, eliminatedId, scores = false }) {
  return <ol className="q-scoreboard" aria-label={scores ? 'ترتيب الجولة' : 'الترتيب النهائي'}>
    {ranking.map((player, index) => <li key={player.id} className={`q-score-row ${player.id === eliminatedId ? 'is-out' : index === 0 ? 'is-leader' : ''} ${player.id === meId ? 'is-me' : ''}`}>
      <span className="q-score-row__rank q-ltr">{player.place ?? index + 1}</span>
      <span className={`q-avatar q-avatar--${index % 8 + 1}`} aria-hidden="true">{player.name?.[0]}</span>
      <span className="q-score-row__name">{player.name}{player.id === meId ? ' (أنت)' : ''}</span>
      {scores && <span className="q-score-row__pts q-ltr">{player.score}</span>}
    </li>)}
  </ol>;
}
