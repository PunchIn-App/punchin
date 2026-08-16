# PunchIn — AI Assistant Guide

## Project Overview

PunchIn is a mobile-first, offline-capable time tracking PWA for freelancers. Users punch in/out of jobs, categorize work by labor type, review timesheets, and analyze time trends. The app is local-first by default: all data is stored locally in IndexedDB and the base app has no backend or auth. Optional, opt-in cloud sync adds a Cloudflare Worker (GitHub OAuth code→token exchange) that needs one provider secret (`GITHUB_CLIENT_SECRET`); sync builds also read `VITE_*` client IDs from `.env.local`.

**Stack:** React 19 + Vite + Tailwind CSS + Dexie (IndexedDB) + Recharts  
**Deploy:** Cloudflare Workers (static asset serving via `wrangler`)  
**Version:** 0.35.1

---

## Repository Structure

> **The full annotated file-by-file map lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).** Read it to learn what a specific module does, and before adding, moving, or renaming any file — then update the tree there (see Documentation Maintenance). Top-level layout:

```
punchin/
├── worker/     # Cloudflare Worker — GitHub OAuth code→token exchange + per-device provider token-revoke on disconnect (/oauth/revoke) + on-demand accent install-icon render (oauth.js, iconRender.js)
├── app/        # Vite root — index.html app shell + public/ (PWA / home-screen icons)
├── config/     # vite.config.js (+ Vitest), manifest.base.js, postcss.config.js, tailwind.config.js
├── scripts/    # build/asset tooling — screenshots.mjs, icons.mjs, social-preview.py
├── docs/       # CHANGELOG, THIRD-PARTY-LICENSES, ARCHITECTURE.md, TEST-COVERAGE.md, RELEASING.md, SETTINGS.md, SCREENSHOTS.md, THEMING.md, screenshots/, licenses/
└── src/        # app source
    ├── main.jsx, App.jsx    # entry point; root tab/theme/accent + OAuth-callback shell
    ├── sync/                # cloud sync: config, oauthState, tokenStore (access + refresh tokens), syncManager + providers/ (github, google, onedrive)
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

The **base app** needs no `.env` files and has no backend secrets — it's local-first by default. **Optional, opt-in cloud sync** is the exception: the Cloudflare Worker (`worker/oauth.js`) needs a `GITHUB_CLIENT_SECRET` Cloudflare secret for the GitHub OAuth code→token exchange (see `wrangler.jsonc`'s keep-vars comment), and sync builds read the `VITE_*` client IDs from `.env.local` (copy `.env.example`). Cloudflare account credentials for deployment are managed via `wrangler login`.

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
| New setting key | Add row to the Settings Keys table in `docs/SETTINGS.md` | — | ✓ | — |
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

`CLAUDE.md` and its extracted companions — `docs/ARCHITECTURE.md` (file map), `docs/TEST-COVERAGE.md` (test table), `docs/RELEASING.md` (release process), `docs/SETTINGS.md` (settings-key table), `docs/SCREENSHOTS.md` (screenshot specs + regeneration), `docs/THEMING.md` (Tailwind/CSS token tables + design-system layer) — document the *current state* of the codebase. They must stay accurate, not just accumulate additions. Apply these rules when making any code change:

- **Adding** a component, view, hook, or utility: add an entry to the file map in `docs/ARCHITECTURE.md` and the relevant detail section
- **Removing** something: delete its entry (in `docs/ARCHITECTURE.md` and anywhere it's named) — do not leave stale references
- **Renaming** something: update every mention, including the `docs/ARCHITECTURE.md` file map and any section that names it
- **Changing an exported function signature**: update the Time Utilities list or whichever section documents that API
- **Changing the DB schema**: update the Collections table and, if a new setting is added, the Settings Keys table in `docs/SETTINGS.md`
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
| `entries` | `id, jobId, laborTypeId, punchIn, punchOut, uuid` | Time records; optional `notes` (string) field; optional `frozenRefs` field (a `{job?,laborType?}` display snapshot — name, colour, glyph — written when a referenced job or labor type is permanently deleted, so the entry can still render its provenance after the live record is gone) |
| `deletions` | `uuid, deletedAt` | Delete **tombstones**: when a record is hard-deleted a tombstone is written here with a `deletedAt` timestamp so cloud merge propagates the deletion across devices instead of the record resurrecting from a peer's snapshot. Covers three record types: **entries** (hard-deleted from `entries` immediately — views/analytics/exports are unaffected); **jobs** (hard-deleted from `jobs` after freezing refs onto all affected entries); **labor types** (hard-deleted from `laborTypes` after freezing refs). Use `deleteEntry(id)` / `deleteJob(id)` / `deleteLaborType(id)` (all in `db.js`) — never call `db.*.delete()` directly. |
| `secrets` | `name` | At-rest-encrypted sync credentials (issues #126, #243): a non-extractable AES-GCM `CryptoKey`, the encrypted access token, and the encrypted OAuth **refresh** token (Google/OneDrive). Neither token is **ever** stored in plaintext IndexedDB. Access only through `src/sync/tokenStore.js` (`setSyncToken`/`getSyncToken`/`clearSyncToken` and `setRefreshToken`/`getRefreshToken`) — never read/write the tokens directly. |

All three data tables also carry a `uuid` (stable cross-device identifier) and an `updatedAt` (ms epoch) field, stamped automatically by Dexie `creating`/`updating` hooks in `db.js`. `uuid` survives sync/transfer so cloud merge can identify the *same* record across devices (independent of the local-only auto-increment `id`); `updatedAt` is the basis for last-write-wins conflict resolution. The `creating` hook only fills in missing values, so a record merged in from another device keeps its remote `uuid`/`updatedAt`.

### Record Lifecycle

- **Active timer:** `punchOut = null`
- **Completed entry:** `punchOut = <Date>`
- **Live on-screen totals include the running timer.** TimerView tiles, Timesheets totals, and Analytics totals/charts count an active entry's accrued time, valued to a ticking `now` via `useNowTicker` (issue #265). **Exports stay completed-only** — CSV/Print/`InvoiceModal` filter to completed entries (`!!e.punchOut`), so they never bill a moving value; the UI shows a notice when a running timer in scope makes the export total less than the screen. (This intentionally relaxes the old #137 "totals match exports" invariant for the *running timer* only.) For **completed** entries the Timesheets totals now reconcile exactly with the exports: both bill through `billedDurationMap` (back-to-back tasks rounded as one continuous session, attributed by `punchIn` — see Timesheets billing below), so the numbers can't drift.

### Soft-Delete / Archive Pattern

`jobs` and `laborTypes` use a two-stage lifecycle: **archive** (soft, reversible) then optionally **permanent delete** (hard, irreversible — archived items only).

| Table | Field | Meaning |
|-------|-------|---------|
| `jobs` | `isActive: false` | Archived — moved to collapsed "Archived" folder below active jobs; restorable; hidden from punch-in dropdowns |
| `jobs` | `laborRates: { [laborTypeId]: number }` | Per-labor-type hourly rates ($/hr) used by the invoice generator. Stored as a plain JSON object on the job record — no extra table or schema migration required. Missing keys mean "no rate set". |
| `laborTypes` | `isArchived: true` | Archived — moved to collapsed "Archived" folder below active types; restorable; hidden from all labor-type dropdowns |

Dropdowns in `StartTimerModal`, `EditEntryModal`, and `JobForm` filter out archived records. `EditEntryModal` still includes a record's own archived labor type so existing entries can be saved without data loss.

#### Archive UX (v0.3.0+)
- Active jobs show in the main list with **Edit** and **Archive** buttons only — there is no Delete button for active items.
- Archived items appear under a collapsible **"Archived (N)"** row at the bottom of each tab. The folder is collapsed by default and has a live search input when expanded.
- Archived items show a **Restore** button and a **Delete** button (permanent delete, since v0.32.0).

#### Permanent Delete (v0.32.0+)
Archived jobs and labor types can be permanently deleted. The delete flow:

1. **Guard (labor types only):** `jobsUsingLaborType(id)` checks for any active (non-archived) job still referencing the labor type. If any exist, the delete is blocked until those jobs are archived or relinked.
2. **Freeze refs onto entries:** every time entry referencing the record gets an `entry.frozenRefs` snapshot — `{job?: {name, color}}` or `{laborType?: {name, color, glyph}}` — written in the same transaction as the hard delete.
3. **Hard delete:** the record is removed from `jobs` / `laborTypes`.
4. **Tombstone:** a `deletions` row is written so the deletion propagates via cloud sync and the record won't resurrect from a peer's snapshot.

Use `deleteJob(id)` / `deleteLaborType(id)` (in `db.js`) — never call `db.jobs.delete()` / `db.laborTypes.delete()` directly, as that skips the freeze-and-tombstone logic. Both are the hard-delete siblings of `deleteEntry(id)`.

**The freeze step is also required when sync applies a *remote* tombstone.** `db.js` exports `freezeRefsForJob(id)` / `freezeRefsForLaborType(id)` — the freeze half of the delete, without the transaction (the caller supplies one covering `[jobs, laborTypes, entries, deletions]`) and, for labor types, without the `LABOR_TYPE_IN_USE` block (a remote tombstone is authoritative). `syncManager.js`'s `mergeSnapshot` calls them before its deletes. Skipping the freeze there strands referencing entries with a dangling id and no `frozenRefs`, which is the exact shape the entry remap drops — losing those entries on every peer and on backup restore.

**Clearing all entries:** use `clearAllEntries()` (in `db.js`), never a bare `db.entries.clear()`. It tombstones every entry in the same transaction as the clear, so the deletion propagates instead of the entries resurrecting from a peer's snapshot on the next sync (this bites single-device users too, since the provider re-reads the device's own file).

**Frozen-ref rendering:** `src/utils/entryRefs.js` exports `entryJob(entry, liveJob)` and `entryLabor(entry, liveLabor)`. Each returns `{job/laborType, frozen: bool}`. When `frozen` is true, the caller renders the ref's frozen `name`/`color`/`glyph` as inert plaintext — the job name is italicised as the "unlinked" cue (the labor tag keeps its colour+glyph) — instead of a live, interactive record. In EditEntry the deleted ref shows as a `"<name> (deleted)"` option you can leave as-is or re-link. Timesheets, Timer, Invoice, Analytics, and EditEntry all resolve refs through these helpers so deleted items display consistently.

### Settings Keys

> **The full settings-key reference table lives in [`docs/SETTINGS.md`](docs/SETTINGS.md).** Add a row there when you add a new setting key. Keys + defaults are defined once in the `DEFAULT_SETTINGS` object in `src/db.js`; because `useSettings` merges live rows over it, consumers read `settings.yourKey` directly without a fallback.

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

### Typography, tokens & full colour tables

> **The exhaustive reference lives in [`docs/THEMING.md`](docs/THEMING.md)** — the self-hosted **Noto** font setup, the full Tailwind-token → CSS-variable → dark/light value tables, and the design-system token layer (type scale, radii, spacing, elevation, status & pastel colours). The must-not-violate rules stay here:

- **Accent:** never hardcode `amber-*` (or any palette) for accent surfaces — always use the `appAccent` / `text-appAccent` tokens so the user's chosen colour is respected. For text/icons sitting **on** an accent fill, use `text-appOnAccent` (never `text-white` / `text-[#0F1117]`) so the foreground stays legible on a light/pastel accent.
- **Tokens vs. raw values:** prefer the Tailwind token class over raw hex or inline `var()`. The exceptions are `--text-secondary` and `--text-darker`, which have **no** Tailwind token — reference them via `var()` in CSS / Recharts style props only.
- **Fonts:** the UI **and** all print/export documents use the self-hosted Noto family (`font-sans` / `font-display` / `font-mono`) — never a CDN `<link>`, and never `-apple-system` / `SF Mono` in print CSS (the print popup goes through `src/utils/printDocument.js`). `index.css` sets `color-scheme: dark/light` so native controls render in the right scheme.

---

## Component Conventions

### Modals

On mobile, modals are bottom sheets whose style branches by platform. On desktop (`sm:` breakpoint and above) they are always centered dialogs:

| Context | Scrim | Corner radius | Extra behavior |
|---|---|---|---|
| iOS standalone | `bg-black/40 backdrop-blur-md` | `rounded-2xl` | Grabber pill, swipe-down-to-dismiss, Taptic Engine haptic |
| Android standalone | `bg-black/70 backdrop-blur-sm` | `rounded-t-[28px]` (MD3) | 48 dp drag handle, swipe-down **or** `popstate` back-button dismiss, `vibrate(40)` haptic |
| Web / browser tab | `bg-black/70 backdrop-blur-sm` | `rounded-2xl` | Backdrop-tap dismiss (and swipe-down on touch) |

**Every sheet modal dismisses on a backdrop tap and a swipe-down**, in addition to the close button and Escape. The scrim's `onClick` is guarded with `e.target === e.currentTarget` so only a tap on the backdrop itself closes — a bubbled click from inside the sheet does not (the `ConfirmModal` idiom). Swipe-down past ~80px (`useSwipeDismiss`) dismisses on **any touch platform**, not just installed iOS — the drag handle behaves the same everywhere it's shown.

Use `usePlatformContext()` to get `{ isStandalone, os }` and branch accordingly. Follow `StartTimerModal.jsx` as the reference pattern for **form / action** modals; apply the same treatment to any new one.

**Shared modal hooks (issue #151).** Don't re-implement the focus trap or sheet plumbing inline — every modal consumes:
- `useFocusTrap(dialogRef, onClose, opts?)` (`src/hooks/useFocusTrap.js`) — the full a11y contract in one place: initial focus (`[data-autofocus]` → first focusable, or `opts.initialFocus(el, focusables)` e.g. `(el) => el` for a scrollable reading dialog), a container-scoped Tab trap, focus **restoration** to the triggering element on close, and Escape→`onClose`. The hook keeps a module-level stack of mounted traps so **only the topmost (most-recently-opened) dialog reacts to Escape/Tab** — a `ConfirmModal` opened from inside another modal closes alone, and Tab stays inside it, instead of both traps firing on one key.
- `useSwipeDismiss` / `useAndroidBackDismiss` / `useSheetStyles` (`src/hooks/useBottomSheet.jsx`) — swipe-down dismiss (any touch platform), Android back-button dismiss, and platform scrim/sheet/handle styles for bottom-sheet modals.

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
- `roundDurationMs(ms, minutes, mode?)` → a worked **duration** (ms) rounded to a billing increment of `minutes`; `mode` is `'nearest'` (default — standard round-to-nearest) or `'up'` (round up). No-op when `minutes` is 0/undefined or the duration is under a minute (a "0m" entry must not inflate to a full increment). The low-level rounding primitive; billing goes through `billedDurationMap` (below), which applies it in cumulative-offset space so back-to-back tasks round as one session (issues #208/#274)
- `getEntryDuration(entry)` → milliseconds (handles active entries via `Date.now()`)
- `getEntryDurationInRange(entry, start, end, now?)` → ms of the entry clipped to `[start,end]`; a running entry is valued to `now` (default `Date.now()` — pass a ticking value for a live total, issue #265)
- `formatTime(date)` → `"h:mm a"` time-only string (date-fns)
- `formatDate(date)` → `"EEE, MMM d"` date-only string (date-fns)
- `getDayRange(date?)` / `getWeekRange(date?, weekStartsMonday?)` → `{start, end}`
- `getWeekDays(date?, weekStartsMonday?)` → `Date[]` all days in the week
- `isEntryInRange(entry, start, end)` → boolean
- `sumDurations(entries)` → total ms (all entries)
- `sumDurationsInRange(entries, start, end)` → completed-only total clipped to the window (the completed-only base; the #137 export semantics — exports currently filter completed inline rather than calling this)
- `billedDurationMap(entries, now?, minutes?, mode?)` → **the single source of truth for billing** — a `Map<entry, billedMs>` over a set of entries. Completed entries are bucketed by `punchIn` calendar day, then grouped into **continuous sessions** (a task joins the running session when it starts within `SESSION_GAP_MS` = 60 s of the session's end — the sub-minute tolerance that bridges the punch-handoff gap `startTimer` leaves). Each session bills `roundOff(whole worked span)` — a whole number of increments — split first across its billed **rate-groups** (`(jobId, laborTypeId)`) by time **worked**, then within each group across its entries (Hamilton's largest-remainder). So the session total equals the rounded **whole span** (`round`/`ceil` of the continuous session, not of each piece), the rows are clean increments that **sum** to exactly that total, allocation is phase-independent, and each rate-group is billed ~its worked share — exactly when the worked totals already align to the increment, never 0 vs the whole session by punch order. (Limits: a session crossing local midnight splits at the day boundary so the by-day and by-week views agree; in `'up'` mode the round-up surplus lands on the largest-remaining group, so only the session total and per-rate-group shares are bounded, not every individual line.) This fixes the reopened #274: per-task rounding drifted an N-task day by up to N increments (down in `'nearest'`, up in `'up'`); session rounding caps the error at one increment, so a real 9 h 08 m day bills **9.25 h** either way. Running entries are billed live + **unrounded** (#265) and never join a session. A whole session under a minute (a stray mis-punch) bills raw, so it isn't inflated to a full increment. **Contract: always build the map over the COMPLETE set of entries for the period (every job/labor type), then filter for display via `billed.get(entry)` — billing is intrinsic to each entry; rounding a pre-filtered subset (one job, one client) regroups the sessions and yields a different, scope-dependent number.** The Timesheets rows/totals compute the map over the unfiltered day/week and a filter only changes which rows are summed; CSV/print bill the whole range; `InvoiceModal` rounds over the full period (all jobs) then attributes the invoiced scope — so a single-job invoice equals that job's contribution to the timesheet, and all views/exports reconcile
- `billedEntryDuration(entry, now?, minutes?, mode?)` → convenience wrapper: one entry billed as its **own** session (via `billedDurationMap([entry], …)`). Use the map directly for any *set* of entries so back-to-back tasks round together (issues #274/#265)
- `sumBilled(entries, now?, minutes?, mode?)` → billable total: the sum of `billedDurationMap(entries, …)`, so back-to-back tasks bill as one continuous session and the rows sum exactly to the total (issues #274/#265)

---

## Known Issues & Pitfalls

- **Timesheets bill by punch-in day, and back-to-back tasks round as one session (#274).** `isEntryInRange` checks `punchIn` only, and the Timesheets sheets, CSV/print, and invoice all attribute each entry **wholly to the day it started** — an entry that crosses midnight bills on its start day, not split across the two days it spans. Within a day, **contiguous tasks bill as one continuous session** via `billedDurationMap`: the session's whole span is rounded once (so an N-task day can't drift by N increments the way per-task rounding did — the reopened-#274 bug where a 9 h 08 m day showed 9.00 h in `'nearest'` / 9.75 h in `'up'` instead of 9.25 h), and the per-task rows telescope to that total. A break of ≥ 60 s starts a fresh session. AnalyticsView/TimerView still clip a long entry across the days it covers via `getEntryDurationInRange` (those are unrounded time-distribution views, not billing).

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
- **`worker/oauth.js` is not what serves those headers on the app shell.** `wrangler.jsonc` declares an `[assets]` block with no `run_worker_first`, so Cloudflare's asset router answers `/` and every hashed bundle *before* the Worker runs — the Worker only sees paths the assets don't claim. The deployed headers come from **`app/public/_headers`** (Workers with static assets honours `_headers` natively; Vite copies `app/public/` into `dist/`). **Both definitions must be updated together** — `worker/oauth.test.js` asserts they match, including the CSP byte-for-byte. Verify a header change actually landed with `curl -o /dev/null -D - https://trackmytime.today/`, not just by a passing unit test: the two disagreed silently from issue #129 until 2026-08-14, with production serving no CSP at all.

---

## Screenshots

> **The device specs and the full Playwright regeneration procedure live in [`docs/SCREENSHOTS.md`](docs/SCREENSHOTS.md).** See "What counts as a visible UI change" above for *when* to regenerate; see that doc for *how*.

Screenshots live in `docs/screenshots/{phone,tablet,desktop}-{dark,light}/` and are embedded in `README.md` via GitHub's `#gh-dark-mode-only` / `#gh-light-mode-only` URL fragments. They are committed to the repo but must be **generated by the Playwright script** (`scripts/screenshots.mjs`) — never captured and saved by hand.

---

## Adding Features — Checklist

1. **New data type?** Add table/indexes in `db.js`, bump version, add seed data if needed
2. **New setting?** Add the key + default to the single `DEFAULT_SETTINGS` object in `db.js` (both `populate` and `factoryReset` consume it via `defaultSettingsRows()`, so there's one source of truth — no separate edit to `SettingsView.jsx` needed) and document it in the Settings Keys table in `docs/SETTINGS.md`. Because `useSettings` merges over `DEFAULT_SETTINGS`, consumers can read `settings.yourKey` directly without a fallback. Destructive data actions belong in the collapsible **Danger Zone** section, not in the main Data section.
3. **New view?** Add to `App.jsx` tab switch and `Layout.jsx` nav bar (keep it to 5 nav items max for mobile)
4. **Editing time?** Always go through `utils/time.js` helpers; never use raw `Date` arithmetic inline
5. **Charts?** Follow `AnalyticsView.jsx` — use Recharts, reference CSS variables for colors (`var(--text-secondary)` etc.). Wrap each chart in `<figure role="img" aria-label="…">` whose `aria-label` carries the full data summary, and render a `<table className="sr-only">` data fallback as a **sibling right after the `</figure>`** — *not* inside it. `role="img"` makes all descendants presentational, so a table nested in the figure is pruned from the accessibility tree (esp. VoiceOver). Do **not** also set `aria-labelledby` on the figure: it wins accessible-name computation over `aria-label`, hiding the rich summary — name the figure with `aria-label` only.
6. **Theming?** New accent-colored elements must use `appAccent` / `text-appAccent` — never hardcode `amber-*` classes. New non-accent colors should use existing CSS variable conventions or Tailwind red/neutral palettes.
7. **New modal?** Apply the platform-native bottom-sheet pattern from `StartTimerModal.jsx` — use `usePlatformContext()` to branch scrim/sheet/handle styles and wire up `useSwipeDismiss` (iOS) and `useAndroidBackDismiss` (Android). Do not add a new modal that only uses the old `items-end sm:items-center` toggle. Every modal must also have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a focus trap, and an Escape key handler (see existing modals for the inline pattern).
8. **Haptic feedback?** Use `useHapticFeedback(os)` — never call `navigator.vibrate()` directly in a component, and never attempt iOS haptics via any method other than the WebKit switch polyfill. Gate it on both standalone mode and the `hapticFeedback` setting by passing `'web'` when off: `useHapticFeedback(isStandalone && settings.hapticFeedback !== false ? os : 'web')`. Call `trigger()` **synchronously inside the gesture handler** (not after an `await`) or iOS Taptic silently no-ops, and render the returned `hapticEl` somewhere in the component.
9. **Destructive confirmation?** Use `<ConfirmModal>` (`src/components/ConfirmModal.jsx`) rather than `window.confirm()`. Pass `title`, `message`, `confirmLabel`, `onConfirm`, and `onCancel`.
10. **New interactive element?** Icon-only buttons need an explicit `aria-label`. Toggle/radio-group buttons need `aria-pressed`. Form inputs need a `<label>` wired via `htmlFor`/`id` (use `useId()` to avoid collisions). Decorative icons inside labeled elements need `aria-hidden="true"`.
11. **Focus indicators?** Do not use `focus:outline-none` without also adding `focus:ring-*`. The global `:focus-visible` rule in `index.css` handles buttons; inputs need explicit `focus:ring-2 focus:ring-appAccent/50`.
12. **Documentation?** Apply the Documentation Maintenance rules — update `CLAUDE.md`, `README.md`, `docs/CHANGELOG.md`, and screenshots as required by the change type. See the Documentation Maintenance section for the full lookup table.

---

## What NOT to Do

- Do not introduce a backend or server-side authentication without explicit scope agreement. Cloud sync via OAuth + provider-hosted storage (GitHub Gist, Google Drive, OneDrive, Dropbox) is in scope as of v0.10.0 — but adding a new sync provider requires a separate Cloudflare Worker secret and explicit agreement on the OAuth flow. Account-free, client-only device-to-device transfer via a compressed `#import=` link + QR code is in scope as of v0.15.0 (no backend involved)
- Do not add a URL router — the tab-state approach is intentional for PWA standalone mode
- Do not import new heavy libraries without checking bundle size impact (current bundle is intentionally small)
- Do not store sensitive data in Dexie (it is plaintext in browser storage)
- Do not write inline date arithmetic or format strings — always use the helpers in `src/utils/time.js`
