# PunchIn — AI Assistant Guide

## Project Overview

PunchIn is a mobile-first, offline-capable time tracking PWA for freelancers. Users punch in/out of jobs, categorize work by labor type, review timesheets, and analyze time trends. All data is stored locally in IndexedDB (no backend/auth).

**Stack:** React 19 + Vite + Tailwind CSS + Dexie (IndexedDB) + Recharts  
**Deploy:** Cloudflare Workers (static asset serving via `wrangler`)  
**Version:** 0.16.0

---

## Repository Structure

```
punchin/
├── README.md               # Product intro, screenshots, getting started
├── wrangler.jsonc          # Cloudflare Workers deployment; deploy via `npm run deploy`; routes OAuth requests to worker/oauth.js and static assets via ASSETS binding
├── .env.example            # Documents all VITE_* OAuth env vars with setup instructions for each provider
├── worker/
│   └── oauth.js            # Cloudflare Worker: handles GitHub OAuth code→token exchange; redirects to app with token in URL fragment; falls through to static assets for all other routes
├── app/
│   ├── index.html          # App shell (viewport, fonts, theme color, apple-touch-icon link); Vite root is app/
│   └── public/             # Static assets copied verbatim to dist/ root; holds the PWA/home-screen icons
│       ├── icon-192.png        # Manifest icon (192×192, purpose any)
│       ├── icon-512.png        # Manifest icon (512×512, purpose any)
│       ├── icon-512-maskable.png # Manifest icon (512×512, purpose maskable) for Android adaptive icons
│       └── apple-touch-icon.png  # iOS home-screen icon (180×180), linked from index.html
├── config/
│   ├── vite.config.js      # Vite + Vitest + PWA config; root=app/, outDir=../dist, test.root=..
│   ├── postcss.config.js   # PostCSS pipeline (Tailwind + autoprefixer)
│   └── tailwind.config.js  # Custom fonts (Noto Sans, Noto Sans Display, Noto Sans Mono) + CSS-variable-backed color tokens
├── scripts/
│   ├── screenshots.mjs     # Playwright script: seeds demo data + captures 42 screenshots (7 views × 3 devices × 2 themes)
│   ├── icons.mjs           # Generates app/public icon set (Clock mark on accent square) via sharp; run to regenerate brand icons
│   └── social-preview.py   # Regenerates docs/social-preview*.svg + .png (Noto wordmark/tagline as outlined paths via fontTools; PNG via sharp). Build-time only — no font binary committed
├── docs/
│   ├── CHANGELOG.md        # Version history; imported at build time by ChangelogModal via ?raw import
│   ├── THIRD-PARTY-LICENSES.md # Attribution + license terms for bundled/used third-party assets (the Noto fonts, OFL-1.1)
│   ├── social-preview.svg      # GitHub README header / repo social card (dark); transparent bg, Noto wordmark outlined
│   ├── social-preview-light.svg # Light-mode variant of the header card
│   ├── social-preview.png      # Raster repo social card (1280×640) flattened on brand navy
│   ├── licenses/
│   │   └── OFL-1.1.txt     # SIL Open Font License 1.1 — covers Noto Sans / Display / Mono
│   └── screenshots/
│       ├── phone-dark/     # Phone · dark theme (412×916 CSS px @2.625×) — 7 views
│       ├── phone-light/    # Phone · light theme — 7 views
│       ├── tablet-dark/    # Tablet landscape · dark theme (1194×834 CSS px @2×) — 7 views
│       ├── tablet-light/   # Tablet landscape · light theme — 7 views
│       ├── desktop-dark/   # 1920×1080 @1× · dark theme — 7 views
│       └── desktop-light/  # 1920×1080 @1× · light theme — 7 views
├── src/
│   ├── main.jsx            # React entry point; registers service worker and PWA install prompt listener
│   ├── App.jsx             # Root: tab state, theme application, accent → CSS var + dynamic favicon, OAuth callback handling (reads window.location.hash on mount), first-run install nudge (after ≥2 opens, localStorage-gated)
│   ├── sync/
│   │   ├── config.js           # Reads VITE_GITHUB_CLIENT_ID, VITE_GOOGLE_CLIENT_ID, VITE_ONEDRIVE_CLIENT_ID from build env
│   │   ├── oauthState.js       # OAuth CSRF protection (issue #125): createOAuthState (mint+store a nonce in sessionStorage), consumeOAuthState (verify the returned nonce, fail closed). The nonce is embedded in the OAuth `state` and checked in App.jsx's callback handler
│   │   ├── syncManager.js      # Core sync logic: exportSnapshot, mergeSnapshot (reuses import dedup), importSnapshot (public merge for transfer links, issue #77), runSync (pull→merge→push), disconnectSync
│   │   └── providers/
│   │       ├── github.js       # GitHub Gist API: buildGitHubOAuthUrl, fetchGitHubUser, findExistingPunchInGist, createGist (marker + device file), fetchAllDeviceData (reads all punchin-data-*.json + legacy file), pushDeviceData (writes marker + own device file), deleteDeviceFile (nulls file on disconnect), updateGist/fetchGist (legacy, kept for backward compat)
│   │       ├── google.js       # Google Drive API: buildGoogleOAuthUrl (implicit flow, appdata scope), pushToDrive, pullFromDrive
│   │       └── onedrive.js     # Microsoft Graph API: buildOneDriveOAuthUrl (implicit flow, AppFolder scope), pushToOneDrive, pullFromOneDrive
│   ├── index.css           # CSS variables (dark/light), scrollbar utils
│   ├── db.js               # Dexie schema, seed data, migrations
│   ├── components/
│   │   ├── Layout.jsx          # Fixed header (logo taps → timer) + bottom nav shell; shows update badge on Settings icon
│   │   ├── ErrorBoundary.jsx   # Class component; wraps each view in App.jsx
│   │   ├── TimerCard.jsx       # Live running timer card (1s interval)
│   │   ├── StartTimerModal.jsx # Punch-in form modal; auto-punches-out running timers when concurrent timers is off
│   │   ├── EditEntryModal.jsx  # Edit active or completed entry (supports cross-day)
│   │   ├── InvoiceModal.jsx    # Invoice generator: job + date range → line-item table → CSV/print
│   │   ├── ConfirmModal.jsx    # Accessible confirmation dialog (focus trap, Escape, Cancel default); replaces window.confirm
│   │   ├── ColorPicker.jsx     # Preset swatches + custom hex picker (react-colorful); luminance contrast check; sizes: 'md' | 'lg'
│   │   ├── ChangelogModal.jsx  # Parses docs/CHANGELOG.md (?raw import) at build time; renders version sections with dates + bullets; centered reading-modal — closes on device Back (pushes {modal:true} history entry)
│   │   ├── LicenseModal.jsx     # Centered reading-modal showing the app license (LICENSE ?raw, BUSL-1.1) and third-party attributions (docs/THIRD-PARTY-LICENSES.md ?raw, rendered via a small built-in markdown renderer); two-way section switch via aria-pressed buttons; closes on device Back
│   │   ├── DataTransfer.jsx     # Account-free device-to-device transfer (issue #77): "Create share link" snapshots the DB → compressed #import= link + QR (qrcode-generator); "Import from a link" pastes a link/code and merges via importSnapshot
│   │   └── InstallPromptModal.jsx # First-run install bottom sheet; mode = 'native' (Chrome/Edge one-tap), 'ios-safari' (Share→Add-to-Home-Screen), or 'ios-other' (open-in-Safari guidance for Chrome/Firefox on iOS)
│   ├── views/
│   │   ├── TimerView.jsx       # Active timers list; shows last completed entry when idle
│   │   ├── JobsView.jsx        # Jobs & labor types CRUD; per-labor-type hourly rates on jobs
│   │   ├── TimesheetsView.jsx  # Daily/weekly time logs + search + CSV/print/invoice export
│   │   ├── AnalyticsView.jsx   # Charts: daily bars, job bars, labor pie
│   │   └── SettingsView.jsx    # Settings as an iOS-style drill-in (CategoryRow root list → Panel sub-pages; device Back / re-tapping the Settings tab returns to root): General (concurrent timers, week start, haptics), Appearance (theme/accent), Reminders (incl. per-reminder WeekdayPicker), Install, Data & Sync (Backup JSON/CSV · Sync GitHub Gist/Google Drive/OneDrive · Transfer · Danger Zone, grouped via PanelGroup), About (changelog, report bug, help-improve/feature request, License & legal, Support the App, check-for-updates). Exports buildBugReportUrl + buildFeatureRequestUrl
│   ├── hooks/
│   │   ├── useSettings.js          # Reactive Dexie KV settings hook
│   │   ├── usePlatformContext.js   # Standalone mode + OS detection (ios/android/web) + isIOSSafari (true only in iOS Safari, where Add to Home Screen works) + isIPad (treats a touch-capable "Macintosh" UA — iPadOS Safari's default desktop mode — as iOS, and distinguishes iPad from iPhone)
│   │   ├── useInstallPrompt.js     # PWA install state: canInstall/isInstalled/isIOS/isIOSSafari + promptInstall(); shared by SettingsView and the install nudge
│   │   ├── useHapticFeedback.jsx  # Platform-routed haptic trigger (vibrate / WebKit switch polyfill)
│   │   └── useReminders.js        # Reminder scheduler (issue #54): watches settings + live timers, evaluates evaluateReminders on a 30s interval (and on tab focus), fires local notifications while reminders are enabled and permission granted. No backend / Web Push
│   └── utils/
│       ├── time.js             # Date/time helpers (format, range, sum)
│       ├── favicon.js          # Renders the brand mark in the current accent color to a canvas PNG and installs it as the browser-tab favicon (updateFavicon)
│       ├── notifications.js    # Browser Notification API wrappers: notificationsSupported, notificationPermission, requestNotificationPermission, showNotification (prefers the SW registration, falls back to the Notification constructor)
│       ├── reminders.js        # Pure evaluateReminders({now, settings, activeEntries, jobs, state}) → {fire, state}; the testable reminder rules (long-running timer, idle, still-running, daily/weekly timesheet) + parseHHMM/dayKey helpers
│       ├── transfer.js         # Device-to-device transfer codec (issue #77): encodeSnapshot/decodeSnapshot (gzip via CompressionStream + base64url, 'g'/'r' flag), buildShareUrl, parseImportCode, parseImportFromHash
│       ├── deviceId.js         # Stable per-device identifier: getDeviceId() generates an 8-char hex ID on first call and persists it in localStorage (pi.deviceId); survives factory resets intentionally
│       └── pwa.js              # PWA state bridge: beforeinstallprompt capture, update notification, applyUpdate(), hasWaitingUpdate() (detects an already-downloaded SW waiting to activate)
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
| `src/utils/time.test.js` | All helpers: `formatElapsed`, `formatDurationHM`, `getEntryDuration`, `formatTime`, `formatDate`, `getDayRange`, `getWeekRange`, `getWeekDays`, `isEntryInRange`, `sumDurations` |
| `src/utils/pwa.test.js` | `getInstallPrompt`, `notifyUpdateAvailable`, `setPwaUpdateFn`, `applyUpdate`, `initPwaInstallPrompt`, `hasWaitingUpdate` (reg.waiting detection) |
| `src/utils/favicon.test.js` | `drawFaviconDataUrl` (accent color, null-context fallback), `updateFavicon` (link creation, static-link replacement, idempotent updates) |
| `src/utils/notifications.test.js` | `notificationsSupported`, `notificationPermission`, `requestNotificationPermission`, `showNotification` (permission gate, SW-registration path, constructor fallback) |
| `src/utils/reminders.test.js` | `parseHHMM`, `dayKey`, `dayAllowed`, `evaluateReminders` (gating, long-running threshold crossing/de-dup/cleanup, idle/still-running/daily/weekly time-of-day rules, day-of-week gating + back-compat when day arrays absent) |
| `src/utils/transfer.test.js` | `encodeSnapshot`/`decodeSnapshot` round-trip (gzip + raw), error paths (empty/bad flag/corrupt/non-PunchIn), `buildShareUrl`, `parseImportCode`, `parseImportFromHash` |
| `src/utils/deviceId.test.js` | `getDeviceId` — generates 8-char hex, persists across calls, falls back to `'default'` when localStorage is unavailable |
| `src/db.test.js` | Schema validation, default settings seed (20 keys incl. the per-reminder weekday defaults = all 7 days), basic CRUD for jobs/labor types/entries |
| `src/hooks/useSettings.test.js` | Loading state, settings object, `updateSetting` (boolean and string values) |
| `src/hooks/usePlatformContext.test.js` | OS detection (iOS/Android/desktop), `isIOSSafari` (Safari vs CriOS/FxiOS/EdgiOS), `isIPad` incl. desktop-mode iPad (touch-capable "Macintosh" → iOS) vs real Mac, standalone mode detection |
| `src/hooks/useHapticFeedback.test.jsx` | `hapticEl` JSX for iOS / null for others; `trigger` routes vibrate/label-click/no-op by platform |
| `src/hooks/useReminders.test.js` | fires a notification when an enabled reminder condition is met; no-ops when reminders disabled or permission not granted |
| `src/hooks/useInstallPrompt.test.js` | `canInstall`/`isInstalled` state from `pwa:install-ready`/`pwa:installed`; `promptInstall` accept/dismiss outcomes |
| `src/components/ChangelogModal.test.jsx` | Render, markdown parsing, close button/Escape/backdrop, focus trap, device-Back (popstate) dismiss |
| `src/components/LicenseModal.test.jsx` | Dialog a11y, default app-license (BUSL) tab, switch to third-party (aria-pressed), close button/Escape/backdrop, device-Back (popstate) dismiss |
| `src/components/InstallPromptModal.test.jsx` | All three modes (native / ios-safari / ios-other), dialog a11y, Install/Not-now/Got-it/Escape/backdrop |
| `src/components/ColorPicker.test.jsx` | Preset swatches, custom hex picker, `aria-pressed`, Escape close |
| `src/components/ConfirmModal.test.jsx` | Render, `onConfirm`/`onCancel`, Escape/backdrop, focus management |
| `src/components/DataTransfer.test.jsx` | Share-link + QR generation, "Includes N jobs/entries" summary, import junk rejection, end-to-end import of a real encoded link with count (issue #77) |
| `src/components/EditEntryModal.test.jsx` | Add/edit/active-timer modes, validation, save/delete flows, keyboard |
| `src/components/EditEntryModal.helpers.test.js` | `formatDateToYYYYMMDD`, `formatTimeToHHMM`, `combineDateAndTime` |
| `src/components/ErrorBoundary.test.jsx` | Children render, fallback UI on throw, "Try again" reset |
| `src/components/InvoiceModal.test.jsx` | Line-item calc, period presets, CSV export, print, empty state |
| `src/components/Layout.test.jsx` | Logo button, nav items, `aria-current`, tab callbacks |
| `src/components/StartTimerModal.test.jsx` | Render, form validation, concurrent-timer guard |
| `src/components/TimerCard.test.jsx` | Job/labor-type display, stop timer, open/close EditEntryModal |
| `src/views/AnalyticsView.test.jsx` | Loading state, period toggle, summary cards, empty state, charts |
| `src/views/JobsView.test.jsx` | Jobs and labor types tabs, full CRUD, archive/restore |
| `src/views/SettingsView.test.jsx` | Drill-in root list + sub-pages, device-Back/Settings-tab-reselect returns to root, Data & Sync consolidation, toggles, theme, export/import, sync UI, danger zone, About rows (help-improve, License modal, Support link) |
| `src/views/SettingsView.bugReport.test.js` | `buildBugReportUrl` + `buildFeatureRequestUrl` (template/scope/URL) — browser/OS/device/install-type detection |
| `src/views/SettingsView.syncUnconfigured.test.jsx` | Sync section with empty client IDs: friendly "not set up" message, no env-var jargon, no provider buttons (issue #59) |
| `src/views/SettingsView.dedup.test.js` | `isEntryDuplicate` (backup import dedup logic) |
| `src/views/SettingsView.haptics.test.jsx` | `hapticFeedback` toggle shown on iPhone/Android, hidden on iPad (no vibration motor) and web, toggles the setting (issue #65) |
| `src/views/SettingsView.reminders.test.jsx` | Reminders section (issue #54): unsupported message, master toggle requests permission + gates the setting on grant/deny, per-reminder options render when enabled, minutes input + sub-toggles, per-reminder `WeekdayPicker` (renders, toggling a day, clearing the last day turns the reminder off + restores all days) |
| `src/views/TimerView.test.jsx` | Empty state, active timers, last session, punch-in modal |
| `src/views/TimesheetsView.test.jsx` | Daily/weekly tabs, period nav, search/filter, CSV/print, edit/delete |
| `src/App.test.jsx` | Accent color CSS variable, theme class, default view, OAuth callbacks (incl. GitHub username fetch + Settings navigation, issue #83), first-run install nudge gating (mobile-only, ios-other mode, desktop suppression), back-button history navigation (seed/push/popstate, issue #65), transfer-link import prompt (confirm/cancel/corrupt, issue #77) |
| `src/sync/config.test.js` | `SYNC_CONFIG` shape and env-var fallbacks |
| `src/sync/providers/github.test.js` | `buildGitHubOAuthUrl`, `fetchGitHubUser`, `findExistingPunchInGist` (pagination, marker file, device prefix, legacy file), `getDeviceFilename`, `createGist` (marker + device file), `fetchAllDeviceData` (multi-device, truncated, legacy, malformed), `pushDeviceData`, `deleteDeviceFile`, `updateGist`, `fetchGist` |
| `src/sync/providers/google.test.js` | `buildGoogleOAuthUrl`, `pushToDrive` (create + update path), `pullFromDrive` |
| `src/sync/providers/onedrive.test.js` | `buildOneDriveOAuthUrl`, `pushToOneDrive`, `pullFromOneDrive` (404 → null) |
| `src/sync/syncManager.test.js` | `exportSnapshot`, `disconnectSync` (deletes device file, clears all settings incl. syncUsername), `runSync` (auth guards, per-provider dispatch, multi-device merge via `fetchAllDeviceData`, existing-gist discovery, per-device push, create with marker) |

When adding new behaviour to any source file, add a test alongside it.

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

### Versioning

PunchIn follows **semantic versioning** (`MAJOR.MINOR.PATCH`).

- **Pre-1.0** (current): `0.MINOR.PATCH` — `MINOR` increments for new user-visible features or significant UX changes; `PATCH` for bug fixes, accessibility improvements, and internal refactors with no visible feature change.
- **Post-1.0**: standard semver — `MAJOR` for breaking data-model changes or major UX overhauls; `MINOR` for new features; `PATCH` for fixes.
- The canonical version source is `package.json` → `"version"`. `vite.config.js` reads it automatically via `__APP_VERSION__` — no manual sync needed for the in-app display.
- The BUSL-1.1 **Change Date** of `2030-06-02` is fixed and independent of version — it does not move when the version number changes.

#### Version increment decision guide

| Change type | Increment |
|---|---|
| New view, tab, or modal | `MINOR` |
| New setting exposed in UI | `MINOR` |
| New export/import format or data capability | `MINOR` |
| Significant UX or layout change | `MINOR` |
| New DB table or field that users interact with | `MINOR` |
| Bug fix visible to users | `PATCH` |
| Accessibility improvement | `PATCH` |
| Performance improvement (no visible change) | `PATCH` |
| Internal refactor (no visible change) | `PATCH` |
| Dependency update (no visible change) | `PATCH` |
| Test additions only | no bump |
| CI / workflow config change only | no bump |
| Documentation-only change (`CLAUDE.md`, `README.md`) | no bump |

When in doubt between `MINOR` and `PATCH`: if a user would notice the change without being told about it, it's `MINOR`.

### Release checklist

Every version bump must update all of the following in the **same commit or PR**:

| File | What to change |
|------|----------------|
| `package.json` | `"version"` field — **source of truth** |
| `README.md` | Version badge: `https://img.shields.io/badge/version-{X.Y.Z}-1f6feb...` |
| `CLAUDE.md` | `**Version:** {X.Y.Z}` in the Project Overview header |
| `docs/CHANGELOG.md` | New `## [{X.Y.Z}] — {YYYY-MM-DD}` section at the top |
| `SECURITY.md`        | Update the **Supported Versions** table — bump the supported version to `{X.Y.Z}.x` and mark all prior minor versions as `No` |
| `docs/screenshots/` | Regenerate if any visible UI changed (see Documentation Maintenance below) |

After the bump commit lands on `main`, also **create a GitHub release** (`gh release create vX.Y.Z …`) — it tags the version and surfaces it in the repo's Releases sidebar. This is a post-merge action (a tag points at a commit on `main`), not a file edit, so it's step 9 in the procedure below rather than a row in this table.

The `wrangler.jsonc` `compatibility_date` is **not** part of the version bump — update it only when intentionally upgrading the Cloudflare Workers runtime.

#### Step-by-step release procedure

1. Decide the new version using the decision guide above
2. Update `package.json` `"version"`
3. Add a new section at the top of `docs/CHANGELOG.md` (see format below)
4. Update the version badge URL in `README.md`
5. Update `**Version:**` in the `CLAUDE.md` Project Overview header
6. If any visible UI changed, regenerate screenshots (see Documentation Maintenance below)
7. Verify `npm run build` and `npm run test:run` both pass
8. Commit everything in a single commit: `chore: bump to vX.Y.Z` (or fold the bump into the feature PR)
9. Once the version commit has landed on `main`, create a GitHub release so the version is tagged and shows in the repo's **Releases**:
   ```bash
   gh release create vX.Y.Z --target <commit-on-main> --title "vX.Y.Z" --latest --notes "<the new docs/CHANGELOG.md section>"
   ```
   The tag `vX.Y.Z` is the canonical marker for the release; `--notes` should mirror that version's `docs/CHANGELOG.md` section. Pass the **full** commit SHA (or a branch name) to `--target` — the API rejects abbreviated SHAs.

   Publishing the release **auto-creates the `vX.Y.Z` milestone and assigns every merged PR that doesn't yet have one** (= everything merged since the last release), via `.github/workflows/milestone-on-release.yml`. Manual fallback if that workflow is unavailable: `gh api repos/<owner>/<repo>/milestones -f title=vX.Y.Z -f state=closed`, then assign PRs with `gh pr edit <n> --milestone vX.Y.Z`.

### Project board automation

`.github/workflows/project-automation.yml` keeps the [PunchIn project board](https://github.com/orgs/PunchIn-App/projects/3) populated as issues/PRs move: on open it auto-adds the item and sets **Labels** (from the conventional-commit type), **Priority** (bug/enhancement → P1, else P2), **Size** (from PR diff), and **Start**/**Target** (+3 days) dates; on close it sets **Completion Date** and **clears any assignees** (finished work shouldn't stay assigned). It deliberately leaves **Status** to the project's built-in workflows (Item added / Item closed / Pull request merged) so it never conflicts with them or the built-in Auto-close rule. **Milestones** are handled at release time (above), not here. Both `project-automation.yml` and `milestone-on-release.yml` live in each repo the board tracks (punchin + punchin-email). Everything runs under the **`ADD_TO_PROJECT_PAT`** secret — the default `GITHUB_TOKEN` is kept read-only (issue #104), so the PAT must grant **Projects: read/write · Issues: read/write · Contents: read/write** on both repos (Projects for the board fields, Issues for labels + milestones, Contents write for the punchin-email → punchin release relay below).

`.github/workflows/project-status-update.yml` (punchin only) is the **single source of truth** for the project's **status updates** (the "Updates" panel): a weekly Monday digest, a "shipped vX.Y.Z" update on a punchin release, and the same on a **punchin-email** release — relayed in via `repository_dispatch` (`type: email-release`) from `punchin-email/notify-status-update.yml`. Every update covers the **whole project** (both repos counted in one post). The status flag is auto-derived — **AT_RISK** if any open P0 items, else **ON_TRACK**. Runs under `ADD_TO_PROJECT_PAT`; the relay additionally needs the PAT to have **Contents: write** on punchin (to send the dispatch).

#### CHANGELOG entry format

Follow [Keep a Changelog](https://keepachangelog.com/) — add a new section at the very top of `docs/CHANGELOG.md`:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- Short description of new capability, written from the user's perspective

### Changed
- What changed and how it differs from before; internal-only refactors get "(internal)" suffix

### Fixed
- What was broken and what it does now

### Removed
- What was removed
```

Rules:
- Omit sections that have no entries for that release
- Write from the user's perspective, not the implementation's: "Timesheets now export..." not "Updated TimesheetsView to..."
- Start bullets with the feature area for scannability: "Timer — ", "Analytics — ", "Settings — ", etc.
- Each bullet is one user-observable change; group closely related implementation details into one bullet

---

## Documentation Maintenance

Every PR that changes code must update relevant documentation in the **same commit or PR**. The table below maps change types to required updates:

| What changed | `CLAUDE.md` | `README.md` | `docs/CHANGELOG.md` | Screenshots |
|---|---|---|---|---|
| New component | Add to Repository Structure; describe it | — | ✓ if user-visible | ✓ if renders in any view |
| Component renamed or removed | Update Repository Structure (remove stale entries) | — | ✓ if user-visible | ✓ if renders in any view |
| New view or tab | Add to Repository Structure + describe it | Consider updating features section | ✓ | ✓ |
| New or changed hook | Update Repository Structure description | — | — | — |
| New or changed `time.js` helper | Update Time Utilities list | — | — | — |
| DB schema change (table, index, or field) | Update Database → Collections table | — | ✓ if user-visible | — |
| New setting key | Add row to Settings Keys table | — | ✓ | — |
| New exported helper from any source file | Update the relevant section | — | — | — |
| Any visible UI change | — | — | — | ✓ regenerate |
| Version bump | Update `**Version:**` in header | Update version badge | Add new section | ✓ if UI changed |

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

### Keeping CLAUDE.md accurate

CLAUDE.md documents the *current state* of the codebase — it must stay accurate, not just accumulate additions. Apply these rules when making any code change:

- **Adding** a component, view, hook, or utility: add an entry to the Repository Structure tree and the relevant detail section
- **Removing** something: delete its entry — do not leave stale references
- **Renaming** something: update every mention, including the Repository Structure tree and any section that names it
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
| `laborTypes` | `id, name, uuid` | Billable categories with color; soft-archived via `isArchived` |
| `jobs` | `id, name, laborTypeId, isActive, uuid` | Client work items (`laborTypeId` is a legacy index — per-job rates now live in `laborRates`); optional `clientName` field |
| `entries` | `id, jobId, laborTypeId, punchIn, punchOut, uuid` | Time records; optional `notes` (string) field |
| `deletions` | `uuid, deletedAt` | Delete **tombstones**: when an entry is removed it is hard-deleted from `entries` (so every view/analytics/export query is unaffected) and its `uuid` is recorded here with a `deletedAt` timestamp, so cloud merge propagates the deletion across devices instead of the entry resurrecting from a peer's snapshot. Use `deleteEntry(id)` (in `db.js`) to delete an entry — never `db.entries.delete` directly. |

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
| `accentColor` | hex string | `"#1f6feb"` |
| `hapticFeedback` | boolean | `true` — vibration on navigation/punch actions; toggle shown only on phones |
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

---

## Theming

Themes are controlled via CSS custom properties defined in `src/index.css`.

- **Dark mode:** variables set on `:root`
- **Light mode:** variables overridden under the `.light` class on `<html>`
- Theme is resolved in `App.jsx`: `"auto"` tracks `prefers-color-scheme` via a `matchMedia` listener; `"light"` / `"dark"` override explicitly
- Default theme is `"auto"` — new installs follow the OS without any user action
- Use `var(--text-primary)`, `var(--bg-secondary)`, etc. in custom CSS; use Tailwind for layout and spacing

### Color Conventions

- **Accent:** `appAccent` / `text-appAccent` tokens — active nav, buttons, highlights (user-configurable; defaults to `#1f6feb`)
- **Stop/end actions:** red (`red-500`, `red-600`) — punch-out buttons and other irreversible-but-non-destructive actions; also used for destructive confirmations
- **Labor type colors:** 9 preset hex values defined in `JobsView.jsx` (`#6366F1 #F59E0B #22C55E #3B82F6 #EF4444 #EC4899 #8B5CF6 #14B8A6 #F97316`) + custom picker via `ColorPicker.jsx`; stored as hex strings in the `laborTypes` table

### Typography & Fonts

The UI uses Google's **Noto** type family, mapped to Tailwind tokens in `tailwind.config.js`:

| Tailwind class | Family | Use |
|---|---|---|
| `font-sans` | Noto Sans | Default body / UI text |
| `font-display` | Noto Sans Display (falls back to Noto Sans) | Headings, the brand wordmark |
| `font-mono` | Noto Sans Mono | Timers / numerals |

- The fonts are **loaded from the Google Fonts CDN** via the `<link>` in `app/index.html` — they are **not** self-hosted or committed. The repo redistributes no font binaries.
- All three Noto families are licensed under the **SIL Open Font License 1.1**. The license text lives at `docs/licenses/OFL-1.1.txt`, and `docs/THIRD-PARTY-LICENSES.md` records the attribution and how the fonts are used. If you ever switch to self-hosting (committing the binaries), the OFL then requires shipping that license alongside them — it already is.
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
| `bg-appAccent` / `text-appAccent` | `--accent-rgb` | `#1f6feb` (user-configurable) | same |

Two additional CSS variables exist in `index.css` but have **no Tailwind token** — use them via `var()` in CSS files or Recharts style props only, not via Tailwind utilities:

| CSS variable | Dark | Light | Use |
|---|---|---|---|
| `--text-secondary` | `#E2E8F0` | `#374151` | secondary labels, axis text |
| `--text-darker` | `#4B5563` | `#9CA3AF` | tertiary/dimmed text |

The accent color is stored as a hex string in the `accentColor` setting. `App.jsx` converts it to space-separated RGB values and writes them to `--accent-rgb` on the root element. The Tailwind token uses `rgb(var(--accent-rgb) / <alpha-value>)` so opacity modifiers like `bg-appAccent/30` work correctly. **Never use hardcoded `amber-*` Tailwind classes** — always use `appAccent` so the user's chosen color is respected.

In JSX, use Tailwind token classes rather than raw hex values or inline `var()` calls — except for `--text-secondary` and `--text-darker` which have no token. `color-scheme: dark/light` is set on `:root`/`.light` in `index.css` so browser-native controls (date/time pickers, caret, scrollbars) render in the correct scheme.

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

**Centered reading-modal variant.** Long-form content dialogs — `ChangelogModal`, `LicenseModal` — are the exception: they are always centered (`max-w-lg`, `max-h-[80vh]` with internal scroll) rather than platform bottom-sheets. They still require the full a11y contract (`role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, Escape) **and** must close on the device Back gesture by pushing a `{ modal: true }` history entry on open and dismissing on `popstate` (unwinding the entry on close). Use these two as the reference when adding another content/reading modal.

### Navigation

Navigation is **tab-based state** in `App.jsx`, not URL routing. The active tab is a string (`"timer"`, `"jobs"`, `"timesheets"`, `"analytics"`, `"settings"`). Do not introduce a router without explicit agreement.

`App.jsx` integrates the **History API** so the device Back button/gesture moves between tabs instead of leaving the installed app: each tab change pushes a `history` entry tagged `{ piView }`, and a `popstate` listener restores the view. This is deliberately lightweight (no router). Modals push their own `{ modal: true }` history entry on top, so closing a modal with Back composes cleanly with tab history.

`SettingsView` adds a second, in-view layer of the same scheme: it is an **iOS-style drill-in** (a root list of `CategoryRow`s → `Panel` sub-pages) rather than URL routing. Opening a sub-page pushes a `{ settingsPanel }` entry; the in-page Back affordance and the device Back both `popstate` back to the root list. App.jsx's handler ignores states without `piView`, so this composes. Re-tapping the already-active **Settings** tab dispatches a `pi:reselect-tab` window event that `SettingsView` listens for to unwind to its root list (matching device Back).

### Time Utilities

Always use `src/utils/time.js` helpers rather than inline date math:

- `formatElapsed(ms)` → `"HH:MM:SS"` for live timers
- `formatDurationHM(ms)` → `"Xh Ym"` for summaries
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
2. **New setting?** Add key to `db.js` initializer, document it in the settings table above, and add it to the `factoryReset` function in `SettingsView.jsx` so it resets correctly. Destructive data actions belong in the collapsible **Danger Zone** section, not in the main Data section.
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
