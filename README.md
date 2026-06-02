<p align="center">
  <img src="docs/social-preview.svg#gh-dark-mode-only"       alt="PunchIn — Precision time tracking for freelancers" width="720" />
  <img src="docs/social-preview-light.svg#gh-light-mode-only" alt="PunchIn — Precision time tracking for freelancers" width="720" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-BUSL--1.1-1f6feb?style=flat" alt="License" /></a>
  <a href="../../actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/PunchIn-App/punchin/ci.yml?branch=main&style=flat&label=CI&color=1f6feb" alt="CI" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.8.0-1f6feb?style=flat" alt="Version 0.8.0" /></a>
</p>

<p align="center">
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-1f6feb?style=flat&logo=react&logoColor=white" alt="React 18" /></a>
  <a href="https://dexie.org"><img src="https://img.shields.io/badge/Dexie-3-1f6feb?style=flat" alt="Dexie 3" /></a>
  <a href="https://recharts.org"><img src="https://img.shields.io/badge/Recharts-2-1f6feb?style=flat" alt="Recharts 2" /></a>
  <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-6-1f6feb?style=flat&logo=vite&logoColor=white" alt="Vite 6" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-3-1f6feb?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3" /></a>
  <a href="https://workers.cloudflare.com"><img src="https://img.shields.io/badge/deployed%20on-Cloudflare%20Workers-1f6feb?style=flat&logo=cloudflare&logoColor=white" alt="Deployed on Cloudflare Workers" /></a>
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

## Get Started

**[trackmytime.today](https://trackmytime.today)** — open it in any browser, add it to your home screen, and start tracking. No sign-up required.

---

## Screenshots

### Phone — Pixel 10 Pro XL (all views)

<p align="center">
  <img src="docs/screenshots/phone-dark/timer.png#gh-dark-mode-only"             width="110" alt="Timer — 2 active timers" />
  <img src="docs/screenshots/phone-dark/jobs.png#gh-dark-mode-only"              width="110" alt="Jobs list" />
  <img src="docs/screenshots/phone-dark/labor-types.png#gh-dark-mode-only"       width="110" alt="Labor Types" />
  <img src="docs/screenshots/phone-dark/timesheets-daily.png#gh-dark-mode-only"  width="110" alt="Timesheets — Daily" />
  <img src="docs/screenshots/phone-dark/timesheets-weekly.png#gh-dark-mode-only" width="110" alt="Timesheets — Weekly" />
  <img src="docs/screenshots/phone-dark/analytics.png#gh-dark-mode-only"         width="110" alt="Analytics" />
  <img src="docs/screenshots/phone-dark/settings.png#gh-dark-mode-only"          width="110" alt="Settings" />
  <img src="docs/screenshots/phone-light/timer.png#gh-light-mode-only"             width="110" alt="Timer — 2 active timers" />
  <img src="docs/screenshots/phone-light/jobs.png#gh-light-mode-only"              width="110" alt="Jobs list" />
  <img src="docs/screenshots/phone-light/labor-types.png#gh-light-mode-only"       width="110" alt="Labor Types" />
  <img src="docs/screenshots/phone-light/timesheets-daily.png#gh-light-mode-only"  width="110" alt="Timesheets — Daily" />
  <img src="docs/screenshots/phone-light/timesheets-weekly.png#gh-light-mode-only" width="110" alt="Timesheets — Weekly" />
  <img src="docs/screenshots/phone-light/analytics.png#gh-light-mode-only"         width="110" alt="Analytics" />
  <img src="docs/screenshots/phone-light/settings.png#gh-light-mode-only"          width="110" alt="Settings" />
</p>
<p align="center"><sub>Timer &nbsp;·&nbsp; Jobs &nbsp;·&nbsp; Labor Types &nbsp;·&nbsp; Daily Sheet &nbsp;·&nbsp; Weekly Sheet &nbsp;·&nbsp; Analytics &nbsp;·&nbsp; Settings</sub></p>

---

### Scales to every screen size — and every platform

PunchIn adapts from pocket to desktop without a separate codebase. The bottom-nav shell and card layout reflow naturally across breakpoints. When installed as a PWA, it goes further: the app detects the host OS and applies platform-native behaviors automatically — iOS safe-area insets, Apple-style bottom sheets with swipe-to-dismiss and Taptic Engine feedback, and Material Design 3 sheets on Android with hardware back-button support.

<table align="center">
  <thead>
    <tr>
      <th scope="col" align="center">Phone</th>
      <th scope="col" align="center">Tablet</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center">
        <img src="docs/screenshots/phone-dark/timer.png#gh-dark-mode-only"   width="190" alt="Timer on phone" />
        <img src="docs/screenshots/phone-light/timer.png#gh-light-mode-only" width="190" alt="Timer on phone" />
      </td>
      <td align="center">
        <img src="docs/screenshots/tablet-dark/timer.png#gh-dark-mode-only"   width="370" alt="Timer on iPad" />
        <img src="docs/screenshots/tablet-light/timer.png#gh-light-mode-only" width="370" alt="Timer on iPad" />
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="docs/screenshots/phone-dark/analytics.png#gh-dark-mode-only"   width="190" alt="Analytics on phone" />
        <img src="docs/screenshots/phone-light/analytics.png#gh-light-mode-only" width="190" alt="Analytics on phone" />
      </td>
      <td align="center">
        <img src="docs/screenshots/tablet-dark/analytics.png#gh-dark-mode-only"   width="370" alt="Analytics on iPad" />
        <img src="docs/screenshots/tablet-light/analytics.png#gh-light-mode-only" width="370" alt="Analytics on iPad" />
      </td>
    </tr>
  </tbody>
</table>

<br>

### Desktop — 1920×1080

<p align="center">
  <img src="docs/screenshots/desktop-dark/timer.png#gh-dark-mode-only"   width="720" alt="Timer on desktop" />
  <img src="docs/screenshots/desktop-light/timer.png#gh-light-mode-only" width="720" alt="Timer on desktop" /><br>
  <sub>Timer</sub>
</p>
<p align="center">
  <img src="docs/screenshots/desktop-dark/analytics.png#gh-dark-mode-only"   width="720" alt="Analytics on desktop" />
  <img src="docs/screenshots/desktop-light/analytics.png#gh-light-mode-only" width="720" alt="Analytics on desktop" /><br>
  <sub>Analytics</sub>
</p>
<p align="center">
  <img src="docs/screenshots/desktop-dark/timesheets-weekly.png#gh-dark-mode-only"   width="720" alt="Weekly timesheets on desktop" />
  <img src="docs/screenshots/desktop-light/timesheets-weekly.png#gh-light-mode-only" width="720" alt="Weekly timesheets on desktop" /><br>
  <sub>Weekly timesheets</sub>
</p>

---

## Features

### Live Timer Dashboard
Start one or more timers across different jobs simultaneously. Each running timer shows the job, labor type, start time, optional notes, and a live elapsed-time counter updated every second. Tap **Stop** to end a timer. When no timers are active, the most recently completed session is shown as a "Last Session" card so your previous work is always visible.

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

### Invoice Generator
Set **hourly rates** per labor type on each job (Jobs tab → edit a job → Hourly rates). Then open the **Invoice** modal from the Timesheets toolbar: pick a job and period, and PunchIn builds a line-item invoice showing hours, rate, and amount for every entry. Export as a formatted **CSV** or use **Print / PDF** to send it directly to a client.

### Settings & Data Portability
- **Concurrent timers** — toggle on or off; when off, starting a new timer automatically stops any running one
- **Week start** — choose whether your week starts on Monday or Sunday
- **Theme** — switch between **Auto / Light / Dark** (auto follows your OS preference)
- **Accent color** — pick from 5 preset highlight colors (Blue, Amber, Orange, Lime, Teal); updates the entire app instantly
- **Export JSON** — full backup of all data (jobs, labor types, entries)
- **Export CSV** — all completed entries as a spreadsheet ready for import into bookkeeping apps
- **Import JSON** — restore from a backup file (smart deduplication prevents duplicates)
- **Danger Zone** (collapsible) — **Clear entries** resets logged time while keeping jobs and labor types; **Factory Reset** wipes all data and restores the app to a clean slate (two confirmation steps required)
- **Check for updates** — applies any pending service-worker update and reloads; confirms you're on the latest version if none is found
- **Header logo** — tap the PunchIn logo to return to the Timer view from any screen
- **About → PunchIn** — opens the GitHub repository
- **About → Changelog** — browse version history and release notes

---

## How It Works

### Data Model

All state lives in a local IndexedDB database named `PunchInDB`, managed by Dexie.

| Table | Purpose |
|---|---|
| `entries` | Time entries — `punchOut: null` means the timer is still running |
| `jobs` | Client projects; soft-archived via `isActive` / `isDeleted` |
| `laborTypes` | Billable categories with hex color; soft-archived via `isArchived` |
| `settings` | Key-value app preferences |

Soft-deletion is used throughout: records are never hard-deleted so historical entries always retain valid references to their job and labor type.

### State Management

No Redux, no global Context. Dexie's `useLiveQuery` hook makes the database reactive — components re-render automatically when data changes. Local React state handles UI concerns (open modals, active tab, search input).

### Theming

Dark and light themes are implemented as CSS custom properties. The default `"auto"` setting tracks `prefers-color-scheme` via a `matchMedia` listener; users can override to force light or dark.

The **accent color** (nav, buttons, active states) is stored as a hex setting and converted to an `--accent-rgb` CSS variable at runtime. A single `appAccent` Tailwind token wires the entire UI to the user's chosen color.

### Adaptive Platform Shell

A `usePlatformContext()` hook detects standalone mode and the host OS at runtime. When the app is installed:

- **iOS** — `env(safe-area-inset-top/bottom)` pads the header and nav bar so nothing clips into the notch or home indicator. Modals render as Apple-style bottom sheets with a grabber pill, swipe-down-to-dismiss, and Taptic Engine haptic feedback via the WebKit `<input switch>` polyfill.
- **Android** — Modals follow Material Design 3 (28 px top radius, 48 dp drag handle). The hardware back button closes open modals instead of exiting the app, implemented via `history.pushState` + `popstate`. Dismiss fires `navigator.vibrate(40)` for a crisp tick.
- **Browser tab** — All of the above is bypassed; the original layout and modal behavior is unchanged.

---

## Tech Stack & Project Structure

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

```
punchin/
├── package.json            # Version source of truth
├── index.html              # App shell, fonts, theme-color meta
├── vite.config.js          # Vite + PWA plugin config
├── wrangler.jsonc          # Cloudflare Workers deployment
├── tailwind.config.js      # Custom font families + CSS-variable-backed color tokens
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Root: tab state, theme application
    ├── db.js               # Dexie schema, seed data, migrations
    ├── index.css           # CSS variables (dark/light), scrollbar utils
    ├── components/
    │   ├── Layout.jsx          # Fixed header + bottom nav
    │   ├── ErrorBoundary.jsx   # Error boundary wrapping each view
    │   ├── TimerCard.jsx       # Live timer card (1 s interval)
    │   ├── StartTimerModal.jsx # Punch-in form
    │   ├── EditEntryModal.jsx  # Edit active or completed entry
    │   ├── InvoiceModal.jsx    # Invoice generator with CSV/print export
    │   ├── ConfirmModal.jsx    # Accessible confirmation dialog
    │   ├── ColorPicker.jsx     # Preset swatches + custom hex input
    │   └── ChangelogModal.jsx  # Changelog viewer (built from CHANGELOG.md)
    ├── views/
    │   ├── TimerView.jsx       # Active timers list
    │   ├── JobsView.jsx        # Jobs & Labor Types CRUD
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

PunchIn Time Tracker is source-available under the [Business Source License 1.1](LICENSE). Free for personal, non-commercial use by individual freelancers. Commercial use requires a separate license — [contact the licensor](mailto:licensing@trackmytime.today). The license converts to AGPL-3.0 on 2030-06-02.

Contributions are accepted under the [Contributor License Agreement](CLA.md).
