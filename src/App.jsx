import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import ErrorBoundary  from './components/ErrorBoundary'
import TimerView      from './views/TimerView'
import JobsView       from './views/JobsView'
import TimesheetsView from './views/TimesheetsView'
import AnalyticsView  from './views/AnalyticsView'
import SettingsView   from './views/SettingsView'
import { useSettings } from './hooks/useSettings'
import { db } from './db'

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

export default function App() {
  const [activeView, setActiveView] = useState('timer')
  const { settings } = useSettings()

  const theme       = settings.theme       || 'auto'
  const accentColor = settings.accentColor || '#1f6feb'

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = e => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = window.document.documentElement
    if (resolvedTheme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-rgb', hexToRgb(accentColor))
  }, [accentColor])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolvedTheme === 'light' ? '#F3F4F6' : '#0F1117')
  }, [resolvedTheme])

  // Handle OAuth callback tokens written into the URL hash by the provider
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash === '#') return
    const params = new URLSearchParams(hash.slice(1))

    if (params.has('sync_error')) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
      db.settings.put({ key: 'syncError', value: params.get('sync_error') })
      return
    }

    // GitHub: token comes via our Cloudflare Worker callback
    if (params.has('sync_token') && params.get('sync_provider') === 'github') {
      const token = params.get('sync_token')
      db.settings.bulkPut([
        { key: 'syncProvider', value: 'github' },
        { key: 'syncToken', value: token },
        { key: 'syncTokenExpiry', value: null },
        { key: 'syncFileId', value: null },
        { key: 'syncError', value: null },
      ]).then(() => {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      })
      return
    }

    // Google / OneDrive: token comes via implicit flow, provider passed as `state`
    if (params.has('access_token') && params.has('state')) {
      const provider = params.get('state')
      if (provider !== 'google' && provider !== 'onedrive') return
      const token = params.get('access_token')
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10) * 1000
      db.settings.bulkPut([
        { key: 'syncProvider', value: provider },
        { key: 'syncToken', value: token },
        { key: 'syncTokenExpiry', value: Date.now() + expiresIn },
        { key: 'syncFileId', value: null },
        { key: 'syncError', value: null },
      ]).then(() => {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      })
    }
  }, [])

  const views = {
    timer:      <TimerView />,
    jobs:       <JobsView />,
    timesheets: <TimesheetsView />,
    analytics:  <AnalyticsView />,
    settings:   <SettingsView />,
  }

  return (
    <Layout activeView={activeView} onNavigate={setActiveView}>
      <ErrorBoundary key={activeView}>
        {views[activeView]}
      </ErrorBoundary>
    </Layout>
  )
}
