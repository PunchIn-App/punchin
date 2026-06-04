// Builders for the GitHub "new issue" links surfaced in Settings → About.
// Kept out of SettingsView so the URL/UA logic is reusable and unit-testable
// without importing the whole settings view (issue #146).

const ISSUES_NEW = 'https://github.com/PunchIn-App/punchin/issues/new'

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
  return `Desktop (${screen.width}×${screen.height})`
}

// Opens the bug-report issue form, pre-filling environment metadata so reports
// arrive with the version / browser / OS / device already captured.
export function buildBugReportUrl(appVersion, isStandalone, os) {
  const ua = navigator.userAgent
  return issueUrl(new URLSearchParams({
    template: 'bug_report.yml',
    version: appVersion,
    'install-type': isStandalone ? 'PWA (installed to home screen)' : 'Browser tab',
    browser: describeBrowser(ua),
    os: describeOs(ua, os),
    device: describeDevice(ua, os),
  }))
}

// Opens the feature-request issue form (separate template from bug reports).
// The version is dropped into the template's "scope" field for context.
export function buildFeatureRequestUrl(appVersion) {
  return issueUrl(new URLSearchParams({
    template: 'feature_request.yml',
    scope: `Suggested from PunchIn v${appVersion}`,
  }))
}
