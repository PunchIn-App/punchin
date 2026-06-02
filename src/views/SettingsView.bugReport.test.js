import { describe, it, expect, afterEach } from 'vitest'
import { buildBugReportUrl } from './SettingsView'

function setUA(ua) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, writable: true, configurable: true })
}

function params(url) {
  return new URL(url).searchParams
}

afterEach(() => {
  setUA('')
})

// ── browser detection ────────────────────────────────────────────────────────

describe('buildBugReportUrl — browser detection', () => {
  it('detects Edge', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('browser')).toBe('Edge 124')
  })

  it('detects Chrome on iOS (CriOS)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1')
    expect(params(buildBugReportUrl('1.0.0', false, 'ios')).get('browser')).toBe('Chrome 124 (iOS)')
  })

  it('detects Firefox on iOS (FxiOS)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 FxiOS/124.0 Mobile/15E148 Safari/604.1')
    expect(params(buildBugReportUrl('1.0.0', false, 'ios')).get('browser')).toBe('Firefox 124 (iOS)')
  })

  it('detects Chrome on desktop', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('browser')).toBe('Chrome 124')
  })

  it('detects Safari', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1')
    expect(params(buildBugReportUrl('1.0.0', false, 'ios')).get('browser')).toBe('Safari 17')
  })

  it('detects Firefox on desktop', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('browser')).toBe('Firefox 124')
  })

  it('falls back to Unknown for unrecognised UA', () => {
    setUA('CustomBrowser/99.0')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('browser')).toBe('Unknown')
  })
})

// ── OS detection ─────────────────────────────────────────────────────────────

describe('buildBugReportUrl — OS detection', () => {
  it('extracts iOS version', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15')
    expect(params(buildBugReportUrl('1.0.0', false, 'ios')).get('os')).toBe('iOS 17.4.1')
  })

  it('falls back to plain "iOS" when version not in UA', () => {
    setUA('SomeAppWithNoVersion')
    expect(params(buildBugReportUrl('1.0.0', false, 'ios')).get('os')).toBe('iOS')
  })

  it('extracts Android version', () => {
    setUA('Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'android')).get('os')).toBe('Android 15')
  })

  it('falls back to plain "Android" when version not in UA', () => {
    setUA('SomeAppWithNoVersion')
    expect(params(buildBugReportUrl('1.0.0', false, 'android')).get('os')).toBe('Android')
  })

  it('extracts macOS version', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('os')).toBe('macOS 14.4.1')
  })

  it('maps Windows NT 10.0 to Windows 10 / 11', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('os')).toBe('Windows 10 / 11')
  })

  it('maps Windows NT 6.3 to Windows 8.1', () => {
    setUA('Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('os')).toBe('Windows 8.1')
  })

  it('maps Windows NT 6.2 to Windows 8', () => {
    setUA('Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('os')).toBe('Windows 8')
  })

  it('maps Windows NT 6.1 to Windows 7', () => {
    setUA('Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('os')).toBe('Windows 7')
  })

  it('uses raw NT version for unknown Windows NT', () => {
    setUA('Mozilla/5.0 (Windows NT 5.1; rv:11.0) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('os')).toBe('Windows NT 5.1')
  })

  it('falls back to "Linux / other" for non-Mac non-Windows desktop', () => {
    setUA('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('os')).toBe('Linux / other')
  })
})

// ── device detection ─────────────────────────────────────────────────────────

describe('buildBugReportUrl — device detection', () => {
  it('detects iPhone', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15')
    expect(params(buildBugReportUrl('1.0.0', false, 'ios')).get('device')).toBe('iPhone')
  })

  it('detects iPad', () => {
    setUA('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15')
    expect(params(buildBugReportUrl('1.0.0', false, 'ios')).get('device')).toBe('iPad')
  })

  it('extracts Android model from UA', () => {
    setUA('Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'android')).get('device')).toBe('Pixel 8')
  })

  it('falls back to "Android device" when model not extractable', () => {
    setUA('SomeAndroidUA')
    expect(params(buildBugReportUrl('1.0.0', false, 'android')).get('device')).toBe('Android device')
  })

  it('reports desktop with screen dimensions', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('device')).toMatch(/^Desktop \(\d+×\d+\)$/)
  })
})

// ── install type & metadata ───────────────────────────────────────────────────

describe('buildBugReportUrl — install type and metadata', () => {
  it('sets install-type to PWA when standalone', () => {
    setUA('Mozilla/5.0')
    expect(params(buildBugReportUrl('1.0.0', true, 'web')).get('install-type')).toBe('PWA (installed to home screen)')
  })

  it('sets install-type to Browser tab when not standalone', () => {
    setUA('Mozilla/5.0')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('install-type')).toBe('Browser tab')
  })

  it('includes the app version', () => {
    setUA('Mozilla/5.0')
    expect(params(buildBugReportUrl('0.7.0', false, 'web')).get('version')).toBe('0.7.0')
  })

  it('targets bug_report.yml template', () => {
    setUA('Mozilla/5.0')
    expect(params(buildBugReportUrl('1.0.0', false, 'web')).get('template')).toBe('bug_report.yml')
  })

  it('points to the punchin GitHub issues URL', () => {
    setUA('Mozilla/5.0')
    const url = buildBugReportUrl('1.0.0', false, 'web')
    expect(url).toMatch(/^https:\/\/github\.com\/PunchIn-App\/punchin\/issues\/new/)
  })
})
