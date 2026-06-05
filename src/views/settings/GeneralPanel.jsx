import { Layers, Calendar, Vibrate, Clock, Hourglass } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { usePlatformContext } from '../../hooks/usePlatformContext'
import { Panel, SettingsRow, Toggle } from './components'

const selectClass =
  'bg-appInput border border-appBorder text-appText rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-appAccent/50'

export default function GeneralPanel({ onBack }) {
  const { settings, updateSetting } = useSettings()
  const { os, isIPad } = usePlatformContext()

  // Haptics only fire on phones (iPhone via the Taptic polyfill, Android via
  // vibrate). iPads have no vibration motor and desktop has none, so hide it.
  const canHaptic = os === 'android' || (os === 'ios' && !isIPad)

  return (
    <Panel title="General" onBack={onBack}>
      <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
        <SettingsRow
          icon={Layers}
          title="Concurrent timers"
          subtitle="Run multiple jobs at the same time"
          right={
            <Toggle
              ariaLabel="Allow concurrent timers"
              value={!!settings.allowConcurrentTimers}
              onChange={v => updateSetting('allowConcurrentTimers', v)}
            />
          }
        />
        <SettingsRow
          icon={Calendar}
          title="Week starts Monday"
          subtitle="Off = week starts Sunday"
          right={
            <Toggle
              ariaLabel="Week starts Monday"
              value={settings.weekStartsMonday !== false}
              onChange={v => updateSetting('weekStartsMonday', v)}
            />
          }
        />
        <SettingsRow
          icon={Clock}
          title="Decimal hours"
          subtitle="Show timesheet durations as 1.50 h instead of 1h 30m"
          right={
            <Toggle
              ariaLabel="Show durations as decimal hours"
              value={!!settings.decimalHours}
              onChange={v => updateSetting('decimalHours', v)}
            />
          }
        />
        <SettingsRow
          icon={Hourglass}
          title="Round billed time"
          subtitle="Rounds each entry in your favour (start down, end up) in timesheets and invoices"
          right={
            <select
              aria-label="Round billed time to the nearest"
              value={settings.roundingMinutes ?? 0}
              onChange={e => updateSetting('roundingMinutes', Number(e.target.value))}
              className={selectClass}
            >
              <option value={0}>Off</option>
              <option value={15}>¼ hour</option>
              <option value={30}>½ hour</option>
            </select>
          }
        />
        {canHaptic && (
          <SettingsRow
            icon={Vibrate}
            title="Haptic feedback"
            subtitle="Vibrate on key actions and navigation"
            right={
              <Toggle
                ariaLabel="Haptic feedback"
                value={settings.hapticFeedback !== false}
                onChange={v => updateSetting('hapticFeedback', v)}
              />
            }
          />
        )}
      </div>
    </Panel>
  )
}
