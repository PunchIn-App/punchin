import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mutable holders the mocked hooks read from (vi.mock factories are hoisted).
const h = vi.hoisted(() => ({ settings: {}, entries: [], jobs: [], perm: 'granted' }))

// useReminders calls useLiveQuery three times per render in a fixed order
// (settings, entries, jobs); cycle through the holders with a mod-3 counter.
vi.mock('dexie-react-hooks', () => {
  let i = 0
  return {
    useLiveQuery: () => {
      const v = [h.settings, h.entries, h.jobs][i % 3]
      i++
      return v
    },
  }
})

vi.mock('../db', () => ({ db: { settings: {}, entries: {}, jobs: {} } }))

const mockShow = vi.fn().mockResolvedValue(true)
vi.mock('../utils/notifications', () => ({
  showNotification: (...args) => mockShow(...args),
  notificationPermission: () => h.perm,
}))

import { useReminders } from './useReminders'

beforeEach(() => {
  mockShow.mockClear()
  h.settings = {}
  h.entries = []
  h.jobs = []
  h.perm = 'granted'
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

describe('useReminders', () => {
  it('fires a notification when an enabled reminder condition is met', async () => {
    h.settings = { remindersEnabled: true, remindLongRunning: true, remindLongRunningMinutes: 60 }
    h.entries = [{ id: 1, jobId: 1, punchIn: new Date(Date.now() - 90 * 60000) }]
    h.jobs = [{ id: 1, name: 'Acme' }]
    renderHook(() => useReminders())
    await waitFor(() => expect(mockShow).toHaveBeenCalled())
    expect(mockShow.mock.calls[0][0]).toBe('Timer still running')
  })

  it('does nothing when reminders are disabled', async () => {
    h.settings = { remindersEnabled: false }
    renderHook(() => useReminders())
    await new Promise(r => setTimeout(r, 20))
    expect(mockShow).not.toHaveBeenCalled()
  })

  it('does nothing when notification permission is not granted', async () => {
    h.settings = { remindersEnabled: true, remindLongRunning: true }
    h.entries = [{ id: 1, jobId: 1, punchIn: new Date(Date.now() - 90 * 60000) }]
    h.perm = 'default'
    renderHook(() => useReminders())
    await new Promise(r => setTimeout(r, 20))
    expect(mockShow).not.toHaveBeenCalled()
  })
})
