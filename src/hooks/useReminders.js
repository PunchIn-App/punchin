import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { evaluateReminders } from '../utils/reminders'
import { showNotification, notificationPermission } from '../utils/notifications'

// Drives local reminder notifications (issue #54). Mounted once at the app
// root, it watches settings + live timers and, while reminders are enabled and
// permission is granted, evaluates the reminder rules on a slow interval (and
// whenever the tab becomes visible again). There is no backend — notifications
// only fire while the app is running, so this is a best-effort, no-Web-Push
// reminder system.

const STATE_KEY = 'pi.reminderState'
const CHECK_INTERVAL_MS = 30000

// Returns the persisted de-dup map, or null when storage is unavailable
// (private mode) so callers can fall back to the in-memory ref (issue #158).
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}')
  } catch {
    return null
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable (private mode); reminders just won't de-dupe across reloads */
  }
}

export function useReminders() {
  const settings = useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    return rows.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
  }, [])
  const activeEntries = useLiveQuery(() => db.entries.filter(e => e.punchOut == null).toArray(), [])
  const jobs = useLiveQuery(() => db.jobs.toArray(), [])

  // In-memory de-dup map, used as the fallback when localStorage is unavailable.
  const stateRef = useRef(null)
  if (stateRef.current === null) stateRef.current = loadState() ?? {}

  // Gate the interval on whether reminders are enabled only — NOT on permission.
  // Permission is checked inside run() so granting it mid-session starts firing
  // on the next poll and revoking it stops, without needing an unrelated dep
  // change to re-subscribe (issue #160).
  useEffect(() => {
    if (!settings?.remindersEnabled) return

    let cancelled = false
    const run = async () => {
      if (notificationPermission() !== 'granted') return

      // Re-read the persisted map so a fire from another open tab is seen here;
      // otherwise each tab keeps its own ref and both fire the same reminder
      // (issue #158). Falls back to the in-memory ref in private mode.
      const prev = loadState() ?? stateRef.current
      const { fire, state } = evaluateReminders({
        now: new Date(),
        settings,
        activeEntries: activeEntries || [],
        jobs: jobs || [],
        state: prev,
      })
      stateRef.current = state
      // Only write when something actually changed, not on every 30s tick (#161).
      if (JSON.stringify(state) !== JSON.stringify(prev)) saveState(state)
      for (const n of fire) {
        if (cancelled) break
        await showNotification(n.title, { body: n.body, tag: n.key })
      }
    }

    run()
    const id = setInterval(run, CHECK_INTERVAL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [settings, activeEntries, jobs])
}
