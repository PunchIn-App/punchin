import { useState, useEffect } from 'react'

// A `now` timestamp (ms epoch) that advances on an interval while `active` is
// true, so durations derived from a RUNNING timer re-render live instead of
// going stale until punch-out (issue #265). When `active` is false (nothing
// running) it holds a static value and registers no interval, so an idle app
// never re-renders just to tick a clock.
//
// `intervalMs` trades smoothness for cost: 1000 for minute-granularity text
// tiles/totals, a coarser value (e.g. 30000) for expensive surfaces like the
// Recharts analytics view where a per-second re-render isn't worth it.
export function useNowTicker(active, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now()) // resync immediately on becoming active
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return now
}
