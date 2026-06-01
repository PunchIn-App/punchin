# PunchIn — AI Assistant Guide

## Project Overview

PunchIn is a mobile-first, offline-capable time tracking PWA for freelancers. Users punch in/out of jobs, categorize work by labor type, review timesheets, and analyze time trends. All data is stored locally in IndexedDB (no backend/auth).

**Stack:** React 18 + Vite + Tailwind CSS + Dexie (IndexedDB) + Recharts  
**Deploy:** Cloudflare Workers (static asset serving via `wrangler`)  
**Version:** 0.2.0

---

## Repository Structure

```
punchin/
├── index.html              # App shell (viewport, fonts, theme color)
├── vite.config.js          # Vite + PWA plugin config
├── wrangler.jsonc          # Cloudflare Workers deployment
├── tailwind.config.js      # Custom fonts (Syne, DM Sans, JetBrains Mono)
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Root: tab state, theme application
│   ├── index.css           # CSS variables (dark/light), scrollbar utils
│   ├── db.js               # Dexie schema, seed data, migrations
│   ├── components/
│   │   ├── Layout.jsx          # Fixed header + bottom nav shell
│   │   ├── ErrorBoundary.jsx   # Class component; wraps each view in App.jsx
│   │   ├── TimerCard.jsx       # Live running timer card (1s interval)
│   │   ├── StartTimerModal.jsx # Punch-in form modal
│   │   └── EditEntryModal.jsx  # Edit active or completed entry (supports cross-day)
│   ├── views/
│   │   ├── TimerView.jsx       # Active timers list
│   │   ├── JobsView.jsx        # Jobs & labor types CRUD
│   │   ├── TimesheetsView.jsx  # Daily/weekly time logs + search
│   │   ├── AnalyticsView.jsx   # Charts: daily bars, job bars, labor pie
│   │   └── SettingsView.jsx    # Settings toggles + JSON backup/restore
│   ├── hooks/
│   │   └── useSettings.js      # Reactive Dexie KV settings hook
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

### Deploy

```bash
npm run build
npx wrangler deploy   # Deploys dist/ to Cloudflare Workers
```

No `.env` files are needed — the app has no backend secrets. Cloudflare account credentials for deployment are managed via `wrangler login`.

---

## Database (Dexie / IndexedDB)

All schema and seed logic lives in `src/db.js`. The database is named `PunchInDB`.

### Collections

| Table | Indexes | Purpose |
|-------|---------|---------|
| `settings` | `key` | KV store for app preferences |
| `laborTypes` | `id, name` | Billable categories with color |
| `jobs` | `id, name, laborTypeId, isActive` | Client work items |
| `entries` | `id, jobId, laborTypeId, punchIn` | Time records |

### Entry Lifecycle

- **Active timer:** `punchOut = null`
- **Completed entry:** `punchOut = <Date>`
- Analytics and timesheets only show completed entries (must have `punchOut`)

### Settings Keys

| Key | Type | Default |
|-----|------|---------|
| `allowConcurrentTimers` | boolean | `false` |
| `weekStartsMonday` | boolean | `true` |
| `theme` | `"auto"` \| `"dark"` \| `"light"` | `"auto"` |

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
- **Destructive:** red (`red-500`, `red-600`) — punch out, delete actions
- **Labor type colors:** 10 preset hex values defined in `JobsView.jsx`; stored as hex strings in the `laborTypes` table

---

## Component Conventions

### Modals

Modals are full-screen overlays that behave as bottom sheets on mobile and centered dialogs on `sm:` breakpoint and above. Follow `StartTimerModal.jsx` and `EditEntryModal.jsx` as reference patterns.

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

---

## PWA & Deployment Notes

- PWA is configured in `vite.config.js` with `vite-plugin-pwa` using **auto-update** strategy (new service worker activates immediately on next load)
- Manifest defines: name `"PunchIn"`, display `"standalone"`, theme `#0F1117`, icons at 192×192 and 512×512
- Build output goes to `dist/` — Cloudflare Workers serves it as static assets via `wrangler.jsonc`
- The `compatibility_date` in `wrangler.jsonc` is pinned; update it intentionally, not automatically

---

## Adding Features — Checklist

1. **New data type?** Add table/indexes in `db.js`, bump version, add seed data if needed
2. **New setting?** Add key to `db.js` initializer and document it in the settings table above
3. **New view?** Add to `App.jsx` tab switch and `Layout.jsx` nav bar (keep it to 5 nav items max for mobile)
4. **Editing time?** Always go through `utils/time.js` helpers; never use raw `Date` arithmetic inline
5. **Charts?** Follow `AnalyticsView.jsx` — use Recharts, reference CSS variables for colors (`var(--text-secondary)` etc.)
6. **Theming?** New colors should use existing CSS variable conventions or Tailwind amber/red/neutral palette

---

## What NOT to Do

- Do not introduce a backend, authentication, or cloud sync without explicit scope agreement
- Do not add a URL router — the tab-state approach is intentional for PWA standalone mode
- Do not import new heavy libraries without checking bundle size impact (current bundle is intentionally small)
- Do not store sensitive data in Dexie (it is plaintext in browser storage)
- Do not hardcode date formats — always use `date-fns` via `src/utils/time.js`
