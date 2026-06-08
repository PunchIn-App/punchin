import { Layers, Calendar, Vibrate, Clock, Hourglass, Watch } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { usePlatformContext } from '../../hooks/usePlatformContext'
import EntitySelect from '../../components/EntitySelect'
import { Panel, SettingsRow, Toggle } from './components'

const TIME_FORMAT_OPTIONS = [
  { value: 'auto', label: 'Auto (match device)' },
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
]
const ROUNDING_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 15, label: '¼ hour' },
  { value: 30, label: '½ hour' },
]

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
          icon={Watch}
          title="Time format"
          subtitle="How clock times show in timesheets and invoices"
          right={
            <div className="w-44 flex-shrink-0">
              <EntitySelect
                compact plain hideLabel
                label="Time format"
                value={settings.timeFormat || 'auto'}
                onChange={v => updateSetting('timeFormat', v)}
                options={TIME_FORMAT_OPTIONS}
              />
            </div>
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
            <div className="w-44 flex-shrink-0">
              <EntitySelect
                compact plain hideLabel
                label="Round billed time to the nearest"
                value={settings.roundingMinutes ?? 0}
                onChange={v => updateSetting('roundingMinutes', Number(v))}
                options={ROUNDING_OPTIONS}
              />
            </div>
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
