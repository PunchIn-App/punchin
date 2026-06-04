import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import licenseRaw from '../../LICENSE?raw'
import thirdPartyRaw from '../../docs/THIRD-PARTY-LICENSES.md?raw'

const TITLE_ID = 'license-modal-title'

const TABS = [
  { id: 'app',   label: 'License' },
  { id: 'third', label: 'Third-party' },
]

// ── Minimal markdown rendering (headings, tables, lists, paragraphs with
//    inline bold / code / links) — enough for THIRD-PARTY-LICENSES.md without
//    pulling in a markdown dependency. ─────────────────────────────────────────

function renderInline(text) {
  const out = []
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(<(https?:\/\/[^>]+)>)/g
  let last = 0, m, key = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) {
      out.push(<strong key={key++} className="text-appText font-semibold">{m[2]}</strong>)
    } else if (m[3]) {
      out.push(<code key={key++} className="text-appText bg-appBg px-1 py-0.5 rounded text-[0.85em] font-mono">{m[4]}</code>)
    } else if (m[5]) {
      const label = m[6], url = m[7]
      out.push(/^https?:/.test(url)
        ? <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-appAccent hover:underline">{label}</a>
        : <span key={key++}>{label}</span>)
    } else if (m[8]) {
      out.push(<a key={key++} href={m[9]} target="_blank" rel="noopener noreferrer" className="text-appAccent hover:underline">{m[9]}</a>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const splitCells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())

function parseMarkdown(md) {
  const lines = md.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    if (line.trim().startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++ }
      blocks.push({ type: 'table', rows })
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2] }); i++; continue }

    if (/^\s*-\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s+/, '')); i++ }
      blocks.push({ type: 'list', items })
      continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('|') && !/^#{1,6}\s/.test(lines[i]) && !/^\s*-\s+/.test(lines[i])) {
      para.push(lines[i]); i++
    }
    blocks.push({ type: 'para', text: para.join(' ') })
  }
  return blocks
}

function MarkdownBlock({ block, k }) {
  if (block.type === 'heading') {
    const cls = block.level === 1 ? 'text-base font-display font-semibold text-appText mt-1 mb-2'
      : block.level === 2 ? 'text-sm font-display font-semibold text-appText mt-4 mb-1.5'
      : 'text-xs font-semibold uppercase tracking-wide text-appTextMuted mt-3 mb-1'
    return <p key={k} className={cls}>{renderInline(block.text)}</p>
  }
  if (block.type === 'list') {
    return (
      <ul key={k} className="list-disc pl-5 space-y-1 my-2">
        {block.items.map((it, j) => <li key={j} className="text-sm text-appTextMuted leading-relaxed">{renderInline(it)}</li>)}
      </ul>
    )
  }
  if (block.type === 'table') {
    const [header, , ...body] = block.rows
    return (
      <div key={k} className="my-3 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>{splitCells(header).map((c, j) => (
              <th key={j} scope="col" className="border-b border-appBorder px-2 py-1.5 text-xs font-semibold text-appText">{renderInline(c)}</th>
            ))}</tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>{splitCells(row).map((c, j) => (
                <td key={j} className="border-b border-appBorderLight px-2 py-1.5 text-xs text-appTextMuted align-top">{renderInline(c)}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return <p key={k} className="text-sm text-appTextMuted leading-relaxed my-2">{renderInline(block.text)}</p>
}

const THIRD_PARTY_BLOCKS = parseMarkdown(thirdPartyRaw)

export default function LicenseModal({ onClose }) {
  const dialogRef = useRef(null)
  const [tab, setTab] = useState('app')

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
          <p id={TITLE_ID} className="font-display font-semibold text-appText">License &amp; legal</p>
          <button
            onClick={onClose}
            aria-label="Close license"
            className="p-1.5 rounded-lg text-appTextMuted hover:text-appText hover:bg-appInput transition-colors focus-visible:ring-2 focus-visible:ring-appAccent focus-visible:outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* A two-way content switch — modelled as a labelled group of toggle
            buttons (aria-pressed) rather than a full ARIA tablist, which would
            also require tabpanels, aria-controls, roving tabindex and arrow keys. */}
        <div className="flex gap-1 px-5 pt-3 flex-shrink-0" role="group" aria-label="License sections">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${tab === t.id ? 'bg-appAccent text-[#0F1117]' : 'text-appTextMuted hover:text-appText'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {tab === 'app' ? (
            <pre className="text-sm text-appTextMuted whitespace-pre-wrap break-words font-sans leading-relaxed">{licenseRaw}</pre>
          ) : (
            <div>{THIRD_PARTY_BLOCKS.map((b, k) => <MarkdownBlock key={k} block={b} k={k} />)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
