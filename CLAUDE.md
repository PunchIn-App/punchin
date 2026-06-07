# PunchIn — AI Assistant Guide

## Project Overview

PunchIn is a mobile-first, offline-capable time tracking PWA for freelancers. Users punch in/out of jobs, categorize work by labor type, review timesheets, and analyze time trends. All data is stored locally in IndexedDB (no backend/auth).

**Stack:** React 19 + Vite + Tailwind CSS + Dexie (IndexedDB) + Recharts  
**Deploy:** Cloudflare Workers (static asset serving via `wrangler`)  
**Version:** 0.21.0

---

## Repository Structure

> **The full annotated file-by-file map lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).** Read it to learn what a specific module does, and before adding, moving, or renaming any file — then update the tree there (see Documentation Maintenance). Top-level layout:

```
punchin/
├── worker/     # Cloudflare Worker — GitHub OAuth code→token exchange + on-demand accent install-icon render (oauth.js, iconRender.js)
├── app/        # Vite root — index.html app shell + public/ (PWA / home-screen icons)
├── config/     # vite.config.js (+ Vitest), manifest.base.js, postcss.config.js, tailwind.config.js
├── scripts/    # build/asset tooling — screenshots.mjs, icons.mjs, social-preview.py
├── docs/       # CHANGELOG, THIRD-PARTY-LICENSES, ARCHITECTURE.md, TEST-COVERAGE.md, RELEASING.md, screenshots/, licenses/
└── src/        # app source
    ├── main.jsx, App.jsx    # entry point; root tab/theme/accent + OAuth-callback shell
    ├── sync/                # cloud sync: config, oauthState, tokenStore, pkce, syncManager + providers/ (github, google, onedrive)
    ├── components/          # modals, cards, pickers (TimerCard, EditEntryModal, ConfirmModal, ColorPicker, ChangelogModal, …)
    ├── views/               # Timer, Jobs, Timesheets, Analytics, Settings (+ settings/ drill-in panels)
    ├── hooks/               # useSettings, usePwaUpdate, usePlatformContext, useInstallPrompt, useFocusTrap, useReminders, …
    └── utils/               # time, backup, transfer, notifications, reminders, favicon, installIcon, deviceId, pwa, issueUrl
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

> The full per-file coverage table lives in [`docs/TEST-COVERAGE.md`](docs/TEST-COVERAGE.md). **Consult it before adding or changing tests, and add a row there when you add a new test file.** When adding new behaviour to any source file, add a test alongside it.

### Deploy

```bash
npm run deploy   # builds then deploys via `wrangler deploy` using the root wrangler.jsonc
```

No `.env` files are needed — the app has no backend secrets. Cloudflare account credentials for deployment are managed via `wrangler login`.

### Pull Requests

When opening a PR via the GitHub API or MCP tools (i.e. not through the GitHub web UI where the template auto-populates), **write the PR body to match `.github/PULL_REQUEST_TEMPLATE.md` exactly**:

- Fill in the **Summary** with 1–3 bullets describing what the PR does and why.
- Check the correct **Type of change** box.
- Work through every item in the **Checklist** — check it if done, or check it and append `— N/A` if it genuinely does not apply to this PR. Do not omit sections.
- Include the **CLA sign-off** line verbatim.

### Versioning & Releases

PunchIn uses **semantic versioning** (`MAJOR.MINOR.PATCH`); the canonical version is `package.json` → `"version"` (`vite.config.js` exposes it via `__APP_VERSION__`, so the in-app display needs no manual sync). Quick bump call: **MINOR** = a user-visible new feature or significant UX change · **PATCH** = bug fix, accessibility, performance, or internal refactor with no visible change · **no bump** = tests-only, CI/workflow-only, or documentation-only changes. The BUSL-1.1 **Change Date** `2030-06-02` is fixed and independent of the version.

> **Before bumping the version or cutting a release, follow [`docs/RELEASING.md`](docs/RELEASING.md)** — it holds the full increment decision guide, the release checklist (every file to update in the same commit, incl. `SECURITY.md`), the step-by-step GitHub release procedure, the project-board / milestone automation, and the CHANGELOG entry format.

---

## Documentation Maintenance

Every PR that changes code must update relevant documentation in the **same commit or PR**. The table below maps change types to required updates:

| What changed | Docs to update | `README.md` | `docs/CHANGELOG.md` | Screenshots |
|---|---|---|---|---|
| New component | Add to the file map in `docs/ARCHITECTURE.md`; describe it | — | ✓ if user-visible | ✓ if renders in any view |
| Component renamed or removed | Update `docs/ARCHITECTURE.md` (remove stale entries) | — | ✓ if user-visible | ✓ if renders in any view |
| New view or tab | Add to `docs/ARCHITECTURE.md` + describe it | Consider updating features section | ✓ | ✓ |
| New or changed hook | Update `docs/ARCHITECTURE.md` description | — | — | — |
| New or changed test file | Add/update its row in `docs/TEST-COVERAGE.md` | — | — | — |
| New or changed `time.js` helper | Update Time Utilities list (`CLAUDE.md`) | — | — | — |
| DB schema change (table, index, or field) | Update Database → Collections table (`CLAUDE.md`) | — | ✓ if user-visible | — |
| New setting key | Add row to Settings Keys table (`CLAUDE.md`) | — | ✓ | — |
| New exported helper from any source file | Update the relevant section (`CLAUDE.md` / `docs/ARCHITECTURE.md`) | — | — | — |
| Any visible UI change | — | — | — | ✓ regenerate |
| Version bump | Update `**Version:**` in header; full checklist in `docs/RELEASING.md` | Update version badge | Add new section | ✓ if UI changed |

> **Enforced by CI.** The **Docs Sync** check (`.github/workflows/docs-sync.yml` → `scripts/check-doc-sync.mjs`, run locally via `npm run check:docs`) fails a PR to `main` when: a new `src/`/`worker/` source file isn't in `docs/ARCHITECTURE.md`; a new test file isn't in `docs/TEST-COVERAGE.md`; a removed/renamed file leaves a stale doc entry; or a `package.json` version bump lacks the matching `docs/CHANGELOG.md` section (and `SECURITY.md`, on minor/major only). Add the **`skip-docs-check`** PR label to bypass it intentionally.

### Security Policy Maintenance

Keep `SECURITY.md` accurate whenever code changes affect what versions are supported or how vulnerabilities should be reported.

| Trigger | What to update in `SECURITY.md` |
|---------|----------------------------------|
| Version bump (any MINOR or PATCH) | Update the **Supported Versions** table: set the new `X.Y.x` row to **Yes**, mark all prior minor versions as **No** |
| Vulnerability reporting process changes (e.g. new contact channel, new response SLA) | Update the **Reporting a Vulnerability** section accordingly |
| Repository rename or move | Update the **Report a vulnerability** link URL |

> **Rule:** If you change `package.json` `"version"` you must update `SECURITY.md` in the same commit.

### What counts as a "visible UI change" for screenshots

**Regenerate** `docs/screenshots/` when any of these change:
- Layout, spacing, or sizing in any of the 7 captured views
- New or removed UI element (button, card, badge, section, label)
- Color, font, or icon change
- New or revised text content in a view (labels, placeholders, empty states, headings)
- Any change to: `TimerView`, `JobsView`, `TimesheetsView`, `AnalyticsView`, `SettingsView`

**Do not regenerate** for: logic-only changes, hook/utility changes, DB schema changes with no visible rendering effect, test additions, CI changes, or documentation-only updates.

### Keeping CLAUDE.md (and the extracted docs) accurate

`CLAUDE.md` and its extracted companions — `docs/ARCHITECTURE.md` (file map), `docs/TEST-COVERAGE.md` (test table), `docs/RELEASING.md` (release process) — document the *current state* of the codebase. They must stay accurate, not just accumulate additions. Apply these rules when making any code change:

- **Adding** a component, view, hook, or utility: add an entry to the file map in `docs/ARCHITECTURE.md` and the relevant detail section
- **Removing** something: delete its entry (in `docs/ARCHITECTURE.md` and anywhere it's named) — do not leave stale references
- **Renaming** something: update every mention, including the `docs/ARCHITECTURE.md` file map and any section that names it
- **Changing an exported function signature**: update the Time Utilities list or whichever section documents that API
- **Changing the DB schema**: update the Collections table and, if a new setting is added, the Settings Keys table
- **Changing a convention** (modal pattern, theming rules, accessibility requirements): update the relevant convention section — a stale convention is worse than no convention

---

## Database (Dexie / IndexedDB)

All schema and seed logic lives in `src/db.js`. The database is named `PunchInDB`.

### Collections

| Table | Indexes | Purpose |
|-------|---------|---------|
| `settings` | `key` | KV store for app preferences |
| `laborTypes` | `id, name, uuid` | Billable categories with `color` + `glyph` (an icon id — Lucide ids plus `punchin` for the brand mark; unindexed, render-time fallback to the PunchIn brand mark so existing rows need no migration — see `src/components/LaborGlyph.jsx`); soft-archived via `isArchived` |
| `jobs` | `id, name, laborTypeId, isActive, uuid` | Client work items (`laborTypeId` is a legacy index — per-job rates now live in `laborRates`); optional `clientName` field; optional `color` field (the job's own colour for its card left-rail — unindexed, no migration; falls back to its labor type's colour when unset) |
| `entries` | `id, jobId, laborTypeId, punchIn, punchOut, uuid` | Time records; optional `notes` (string) field |
| `deletions` | `uuid, deletedAt` | Delete **tombstones**: when an entry is removed it is hard-deleted from `entries` (so every view/analytics/export query is unaffected) and its `uuid` is recorded here with a `deletedAt` timestamp, so cloud merge propagates the deletion across devices instead of the entry resurrecting from a peer's snapshot. Use `deleteEntry(id)` (in `db.js`) to delete an entry — never `db.entries.delete` directly. |
| `secrets` | `name` | At-rest-encrypted sync credentials (issue #126): a non-extractable AES-GCM `CryptoKey` and the encrypted sync token. The OAuth token is **never** stored in plaintext IndexedDB. Access only through `src/sync/tokenStore.js` (`setSyncToken`/`getSyncToken`/`clearSyncToken`) — never read/write the token directly. |

All three data tables also carry a `uuid` (stable cross-device identifier) and an `updatedAt` (ms epoch) field, stamped automatically by Dexie `creating`/`updating` hooks in `db.js`. `uuid` survives sync/transfer so cloud merge can identify the *same* record across devices (independent of the local-only auto-increment `id`); `updatedAt` is the basis for last-write-wins conflict resolution. The `creating` hook only fills in missing values, so a record merged in from another device keeps its remote `uuid`/`updatedAt`.

### Record Lifecycle

- **Active timer:** `punchOut = null`
- **Completed entry:** `punchOut = <Date>`
- Analytics and timesheets only show completed entries (must have `punchOut`)

### Soft-Delete / Archive Pattern

Both `jobs` and `laborTypes` use soft-deletion — records are never hard-deleted so historical entries always retain their references.

| Table | Field | Meaning |
|-------|-------|---------|
| `jobs` | `isActive: false` | Archived — moved to collapsed "Archived" folder below active jobs; restorable; hidden from punch-in dropdowns |
| `jobs` | `laborRates: { [laborTypeId]: number }` | Per-labor-type hourly rates ($/hr) used by the invoice generator. Stored as a plain JSON object on the job record — no extra table or schema migration required. Missing keys mean "no rate set". |
| `laborTypes` | `isArchived: true` | Archived — moved to collapsed "Archived" folder below active types; restorable; hidden from all labor-type dropdowns |

Dropdowns in `StartTimerModal`, `EditEntryModal`, and `JobForm` filter out archived records. `EditEntryModal` still includes a record's own archived labor type so existing entries can be saved without data loss.

#### Archive UX (v0.3.0+, unchanged in v0.5.0)
- Active jobs show in the main list with **Edit** and **Archive** buttons only — there is no Delete button in the UI.
- Archived items appear under a collapsible **"Archived (N)"** row at the bottom of each tab. The folder is collapsed by default and has a live search input when expanded.
- Archived items show only a **Restore** button.

### Settings Keys

| Key | Type | Default |
|-----|------|---------|
| `allowConcurrentTimers` | boolean | `false` |
| `weekStartsMonday` | boolean | device-locale default — Sunday-start locales (e.g. en-US) seed `false`, Monday-start locales (e.g. en-GB) seed `true`; falls back to `false` where the locale's week info is unavailable (`localeWeekStartsMonday()` in `db.js`) |
| `theme` | `"auto"` \| `"dark"` \| `"light"` | `"auto"` |
| `accentColor` | hex string | `"#2D5BF5"` (PunchIn Blue; light theme renders the default as the darker `#2348DB`) |
| `hapticFeedback` | boolean | `true` — vibration on navigation/punch actions; toggle shown only on phones |
| `decimalHours` | boolean | `false` — show timesheet durations as decimal hours (`1.50 h`) instead of `1h 30m` (issue #208) |
| `roundingMinutes` | number (`0` \| `15` \| `30`) | `0` — round each billable entry in the user's favour (start floored, end ceiled) for timesheets & invoices; `0` = off (issue #208) |
| `timeFormat` | `"auto"` \| `"12h"` \| `"24h"` | `"auto"` (match the device's 12/24h preference) — clock-time rendering in timers, timesheets & invoices (`formatTime(date, fmt)`) |
| `defaultCurrency` | ISO 4217 string | `"USD"` — formats invoice/CSV amounts via `Intl.NumberFormat` (`utils/format.js`) |
| `billingName` | string | `""` — Billing profile: your name (the invoice "Billed from" identity) |
| `billingBusiness` | string | `""` — Billing profile: business name |
| `billingEmail` | string | `""` — Billing profile: email |
| `billingPhone` | string | `""` — Billing profile: phone |
| `billingAddress` | string | `""` — Billing profile: address (multi-line) |
| `billingPaymentTerms` | string | `""` — Billing profile: payment terms |
| `billingNotes` | string | `""` — Billing profile: notes / payment instructions |
| `billingLogo` | string | `""` — Billing profile: optional business logo as a downscaled PNG data URL (`utils/image.js`); rendered in the invoice "Billed from" band |
| `numberInvoices` | boolean | `false` — print an invoice number (advances `nextInvoiceNumber` each time an invoice print is generated) |
| `invoicePrefix` | string | `""` — prefix prepended to the invoice number (e.g. `PI-`) |
| `nextInvoiceNumber` | number | `1` — the next invoice number; printed when `numberInvoices` is on and **auto-incremented when an invoice print is generated** (a blocked popup doesn't burn a number) |
| `remindersEnabled` | boolean | `false` — master switch for local reminder notifications (issue #54); enabling it requests notification permission |
| `remindLongRunning` | boolean | `true` — alert when an active timer exceeds the threshold |
| `remindLongRunningMinutes` | number | `60` — long-running timer threshold (minutes) |
| `remindIdle` | boolean | `false` — alert if no timer is running by `remindIdleTime` |
| `remindIdleTime` | string (`"HH:MM"`) | `"09:00"` |
| `remindIdleDays` | number[] (0=Sun … 6=Sat) | `[0,1,2,3,4,5,6]` — weekdays the idle reminder may fire (clearing all days turns the reminder off) |
| `remindStillRunning` | boolean | `false` — alert if a timer is still running at `remindStillRunningTime` |
| `remindStillRunningTime` | string (`"HH:MM"`) | `"17:00"` |
| `remindStillRunningDays` | number[] (0=Sun … 6=Sat) | `[0,1,2,3,4,5,6]` — weekdays the still-running reminder may fire |
| `remindTimesheetDaily` | boolean | `false` — daily timesheet reminder |
| `remindTimesheetDailyTime` | string (`"HH:MM"`) | `"17:00"` |
| `remindTimesheetDailyDays` | number[] (0=Sun … 6=Sat) | `[0,1,2,3,4,5,6]` — weekdays the daily timesheet reminder may fire |
| `remindTimesheetWeekly` | boolean | `false` — weekly timesheet reminder |
| `remindTimesheetWeeklyDay` | number (0=Sun … 6=Sat) | `5` (Friday) |
| `remindTimesheetWeeklyTime` | string (`"HH:MM"`) | `"16:00"` |
| `syncProvider` | `"github"` \| `"google"` \| `"onedrive"` \| `null` | `null` |
| `syncToken` | string \| `null` | `null` |
| `syncTokenExpiry` | number (ms epoch) \| `null` | `null` — GitHub tokens do not expire; Google/OneDrive implicit tokens expire after ~1 hour |
| `syncFileId` | string \| `null` | `null` — GitHub Gist ID; unused for Google/OneDrive |
| `lastSyncedAt` | number (ms epoch) \| `null` | `null` |
| `syncError` | string \| `null` | `null` — set when the OAuth callback returns a `sync_error` fragment |
| `syncUsername` | string \| `null` | `null` — GitHub login name fetched after OAuth; shown in the connected status UI; null for Google/OneDrive |

### Fresh Install / Zero State

As of v0.3.0 the `populate` event in `db.js` seeds **only settings** — no default jobs or labor types are created. New users see empty lists and are prompted to add their own. The factory reset in Settings restores this same zero state.

Both the `populate` seed and `factoryReset` consume the single exported **`DEFAULT_SETTINGS`** object in `db.js` (via `defaultSettingsRows()`), so they can never drift (issue #131). A fresh install seeds **all** keys including the sync keys (as `null`), matching a factory reset exactly. `useSettings` merges the live rows over `DEFAULT_SETTINGS`, so consumers always read a complete, typed settings object and don't need per-call `|| default` / `!== false` fallbacks (issue #134).

### Schema Changes

When adding new tables or indexes, increment the version number in `db.js` and add an upgrade block. Dexie handles migrations automatically on version bump. (v3 added the `uuid` index + `updatedAt` field to `jobs`/`laborTypes`/`entries`, backfilling existing records in its `upgrade()` so older installs become merge-identifiable without data loss.)

---

## GitHub Gist Sync Architecture

The GitHub Gist sync uses a **multi-file per-device structure** (as of v0.15.1):

- `- PunchIn Sync` — static JSON marker file; sorts first alphabetically; identifies the gist as PunchIn's
- `punchin-data-{deviceId}.json` — one file per device; each device **only ever writes its own file**

This eliminates last-write-wins race conditions: two devices syncing simultaneously can never overwrite each other because they write to different files. The pull side reads all matching files and merges them via the existing dedup logic.

### Device ID

Generated once by `src/utils/deviceId.js` as 8 random hex chars and stored in `localStorage` under `pi.deviceId`. Intentionally persists across factory resets so reconnecting after a reset reuses the same filename rather than creating a stale orphan.

### Pull / push flow

| Step | Function |
|------|----------|
| Find gist on first connect | `findExistingPunchInGist(token)` — matches marker, legacy `punchin-data.json`, or any `punchin-data-*.json` |
| Pull all device data | `fetchAllDeviceData(token, gistId)` — fetches every matching file, returns array of snapshots |
| Merge each snapshot | `mergeSnapshot(snapshot)` loop in `syncManager.js` |
| Push own data | `pushDeviceData(token, gistId, deviceId, snapshot)` — writes marker + own device file |
| Create new gist | `createGist(token, deviceId, snapshot)` — includes marker + own device file from the start |
| Disconnect cleanup | `deleteDeviceFile(token, gistId, deviceId)` — nulls the device file (GitHub Gist PATCH API deletes files set to `null`) |

### Backward compatibility

Legacy single-file gists (`punchin-data.json`) are detected by `findExistingPunchInGist` and included in the `fetchAllDeviceData` pull. The legacy file is never written to; it becomes stale naturally as the device file takes over.

---

## Data Flow & State Management

**No Redux or global Context.** State flows as:

1. **Dexie → components** via `useLiveQuery` (from `dexie-react-hooks`) — reactive, auto-rerenders on DB writes
2. **Settings** via the `useSettings` hook, which wraps `useLiveQuery` and normalizes the KV table into a plain object
3. **Local React state** for UI (modals open/closed, selected tab, search input)

Parent views fetch data and pass it as props to child components. Components that need to write call Dexie methods directly.

### `useLiveQuery` loading convention

`useLiveQuery` returns `undefined` until its first query resolves. **Never render an empty / "zero" state derived from a result that may still be `undefined`** — guard on `=== undefined` first, or the empty state flashes before data arrives (issue #135). Pick whichever shape fits the view:

- **Early loading guard** — `if (!entries || !jobs) return <…Loading…/>` (AnalyticsView)
- **Render nothing** — `if (!entries) return null` for a sub-section (TimesheetsView's day/week sheets)
- **Inline guard** — branch the specific bit of UI on `value === undefined` (TimerView's "N timers running" subtitle)

The distinction that matters: `undefined` = still loading (render nothing/skeleton), `[]` / `0` = loaded and genuinely empty (render the empty state).

---

## Theming

Themes are controlled via CSS custom properties defined in `src/index.css`.

- **Dark mode:** variables set on `:root`
- **Light mode:** variables overridden under the `.light` class on `<html>`
- Theme is resolved in `App.jsx`: `"auto"` tracks `prefers-color-scheme` via a `matchMedia` listener; `"light"` / `"dark"` override explicitly
- Default theme is `"auto"` — new installs follow the OS without any user action
- Use `var(--text-primary)`, `var(--bg-secondary)`, etc. in custom CSS; use Tailwind for layout and spacing

### Color Conventions

- **Accent:** `appAccent` / `text-appAccent` tokens — active nav, buttons, highlights (user-configurable; defaults to PunchIn Blue `#2D5BF5` dark / `#2348DB` light). `App.jsx` writes both `--accent-rgb` (for the Tailwind token) and `--accent` (raw hex, backs `color-mix` tokens like `--shadow-accent`); the default accent shifts to the darker `#2348DB` in light mode, a custom accent is used as-is in both themes
- **Brand mark:** a **stopwatch** glyph (crown + stem + body + clock hands, Lucide visual language) on the accent tile. One geometry, three renderers kept in sync: `src/iconSvg.js` (SVG → build PNGs + worker), `src/utils/favicon.js` (canvas favicon/apple-touch), and `src/components/BrandMark.jsx` (`PunchMark` inline SVG for the header/sidebar). The glyph flips between white and dark ink (`#0F1117`) via `src/utils/inkOnAccent.js` `readableInk()` so it reads on any accent (incl. light pastels). The **wordmark** is `PunchIn` in `font-display` with the capital **I** tinted `text-appAccent` (`Wordmark`). All accent-driven — never hardcode the mark colour. The `scripts/social-preview.py` card mirrors the same stopwatch + tinted I (with a `readable_ink` port — keep it in sync).
- **Stop/end actions:** red (`red-500`, `red-600`) — punch-out buttons and other irreversible-but-non-destructive actions; also used for destructive confirmations
- **Labor type colors:** 10 suggested pastel presets defined in `JobsView.jsx` (`#FF8FA3 #FFB163 #E6C84B #5FD08A #4FC6E8 #6FA8FF #9B8CFF #C77DFF #FF8FD9 #9AA4B2` — the design-system pastel rainbow, mirrored as `--pastel-*` tokens in `index.css`) + custom picker via `ColorPicker.jsx`; stored as hex strings in the `laborTypes` table
- **Labor type glyphs:** each labor type also carries a **glyph** (a Lucide icon — or `punchin`, the PunchIn brand stopwatch, which is also the default when none is chosen; accessibility — read by shape + colour, not colour alone). Render labor types via the shared `LaborTag` (tinted pill + glyph + name) or `LaborGlyphChip` (solid colour chip + glyph) from `src/components/LaborGlyph.jsx` — **never** a bare colour dot/pill — so the glyph rides along on every surface (timer ticket, timesheets, analytics legend, invoice line items, management lists)

### Typography & Fonts

The UI uses Google's **Noto** type family, mapped to Tailwind tokens in `tailwind.config.js`:

| Tailwind class | Family | Use |
|---|---|---|
| `font-sans` | Noto Sans | Default body / UI text |
| `font-display` | Noto Sans Display (falls back to Noto Sans) | Headings, the brand wordmark |
| `font-mono` | Noto Sans Mono | Timers / numerals |

- The fonts are **self-hosted** (no CDN): five variable WOFF2 files (Noto Sans normal+italic, Noto Sans Display normal+italic, Noto Sans Mono normal) live in `app/public/fonts/`, served at `/fonts/`, with `@font-face` rules at the top of `src/index.css` (each spans the full 100–900 weight axis). The Google Fonts `<link>` is gone from `app/index.html` (which now `preload`s the body face); the worker CSP (`worker/oauth.js`) is correspondingly tightened to `font-src 'self'` / `style-src 'self' 'unsafe-inline'`. The fonts are precached by the service worker (they sit in `app/public`, outside the `icons/**` glob-ignore) so the brand renders offline. **Noto Sans JP is intentionally not shipped** — it only existed in the design system for a "bad font" illustration the app never renders.
- **Print / export documents use the brand font too.** The invoice (`InvoiceModal.jsx`) and timesheet (`TimesheetsView.jsx`) print/PDF paths build a standalone print popup, which does **not** inherit the app stylesheet — so they go through `src/utils/printDocument.js`: `PRINT_FONT_HEAD` declares the same self-hosted `@font-face` (the popup is same-origin, so `/fonts/*.woff2` resolve), and `openPrintWindow()` waits for `document.fonts.ready` before printing (falling back to a short delay) so exports render in Noto instead of a system-UI fallback. Set print `font-family` to `'Noto Sans'` / `'Noto Sans Display'` / `'Noto Sans Mono'` (never `-apple-system` or `SF Mono`).
- All three Noto families are licensed under the **SIL Open Font License 1.1**. The license text lives at `docs/licenses/OFL-1.1.txt`, and `docs/THIRD-PARTY-LICENSES.md` records the attribution and how the fonts are used. Now that the binaries are committed and redistributed, the OFL requires shipping that license alongside them — it does.
- The social-preview cards render the wordmark/tagline as **outlined vector paths** (not `<text>` + font, and not embedded font binaries) so they show Noto on GitHub without a webfont. Regenerate them with `scripts/social-preview.py` whenever the wordmark, tagline, or brand mark changes — never hand-edit the `<path>` data.

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
| `bg-appAccent` / `text-appAccent` | `--accent-rgb` | `#2D5BF5` (user-configurable) | `#2348DB` (default; user-configurable) |
| `text-appOnAccent` | `--on-accent` | `#FFFFFF` (legible ink ON the accent) | flips to `#0F1117` on a light/pastel accent |

Two additional CSS variables exist in `index.css` but have **no Tailwind token** — use them via `var()` in CSS files or Recharts style props only, not via Tailwind utilities:

| CSS variable | Dark | Light | Use |
|---|---|---|---|
| `--text-secondary` | `#E2E8F0` | `#374151` | secondary labels, axis text |
| `--text-darker` | `#4B5563` | `#9CA3AF` | tertiary/dimmed text |

The accent color is stored as a hex string in the `accentColor` setting. `App.jsx` converts it to space-separated RGB values and writes them to `--accent-rgb` on the root element (plus `--accent` as raw hex, and `--on-accent` = `readableInk(accent)` for legible on-accent text). The Tailwind token uses `rgb(var(--accent-rgb) / <alpha-value>)` so opacity modifiers like `bg-appAccent/30` work correctly. **Never use hardcoded `amber-*` Tailwind classes** — always use `appAccent` so the user's chosen color is respected. **For text/icons sitting ON an accent fill, use `text-appOnAccent`** (never a hardcoded `text-[#0F1117]` / `text-white`) so the foreground stays legible when the user picks a light/pastel accent.

In JSX, use Tailwind token classes rather than raw hex values or inline `var()` calls — except for `--text-secondary` and `--text-darker` which have no token. `color-scheme: dark/light` is set on `:root`/`.light` in `index.css` so browser-native controls (date/time pickers, caret, scrollbars) render in the correct scheme.

### Design-system tokens

`index.css` also defines the PunchIn design-system token layer (CSS custom properties; reference via `var()`):

- **Type scale / weights / tracking:** `--text-display|h1|h2|lg|base|sm|xs|2xs`, `--weight-regular…black`, `--track-tight|normal|over`
- **Radii:** `--radius-sm` 8 · `--radius` 11 · `--radius-md` 13 · `--radius-lg` 16 · `--radius-xl` 20 · `--radius-pill`
- **Spacing:** `--space-1…8` (4px base)
- **Elevation:** `--shadow-card|pop|modal` + `--shadow-accent` (`color-mix` against `--accent`)
- **Status colours (per theme):** `--green --violet --amber --red`
- **Pastel presets:** `--pastel-red…gray` — the suggested accent + labor-type colours (users may still pick any custom hex)

The radii/spacing/type/shadow/pastel scales are theme-independent; `--accent`, `--accent-rgb`, and the status colours are overridden under `.light`.

---

## Component Conventions

### Modals

On mobile, modals are bottom sheets whose style branches by platform. On desktop (`sm:` breakpoint and above) they are always centered dialogs:

| Context | Scrim | Corner radius | Extra behavior |
|---|---|---|---|
| iOS standalone | `bg-black/40 backdrop-blur-md` | `rounded-2xl` | Grabber pill, swipe-down-to-dismiss, Taptic Engine haptic |
| Android standalone | `bg-black/70 backdrop-blur-sm` | `rounded-t-[28px]` (MD3) | 48 dp drag handle, `popstate` back-button dismiss, `vibrate(40)` haptic |
| Web / browser tab | `bg-black/70 backdrop-blur-sm` | `rounded-2xl` | None |

Use `usePlatformContext()` to get `{ isStandalone, os }` and branch accordingly. Follow `StartTimerModal.jsx` as the reference pattern for **form / action** modals; apply the same treatment to any new one.

**Shared modal hooks (issue #151).** Don't re-implement the focus trap or sheet plumbing inline — every modal consumes:
- `useFocusTrap(dialogRef, onClose, opts?)` (`src/hooks/useFocusTrap.js`) — the full a11y contract in one place: initial focus (`[data-autofocus]` → first focusable, or `opts.initialFocus(el, focusables)` e.g. `(el) => el` for a scrollable reading dialog), a container-scoped Tab trap, focus **restoration** to the triggering element on close, and Escape→`onClose`.
- `useSwipeDismiss` / `useAndroidBackDismiss` / `useSheetStyles` (`src/hooks/useBottomSheet.jsx`) — the iOS swipe-down, Android back-button dismiss, and platform scrim/sheet/handle styles for bottom-sheet modals.

Title ids use `useId()` (never a hardcoded string) so two of the same modal can coexist.

**Centered reading-modal variant.** Long-form content dialogs — `ChangelogModal`, `LicenseModal` — are the exception: they are always centered (`max-w-lg`, `max-h-[80vh]` with internal scroll) rather than platform bottom-sheets. They still require the full a11y contract (`role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap via `useFocusTrap(ref, onClose, { initialFocus: (el) => el })`, Escape) **and** must close on the device Back gesture by pushing a `{ modal: true }` history entry on open and dismissing on `popstate` (unwinding the entry on close). Use these two as the reference when adding another content/reading modal.

### Navigation

Navigation is **tab-based state** in `App.jsx`, not URL routing. The active tab is a string (`"timer"`, `"jobs"`, `"timesheets"`, `"analytics"`, `"settings"`). Do not introduce a router without explicit agreement.

`App.jsx` integrates the **History API** so the device Back button/gesture moves between tabs instead of leaving the installed app: each tab change pushes a `history` entry tagged `{ piView }`, and a `popstate` listener restores the view. This is deliberately lightweight (no router). Modals push their own `{ modal: true }` history entry on top, so closing a modal with Back composes cleanly with tab history.

`SettingsView` adds a second, in-view layer of the same scheme: it is an **iOS-style drill-in** (a root list of `CategoryRow`s → `Panel` sub-pages) rather than URL routing. Opening a sub-page pushes a `{ settingsPanel }` entry; the in-page Back affordance and the device Back both `popstate` back to the root list. App.jsx's handler ignores states without `piView`, so this composes. Re-tapping the already-active **Settings** tab dispatches a `pi:reselect-tab` window event that `SettingsView` listens for to unwind to its root list (matching device Back).

### Time Utilities

Always use `src/utils/time.js` helpers rather than inline date math:

- `formatElapsed(ms)` → `"HH:MM:SS"` for live timers
- `formatDurationHM(ms)` → `"Xh Ym"` for summaries
- `formatDecimalHours(ms)` → `"1.50 h"` decimal-hours string for billing display (issue #208)
- `formatDuration(ms, decimal)` → decimal hours when `decimal` is set, else `"Xh Ym"` (issue #208)
- `roundEntry(entry, roundingMinutes)` → entry copy with punchIn floored / punchOut ceiled to the increment ("in the user's favour"); no-op when off, still running, or under a minute (a "0m" entry must not inflate to a full increment, e.g. 0.25 h) (issue #208)
- `getEntryDuration(entry)` → milliseconds (handles active entries)
- `formatTime(date)` → `"h:mm a"` time-only string (date-fns)
- `formatDate(date)` → `"EEE, MMM d"` date-only string (date-fns)
- `getDayRange(date?)` / `getWeekRange(date?, weekStartsMonday?)` → `{start, end}`
- `getWeekDays(date?, weekStartsMonday?)` → `Date[]` all days in the week
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

- PWA is configured in `vite.config.js` with `vite-plugin-pwa` using **prompt** strategy (`registerType: 'prompt'`) — the app controls when updates are applied; users are never interrupted by an auto-reload mid-session
- Service worker registration and update callbacks are wired in `main.jsx` via `virtual:pwa-register`; state is exposed app-wide through `src/utils/pwa.js` using window events (no React context needed)
- `beforeinstallprompt` is captured in `src/utils/pwa.js` and surfaced as an "Add to Home Screen" row in Settings when the browser offers it (Android/desktop Chrome; iOS does not fire this event)
- Manifest defines: name `"PunchIn"`, display `"standalone"`, `orientation: "any"` (follows device rotation), theme `#0F1117`, icons at 192×192 and 512×512
- Build output goes to `dist/` — Cloudflare Workers serves it as static assets via `wrangler.jsonc`; deploy with `npm run deploy`
- `wrangler.jsonc` stays at the project root — Cloudflare's Git integration auto-detects it there and cannot be redirected without a Dashboard build-command override
- The `compatibility_date` in `wrangler.jsonc` is pinned; update it intentionally, not automatically
- `worker/oauth.js` wraps every static-asset response with a **Content-Security-Policy** and hardening headers (`X-Content-Type-Options`, `Referrer-Policy: no-referrer`, HSTS, `X-Frame-Options`). `script-src` is `'self'` (the built `index.html` has no inline scripts). **If you add a `fetch()` to a new external origin** (e.g. a new sync provider's API), add that origin to the CSP `connect-src` list in `worker/oauth.js`, or the request will be blocked in production. Likewise add new style/font/image origins to the matching directive.

---

## Screenshots

Screenshots live in `docs/screenshots/{phone,tablet,desktop}-{dark,light}/` and are embedded in `README.md` using GitHub's `#gh-dark-mode-only` / `#gh-light-mode-only` URL fragments so GitHub shows the correct theme automatically. They are committed to the repo but must be **generated by the Playwright script** — never captured and saved by hand.

### Device specs used

| Device | Physical (default) | PPI | DPR | CSS viewport |
|--------|-------------------|-----|-----|--------------|
| Pixel 10 Pro XL | 1080×2404 (max: 1344×2992) | 486 | 2.625× | 412×916 |
| iPad Air 11" M2 | 2388×1668 (landscape) | 264 | 2× | 1194×834 |
| Desktop | — | — | 1× | 1920×1080 |

Phone shots use the Pixel's **default** 1080×2404 resolution. At 486 PPI physical the Android DPR is ~2.625 (1080 / 2.625 ≈ 412 CSS px).

### Regenerating

> **Important:** Use the **preview build**, not the dev server. The dev server's `root: './app'` configuration causes Chromium (Playwright) to 404 on the `../src/main.jsx` module script path; the preview build serves a self-contained bundle that loads correctly.

1. Build and start the preview server:

```bash
npm run build && npm run preview -- --port 5174
```

2. Run the script from the project root:

```bash
SCREENSHOT_URL=http://localhost:5174 node scripts/screenshots.mjs
```

Playwright must be available — it ships with the cloud environment at `/opt/node22/lib/node_modules/playwright/index.mjs`. For local runs where it isn't globally installed:

```bash
npm install --save-dev playwright && npx playwright install chromium
SCREENSHOT_URL=http://localhost:5174 node scripts/screenshots.mjs
```

The script (`scripts/screenshots.mjs`):
- Checks that the target server is reachable before starting
- Iterates over 3 devices × 2 themes = 6 browser contexts
- Sets a realistic per-device **userAgent** (Android for phone, iPadOS for tablet, default desktop Chromium for desktop) so the app's OS detection resolves correctly — without it, mobile-only surfaces (the Haptic feedback toggle, iOS install guidance) never render
- Seeds demo data directly into IndexedDB (including the `theme` setting), then reloads so the app picks it up
- Suppresses the first-run install nudge (`pi.installNudgeDismissed` in localStorage) so it doesn't pop a bottom sheet over the captured views once a mobile UA makes it eligible
- Injects 2 active timers (`punchOut: null`) so the Timer view is populated
- Captures 7 views per context (42 total): `timer`, `jobs`, `labor-types`, `timesheets-daily`, `timesheets-weekly`, `analytics`, `settings`
- Outputs to `docs/screenshots/{device}-{theme}/` — 6 directories, 7 PNGs each
- Is idempotent — clears existing data before seeding, so re-runs always produce consistent output
- Accepts `SCREENSHOT_URL` env var to target a different server (default: `http://localhost:5173`)

---

## Adding Features — Checklist

1. **New data type?** Add table/indexes in `db.js`, bump version, add seed data if needed
2. **New setting?** Add the key + default to the single `DEFAULT_SETTINGS` object in `db.js` (both `populate` and `factoryReset` consume it via `defaultSettingsRows()`, so there's one source of truth — no separate edit to `SettingsView.jsx` needed) and document it in the Settings Keys table above. Because `useSettings` merges over `DEFAULT_SETTINGS`, consumers can read `settings.yourKey` directly without a fallback. Destructive data actions belong in the collapsible **Danger Zone** section, not in the main Data section.
3. **New view?** Add to `App.jsx` tab switch and `Layout.jsx` nav bar (keep it to 5 nav items max for mobile)
4. **Editing time?** Always go through `utils/time.js` helpers; never use raw `Date` arithmetic inline
5. **Charts?** Follow `AnalyticsView.jsx` — use Recharts, reference CSS variables for colors (`var(--text-secondary)` etc.). Wrap each chart in `<figure role="img" aria-label="…">` with a `<table className="sr-only">` fallback.
6. **Theming?** New accent-colored elements must use `appAccent` / `text-appAccent` — never hardcode `amber-*` classes. New non-accent colors should use existing CSS variable conventions or Tailwind red/neutral palettes.
7. **New modal?** Apply the platform-native bottom-sheet pattern from `StartTimerModal.jsx` — use `usePlatformContext()` to branch scrim/sheet/handle styles and wire up `useSwipeDismiss` (iOS) and `useAndroidBackDismiss` (Android). Do not add a new modal that only uses the old `items-end sm:items-center` toggle. Every modal must also have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a focus trap, and an Escape key handler (see existing modals for the inline pattern).
8. **Haptic feedback?** Use `useHapticFeedback(os)` — never call `navigator.vibrate()` directly in a component, and never attempt iOS haptics via any method other than the WebKit switch polyfill. Gate it on both standalone mode and the `hapticFeedback` setting by passing `'web'` when off: `useHapticFeedback(isStandalone && settings.hapticFeedback !== false ? os : 'web')`. Call `trigger()` **synchronously inside the gesture handler** (not after an `await`) or iOS Taptic silently no-ops, and render the returned `hapticEl` somewhere in the component.
9. **Destructive confirmation?** Use `<ConfirmModal>` (`src/components/ConfirmModal.jsx`) rather than `window.confirm()`. Pass `title`, `message`, `confirmLabel`, `onConfirm`, and `onCancel`.
10. **New interactive element?** Icon-only buttons need an explicit `aria-label`. Toggle/radio-group buttons need `aria-pressed`. Form inputs need a `<label>` wired via `htmlFor`/`id` (use `useId()` to avoid collisions). Decorative icons inside labeled elements need `aria-hidden="true"`.
11. **Focus indicators?** Do not use `focus:outline-none` without also adding `focus:ring-*`. The global `:focus-visible` rule in `index.css` handles buttons; inputs need explicit `focus:ring-2 focus:ring-appAccent/50`.
12. **Documentation?** Apply the Documentation Maintenance rules — update `CLAUDE.md`, `README.md`, `docs/CHANGELOG.md`, and screenshots as required by the change type. See the Documentation Maintenance section for the full lookup table.

---

## What NOT to Do

- Do not introduce a backend or server-side authentication without explicit scope agreement. Cloud sync via OAuth + provider-hosted storage (GitHub Gist, Google Drive, OneDrive) is in scope as of v0.10.0 — but adding a new sync provider requires a separate Cloudflare Worker secret and explicit agreement on the OAuth flow. Account-free, client-only device-to-device transfer via a compressed `#import=` link + QR code is in scope as of v0.15.0 (no backend involved)
- Do not add a URL router — the tab-state approach is intentional for PWA standalone mode
- Do not import new heavy libraries without checking bundle size impact (current bundle is intentionally small)
- Do not store sensitive data in Dexie (it is plaintext in browser storage)
- Do not write inline date arithmetic or format strings — always use the helpers in `src/utils/time.js`
