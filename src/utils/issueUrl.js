// Builders for the GitHub "new issue" links surfaced in Settings → About.
// Kept out of SettingsView so the URL/UA logic is reusable and unit-testable
// without importing the whole settings view (issue #146).

const ISSUES_NEW = 'https://github.com/PunchIn-App/punchin/issues/new'
// Self-hosted, account-free intake (the punchin-feedback worker). Its /bug and
// /feature forms derive from the same issue templates, so the same query-param
// keys prefill either the GitHub form or the self-hosted one.
const FEEDBACK_BASE = 'https://feedback.trackmytime.today'

function issueUrl(params) {
  const url = new URL(ISSUES_NEW)
  url.search = params.toString()
  return url.toString()
}

// --- userAgent sniffing -----------------------------------------------------
// Best-effort labels for the bug-report metadata. Each returns a human-readable
// string and falls back gracefully when the UA doesn't carry what we need.

function describeBrowser(ua) {
  if (/Edg\/(\d+)/.test(ua))                 return `Edge ${ua.match(/Edg\/(\d+)/)[1]}`
  if (/CriOS\/(\d+)/.test(ua))               return `Chrome ${ua.match(/CriOS\/(\d+)/)[1]} (iOS)`
  if (/FxiOS\/(\d+)/.test(ua))               return `Firefox ${ua.match(/FxiOS\/(\d+)/)[1]} (iOS)`
  if (/Chrome\/(\d+)/.test(ua))              return `Chrome ${ua.match(/Chrome\/(\d+)/)[1]}`
  if (/Version\/(\d+).*Safari/.test(ua))     return `Safari ${ua.match(/Version\/(\d+)/)[1]}`
  if (/Firefox\/(\d+)/.test(ua))             return `Firefox ${ua.match(/Firefox\/(\d+)/)[1]}`
  return 'Unknown'
}

function describeOs(ua, os) {
  if (os === 'ios') {
    const m = ua.match(/OS (\d+[_\d]*)/)
    return m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS'
  }
  if (os === 'android') {
    const m = ua.match(/Android (\d+\.?\d*)/)
    return m ? `Android ${m[1]}` : 'Android'
  }
  const mac = ua.match(/Mac OS X (\d+[_\d]*)/)
  if (mac) return `macOS ${mac[1].replace(/_/g, '.')}`
  const win = ua.match(/Windows NT (\d+\.\d+)/)
  if (win) {
    const ntMap = { '10.0': 'Windows 10 / 11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' }
    return ntMap[win[1]] ?? `Windows NT ${win[1]}`
  }
  return 'Linux / other'
}

function describeDevice(ua, os) {
  if (os === 'ios')     return /iPad/.test(ua) ? 'iPad' : 'iPhone'
  if (os === 'android') {
    const m = ua.match(/\(Linux; Android [^;]+; ([^)]+)\)/)
    return m ? m[1].trim() : 'Android device'
  }
  // Guard `screen` (a window-only global) so this never throws off the main thread
  // or in non-DOM contexts; real browsers always have it.
  const w = typeof screen !== 'undefined' ? screen.width : 0
  const h = typeof screen !== 'undefined' ? screen.height : 0
  return `Desktop (${w}×${h})`
}

// Environment metadata shared by the GitHub and self-hosted bug forms. The keys
// match the bug_report.yml field ids, so the same params prefill either form.
function bugMetadata(appVersion, isStandalone, os) {
  const ua = navigator.userAgent
  return {
    version: appVersion,
    'install-type': isStandalone ? 'PWA (installed to home screen)' : 'Browser tab',
    browser: describeBrowser(ua),
    os: describeOs(ua, os),
    device: describeDevice(ua, os),
  }
}

// Opens the bug-report issue form, pre-filling environment metadata so reports
// arrive with the version / browser / OS / device already captured.
export function buildBugReportUrl(appVersion, isStandalone, os) {
  return issueUrl(new URLSearchParams({ template: 'bug_report.yml', ...bugMetadata(appVersion, isStandalone, os) }))
}

// Opens the feature-request issue form (separate template from bug reports).
// The version is dropped into the template's "scope" field for context.
export function buildFeatureRequestUrl(appVersion) {
  return issueUrl(new URLSearchParams({
    template: 'feature_request.yml',
    scope: `Suggested from PunchIn v${appVersion}`,
  }))
}

// Carry the user's theme + accent so the self-hosted form matches the app. An
// "auto" theme is omitted so the form follows the device (its default); accent
// must be a bare hex (the form injects it into a <style>, and drops non-hex).
function withTheme(params, theme, accent) {
  if (theme === 'light' || theme === 'dark') params.set('theme', theme)
  if (typeof accent === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(accent)) params.set('accent', accent)
  return params
}

// Self-hosted feedback forms (no GitHub account required). The bug form gets the
// same prefilled environment metadata as the GitHub form; the feature form
// carries no environment fields. Both also carry the app's theme + accent, plus
// `from=app`: these links open in an in-app browser overlay (Android Custom Tab /
// iOS in-app Safari) that navigation can't escape, so the worker swaps its root
// links for a "close this window" exit (punchin-feedback#6, #277).
export function buildFeedbackBugUrl(appVersion, isStandalone, os, theme, accent) {
  const params = withTheme(new URLSearchParams(bugMetadata(appVersion, isStandalone, os)), theme, accent)
  params.set('from', 'app')
  return `${FEEDBACK_BASE}/bug?${params.toString()}`
}

export function buildFeedbackFeatureUrl(theme, accent) {
  const params = withTheme(new URLSearchParams(), theme, accent)
  params.set('from', 'app')
  return `${FEEDBACK_BASE}/feature?${params.toString()}`
}
