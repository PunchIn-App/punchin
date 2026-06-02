<p align="center">
  <img src="docs/logo.svg" alt="PunchIn" width="220" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-BUSL--1.1-F59E0B?style=flat&labelColor=161923" alt="License" /></a>
  <a href="../../actions/workflows/ci.yml"><img src="../../actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/version-0.6.6-F59E0B?style=flat&labelColor=161923" alt="Version 0.6.6" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/frontend-stack-374151?style=flat" alt="" />
  <img src="https://img.shields.io/badge/React-18-F59E0B?style=flat&labelColor=161923&logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Dexie-3-F59E0B?style=flat&labelColor=161923" alt="Dexie 3" />
  <img src="https://img.shields.io/badge/Recharts-2-F59E0B?style=flat&labelColor=161923" alt="Recharts 2" />
  <img src="https://img.shields.io/badge/Vite-6-F59E0B?style=flat&labelColor=161923&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Tailwind-3-F59E0B?style=flat&labelColor=161923&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/backend-none-374151?style=flat" alt="" />
  <img src="https://img.shields.io/badge/deployed%20on-Cloudflare%20Workers-F59E0B?style=flat&labelColor=161923&logo=cloudflare&logoColor=white" alt="Deployed on Cloudflare Workers" />
</p>

<p align="center"><strong>Precision time tracking for freelancers</strong> — punch in, punch out, get paid accurately.</p>

---

PunchIn is a mobile-first, offline-capable Progressive Web App (PWA) for freelancers and independent contractors who need fast, no-friction time tracking. No accounts. No cloud. No subscriptions. Your data lives entirely on your device.

---

## Why PunchIn?

Most time tracking tools are bloated, require an account, or bill you monthly for basic features. PunchIn is the opposite:

- **Instant** — open the app, tap Punch In, you're tracking
- **Private** — all data stored locally in your browser (IndexedDB); nothing ever leaves your device
- **Installable** — works as a PWA; add it to your home screen and use it like a native app
- **Offline-first** — works without an internet connection, always

---

## Screenshots

### All views &nbsp;·&nbsp; Pixel 10 Pro XL (default 1080×2404 @486 PPI · 412×916 CSS px @2.625×)

<p align="center">
  <img src="docs/screenshots/phone/timer.png"            width="110" alt="Timer — 2 active timers" />
  <img src="docs/screenshots/phone/jobs.png"             width="110" alt="Jobs list" />
  <img src="docs/screenshots/phone/labor-types.png"      width="110" alt="Labor Types" />
  <img src="docs/screenshots/phone/timesheets-daily.png" width="110" alt="Timesheets — Daily" />
  <img src="docs/screenshots/phone/timesheets-weekly.png"width="110" alt="Timesheets — Weekly" />
  <img src="docs/screenshots/phone/analytics.png"        width="110" alt="Analytics" />
  <img src="docs/screenshots/phone/settings.png"         width="110" alt="Settings" />
</p>
<p align="center"><sub>Timer &nbsp;·&nbsp; Jobs &nbsp;·&nbsp; Labor Types &nbsp;·&nbsp; Daily Sheet &nbsp;·&nbsp; Weekly Sheet &nbsp;·&nbsp; Analytics &nbsp;·&nbsp; Settings</sub></p>

---

### Scales to every screen size — and every platform

PunchIn adapts from pocket to desktop without a separate codebase. The bottom-nav shell and card layout reflow naturally across breakpoints. When installed as a PWA, it goes further: the app detects the host OS and applies platform-native behaviors automatically — iOS safe-area insets, Apple-style bottom sheets with swipe-to-dismiss and Taptic Engine feedback, and Material Design 3 sheets on Android with hardware back-button support.

<table align="center">
  <thead>
    <tr>
      <th align="center">Phone<br><sub>Pixel 10 Pro XL · default 1080×2404 @486 PPI · 412×916 CSS px @2.625×</sub></th>
      <th align="center">Tablet<br><sub>iPad Air 11" M2 · landscape 2388×1668 @2×</sub></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="docs/screenshots/phone/timer.png"     width="190" alt="Timer on phone" /></td>
      <td align="center"><img src="docs/screenshots/tablet/timer.png"    width="370" alt="Timer on iPad" /></td>
    </tr>
    <tr>
      <td align="center"><img src="docs/screenshots/phone/analytics.png" width="190" alt="Analytics on phone" /></td>
      <td align="center"><img src="docs/screenshots/tablet/analytics.png"width="370" alt="Analytics on iPad" /></td>
    </tr>
  </tbody>
</table>

<br>

**Desktop · 1920×1080**

<p align="center">
  <img src="docs/screenshots/desktop/timer.png"      width="720" alt="Timer on desktop" /><br>
  <sub>Timer view</sub>
</p>
<p align="center">
  <img src="docs/screenshots/desktop/analytics.png"  width="720" alt="Analytics on desktop" /><br>
  <sub>Analytics view</sub>
</p>
<p align="center">
  <img src="docs/screenshots/desktop/timesheets-weekly.png" width="720" alt="Weekly timesheets on desktop" /><br>
  <sub>Weekly timesheets</sub>
</p>

---

## Features

### Live Timer Dashboard
Start one or more timers across different jobs simultaneously. Each running timer shows the job, labor type, start time, optional notes, and a live elapsed-time counter updated every second. Punch out with a single tap. When no timers are active, the most recently completed session is shown as a "Last Session" card so your previous work is always visible.

### Job & Labor Type Management
Organize your work into **jobs** (client projects) and **labor types** (billable categories like Design, Development, Consulting). Both support color-coded badges for fast visual identification. Archiving a job or labor type hides it from active dropdowns and groups it under a collapsible **Archived** section at the bottom of the list — searchable and restorable any time. Historical entries are never broken; archived records are always preserved.

### Timesheets
Review your logged time by **day** or **week**. The weekly view shows a per-job breakdown with proportional bars so you can see at a glance where your time went. Full-text search filters entries by job name, client, labor type, or notes. Navigate between periods with arrows, log past entries manually, and edit or delete any record.

Export the current period as a **CSV** spreadsheet or a **Print / PDF** via the system print dialog — both available directly from the Timesheets toolbar.

### Analytics
Charts powered by [Recharts](https://recharts.org) give you a visual overview of your workload over the last **7 or 30 days**:

- **Daily bar chart** — hours logged per day
- **Hours by job** — horizontal bar chart sorted by volume
- **Labor type donut** — proportion of time by category

### Invoicing
Set **hourly rates** per labor type on each job (Jobs tab → edit a job → Hourly rates). Then open the **Invoice** modal from the Timesheets toolbar: pick a job and period, and PunchIn builds a line-item invoice showing hours, rate, and amount for every entry. Export as a formatted **CSV** or use **Print / PDF** to send it directly to a client.

### Settings & Data Portability
- Toggle concurrent timers on or off — when off, starting a new timer automatically punches out any running one
- Choose whether your week starts on Monday or Sunday
- Switch between **Auto / Light / Dark** theme (auto follows your OS preference)
- **Accent color** — pick from 6 preset highlight colors (Amber, Orange, Lime, Teal, Sky, Pink); updates the entire app instantly
- **Export JSON** — full backup of all data (jobs, labor types, entries)
- **Export CSV** — all completed entries as a spreadsheet ready for import into bookkeeping apps
- **Import** a JSON backup (smart deduplication prevents duplicates)
- **Danger Zone** (collapsible) — **Clear entries** resets logged time while keeping jobs and labor types; **Factory Reset** wipes all data and restores the app to a clean slate (two confirmation steps required)
- **Check for updates** checks for a pending service-worker update and reloads if one is found, or confirms you're already on the latest version
- Tap the **PunchIn** logo in the header to return to the Timer view from anywhere
- Tap the **PunchIn** row in About to open the GitHub repository
- View the **Changelog** directly from the About section

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build | Vite 6 |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Database | Dexie 3 (IndexedDB) |
| Charts | Recharts 2 |
| Date utilities | date-fns 3 |
| Icons | lucide-react |
| PWA | vite-plugin-pwa |
| Hosting | Cloudflare Workers |

---

## Get Started

**[trackmytime.today](https://trackmytime.today)** — open it in any browser, add it to your home screen, and start tracking. No sign-up required.

---

## How It Works

### Data model

All state lives in a local IndexedDB database named `PunchInDB`, managed by Dexie.

| Table | Purpose |
|---|---|
| `entries` | Time records — `punchOut: null` means the timer is still running |
| `jobs` | Client projects; soft-archived via `isActive` / `isDeleted` |
| `laborTypes` | Billable categories with hex color; soft-archived via `isArchived` |
| `settings` | Key-value app preferences |

Soft-deletion is used throughout: records are never hard-deleted so historical entries always retain valid references to their job and labor type.

### State management

No Redux, no global Context. Dexie's `useLiveQuery` hook makes the database reactive — components re-render automatically when data changes. Local React state handles UI concerns (open modals, active tab, search input).

### Theming

Dark and light themes are implemented as CSS custom properties. The default `"auto"` setting tracks `prefers-color-scheme` via a `matchMedia` listener; users can override to force light or dark.

The **accent color** (nav, buttons, active states) is stored as a hex setting and converted to an `--accent-rgb` CSS variable at runtime. A single `appAccent` Tailwind token wires the entire UI to the user's chosen color.

### Adaptive platform shell

A `usePlatformContext()` hook detects standalone mode and the host OS at runtime. When the app is installed:

- **iOS** — `env(safe-area-inset-top/bottom)` pads the header and nav bar so nothing clips into the notch or home indicator. Modals render as Apple-style bottom sheets with a grabber pill, swipe-down-to-dismiss, and Taptic Engine haptic feedback via the WebKit `<input switch>` polyfill.
- **Android** — Modals follow Material Design 3 (28 px top radius, 48 dp drag handle). The hardware back button closes open modals instead of exiting the app, implemented via `history.pushState` + `popstate`. Dismiss fires `navigator.vibrate(40)` for a crisp tick.
- **Browser tab** — All of the above is bypassed; the original layout and modal behavior is unchanged.

---

## Project Structure

```
punchin/
├── index.html              # App shell, fonts, theme-color meta
├── vite.config.js          # Vite + PWA plugin config
├── wrangler.jsonc          # Cloudflare Workers deployment
├── tailwind.config.js      # Custom font families + CSS-variable-backed color tokens
└── src/
    ├── App.jsx             # Root: tab state, theme application
    ├── db.js               # Dexie schema, seed data, migrations
    ├── index.css           # CSS variables (dark/light), scrollbar utils
    ├── components/
    │   ├── Layout.jsx          # Fixed header + bottom nav
    │   ├── TimerCard.jsx       # Live timer card (1 s interval)
    │   ├── StartTimerModal.jsx # Punch-in form
    │   ├── EditEntryModal.jsx  # Edit active or completed entry
    │   ├── InvoiceModal.jsx    # Invoice generator with CSV/print export
    │   └── ConfirmModal.jsx    # Accessible confirmation dialog
    ├── views/
    │   ├── TimerView.jsx       # Active timers list
    │   ├── JobsView.jsx        # Jobs & labor types CRUD
    │   ├── TimesheetsView.jsx  # Daily/weekly logs + search
    │   ├── AnalyticsView.jsx   # Charts
    │   └── SettingsView.jsx    # Preferences + data management
    ├── hooks/
    │   ├── useSettings.js          # Reactive settings hook
    │   ├── usePlatformContext.js   # Standalone + OS detection
    │   └── useHapticFeedback.jsx  # Platform-routed haptic trigger
    └── utils/
        └── time.js             # Date/time helpers
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, workflow, and conventions.

All contributors must agree to the [Contributor License Agreement](CLA.md) before their pull request can be merged.

---

## License

PunchIn Time Tracker is source-available under the [Business Source License 1.1](LICENSE). Free for personal, non-commercial use by individual freelancers. Commercial use requires a separate license — contact [licensing@trackmytime.today](mailto:licensing@trackmytime.today). The license converts to AGPL-3.0 on 2030-06-02.

Contributions are accepted under the [Contributor License Agreement](CLA.md).
