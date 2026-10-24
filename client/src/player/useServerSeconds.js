import { useEffect, useState } from "react";

// This only draws the deadline supplied by the server; it never advances game state.
export default function useServerSeconds(deadline, offset) {
  const remaining = () =>
    Math.max(
      0,
      Math.ceil(((deadline || 0) - Date.now() - offset.current) / 1000),
    );
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    setSeconds(remaining());
    const interval = setInterval(() => setSeconds(remaining()), 100);
    return () => clearInterval(interval);
  }, [deadline, offset]);
  return seconds;
}
