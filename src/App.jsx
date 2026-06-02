import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import ErrorBoundary  from './components/ErrorBoundary'
import TimerView      from './views/TimerView'
import JobsView       from './views/JobsView'
import TimesheetsView from './views/TimesheetsView'
import AnalyticsView  from './views/AnalyticsView'
import SettingsView   from './views/SettingsView'
import { useSettings } from './hooks/useSettings'

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
  const accentColor = settings.accentColor || '#F59E0B'

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
