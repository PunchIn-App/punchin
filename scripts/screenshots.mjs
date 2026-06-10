/**
 * Screenshot generator for docs/screenshots/{phone,tablet,desktop}-{dark,light}/
 *
 * Usage (from project root, with dev server running):
 *   npm run dev &          # start Vite if not already running
 *   node scripts/screenshots.mjs
 *
 * Playwright must be available — it ships with the cloud environment at
 * /opt/node22/lib/node_modules/playwright/index.mjs, or install locally:
 *   npm install --save-dev playwright && npx playwright install chromium
 *
 * Captured views per device × theme (42 total):
 *   timer · jobs · labor-types · timesheets-daily · timesheets-weekly · analytics · settings
 *
 * Device specs:
 *   phone   — Pixel 10 Pro XL default:  412 × 916  CSS px  @ 2.625×
 *   tablet  — iPad Air 11" M2 landscape: 1194 × 834 CSS px  @ 2×
 *   desktop — 1920 × 1080 CSS px @ 1×
 *
 * Output directories: docs/screenshots/{phone,tablet,desktop}-{dark,light}/
 * README uses #gh-dark-mode-only / #gh-light-mode-only fragments so GitHub
 * shows the correct theme variant automatically.
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

// ── Playwright import ────────────────────────────────────────────────────────
let chromium
const GLOBAL_PW = '/opt/node22/lib/node_modules/playwright/index.mjs'
if (existsSync(GLOBAL_PW)) {
  ;({ chromium } = await import(GLOBAL_PW))
} else {
  ;({ chromium } = await import('playwright'))
}

// ── Config ───────────────────────────────────────────────────────────────────
const ROOT     = dirname(dirname(fileURLToPath(import.meta.url)))
const BASE_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:5173'

// A realistic per-device userAgent is required so the app's OS detection
// (usePlatformContext → detectOS) resolves to android / ios rather than the
// default desktop Chromium UA. Without it, mobile-only surfaces (e.g. the
// Haptic feedback toggle, the iOS install guidance) never render in captures.
const DEVICES = [
  {
    name: 'phone', width: 412, height: 916, dpr: 2.625, isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 10 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'tablet', width: 1194, height: 834, dpr: 2, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  { name: 'desktop', width: 1920, height: 1080, dpr: 1, isMobile: false },
]

const THEMES = ['dark', 'light']

// ── Demo data seed ───────────────────────────────────────────────────────────
// Passed as a serialised function to page.evaluate(seedData, theme).
// Must only reference browser globals — no outer Node.js scope.
async function seedData(theme) {
  function txDone(tx) {
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
  }

  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('PunchInDB')
    r.onsuccess = () => res(r.result)
    r.onerror  = () => rej(r.error)
  })

  // Wipe so re-runs are idempotent
  { const tx = db.transaction(['laborTypes','jobs','entries'], 'readwrite')
    tx.objectStore('laborTypes').clear()
    tx.objectStore('jobs').clear()
    tx.objectStore('entries').clear()
    await txDone(tx) }

  // Labor types (explicit IDs for deterministic job references)
  { const tx = db.transaction(['laborTypes'], 'readwrite')
    const s = tx.objectStore('laborTypes')
    s.put({ id:1, name:'Development', color:'#22C55E', glyph:'code',  isArchived:false })
    s.put({ id:2, name:'Design',      color:'#6366F1', glyph:'brush', isArchived:false })
    s.put({ id:3, name:'Meetings',    color:'#F59E0B', glyph:'chat',  isArchived:false })
    await txDone(tx) }

  // Jobs
  { const tx = db.transaction(['jobs'], 'readwrite')
    const s = tx.objectStore('jobs')
    s.put({ id:1, name:'Acme Corp',      clientName:'Acme Inc',    laborTypeId:1, isActive:true, laborRates:{1:125, 2:95}  })
    s.put({ id:2, name:'Skyline Studio', clientName:'Skyline LLC', laborTypeId:2, isActive:true, laborRates:{2:110}        })
    s.put({ id:3, name:'Internal',       clientName:null,          laborTypeId:3, isActive:true, laborRates:{}             })
    await txDone(tx) }

  // Apply requested theme
  { const tx = db.transaction(['settings'], 'readwrite')
    tx.objectStore('settings').put({ key:'theme',       value: theme })
    tx.objectStore('settings').put({ key:'accentColor', value: '#2D5BF5' })
    await txDone(tx) }

  // Completed entries spread across past 30 days for populated analytics
  function d(daysBack, h, m=0) {
    const t = new Date(); t.setDate(t.getDate()-daysBack); t.setHours(h,m,0,0); return t
  }

  const completed = [
    {jobId:1,laborTypeId:1,punchIn:d(0, 9, 0),punchOut:d(0,11,30)},
    {jobId:3,laborTypeId:3,punchIn:d(0,11,30),punchOut:d(0,12, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(1, 9, 0),punchOut:d(1,12, 0)},
    {jobId:2,laborTypeId:2,punchIn:d(1,13, 0),punchOut:d(1,16, 0)},
    {jobId:3,laborTypeId:3,punchIn:d(1,16, 0),punchOut:d(1,17, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(2, 8,30),punchOut:d(2,11,30)},
    {jobId:2,laborTypeId:2,punchIn:d(2,13, 0),punchOut:d(2,17, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(3, 9, 0),punchOut:d(3,13, 0)},
    {jobId:3,laborTypeId:3,punchIn:d(3,14, 0),punchOut:d(3,15, 0)},
    {jobId:2,laborTypeId:2,punchIn:d(4,10, 0),punchOut:d(4,14,30)},
    {jobId:1,laborTypeId:1,punchIn:d(5, 9, 0),punchOut:d(5,12,30)},
    {jobId:2,laborTypeId:2,punchIn:d(5,13, 0),punchOut:d(5,16, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(6, 9, 0),punchOut:d(6,12, 0)},
    {jobId:3,laborTypeId:3,punchIn:d(7,10, 0),punchOut:d(7,11, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(8, 9, 0),punchOut:d(8,13, 0)},
    {jobId:2,laborTypeId:2,punchIn:d(9, 9, 0),punchOut:d(9,15, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(10,8, 0),punchOut:d(10,12,30)},
    {jobId:3,laborTypeId:3,punchIn:d(11,9, 0),punchOut:d(11,10,30)},
    {jobId:2,laborTypeId:2,punchIn:d(12,13,0),punchOut:d(12,17, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(14,9, 0),punchOut:d(14,13, 0)},
    {jobId:2,laborTypeId:2,punchIn:d(15,9, 0),punchOut:d(15,16, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(16,8, 0),punchOut:d(16,12, 0)},
    {jobId:3,laborTypeId:3,punchIn:d(17,10,0),punchOut:d(17,11,30)},
    {jobId:2,laborTypeId:2,punchIn:d(18,13,0),punchOut:d(18,16,30)},
    {jobId:1,laborTypeId:1,punchIn:d(21,9, 0),punchOut:d(21,13, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(22,9, 0),punchOut:d(22,12, 0)},
    {jobId:2,laborTypeId:2,punchIn:d(23,9, 0),punchOut:d(23,15, 0)},
    {jobId:3,laborTypeId:3,punchIn:d(25,10,0),punchOut:d(25,11, 0)},
    {jobId:1,laborTypeId:1,punchIn:d(28,9, 0),punchOut:d(28,13,30)},
  ]

  // Two active timers so Timer view is populated
  const now = Date.now()
  const active = [
    {jobId:1,laborTypeId:1,punchIn:new Date(now - 90*60000),punchOut:null},
    {jobId:2,laborTypeId:2,punchIn:new Date(now - 45*60000),punchOut:null},
  ]

  { const tx = db.transaction(['entries'], 'readwrite')
    const s = tx.objectStore('entries')
    for (const e of [...completed, ...active]) s.add(e)
    await txDone(tx) }

  db.close()
}

// ── Per-device-and-theme capture ─────────────────────────────────────────────
async function captureDevice(browser, device, theme) {
  const { name, width, height, dpr, isMobile, userAgent } = device
  const outDir = join(ROOT, 'docs', 'screenshots', `${name}-${theme}`)
  mkdirSync(outDir, { recursive: true })

  const ctx = await browser.newContext({
    viewport:          { width, height },
    deviceScaleFactor: dpr,
    isMobile,
    colorScheme:       theme,
    ...(userAgent ? { userAgent } : {}),
  })

  const page = await ctx.newPage()
  // Load, seed (with correct theme), reload so the app picks it all up
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  // Wait for the nav to appear — signals Dexie has finished opening/upgrading the DB.
  // Use preview build (npm run preview) rather than dev server: the dev server's root=app/
  // configuration causes Chromium to 404 on the ../src/main.jsx module script path.
  // Which nav is visible depends on the responsive layout: the phone bottom tab
  // bar below md, the desktop/tablet left sidebar (aria-label "Primary") at md+.
  const navLabel = width >= 768 ? 'Primary' : 'Main navigation'
  await page.waitForSelector(`nav[aria-label="${navLabel}"]`)
  await page.evaluate(seedData, theme)
  // Suppress the first-run install nudge: with a mobile UA it becomes eligible
  // once the reload below bumps the open count past the threshold, and would
  // otherwise pop a bottom sheet over every captured view.
  await page.evaluate(() => localStorage.setItem('pi.installNudgeDismissed', '1'))
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)

  const nav = page.locator(`nav[aria-label="${navLabel}"]`)

  async function goTab(label) {
    // Match by accessible name so it works for both the bottom nav (text label)
    // and the tablet icon rail (aria-label, where the text label is hidden).
    await nav.getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(350)
  }

  async function shot(filename) {
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(outDir, filename) })
    process.stdout.write(`  ${filename}\n`)
  }

  await goTab('Timer')
  await shot('timer.png')

  await goTab('Jobs')
  await shot('jobs.png')

  // Jobs/Labor-Types and Timesheets daily/weekly switchers are role="group" +
  // aria-pressed toggle buttons (not an ARIA tablist) — see LicenseModal’s note.
  await page.getByRole('button', { name: 'Labor Types' }).click()
  await page.waitForTimeout(300)
  await shot('labor-types.png')

  await goTab('Timesheets')
  await shot('timesheets-daily.png')
  await page.getByRole('button', { name: /weekly/i }).click()
  await page.waitForTimeout(300)
  await shot('timesheets-weekly.png')

  await goTab('Analytics')
  await page.waitForTimeout(600)
  await shot('analytics.png')

  await goTab('Settings')
  await shot('settings.png')

  await ctx.close()
  console.log(`✓ ${name}-${theme} done → docs/screenshots/${name}-${theme}/`)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Connecting to ${BASE_URL} …`)

  try {
    await fetch(BASE_URL)
  } catch {
    console.error(`\nError: dev server not reachable at ${BASE_URL}`)
    console.error('Start it first:  npm run dev\n')
    process.exit(1)
  }

  const browser = await chromium.launch()

  for (const device of DEVICES) {
    for (const theme of THEMES) {
      console.log(`\n── ${device.name}-${theme} (${device.width}×${device.height} @${device.dpr}×) ──`)
      await captureDevice(browser, device, theme)
    }
  }

  await browser.close()
  console.log('\n✓ All 42 screenshots generated.')
}

main().catch(err => { console.error(err); process.exit(1) })
