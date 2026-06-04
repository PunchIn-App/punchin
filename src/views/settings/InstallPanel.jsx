import { useState } from 'react'
import { MonitorDown, Check, ChevronDown, Share, Plus, Compass } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { Panel, SettingsRow } from './components'

export default function InstallPanel({ onBack }) {
  const { canInstall, isInstalled, isIOSSafari, os: installOs, promptInstall } = useInstallPrompt()
  const [iosHelpOpen, setIosHelpOpen] = useState(false)

  const handleInstall = async () => {
    await promptInstall()
  }

  return (
    <Panel title="Install" onBack={onBack}>
      <div className="rounded-xl border border-appBorder bg-appCard overflow-hidden">
        {isInstalled ? (
          <SettingsRow
            icon={Check}
            title="Installed"
            subtitle="PunchIn is installed on this device"
          />
        ) : canInstall ? (
          <button
            onClick={handleInstall}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left rounded-xl">
            <MonitorDown className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm text-appText font-medium">{installOs === 'android' ? 'Add to Home Screen' : 'Install app'}</p>
              <p className="text-xs text-appTextMuted mt-0.5">Install as a standalone app for faster access</p>
            </div>
          </button>
        ) : isIOSSafari ? (
          <>
            <button
              onClick={() => setIosHelpOpen(o => !o)}
              aria-expanded={iosHelpOpen}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left">
              <MonitorDown className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-appText font-medium">Add to Home Screen</p>
                <p className="text-xs text-appTextMuted mt-0.5">Install as a standalone app for faster access</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-appTextMuted flex-shrink-0 transition-transform ${iosHelpOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {iosHelpOpen && (
              <div className="px-4 pb-4 -mt-1 space-y-2.5 text-sm text-appText">
                <p className="text-xs text-appTextMuted">From Safari, install in two steps:</p>
                <p className="flex items-center gap-3">
                  <Share className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Tap the <span className="font-semibold">Share</span> button</span>
                </p>
                <p className="flex items-center gap-3">
                  <Plus className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Choose <span className="font-semibold">Add to Home Screen</span></span>
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setIosHelpOpen(o => !o)}
              aria-expanded={iosHelpOpen}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-appInput transition-colors text-left">
              <MonitorDown className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-appText font-medium">Add to Home Screen</p>
                <p className="text-xs text-appTextMuted mt-0.5">Open in Safari to install</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-appTextMuted flex-shrink-0 transition-transform ${iosHelpOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {iosHelpOpen && (
              <div className="px-4 pb-4 -mt-1 space-y-2.5 text-sm text-appText">
                <p className="text-xs text-appTextMuted">Only Safari can install web apps on iOS.</p>
                <p className="flex items-center gap-3">
                  <Compass className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Open <span className="font-semibold">trackmytime.today</span> in Safari</span>
                </p>
                <p className="flex items-center gap-3">
                  <Share className="w-4 h-4 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span></span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}
