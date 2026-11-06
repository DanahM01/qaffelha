// Owner: Renad. Locked words wall (SPEC §6.3), newest first. Chips start big and step down
// until every word fits without scrolling (.q-lock-wall--fill sizes, as in theme/SimV2.jsx).
import { useLayoutEffect, useRef, useState } from 'react';
import { LockIcon } from '../theme/Logo.jsx';

const SIZES = ['is-xl', 'is-lg', 'is-md', 'is-sm'];

export default function LockedWords({ locked }) {
  const wall = useRef(null);
  const [sizeIndex, setSizeIndex] = useState(0);

  useLayoutEffect(() => {
    const el = wall.current;
    if (locked.length === 0) setSizeIndex(0);
    else if (el.scrollHeight > el.clientHeight + 1 && sizeIndex < SIZES.length - 1) setSizeIndex(sizeIndex + 1);
  }, [locked, sizeIndex]);

  return (
    <div ref={wall} className={`q-lock-wall q-lock-wall--fill ${SIZES[sizeIndex]}`} aria-live="polite">
      {locked.length === 0 && <span className="q-tv-label">أول واحد يكتب كلمة صحيحة يقفّلها…</span>}
      {locked.map((l) => (
        <span key={l.word} className="q-lock-chip">
          <LockIcon className="q-lock-chip__icon" />
          {l.word}
          <span className="q-lock-chip__by">{l.by.name}</span>
        </span>
      ))}
    </div>
  );
}
