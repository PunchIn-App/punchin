import { Layers, Calendar, Vibrate } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { usePlatformContext } from '../../hooks/usePlatformContext'
import { Panel, SettingsRow, Toggle } from './components'

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
