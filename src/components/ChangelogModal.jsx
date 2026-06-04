import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import changelogRaw from '../../docs/CHANGELOG.md?raw'

function renderInline(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-appText font-semibold">{part}</strong>
      : part
  )
}

function parseChangelog(raw) {
  const sections = []
  let current = null

  for (const line of raw.split('\n')) {
    const vMatch = line.match(/^## \[(.+?)\] — (.+)$/)
    const hMatch = line.match(/^### (.+)$/)
    const bMatch = line.match(/^- (.+)$/)

    if (vMatch) {
      if (current) sections.push(current)
      current = { version: vMatch[1], date: vMatch[2], items: [] }
    } else if (hMatch && current) {
      current.items.push({ type: 'heading', text: hMatch[1] })
    } else if (bMatch && current) {
      current.items.push({ type: 'bullet', text: bMatch[1] })
    }
  }
  if (current) sections.push(current)
  return sections
}

const SECTIONS = parseChangelog(changelogRaw)
const TITLE_ID = 'changelog-modal-title'

export default function ChangelogModal({ onClose }) {
  const dialogRef = useRef(null)

  // Hardware/gesture Back closes the modal instead of navigating away. Push a
  // history entry on open and unwind it on close so it composes with the app's
  // tab/panel history (states without `piView`/`settingsPanel` are ignored
  // there). Mirrors the bottom-sheet modals' back-dismiss behaviour.
  useEffect(() => {
    history.pushState({ modal: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (history.state?.modal) history.back()
    }
  }, [onClose])

  // Focus the scrollable dialog container, trap Tab, restore focus on close,
  // close on Escape (issues #151/#152/#154).
  useFocusTrap(dialogRef, onClose, { initialFocus: (el) => el })

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        className="w-full max-w-lg bg-appCard rounded-2xl border border-appBorder shadow-xl flex flex-col max-h-[80vh] outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-appBorder flex-shrink-0">
          <p id={TITLE_ID} className="font-display font-semibold text-appText">Changelog</p>
          <button
            onClick={onClose}
            aria-label="Close changelog"
            className="p-1.5 rounded-lg text-appTextMuted hover:text-appText hover:bg-appInput transition-colors focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-6">
          {SECTIONS.map(section => (
            <div key={section.version}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display font-bold text-appAccent">v{section.version}</span>
                <span className="text-xs text-appTextMuted">{section.date}</span>
              </div>
              <div className="space-y-1">
                {section.items.map((item, i) =>
                  item.type === 'heading' ? (
                    <p key={i} className="text-[10px] font-semibold text-appTextMuted uppercase tracking-widest mt-3 mb-1 first:mt-0">
                      {item.text}
                    </p>
                  ) : (
                    <p key={i} className="text-sm text-appTextMuted leading-relaxed">
                      <span className="text-appAccent mr-1.5" aria-hidden="true">·</span>
                      {renderInline(item.text)}
                    </p>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
