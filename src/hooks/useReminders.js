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

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}')
  } catch {
    return {}
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

  const stateRef = useRef(null)
  if (stateRef.current === null) stateRef.current = loadState()

  useEffect(() => {
    if (!settings?.remindersEnabled || notificationPermission() !== 'granted') return

    let cancelled = false
    const run = async () => {
      const { fire, state } = evaluateReminders({
        now: new Date(),
        settings,
        activeEntries: activeEntries || [],
        jobs: jobs || [],
        state: stateRef.current,
      })
      stateRef.current = state
      saveState(state)
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
