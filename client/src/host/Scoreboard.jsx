// Owner: Renad. Live round scoreboard (SPEC §6.3), the .q-flap board from theme/SimV2.jsx.
// Names and out flags come from room:players, points from score:update.
import { useEffect, useRef } from 'react';

// Sizing only, on top of .q-flap. Up to 6 rows the theme's board already fits; from 7 the rows
// lose their spare height so 12 players fit without shrinking the text. The font cap and the
// auto-fit columns only take effect on short or narrow screens (a phone in landscape).
const COMPACT_FROM = 7;
const BOARD_FIT = { fontSize: 'min(var(--q-fs-tv-label), 3.4vh, 1.6vw)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12em), 1fr))' };
const BOARD_COMPACT = { padding: '0.5em', gap: '0.25em' };
const TILE_COMPACT = { minHeight: 0, paddingBlock: 0, paddingInline: '0.3em' };
const NAME_TILE = { minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' };
const NAME_TEXT = { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.15 };

// Active players, highest score first. sort() is stable, so ties keep join order.
function rankPlayers(players, scores) {
  const points = new Map(scores.map((s) => [s.id, s.score]));
  return players
    .filter((p) => !p.out)
    .map((p) => ({ id: p.id, name: p.name, score: points.get(p.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

export default function Scoreboard({ players, scores, title = 'نقاط الجولة' }) {
  const ranked = rankPlayers(players, scores);
  const compact = ranked.length >= COMPACT_FROM;
  const tile = compact ? TILE_COMPACT : undefined;
  const top = ranked[0]?.score ?? 0;
  const low = ranked.at(-1)?.score ?? 0;

  const previous = useRef({});
  const moves = {};
  ranked.forEach((p, i) => {
    const was = previous.current[p.id];
    moves[p.id] = was === undefined ? 0 : was - i;
  });
  useEffect(() => {
    previous.current = Object.fromEntries(ranked.map((p, i) => [p.id, i]));
  });

  // Ties can't be broken here (the server uses lastCorrectAt), so every tied row is marked,
  // and nobody is in danger while all scores are equal.
  const rowClass = (p) => {
    if (p.score === low && low < top) return 'is-danger';
    return p.score === top && top > 0 ? 'is-leader' : '';
  };

  return (
    <div className="q-stack" style={{ gap: '0.6em', fontSize: 'var(--q-fs-tv-label)' }}>
      <span className="q-tv-label" style={{ color: 'var(--q-text)' }}>{title}</span>
      <div className="q-flap q-flap--v2" style={compact ? { ...BOARD_FIT, ...BOARD_COMPACT } : BOARD_FIT}>
        {ranked.map((p, i) => (
          <div key={p.id} className={`q-flap__row ${rowClass(p)}`}>
            <span className={`q-flap__move ${moves[p.id] > 0 ? 'q-flap__move--up' : moves[p.id] < 0 ? 'q-flap__move--down' : ''}`} aria-hidden="true">
              {moves[p.id] > 0 ? '▲' : moves[p.id] < 0 ? '▼' : ''}
            </span>
            <span className="q-flap__tile" style={tile}><span key={i + p.name}>{i + 1}</span></span>
            <span className="q-flap__tile q-flap__tile--name" style={{ ...tile, ...NAME_TILE }}><span key={p.name + i} style={NAME_TEXT}>{p.name}</span></span>
            <span className="q-flap__tile q-flap__tile--score" style={tile}><span key={`${p.id}-${p.score}`}>{p.score < 0 ? `−${Math.abs(p.score)}` : p.score}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
