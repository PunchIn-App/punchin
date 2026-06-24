import { Layers, Calendar, Vibrate, Clock, Hourglass, Watch, CalendarOff, CalendarRange } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { usePlatformContext } from '../../hooks/usePlatformContext'
import EntitySelect from '../../components/EntitySelect'
import InfoButton from '../../components/InfoButton'
import { Panel, SettingsRow, Toggle, WeekdayPicker, ALL_DAYS } from './components'

const TIME_FORMAT_OPTIONS = [
  { value: 'auto', label: 'Auto (match region)' },
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
]
// One control encoding the increment + direction. 'off', else '<mode>-<minutes>'.
const ROUNDING_OPTIONS = [
  { value: 'off',        label: 'Off' },
  { value: 'nearest-15', label: 'Nearest ¼ hour' },
  { value: 'nearest-30', label: 'Nearest ½ hour' },
  { value: 'up-15',      label: 'Round up ¼ hour' },
  { value: 'up-30',      label: 'Round up ½ hour' },
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
          subtitle="Run multiple jobs at once"
          info="Lets timers overlap instead of punching out the previous one. Each entry is tracked and billed independently."
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
          icon={CalendarOff}
          title="Ignore empty days in averages"
          subtitle="Days with nothing logged don't count"
          info="Analytics' average per day skips days you logged no time, so a day off doesn't pull the number down — the card then reads 'Avg / active day'. Turn this off to divide by every day in the range."
          right={
            <Toggle
              ariaLabel="Ignore empty days in averages"
              value={settings.avgExcludeZeroDays !== false}
              onChange={v => updateSetting('avgExcludeZeroDays', v)}
            />
          }
        />
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <CalendarRange className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-appText font-medium">
                Days counted in averages
                <InfoButton label="About days counted in averages" className="ml-1.5">Only the selected weekdays count toward the Analytics average. Clear the days you never work — weekends, say — so they don't dilute it. Clearing every day restores all seven.</InfoButton>
              </p>
              <p className="text-xs text-appTextMuted mt-0.5">Which weekdays the average includes</p>
            </div>
          </div>
          <div className="mt-3 pl-7">
            <WeekdayPicker
              value={settings.avgWeekdays}
              onChange={days => updateSetting('avgWeekdays', days.length ? days : ALL_DAYS)}
              label="Weekdays counted in the average"
              weekStartsMonday={settings.weekStartsMonday !== false}
            />
          </div>
        </div>
        <SettingsRow
          icon={Watch}
          title="Time format"
          subtitle="Clock times in timesheets & invoices"
          info="Auto follows your region's 12/24-hour convention. On iPhone it can't read the OS clock toggle — pick 12- or 24-hour to force it."
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
          subtitle="Show durations as decimals"
          info="Shows timesheet and invoice durations as 1.50 h instead of 1h 30m."
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
          subtitle="Round each task's billed time"
          info="Rounds each task's logged time in timesheets and invoices. 'Nearest' is the standard round-to-the-nearest-increment; 'Round up' rounds each task up so short tasks are never lost. Each task rounds on its own, so a task switch is never double-billed and per-rate amounts stay correct."
          right={
            <div className="w-48 flex-shrink-0">
              <EntitySelect
                compact plain hideLabel
                label="Round billed time"
                value={settings.roundingMinutes ? `${settings.roundingMode}-${settings.roundingMinutes}` : 'off'}
                onChange={v => {
                  if (v === 'off') { updateSetting('roundingMinutes', 0); return }
                  const [m, mins] = v.split('-')
                  updateSetting('roundingMinutes', Number(mins))
                  updateSetting('roundingMode', m)
                }}
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
