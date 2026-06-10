import { useState, useRef } from 'react'
import qrcode from 'qrcode-generator'
import { Share2, Copy, Check, Download, Link as LinkIcon, X } from 'lucide-react'
import { exportSnapshot, importSnapshot } from '../sync/syncManager'
import { encodeSnapshot, decodeSnapshot, buildShareUrl, parseImportCode } from '../utils/transfer'
import { useFocusTrap } from '../hooks/useFocusTrap'

// Above this URL length a QR code is unlikely to scan reliably, and some apps
// truncate very long links — warn and lean on copy/paste instead.
const QR_SAFE_LIMIT = 1800

function makeQrDataUrl(text) {
  try {
    const qr = qrcode(0, 'M') // type 0 = auto-size to fit the data
    qr.addData(text)
    qr.make()
    return qr.createDataURL(4, 8)
  } catch {
    return null // data exceeds the largest QR version
  }
}

// Account-free, device-to-device data transfer via a compressed link + QR
// (issue #77). Generating a link snapshots the local database; importing merges
// a snapshot in (same name-based dedup as cloud sync, so it never duplicates).
export default function DataTransfer() {
  const [generating, setGenerating] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [shareInfo, setShareInfo] = useState(null)
  const [shareError, setShareError] = useState(null)
  const [copied, setCopied] = useState(false)

  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null) // { success } | { error }
  const [enlarged, setEnlarged] = useState(false) // QR lightbox (issue: code too small to scan inline)

  const createLink = async () => {
    setGenerating(true)
    setShareError(null)
    setCopied(false)
    setEnlarged(false)
    try {
      const snap = await exportSnapshot()
      const code = await encodeSnapshot(snap)
      const url = buildShareUrl(code)
      setShareUrl(url)
      setShareInfo({ jobs: snap.jobs.length, entries: snap.entries.length, length: url.length })
    } catch (e) {
      setShareError(e.message || 'Could not create a share link.')
    } finally {
      setGenerating(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the user can still select the field manually */
    }
  }

  const doImport = async () => {
    const code = parseImportCode(importText)
    if (!code) {
      setImportMsg({ error: 'Paste a PunchIn share link or code first.' })
      return
    }
    setImporting(true)
    setImportMsg(null)
    try {
      const snap = await decodeSnapshot(code)
      const added = await importSnapshot(snap)
      setImportMsg({ success: `Imported ${added} new ${added === 1 ? 'entry' : 'entries'}.` })
      setImportText('')
    } catch (e) {
      setImportMsg({ error: e.message || 'Could not import this link.' })
    } finally {
      setImporting(false)
    }
  }

  const qrSrc = shareUrl && shareUrl.length <= QR_SAFE_LIMIT ? makeQrDataUrl(shareUrl) : null

  return (
    <>
    <div className="rounded-xl border border-appBorder bg-appCard divide-y divide-appBorderLight">
      {/* Share */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Share2 className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm text-appText font-medium">Share to another device</p>
            <p className="text-xs text-appTextMuted mt-0.5">Create a link (and QR code) that moves your data to another device — no account needed</p>
          </div>
        </div>

        <button
          onClick={createLink}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-appInput hover:bg-appBg border border-appBorder transition-colors text-sm text-appText disabled:opacity-50"
        >
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
          {generating ? 'Creating…' : shareUrl ? 'Regenerate link' : 'Create share link'}
        </button>

        {shareError && <p className="text-xs text-red-400">{shareError}</p>}

        {shareUrl && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                aria-label="Share link"
                onFocus={e => e.target.select()}
                className="flex-1 min-w-0 bg-appBg border border-appBorder text-appText rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-appAccent/50"
              />
              <button
                onClick={copyLink}
                aria-label="Copy share link"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-appInput hover:bg-appBg border border-appBorder transition-colors text-xs text-appText flex-shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {qrSrc ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() => setEnlarged(true)}
                  aria-label="Enlarge QR code"
                  aria-haspopup="dialog"
                  className="rounded-lg focus:outline-none focus:ring-2 focus:ring-appAccent/60"
                >
                  <img src={qrSrc} alt="QR code for the share link" className="w-44 h-44 rounded-lg bg-white p-2" />
                </button>
                <p className="text-xs text-appTextMuted">Tap the code to enlarge · scan with the other device's camera</p>
              </div>
            ) : (
              <p className="text-xs text-appTextMuted">
                This snapshot is too large for a QR code — copy the link above and open it on the other device instead.
              </p>
            )}

            {shareInfo && (
              <p className="text-[11px] text-appTextMuted">
                Includes {shareInfo.jobs} {shareInfo.jobs === 1 ? 'job' : 'jobs'} and {shareInfo.entries} {shareInfo.entries === 1 ? 'entry' : 'entries'}.
                {shareInfo.length > 8000 && ' This link is long; if it won’t open, use Export data instead.'}
                {' '}The link is a one-time snapshot — it won’t keep updating.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Import */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Download className="w-4 h-4 text-appTextMuted flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm text-appText font-medium">Import from a link</p>
            <p className="text-xs text-appTextMuted mt-0.5">Paste a PunchIn share link (or scan its QR to open it) to merge that data in</p>
          </div>
        </div>

        <textarea
          value={importText}
          onChange={e => { setImportText(e.target.value); setImportMsg(null) }}
          placeholder="Paste a PunchIn share link…"
          aria-label="PunchIn share link to import"
          rows={2}
          className="w-full bg-appBg border border-appBorder text-appText rounded-lg px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-appAccent/50"
        />

        <button
          onClick={doImport}
          disabled={importing || !importText.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-appInput hover:bg-appBg border border-appBorder transition-colors text-sm text-appText disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {importing ? 'Importing…' : 'Import data'}
        </button>

        {importMsg?.success && <p className="text-xs text-green-400">{importMsg.success}</p>}
        {importMsg?.error && <p className="text-xs text-red-400">{importMsg.error}</p>}
      </div>
    </div>

    {enlarged && qrSrc && <QrLightbox src={qrSrc} onClose={() => setEnlarged(false)} />}
    </>
  )
}

// Enlarged QR lightbox — the inline thumbnail is often too small to scan, so
// tapping it blows the code up centered on a dark scrim. The focus trap (initial
// focus → restore → Escape) must mount/unmount with the dialog, so it lives in
// this child rather than a conditional hook in the parent (issues #151/#152/#154).
function QrLightbox({ src, onClose }) {
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, onClose) // traps Tab + Escape; restores focus to the "Enlarge QR code" trigger on close

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Share QR code — scan with the other device"
      ref={dialogRef}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        data-autofocus
        className="absolute top-4 right-4 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        <X className="w-6 h-6" aria-hidden="true" />
      </button>
      <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <img
          src={src}
          alt="QR code for the share link"
          className="w-full max-w-[340px] aspect-square rounded-2xl bg-white p-4 shadow-xl"
          style={{ imageRendering: 'pixelated' }}
        />
        <p className="text-sm text-white/90 text-center">Scan with the other device's camera</p>
      </div>
    </div>
  )
}
