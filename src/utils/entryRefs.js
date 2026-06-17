// Resolve an entry's job / labor-type for display, falling back to the frozen
// snapshot captured at delete time (entry.frozenRefs) when the live record is
// gone. `frozen` is true when the fallback was used, so callers can render the
// reference as inert "unlinked" plaintext instead of a live, interactive record.

export function entryJob(entry, liveJob) {
  if (liveJob) return { job: liveJob, frozen: false }
  const f = entry?.frozenRefs?.job
  return f ? { job: f, frozen: true } : { job: null, frozen: false }
}

export function entryLabor(entry, liveLabor) {
  if (liveLabor) return { laborType: liveLabor, frozen: false }
  const f = entry?.frozenRefs?.laborType
  return f ? { laborType: f, frozen: true } : { laborType: null, frozen: false }
}
