import { useState } from 'react'
import { Info, ExternalLink, ScrollText, ChevronDown, Bug, Lightbulb, Scale, RefreshCw, Heart } from 'lucide-react'
import { usePlatformContext } from '../../hooks/usePlatformContext'
import { useSettings } from '../../hooks/useSettings'
import { buildFeedbackBugUrl, buildFeedbackFeatureUrl } from '../../utils/issueUrl'
import ChangelogModal from '../../components/ChangelogModal'
import LicenseModal from '../../components/LicenseModal'
import { Panel } from './components'

// PWA update state is owned once by SettingsView (a single usePwaUpdate, shared
// with the root-list "update available" badge) and passed in (issue #149).
export default function AboutPanel({ onBack, updateAvailable, updateStatus, checkForUpdates }) {
  const { isStandalone, os } = usePlatformContext()
  const { settings } = useSettings()
  const [showChangelog, setShowChangelog] = useState(false)
  const [showLicense, setShowLicense] = useState(false)

  return (
    <Panel title="About" onBack={onBack}>
      <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
        <a
          href="https://github.com/PunchIn-App/punchin"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-4 py-4 gap-3 hover:bg-appInput transition-colors rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <Info className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-appText font-medium">PunchIn</p>
              <p className="text-xs text-appTextMuted mt-0.5">{`v${__APP_VERSION__} · Data stored on this device${settings.syncProvider ? ' and in the cloud' : ''}`}</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
        </a>
        <button
          onClick={() => setShowChangelog(true)}
          className="w-full flex items-center justify-between px-4 py-4 gap-3 hover:bg-appInput transition-colors text-left">
          <div className="flex items-center gap-3 min-w-0">
            <ScrollText className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-appText font-medium">Changelog</p>
              <p className="text-xs text-appTextMuted mt-0.5">See what's new in each release</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-appTextMuted flex-shrink-0 -rotate-90" aria-hidden="true" />
        </button>
        <button
          onClick={() => window.open(buildFeedbackBugUrl(__APP_VERSION__, isStandalone, os, settings.theme, settings.accentColor), '_blank', 'noopener,noreferrer')}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-appInput transition-colors text-left">
          <div className="flex items-center gap-3 min-w-0">
            <Bug className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-appText font-medium">Report a bug</p>
              <p className="text-xs text-appTextMuted mt-0.5">Opens a quick web form with your device info pre-filled</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
        </button>
        <button
          onClick={() => window.open(buildFeedbackFeatureUrl(settings.theme, settings.accentColor), '_blank', 'noopener,noreferrer')}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-appInput transition-colors text-left">
          <div className="flex items-center gap-3 min-w-0">
            <Lightbulb className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-appText font-medium">Help improve PunchIn</p>
              <p className="text-xs text-appTextMuted mt-0.5">Opens a quick web form — no account needed</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
        </button>
        <button
          onClick={() => setShowLicense(true)}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-appInput transition-colors text-left">
          <div className="flex items-center gap-3 min-w-0">
            <Scale className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-appText font-medium">License &amp; legal</p>
              <p className="text-xs text-appTextMuted mt-0.5">App license and third-party attributions</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-appTextMuted flex-shrink-0 -rotate-90" aria-hidden="true" />
        </button>
        <button
          onClick={checkForUpdates}
          disabled={updateStatus === 'checking'}
          className={`w-full flex items-center gap-3 px-4 py-4 transition-colors text-left rounded-b-xl disabled:opacity-60
            ${updateAvailable ? 'hover:bg-appAccent/10' : 'hover:bg-appInput'}`}>
          <RefreshCw
            className={`w-4 h-4 flex-shrink-0 ${updateStatus === 'checking' ? 'animate-spin' : ''} ${updateAvailable ? 'text-appAccent' : 'text-appTextMuted'}`}
            aria-hidden="true"
          />
          <div>
            <p className={`text-sm font-medium ${updateAvailable ? 'text-appAccent' : 'text-appText'}`}>
              {updateAvailable ? 'Update available' : 'Check for updates'}
            </p>
            {/* role="status" / aria-live="polite": this <p> is always in the
                DOM and only its text changes, so a screen reader announces the
                check result ("Checking…" → "Already up to date" / "Update
                available") even though the "latest" state self-clears after 3s
                (WCAG 4.1.3). */}
            <p className="text-xs text-appTextMuted mt-0.5" role="status" aria-live="polite">
              {updateAvailable                         && 'Tap to reload and apply the new version'}
              {!updateAvailable && updateStatus === 'checking' && 'Checking…'}
              {!updateAvailable && updateStatus === 'latest'   && 'Already up to date'}
              {!updateAvailable && !updateStatus               && 'Tap to check for a new version'}
            </p>
          </div>
        </button>
      </div>

      {/* Support — links out to Buy Me a Coffee (no third-party script: a plain
          link keeps the app self-contained and tracker-free). Styled with the
          user's accent so it follows their theme. */}
      <a
        href="https://www.buymeacoffee.com/punchin"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-appAccent text-appOnAccent font-display font-bold text-sm hover:brightness-110 active:brightness-90 transition-all focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
      >
        <Heart className="w-4 h-4" aria-hidden="true" />
        Support the App
        <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
      </a>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      {showLicense && <LicenseModal onClose={() => setShowLicense(false)} />}
    </Panel>
  )
}
