// Owner: Renad. The 4-letter room code as LED tiles (.q-room-code, always LTR).
export default function RoomCode({ code, small = false }) {
  return (
    <div className={`q-room-code ${small ? 'q-room-code--sm' : ''}`} role="img" aria-label={`كود الغرفة ${code.split('').join(' ')}`}>
      {code.split('').map((c, i) => (
        <span key={i} className="q-room-code__char" aria-hidden="true">{c}</span>
      ))}
    </div>
  );
}
