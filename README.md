<p align="center">
  <img src="docs/social-preview.svg#gh-dark-mode-only"       alt="PunchIn — Precision time tracking for freelancers" width="720" />
  <img src="docs/social-preview-light.svg#gh-light-mode-only" alt="PunchIn — Precision time tracking for freelancers" width="720" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-BUSL--1.1-2d5bf5?style=flat" alt="License" /></a>
  <a href="../../actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/PunchIn-App/punchin/ci.yml?branch=main&style=flat&label=CI&color=2d5bf5" alt="CI" /></a>
  <a href="docs/CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.25.0-2d5bf5?style=flat" alt="Version 0.25.0" /></a>
</p>

<p align="center">
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-2d5bf5?style=flat&logo=react&logoColor=white" alt="React 19" /></a>
  <a href="https://dexie.org"><img src="https://img.shields.io/badge/Dexie-4-2d5bf5?style=flat" alt="Dexie 4" /></a>
  <a href="https://recharts.org"><img src="https://img.shields.io/badge/Recharts-3-2d5bf5?style=flat" alt="Recharts 3" /></a>
  <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-8-2d5bf5?style=flat&logo=vite&logoColor=white" alt="Vite 8" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-4-2d5bf5?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" /></a>
  <a href="https://workers.cloudflare.com"><img src="https://img.shields.io/badge/deployed%20on-Cloudflare%20Workers-2d5bf5?style=flat&logo=cloudflare&logoColor=white" alt="Deployed on Cloudflare Workers" /></a>
</p>

<p align="center"><strong>Precision time tracking for freelancers</strong> — punch in, punch out, get paid accurately.</p>

---

PunchIn is a mobile-first, offline-capable Progressive Web App (PWA) for freelancers and independent contractors who need fast, no-friction time tracking. No accounts. No subscriptions. Your data stays on your device by default — nothing leaves it unless you opt in to sync.

---

## Why PunchIn?

Most time tracking tools are bloated, require an account, or bill you monthly for basic features. PunchIn is the opposite:

- **Instant** — open the app, tap Punch In, you're tracking
- **Private** — all data stored locally in your browser (IndexedDB); nothing leaves your device unless you opt in to sync
- **Installable** — works as a PWA; add it to your home screen and use it like a native app
- **Offline-first** — works without an internet connection, always

## Get Started

**[trackmytime.today](https://trackmytime.today)** — open it in any browser, add it to your home screen, and start tracking. No sign-up required.

---

## Screenshots

### Phone

<p align="center">
  <img src="docs/screenshots/phone-dark/timer.png#gh-dark-mode-only"             width="110" alt="Timer view — two jobs running in parallel, each showing elapsed time ticking live" />
  <img src="docs/screenshots/phone-dark/jobs.png#gh-dark-mode-only"              width="110" alt="Jobs view — color-coded job cards with edit and archive controls" />
  <img src="docs/screenshots/phone-dark/labor-types.png#gh-dark-mode-only"       width="110" alt="Labor Types view — colored category badges for billable work types" />
  <img src="docs/screenshots/phone-dark/timesheets-daily.png#gh-dark-mode-only"  width="110" alt="Daily timesheet — logged entries listed with job, labor type, and duration" />
  <img src="docs/screenshots/phone-dark/timesheets-weekly.png#gh-dark-mode-only" width="110" alt="Weekly timesheet — per-job time breakdown with proportional fill bars" />
  <img src="docs/screenshots/phone-dark/analytics.png#gh-dark-mode-only"         width="110" alt="Analytics view — daily hours bar chart, job volume bars, and labor type donut" />
  <img src="docs/screenshots/phone-dark/settings.png#gh-dark-mode-only"          width="110" alt="Settings view — theme toggle, accent color picker, and data export options" />
  <img src="docs/screenshots/phone-light/timer.png#gh-light-mode-only"             width="110" alt="Timer view — two jobs running in parallel, each showing elapsed time ticking live" />
  <img src="docs/screenshots/phone-light/jobs.png#gh-light-mode-only"              width="110" alt="Jobs view — color-coded job cards with edit and archive controls" />
  <img src="docs/screenshots/phone-light/labor-types.png#gh-light-mode-only"       width="110" alt="Labor Types view — colored category badges for billable work types" />
  <img src="docs/screenshots/phone-light/timesheets-daily.png#gh-light-mode-only"  width="110" alt="Daily timesheet — logged entries listed with job, labor type, and duration" />
  <img src="docs/screenshots/phone-light/timesheets-weekly.png#gh-light-mode-only" width="110" alt="Weekly timesheet — per-job time breakdown with proportional fill bars" />
  <img src="docs/screenshots/phone-light/analytics.png#gh-light-mode-only"         width="110" alt="Analytics view — daily hours bar chart, job volume bars, and labor type donut" />
  <img src="docs/screenshots/phone-light/settings.png#gh-light-mode-only"          width="110" alt="Settings view — theme toggle, accent color picker, and data export options" />
</p>
<p align="center"><sub>Timer &nbsp;·&nbsp; Jobs &nbsp;·&nbsp; Labor Types &nbsp;·&nbsp; Daily Sheet &nbsp;·&nbsp; Weekly Sheet &nbsp;·&nbsp; Analytics &nbsp;·&nbsp; Settings</sub></p>

### Tablet &amp; Desktop

PunchIn adapts from pocket to desktop without a separate codebase, with a **three-tier navigation shell**: on phones, a top brand header + bottom tab bar; on tablets, that bottom bar gives way to a compact left **icon rail**; on desktop, to a full **labelled sidebar** carrying the brand and a live "On the clock" status. The Timer screen adds a right-hand **overview rail** on wide screens — last session, quick-punch shortcuts for your most-recent jobs, and a this-week total with a per-job breakdown. When installed as a PWA, it detects the host OS and applies platform-native behaviors automatically — iOS safe-area insets, Apple-style bottom sheets with swipe-to-dismiss and Taptic Engine feedback, and Material Design 3 sheets on Android with hardware back-button support.

<details>
<summary><strong>Screenshots</strong></summary>
  
#### Tablet

<p align="center">
  <img src="docs/screenshots/tablet-dark/timer.png#gh-dark-mode-only"              width="280" alt="Timer view on iPad Air — wide landscape layout with two active timers" />
  <img src="docs/screenshots/tablet-dark/analytics.png#gh-dark-mode-only"          width="280" alt="Analytics on iPad Air — charts spread across the full landscape canvas" />
  <img src="docs/screenshots/tablet-dark/timesheets-weekly.png#gh-dark-mode-only"  width="280" alt="Weekly timesheet on iPad Air — full-week log in landscape with job breakdowns" />
  <img src="docs/screenshots/tablet-light/timer.png#gh-light-mode-only"              width="280" alt="Timer view on iPad Air — wide landscape layout with two active timers" />
  <img src="docs/screenshots/tablet-light/analytics.png#gh-light-mode-only"          width="280" alt="Analytics on iPad Air — charts spread across the full landscape canvas" />
  <img src="docs/screenshots/tablet-light/timesheets-weekly.png#gh-light-mode-only"  width="280" alt="Weekly timesheet on iPad Air — full-week log in landscape with job breakdowns" />
</p>
<p align="center"><sub>Timer &nbsp;·&nbsp; Analytics &nbsp;·&nbsp; Weekly Sheet</sub></p>

##### Desktop

<p align="center">
  <img src="docs/screenshots/desktop-dark/timer.png#gh-dark-mode-only"   width="720" alt="Timer view at 1920×1080 — active timers in a full-width card layout" />
  <img src="docs/screenshots/desktop-light/timer.png#gh-light-mode-only" width="720" alt="Timer view at 1920×1080 — active timers in a full-width card layout" />
  <img src="docs/screenshots/desktop-dark/analytics.png#gh-dark-mode-only"   width="720" alt="Analytics at 1920×1080 — daily bars, job chart, and labor donut side by side" />
  <img src="docs/screenshots/desktop-light/analytics.png#gh-light-mode-only" width="720" alt="Analytics at 1920×1080 — daily bars, job chart, and labor donut side by side" />
  <img src="docs/screenshots/desktop-dark/timesheets-weekly.png#gh-dark-mode-only"   width="720" alt="Weekly timesheet at 1920×1080 — full-week log with job bars and export toolbar" />
  <img src="docs/screenshots/desktop-light/timesheets-weekly.png#gh-light-mode-only" width="720" alt="Weekly timesheet at 1920×1080 — full-week log with job bars and export toolbar" />
</p>
<p align="center"><sub>Timer &nbsp;·&nbsp; Analytics &nbsp;·&nbsp; Weekly Sheet</sub></p>

</details>

---

## Features

<details>
<summary><strong>Live Timer Dashboard</strong></summary>

Start one or more timers across different jobs simultaneously. Each running timer shows the job, labor type, start time, optional notes, and a live elapsed-time counter updated every second. Tap **Stop** to end a timer. When no timers are active, the most recently completed session is shown as a "Last Session" card so your previous work is always visible.

</details>

<details>
<summary><strong>Job &amp; Labor Type Management</strong></summary>

Organize your work into **jobs** (client projects) and **labor types** (billable categories like Design, Development, Consulting). Both support color-coded badges for fast visual identification. Archiving a job or labor type hides it from active dropdowns and groups it under a collapsible **Archived** section at the bottom of the list — searchable and restorable any time. Historical entries are never broken; archived records are always preserved.

</details>

<details>
<summary><strong>Timesheets</strong></summary>

Review your logged time by **day** or **week**. The weekly view shows a per-job breakdown with proportional bars so you can see at a glance where your time went. Full-text search filters entries by job name, client, labor type, or notes. Navigate between periods with arrows, log past entries manually, and edit or delete any record.

Export the current period as a **CSV** spreadsheet or a **Print / PDF** via the system print dialog — both available directly from the Timesheets toolbar.

</details>

<details>
<summary><strong>Analytics</strong></summary>

Charts powered by [Recharts](https://recharts.org) give you a visual overview of your workload over the last **7 or 30 days**:

- **Daily bar chart** — hours logged per day
- **Hours by job** — horizontal bar chart sorted by volume
- **Labor type donut** — proportion of time by category

</details>

<details>
<summary><strong>Invoice Generator</strong></summary>

Set **hourly rates** per labor type on each job (Jobs tab → edit a job → Hourly rates), then open the **Invoice** modal from the Timesheets toolbar. Pick a single **job** or a whole **client** and a period, and PunchIn builds a line-item invoice — hours, rate, and amount for every entry, each line priced at that job's own rate.

The invoice carries your **billing profile** (Settings → **Billing**): a **Billed from / Billed to** band with your name, business, email, phone, and address — plus an optional **business logo** — and the chosen client as "Billed to". Amounts format in your **default currency**, clock times follow your **12/24-hour** preference, and each entry can be **rounded in your favour** to a 15- or 30-minute increment. An optional, editable **invoice number** (prefix + auto-incrementing counter, or a custom alphanumeric code) prints on each invoice. Export as a formatted **CSV** or use **Print / PDF** to send it directly to a client.

</details>

<details>
<summary><strong>Cross-Device Sync</strong></summary>

Sync your data across devices using your existing cloud storage — no PunchIn account required. Choose one of three free providers:

- **GitHub Gist** (private) — ideal for developers; uses a private Gist in your account. Requires a GitHub OAuth App and a Cloudflare Worker secret to exchange the auth code server-side.
- **Google Drive** — stores a single hidden file in the app-specific `appDataFolder`; never appears in your Drive file list.
- **OneDrive** — stores a single file in your OneDrive App Folder.

Sync is a **pull-then-push snapshot**: PunchIn pulls the remote snapshot, merges any new entries from other devices using the same smart deduplication as JSON import, then pushes the unified state back. Google and OneDrive tokens expire after ~1 hour; PunchIn detects expiry and prompts you to reconnect.

Provider buttons only appear when the app is deployed with the corresponding `VITE_*` OAuth client ID. See `.env.example` for setup instructions.

</details>

<details>
<summary><strong>Account-Free Device Transfer</strong></summary>

Move your data between devices with **no account and no cloud provider**. In Settings → **Transfer**, tap **Create share link** to snapshot your database into a compressed link plus a scannable **QR code** — then open the link or scan the QR on the other device. **Import from a link** lets you paste a link or code directly. Imports show a confirmation with a summary ("Includes N jobs / M entries") before merging, and reuse the same smart deduplication as cloud sync so nothing is duplicated. Histories too large for a QR/URL fall back to a copyable link with a clear note. Everything happens client-side — no server is involved.

</details>

<details>
<summary><strong>Reminders</strong></summary>

Opt-in local notifications keep you on top of your tracking — no account or server required. In Settings → **Reminders**, enable the master toggle (which requests notification permission) and choose any combination of:

- **Long-running timer** — alerts when an active timer exceeds a configurable number of minutes
- **No timer running** — nudges you by a chosen time of day if nothing is tracking
- **Timer still running** — alerts at a chosen time if a timer is still going
- **Daily** / **Weekly timesheet** — reminders to log or review your time

Because there's no backend, reminders fire only while PunchIn is open or installed and running in the background — the Settings copy makes this clear and points iPhone/iPad users to add the app to their Home Screen first.

</details>

<details>
<summary><strong>Settings &amp; Data Portability</strong></summary>

- **Concurrent timers** — toggle on or off; when off, starting a new timer automatically stops any running one
- **Week start** — choose whether your week starts on Monday or Sunday
- **Time format** — show clock times as **12-hour**, **24-hour**, or **Auto** (matches your device's preference) across timers, timesheets, and invoices
- **Decimal hours** — display durations as decimal hours (`1.50 h`) instead of `1h 30m`
- **Rounding** — optionally round each billable entry in your favour to a **15- or 30-minute** increment (off by default)
- **Theme** — switch between **Auto / Light / Dark** (auto follows your OS preference)
- **Accent color** — choose from preset highlight swatches or pick any custom hex color; updates the entire app (and the browser-tab favicon) instantly
- **Haptic feedback** — toggle vibration on navigation and punch actions (shown only on phones, where a vibration motor exists)
- **Install** — add PunchIn to your home screen, with platform-aware guidance for Android, iOS Safari, and other iOS browsers
- **Billing** — your invoice identity (name, business, email, phone, address, payment terms, optional logo), the **default currency** used to format invoice and CSV amounts, and optional invoice numbering (prefix + counter)
- **Export JSON** — full backup of all data (jobs, labor types, entries)
- **Export CSV** — all completed entries as a spreadsheet ready for import into bookkeeping apps
- **Import JSON** — restore from a backup file (smart deduplication prevents duplicates)
- **Danger Zone** (collapsible) — **Clear entries** resets logged time while keeping jobs and labor types; **Factory Reset** wipes all data and restores the app to a clean slate (two confirmation steps required)
- **Check for updates** — applies any pending service-worker update and reloads; confirms you're on the latest version if none is found
- **Header logo** — tap the PunchIn logo to return to the Timer view from any screen
- **About → PunchIn** — opens the GitHub repository
- **About → Changelog** — browse version history and release notes

</details>

---

<details>
<summary><strong>How It Works</strong></summary>

### Data Model

All state lives in a local IndexedDB database named `PunchInDB`, managed by Dexie.

| Table | Purpose |
|---|---|
| `entries` | Time entries — `punchOut: null` means the timer is still running |
| `jobs` | Client projects; soft-archived via `isActive` |
| `laborTypes` | Billable categories with a color **and glyph** (an icon id); soft-archived via `isArchived` |
| `settings` | Key-value app preferences |
| `deletions` | Delete tombstones — a removed entry's `uuid` is recorded here so opt-in sync propagates the deletion across devices instead of it resurrecting from a peer's snapshot |
| `secrets` | At-rest-encrypted sync credentials — a non-extractable AES-GCM key plus the encrypted OAuth sync token (never stored in plaintext) |

Soft-deletion is used for `jobs` and `laborTypes`: those records are never hard-deleted so historical entries always retain valid references. Deleting an entry hard-deletes it and records a `deletions` tombstone so the removal propagates through opt-in sync.

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

</details>

<details>
<summary><strong>Tech Stack &amp; Project Structure</strong></summary>

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| Database | Dexie 4 (IndexedDB) |
| Charts | Recharts 3 |
| Date utilities | date-fns 4 |
| Typography | Self-hosted Noto Sans / Display / Mono (variable WOFF2, OFL-1.1) — no CDN |
| Icons | lucide-react |
| PWA | vite-plugin-pwa |
| Hosting | Cloudflare Workers |

> An abridged, illustrative map — sync internals (`sync/oauthState.js`, `sync/tokenStore.js`, `sync/pkce.js`) and `worker/iconRender.js` are omitted for brevity. The authoritative file-by-file tree lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
punchin/
├── package.json            # Version source of truth
├── wrangler.jsonc          # Cloudflare Workers deployment (routes OAuth + serves static assets)
├── .env.example            # VITE_* OAuth env var documentation
├── worker/
│   └── oauth.js            # Cloudflare Worker: GitHub OAuth code→token exchange
├── app/
│   └── index.html          # App shell, fonts, theme-color meta
├── config/
│   ├── vite.config.js      # Vite + Vitest + PWA config
│   ├── postcss.config.js   # PostCSS pipeline
│   └── tailwind.config.js  # Custom font families + CSS-variable-backed color tokens
├── docs/
│   └── CHANGELOG.md        # Version history
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Root: tab state, theme, OAuth callback handling
    ├── db.js               # Dexie schema, seed data, migrations
    ├── index.css           # CSS variables (dark/light), scrollbar utils
    ├── sync/
    │   ├── config.js           # OAuth client IDs from VITE_* build env
    │   ├── syncManager.js      # pull→merge→push snapshot sync, disconnect
    │   └── providers/
    │       ├── github.js       # GitHub Gist API (OAuth + CRUD)
    │       ├── google.js       # Google Drive appDataFolder API
    │       └── onedrive.js     # Microsoft Graph App Folder API
    ├── components/
    │   ├── Layout.jsx          # Fixed header + bottom nav
    │   ├── ErrorBoundary.jsx   # Error boundary wrapping each view
    │   ├── TimerCard.jsx       # Live timer card (1 s interval)
    │   ├── StartTimerModal.jsx # Punch-in form
    │   ├── EditEntryModal.jsx  # Edit active or completed entry
    │   ├── InvoiceModal.jsx    # Invoice generator with CSV/print export
    │   ├── ConfirmModal.jsx    # Accessible confirmation dialog
    │   ├── ColorPicker.jsx     # Preset swatches + custom hex input
    │   ├── BrandMark.jsx       # Stopwatch mark tile + accent-tinted wordmark
    │   ├── LaborGlyph.jsx      # Labor-type tag/chip (glyph + colour)
    │   ├── EntitySelect.jsx    # Bespoke colour/glyph single-select picker
    │   ├── GlyphPicker.jsx     # Labor-type glyph picker (quick row + search)
    │   ├── TimerRail.jsx       # Desktop Timer right rail (last session · quick punch · week)
    │   ├── ChangelogModal.jsx  # Changelog viewer (built from docs/CHANGELOG.md)
    │   ├── DataTransfer.jsx    # Account-free device-to-device transfer (link + QR)
    │   └── InstallPromptModal.jsx # First-run install bottom sheet (platform-aware)
    ├── views/
    │   ├── TimerView.jsx       # Active timers list
    │   ├── JobsView.jsx        # Jobs & Labor Types CRUD
    │   ├── TimesheetsView.jsx  # Daily/weekly logs + search
    │   ├── AnalyticsView.jsx   # Charts
    │   ├── SettingsView.jsx    # iOS-style drill-in root (master-detail on desktop)
    │   └── settings/           # Per-panel UI: General / Appearance / Reminders / Install / Billing / Data & Sync / About panels (+ shared components.jsx)
    ├── hooks/
    │   ├── useSettings.js          # Reactive settings hook
    │   ├── usePlatformContext.js   # Standalone + OS detection
    │   ├── useInstallPrompt.js     # PWA install state + prompt
    │   ├── useReminders.js         # Local reminder scheduler (no backend)
    │   └── useHapticFeedback.jsx  # Platform-routed haptic trigger
    └── utils/
        ├── time.js             # Date/time helpers
        ├── printDocument.js    # Shared invoice/timesheet print document (self-hosted Noto, fonts-ready gating)
        ├── favicon.js          # Accent-colored tab favicon
        ├── notifications.js    # Browser Notification API wrappers
        ├── reminders.js        # Pure reminder-rule evaluation
        ├── transfer.js         # Device-transfer codec (gzip + base64url, QR)
        ├── deviceId.js         # Stable per-device identifier
        └── pwa.js              # PWA install/update state bridge
```

</details>

---

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for setup instructions, workflow, and conventions.

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md) — by participating, you agree to uphold it.

All contributors must agree to the [Contributor License Agreement](.github/CLA.md) before their pull request can be merged.

---

## Security

Found a security vulnerability? Please report it privately — see [SECURITY.md](SECURITY.md) for how. Do **not** open a public issue for security reports.

---

## Credits

PunchIn's interface is set in Google's **Noto** type family — **Noto Sans** (UI text), **Noto Sans Display** (headings and the wordmark), and **Noto Sans Mono** (timers) — **self-hosted** as variable WOFF2 files (no CDN; the worker CSP is `font-src 'self'`). The Noto fonts are licensed under the [SIL Open Font License 1.1](docs/licenses/OFL-1.1.txt); see [docs/THIRD-PARTY-LICENSES.md](docs/THIRD-PARTY-LICENSES.md) for full attribution.

---

## License

PunchIn Time Tracker is source-available under the [Business Source License 1.1](LICENSE). Free for personal, non-commercial use by individual freelancers. Commercial use requires a separate license — [contact the licensor](mailto:licensing@trackmytime.today). The license converts to AGPL-3.0 on 2030-06-02.

Contributions are accepted under the [Contributor License Agreement](.github/CLA.md).
