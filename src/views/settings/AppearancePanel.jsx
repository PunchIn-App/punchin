import { Monitor, Sun, Moon, Palette } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import ColorPicker from '../../components/ColorPicker'
import { Panel, SettingsRow } from './components'

const ACCENT_PRESETS = [
  { name: 'Blue',   hex: '#1f6feb' },
  { name: 'Amber',  hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Lime',   hex: '#84CC16' },
  { name: 'Teal',   hex: '#2DD4BF' },
]

export default function AppearancePanel({ onBack }) {
  const { settings, updateSetting } = useSettings()

  return (
    <Panel title="Appearance" onBack={onBack}>
      <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
        <SettingsRow
          icon={Monitor}
          title="Theme"
          subtitle="Auto follows your device setting"
          right={
            <div className="flex items-center gap-0.5 bg-appBg rounded-lg p-0.5 border border-appBorder">
              {[
                { value: 'auto',  label: 'Auto',  Icon: Monitor },
                { value: 'light', label: 'Light', Icon: Sun     },
                { value: 'dark',  label: 'Dark',  Icon: Moon    },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => updateSetting('theme', value)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${(settings.theme || 'auto') === value
                      ? 'bg-appAccent text-[#0F1117]'
                      : 'text-appTextMuted hover:text-appText'}`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <div className="flex items-center justify-between px-4 py-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Palette className="w-4 h-4 text-appTextMuted flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-appText font-medium">Accent color</p>
              <p className="text-xs text-appTextMuted mt-0.5">Highlight color throughout the app</p>
            </div>
          </div>
          <ColorPicker
            presets={ACCENT_PRESETS}
            value={settings.accentColor || '#1f6feb'}
            onChange={hex => updateSetting('accentColor', hex)}
            size="md"
            label="Choose accent color"
          />
        </div>
      </div>
    </Panel>
  )
}
