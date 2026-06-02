# PunchIn — AI Assistant Guide

## Project Overview

PunchIn is a mobile-first, offline-capable time tracking PWA for freelancers. Users punch in/out of jobs, categorize work by labor type, review timesheets, and analyze time trends. All data is stored locally in IndexedDB (no backend/auth).

**Stack:** React 18 + Vite + Tailwind CSS + Dexie (IndexedDB) + Recharts  
**Deploy:** Cloudflare Workers (static asset serving via `wrangler`)  
**Version:** 0.6.6

---

## Repository Structure

```
punchin/
├── README.md               # Product intro, screenshots, getting started
├── index.html              # App shell (viewport, fonts, theme color)
├── vite.config.js          # Vite + PWA plugin config
├── wrangler.jsonc          # Cloudflare Workers deployment
├── tailwind.config.js      # Custom fonts (Syne, DM Sans, JetBrains Mono) + CSS-variable-backed color tokens
├── docs/
│   └── screenshots/
│       ├── phone/          # Pixel 10 Pro XL default (1080×2404 @486 PPI, 412×916 CSS px @2.625×) — 7 views
│       ├── tablet/         # iPad Air 11" M2 landscape (2388×1668 @2×, 1194×834 CSS px) — 7 views
│       └── desktop/        # 1920×1080 @1× — 7 views
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Root: tab state, theme application
│   ├── index.css           # CSS variables (dark/light), scrollbar utils
│   ├── db.js               # Dexie schema, seed data, migrations
│   ├── components/
│   │   ├── Layout.jsx          # Fixed header (logo taps → timer) + bottom nav shell
│   │   ├── ErrorBoundary.jsx   # Class component; wraps each view in App.jsx
│   │   ├── TimerCard.jsx       # Live running timer card (1s interval)
│   │   ├── StartTimerModal.jsx # Punch-in form modal; auto-punches-out running timers when concurrent timers is off
│   │   ├── EditEntryModal.jsx  # Edit active or completed entry (supports cross-day)
│   │   ├── InvoiceModal.jsx    # Invoice generator: job + date range → line-item table → CSV/print
│   │   └── ConfirmModal.jsx    # Accessible confirmation dialog (focus trap, Escape, Cancel default); replaces window.confirm
│   ├── views/
│   │   ├── TimerView.jsx       # Active timers list; shows last completed entry when idle
│   │   ├── JobsView.jsx        # Jobs & labor types CRUD; per-labor-type hourly rates on jobs
│   │   ├── TimesheetsView.jsx  # Daily/weekly time logs + search + CSV/print/invoice export
│   │   ├── AnalyticsView.jsx   # Charts: daily bars, job bars, labor pie
│   │   └── SettingsView.jsx    # Settings toggles + JSON/CSV backup + accent color picker
│   ├── hooks/
│   │   ├── useSettings.js          # Reactive Dexie KV settings hook
│   │   ├── usePlatformContext.js   # Standalone mode + OS detection (ios/android/web)
│   │   └── useHapticFeedback.jsx  # Platform-routed haptic trigger (vibrate / WebKit switch polyfill)
│   └── utils/
│       └── time.js             # Date/time helpers (format, range, sum)
```

---

## Development Workflow

### Local Dev

```bash
npm install
npm run dev        # Vite dev server (hot reload)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
```

### Test

```bash
npm run test:run   # Vitest (single run, no watch)
npm run test       # Vitest (watch mode)
npm run coverage   # Coverage report via @vitest/coverage-v8
```

**A build is considered passing when both `npm run build` and `npm run test:run` succeed.** CI enforces this via `.github/workflows/ci.yml` on every push and PR to `main`.

#### Current test coverage

| File | What's tested |
|------|---------------|
| `src/utils/time.test.js` | All helpers: `formatElapsed`, `formatDurationHM`, `getEntryDuration`, `formatDate`, `getDayRange`, `getWeekRange`, `isEntryInRange`, `sumDurations` |
| `src/components/StartTimerModal.test.jsx` | Render, form validation, concurrent-timer guard |
| `src/components/EditEntryModal.helpers.test.js` | `formatDateToYYYYMMDD`, `formatTimeToHHMM`, `combineDateAndTime` |
| `src/views/SettingsView.dedup.test.js` | `isEntryDuplicate` (backup import dedup logic) |

#### Known gaps (no tests yet)

- `src/db.js` — schema migrations, seed logic
- `src/hooks/useSettings.js`, `usePlatformContext.js`, `useHapticFeedback.jsx`
- `src/views/TimesheetsView.jsx`, `JobsView.jsx`, `AnalyticsView.jsx`, `TimerView.jsx`
- `src/components/InvoiceModal.jsx`, `EditEntryModal.jsx` (full component, not just helpers)

When adding new behaviour to any of the above, add a test file alongside it.

### Deploy

```bash
npm run build
npx wrangler deploy   # Deploys dist/ to Cloudflare Workers
```

No `.env` files are needed — the app has no backend secrets. Cloudflare account credentials for deployment are managed via `wrangler login`.

### Versioning

PunchIn follows **semantic versioning** (`MAJOR.MINOR.PATCH`).

- **Pre-1.0** (current): `0.MINOR.PATCH` — `MINOR` increments for new user-visible features or significant UX changes; `PATCH` for bug fixes, accessibility improvements, and internal refactors with no visible feature change.
- **Post-1.0**: standard semver — `MAJOR` for breaking data-model changes or major UX overhauls; `MINOR` for new features; `PATCH` for fixes.
- The canonical version source is `package.json` → `"version"`. `vite.config.js` reads it automatically via `__APP_VERSION__` — no manual sync needed for the in-app display.
- The BUSL-1.1 **Change Date** of `2030-06-02` is fixed and independent of version — it does not move when the version number changes.

### Release checklist

Every version bump must update all of the following in the same commit or PR:

| File | What to change |
|------|----------------|
| `package.json` | `"version"` field — **source of truth** |
| `README.md` | Version badge: `https://img.shields.io/badge/version-{X.Y.Z}-F59E0B...` |
| `CLAUDE.md` | `**Version:** {X.Y.Z}` in the Project Overview header |
| `CHANGELOG.md` | New `## [{X.Y.Z}] — {YYYY-MM-DD}` section at the top, following Keep a Changelog format |
| `docs/screenshots/` | Regenerate with the Playwright script if any visible UI changed (see Screenshots section below) |

The `wrangler.jsonc` `compatibility_date` is **not** part of the version bump — update it only when intentionally upgrading the Cloudflare Workers runtime.

---

## Database (Dexie / IndexedDB)

All schema and seed logic lives in `src/db.js`. The database is named `PunchInDB`.

### Collections

| Table | Indexes | Purpose |
|-------|---------|---------|
| `settings` | `key` | KV store for app preferences |
| `laborTypes` | `id, name` | Billable categories with color; soft-archived via `isArchived` |
| `jobs` | `id, name, laborTypeId, isActive` | Client work items |
| `entries` | `id, jobId, laborTypeId, punchIn` | Time records |

### Record Lifecycle

- **Active timer:** `punchOut = null`
- **Completed entry:** `punchOut = <Date>`
- Analytics and timesheets only show completed entries (must have `punchOut`)

### Soft-Delete / Archive Pattern

Both `jobs` and `laborTypes` use soft-deletion — records are never hard-deleted so historical entries always retain their references.

| Table | Field | Meaning |
|-------|-------|---------|
| `jobs` | `isActive: false` | Archived — moved to collapsed "Archived" folder below active jobs; restorable; hidden from punch-in dropdowns |
| `jobs` | `isDeleted: true` | Schema field exists but is **not exposed in the UI** — reserved for future use or data migration |
| `jobs` | `laborRates: { [laborTypeId]: number }` | Per-labor-type hourly rates ($/hr) used by the invoice generator. Stored as a plain JSON object on the job record — no extra table or schema migration required. Missing keys mean "no rate set". |
| `laborTypes` | `isArchived: true` | Archived — moved to collapsed "Archived" folder below active types; restorable; hidden from all labor-type dropdowns |

Dropdowns in `StartTimerModal`, `EditEntryModal`, and `JobForm` filter out archived/deleted records. `EditEntryModal` still includes a record's own archived labor type so existing entries can be saved without data loss.

#### Archive UX (v0.3.0+, unchanged in v0.5.0)
- Active jobs show in the main list with **Edit** and **Archive** buttons only — there is no Delete button in the UI.
- Archived items appear under a collapsible **"Archived (N)"** row at the bottom of each tab. The folder is collapsed by default and has a live search input when expanded.
- Archived items show only a **Restore** button.

### Settings Keys

| Key | Type | Default |
|-----|------|---------|
| `allowConcurrentTimers` | boolean | `false` |
| `weekStartsMonday` | boolean | `true` |
| `theme` | `"auto"` \| `"dark"` \| `"light"` | `"auto"` |
| `accentColor` | hex string | `"#F59E0B"` |

### Fresh Install / Zero State

As of v0.3.0 the `populate` event in `db.js` seeds **only settings** — no default jobs or labor types are created. New users see empty lists and are prompted to add their own. The factory reset in Settings restores this same zero state.

### Schema Changes

When adding new tables or indexes, increment the version number in `db.js` and add an upgrade block. Dexie handles migrations automatically on version bump.

---

## Data Flow & State Management

**No Redux or global Context.** State flows as:

1. **Dexie → components** via `useLiveQuery` (from `dexie-react-hooks`) — reactive, auto-rerenders on DB writes
2. **Settings** via the `useSettings` hook, which wraps `useLiveQuery` and normalizes the KV table into a plain object
3. **Local React state** for UI (modals open/closed, selected tab, search input)

Parent views fetch data and pass it as props to child components. Components that need to write call Dexie methods directly.

---

## Theming

Themes are controlled via CSS custom properties defined in `src/index.css`.

- **Dark mode:** variables set on `:root`
- **Light mode:** variables overridden under the `.light` class on `<html>`
- Theme is resolved in `App.jsx`: `"auto"` tracks `prefers-color-scheme` via a `matchMedia` listener; `"light"` / `"dark"` override explicitly
- Default theme is `"auto"` — new installs follow the OS without any user action
- Use `var(--text-primary)`, `var(--bg-secondary)`, etc. in custom CSS; use Tailwind for layout and spacing

### Color Conventions

- **Accent:** amber (`amber-400`, `amber-500`) — active nav, buttons, highlights
- **Destructive:** red (`red-500`, `red-600`) — punch out actions
- **Labor type colors:** 10 preset hex values defined in `JobsView.jsx`; stored as hex strings in the `laborTypes` table

### Tailwind Custom Color Tokens

`tailwind.config.js` maps semantic token names to CSS custom properties so both Tailwind utilities and CSS variables stay in sync:

| Tailwind class | CSS variable | Dark | Light |
|---|---|---|---|
| `bg-appBg` | `--bg-primary` | `#0F1117` | `#F3F4F6` |
| `bg-appCard` | `--bg-secondary` | `#161923` | `#FFFFFF` |
| `bg-appInput` | `--bg-tertiary` | `#1E2232` | `#E5E7EB` |
| `bg-appNav` | `--bg-nav` | `#0C0E14` | `#FFFFFF` |
| `border-appBorder` | `--border-color` | `#2A2F45` | `#E5E7EB` |
| `border-appBorderLight` | `--border-light` | `#1E2232` | `#E5E7EB` |
| `text-appText` | `--text-primary` | `#FFFFFF` | `#111827` |
| `text-appTextMuted` | `--text-muted` | `#6B7280` | `#6B7280` |
| `text-appTextDisabled` | `--text-disabled` | `#374151` | `#D1D5DB` |
| `bg-appAccent` / `text-appAccent` | `--accent-rgb` | amber `#F59E0B` (user-configurable) | same |

The accent color is stored as a hex string in the `accentColor` setting. `App.jsx` converts it to space-separated RGB values and writes them to `--accent-rgb` on the root element. The Tailwind token uses `rgb(var(--accent-rgb) / <alpha-value>)` so opacity modifiers like `bg-appAccent/30` work correctly. **Never use hardcoded `amber-*` Tailwind classes** — always use `appAccent` so the user's chosen color is respected.

Always use these token classes rather than raw hex values or inline `var()` calls in JSX. `color-scheme: dark/light` is set on `:root`/`.light` in `index.css` so browser-native controls (date/time pickers, caret, scrollbars) render in the correct scheme.

---

## Component Conventions

### Modals

Modals are full-screen overlays. On desktop (`sm:` breakpoint and above) they are always centered dialogs. On mobile, the sheet style branches by platform:

| Context | Scrim | Corner radius | Extra behavior |
|---|---|---|---|
| iOS standalone | `bg-black/40 backdrop-blur-md` | `rounded-2xl` | Grabber pill, swipe-down-to-dismiss, Taptic Engine haptic |
| Android standalone | `bg-black/70 backdrop-blur-sm` | `rounded-t-[28px]` (MD3) | 48 dp drag handle, `popstate` back-button dismiss, `vibrate(40)` haptic |
| Web / browser tab | `bg-black/70 backdrop-blur-sm` | `rounded-2xl` | None |

Use `usePlatformContext()` to get `{ isStandalone, os }` and branch accordingly. Follow `StartTimerModal.jsx` as the reference pattern; apply the same treatment to any new modal.

### Navigation

Navigation is **tab-based state** in `App.jsx`, not URL routing. The active tab is a string (`"timer"`, `"jobs"`, `"timesheets"`, `"analytics"`, `"settings"`). Do not introduce a router without explicit agreement.

### Time Utilities

Always use `src/utils/time.js` helpers rather than inline date math:

- `formatElapsed(ms)` → `"HH:MM:SS"` for live timers
- `formatDurationHM(ms)` → `"Xh Ym"` for summaries
- `getEntryDuration(entry)` → milliseconds (handles active entries)
- `getDayRange(date)` / `getWeekRange(date, weekStartsMonday)` → `{start, end}`
- `isEntryInRange(entry, start, end)` → boolean
- `sumDurations(entries)` → total ms

---

## Known Issues & Pitfalls

- **No cross-day filtering:** `isEntryInRange` checks `punchIn` only. An entry that starts before midnight and ends after midnight will appear on the start day but not the end day in timesheets. Acceptable for now but worth revisiting if users report missing time.

- **iOS haptic polyfill requires user gesture context:** The WebKit `<input switch>` approach fires the Taptic Engine reliably when invoked in direct response to a touch event (swipe release). It will silently no-op if called outside a user-gesture context (e.g., from a `setTimeout`). Keep haptic calls synchronous within gesture handlers.

- **`useHapticFeedback` must be `.jsx`:** The hook returns a JSX fragment for the hidden iOS switch element. Vite/Rollup only runs the JSX transform on `.jsx`/`.tsx` files. Do not rename it to `.js`.

- **`viewport-fit=cover` is required for safe-area insets:** Without it `env(safe-area-inset-*)` always resolves to `0` regardless of device notch geometry. It is set in `index.html` — do not remove it.

---

## PWA & Deployment Notes

- PWA is configured in `vite.config.js` with `vite-plugin-pwa` using **auto-update** strategy (new service worker activates immediately on next load)
- Manifest defines: name `"PunchIn"`, display `"standalone"`, theme `#0F1117`, icons at 192×192 and 512×512
- Build output goes to `dist/` — Cloudflare Workers serves it as static assets via `wrangler.jsonc`
- The `compatibility_date` in `wrangler.jsonc` is pinned; update it intentionally, not automatically

---

## Screenshots

Screenshots live in `docs/screenshots/{phone,tablet,desktop}/` and are embedded in `README.md`. They are generated with Playwright against the Vite dev server — **not** committed manually.

### Device specs used

| Device | Physical (default) | PPI | DPR | CSS viewport |
|--------|-------------------|-----|-----|--------------|
| Pixel 10 Pro XL | 1080×2404 (max: 1344×2992) | 486 | 2.625× | 412×916 |
| iPad Air 11" M2 | 2388×1668 (landscape) | 264 | 2× | 1194×834 |
| Desktop | — | — | 1× | 1920×1080 |

Phone shots use the Pixel's **default** 1080×2404 resolution. At 486 PPI physical the Android DPR is ~2.625 (1080 / 2.625 ≈ 412 CSS px).

### Regenerating

1. Start the dev server: `npm run dev`
2. Run the Playwright script (Node ESM, no extra deps beyond `playwright` which is available globally at `/opt/node22/bin/playwright`):

```bash
node /tmp/screenshots-full.mjs   # script seeds demo data via raw IndexedDB API
# Note: the script hardcodes ROOT='/home/user/punchin' — update if the project path changes
```

The script:
- Opens three browser contexts (phone 412×916 @2.625×, tablet 1194×834 @2× landscape, desktop 1920×1080 @1×)
- Injects demo data directly into IndexedDB after Dexie's `populate` seed runs (so labor type IDs are known)
- Injects 2 active timers (`punchOut: null`) so the Timer view is populated
- Captures 7 views per context: `timer`, `jobs`, `labor-types`, `timesheets-daily`, `timesheets-weekly`, `analytics`, `settings`
- When selecting the Timesheets tab via Playwright use `.filter({ hasText: 'Timesheets' })` — the nav label matches the view name exactly as of v0.3.0

---

## Adding Features — Checklist

1. **New data type?** Add table/indexes in `db.js`, bump version, add seed data if needed
2. **New setting?** Add key to `db.js` initializer, document it in the settings table above, and add it to the `factoryReset` function in `SettingsView.jsx` so it resets correctly. Destructive data actions belong in the collapsible **Danger Zone** section, not in the main Data section.
3. **New view?** Add to `App.jsx` tab switch and `Layout.jsx` nav bar (keep it to 5 nav items max for mobile)
4. **Editing time?** Always go through `utils/time.js` helpers; never use raw `Date` arithmetic inline
5. **Charts?** Follow `AnalyticsView.jsx` — use Recharts, reference CSS variables for colors (`var(--text-secondary)` etc.). Wrap each chart in `<figure role="img" aria-label="…">` with a `<table className="sr-only">` fallback.
6. **Theming?** New accent-colored elements must use `appAccent` / `text-appAccent` — never hardcode `amber-*` classes. New non-accent colors should use existing CSS variable conventions or Tailwind red/neutral palettes.
7. **New modal?** Apply the platform-native bottom-sheet pattern from `StartTimerModal.jsx` — use `usePlatformContext()` to branch scrim/sheet/handle styles and wire up `useSwipeDismiss` (iOS) and `useAndroidBackDismiss` (Android). Do not add a new modal that only uses the old `items-end sm:items-center` toggle. Every modal must also have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a focus trap, and an Escape key handler (see existing modals for the inline pattern).
8. **Haptic feedback?** Use `useHapticFeedback(os)` — never call `navigator.vibrate()` directly in a component, and never attempt iOS haptics via any method other than the WebKit switch polyfill.
9. **Destructive confirmation?** Use `<ConfirmModal>` (`src/components/ConfirmModal.jsx`) rather than `window.confirm()`. Pass `title`, `message`, `confirmLabel`, `onConfirm`, and `onCancel`.
10. **New interactive element?** Icon-only buttons need an explicit `aria-label`. Toggle/radio-group buttons need `aria-pressed`. Form inputs need a `<label>` wired via `htmlFor`/`id` (use `useId()` to avoid collisions). Decorative icons inside labeled elements need `aria-hidden="true"`.
11. **Focus indicators?** Do not use `focus:outline-none` without also adding `focus:ring-*`. The global `:focus-visible` rule in `index.css` handles buttons; inputs need explicit `focus:ring-2 focus:ring-appAccent/50`.

---

## What NOT to Do

- Do not introduce a backend, authentication, or cloud sync without explicit scope agreement
- Do not add a URL router — the tab-state approach is intentional for PWA standalone mode
- Do not import new heavy libraries without checking bundle size impact (current bundle is intentionally small)
- Do not store sensitive data in Dexie (it is plaintext in browser storage)
- Do not hardcode date formats — always use `date-fns` via `src/utils/time.js`
