import { useState } from 'react'
import Layout from './components/Layout'
import TimerView      from './views/TimerView'
import JobsView       from './views/JobsView'
import TimesheetsView from './views/TimesheetsView'
import AnalyticsView  from './views/AnalyticsView'
import SettingsView   from './views/SettingsView'

export default function App() {
  const [activeView, setActiveView] = useState('timer')

  const views = {
    timer:      <TimerView />,
    jobs:       <JobsView />,
    timesheets: <TimesheetsView />,
    analytics:  <AnalyticsView />,
    settings:   <SettingsView />,
  }

  return (
    <Layout activeView={activeView} onNavigate={setActiveView}>
      {views[activeView]}
    </Layout>
  )
}
