import { useCallback, useId } from 'react'
import { X, Share, Plus, Compass } from 'lucide-react'
import { PunchMark } from './BrandMark'
import { DEFAULT_ACCENT } from '../accentPresets'
import { usePlatformContext } from '../hooks/usePlatformContext'
import { useHapticFeedback } from '../hooks/useHapticFeedback.jsx'
import { useSettings } from '../hooks/useSettings'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useSwipeDismiss, useAndroidBackDismiss, useSheetStyles } from '../hooks/useBottomSheet'

// First-run install nudge. Three modes (chosen by the caller):
//   - 'native'    (Chrome/Edge): primary button replays the captured native
//                 prompt via onInstall (a user gesture, which the API requires).
//   - 'ios-safari': manual Share → Add to Home Screen steps (works in Safari).
//   - 'ios-other':  Chrome/Firefox/etc. on iOS can't install a real PWA — tell
//                 the user to open the page in Safari instead.
export default function InstallPromptModal({ mode = 'native', onInstall, onClose }) {
  const { isStandalone, os } = usePlatformContext()
  const { settings } = useSettings()
  // Native install lands in different places per platform — avoid "home screen"
  // wording on desktop, where it installs as an app window.
  const nativeDesc = os === 'android'
    ? 'Add PunchIn to your home screen for faster access and a full-screen, app-like experience. Your data stays on this device.'
    : 'Install PunchIn for faster access and a dedicated, app-like window. Your data stays on this device.'
  const hapticsOn = isStandalone && settings.hapticFeedback !== false
  const { trigger: hapticTrigger, hapticEl } = useHapticFeedback(hapticsOn ? os : 'web')

  const uid = useId()
  const titleId = `${uid}-title`
  const descId  = `${uid}-desc`

  const stableClose = useCallback(onClose, [onClose])
  const noop = useCallback(() => {}, [])

  // Swipe-down dismiss on any touch platform (not just installed iOS), so the
  // drag handle responds the same everywhere. hapticTrigger self-noops off-iOS
  // and desktop fires no touch events.
  const swipeRef = useSwipeDismiss(stableClose, hapticTrigger)
  useAndroidBackDismiss(
    isStandalone && os === 'android' ? stableClose : noop,
    isStandalone && os === 'android' ? hapticTrigger : noop,
  )

  const { scrim, sheet, handle } = useSheetStyles(isStandalone, os)

  // Focus trap, Escape, and focus restoration (issues #151/#152/#154)
  useFocusTrap(swipeRef, stableClose)

  return (
    <div className={scrim} onClick={onClose}>
      {hapticEl}
      <div
        ref={swipeRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={sheet}
        onClick={e => e.stopPropagation()}
      >
        {handle}

        <div className="flex items-center justify-between px-5 py-4 border-b border-appBorder">
          <div className="flex items-center gap-2.5">
            <PunchMark accent={settings.accentColor || DEFAULT_ACCENT} className="w-7 h-7 rounded-lg" glyphClassName="w-4 h-4" />
            <h2 id={titleId} className="font-display font-semibold text-appText text-lg">Install PunchIn</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-appInput text-appTextMuted transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {mode === 'native' && (
          <>
            <div className="px-5 py-4">
              <p id={descId} className="text-sm text-appTextMuted leading-relaxed">{nativeDesc}</p>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <button
                onClick={onInstall}
                className="w-full py-3.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90
                           text-appOnAccent font-display font-bold text-base transition-colors"
              >
                Install
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-appTextMuted hover:text-appText text-sm transition-colors"
              >
                Not now
              </button>
            </div>
          </>
        )}

        {mode === 'ios-safari' && (
          <>
            <div className="px-5 py-4 space-y-3">
              <p id={descId} className="text-sm text-appTextMuted leading-relaxed">
                Install PunchIn for faster access and a full-screen experience. From Safari:
              </p>
              <ol className="space-y-2.5 text-sm text-appText">
                <li className="flex items-center gap-3">
                  <Share className="w-5 h-5 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Tap the <span className="font-semibold">Share</span> button</span>
                </li>
                <li className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Choose <span className="font-semibold">Add to Home Screen</span></span>
                </li>
              </ol>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90
                           text-appOnAccent font-display font-bold text-base transition-colors"
              >
                Got it
              </button>
            </div>
          </>
        )}

        {mode === 'ios-other' && (
          <>
            <div className="px-5 py-4 space-y-3">
              <p id={descId} className="text-sm text-appTextMuted leading-relaxed">
                To install PunchIn on iPhone or iPad, open this page in <span className="font-semibold text-appText">Safari</span> — it's the only iOS browser that can add web apps to the home screen.
              </p>
              <ol className="space-y-2.5 text-sm text-appText">
                <li className="flex items-center gap-3">
                  <Compass className="w-5 h-5 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Open <span className="font-semibold">trackmytime.today</span> in Safari</span>
                </li>
                <li className="flex items-center gap-3">
                  <Share className="w-5 h-5 text-appAccent flex-shrink-0" aria-hidden="true" />
                  <span>Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span></span>
                </li>
              </ol>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-appAccent hover:brightness-110 active:brightness-90
                           text-appOnAccent font-display font-bold text-base transition-colors"
              >
                Got it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
