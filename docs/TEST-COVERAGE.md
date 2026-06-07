# PunchIn — Test Coverage

> **Canonical home for the per-file test-coverage table**, extracted from `CLAUDE.md`. **Consult this before adding or changing tests** to see what's already covered, and **add a row here when you add a new test file.** When adding new behaviour to any source file, add a test alongside it. (`CLAUDE.md` → Documentation Maintenance points back to this file.)

## Current test coverage

| File | What's tested |
|------|---------------|
| `src/utils/time.test.js` | All helpers: `formatElapsed`, `formatDurationHM`, `formatDecimalHours`/`formatDuration` + `roundEntry` (issue #208: favour-rounding the 8:07→8:00 / 8:20→8:30 example, half-hour, exact-boundary no-op, off, still-running, seconds-ceil), `getEntryDuration`, `formatTime`, `formatDate`, `getDayRange`, `getWeekRange`, `getWeekDays`, `isEntryInRange`, `sumDurations` |
| `src/utils/pwa.test.js` | `getInstallPrompt`, `notifyUpdateAvailable`, `setPwaUpdateFn`, `applyUpdate`, `initPwaInstallPrompt`, `hasWaitingUpdate` (reg.waiting detection) |
| `src/utils/favicon.test.js` | `drawFaviconDataUrl` (accent color, null-context fallback), `updateFavicon` (link creation, static-link replacement, idempotent updates) |
| `src/iconPalette.test.js` | Install-icon palette (issue #228): every preset is an exact swatch, `nearestPaletteKey` snaps presets to themselves / near colours close / always returns a generated key, `paletteKey` normalisation, palette density |
| `src/utils/installIcon.test.js` | `applyInstallIcon` (issue #228): points `<link rel="manifest">` at a preset's static set or the worker exact-render route for a custom colour, sets an exact data-URL `apple-touch-icon`, reuses the existing manifest link rather than duplicating |
| `worker/oauth.test.js` | Security headers + GitHub OAuth exchange paths; accent-icon routes (issue #228): dynamic manifest (no render), exact-colour PNG render (size + maskable), `nearestSwatchPath` fallback, invalid-hex pass-through to ASSETS |
| `src/utils/notifications.test.js` | `notificationsSupported`, `notificationPermission`, `requestNotificationPermission`, `showNotification` (permission gate, SW-registration path, constructor fallback) |
| `src/utils/reminders.test.js` | `parseHHMM`, `dayKey`, `dayAllowed`, `evaluateReminders` (gating, long-running threshold crossing/de-dup/cleanup, idle/still-running/daily/weekly time-of-day rules, day-of-week gating + back-compat when day arrays absent) |
| `src/utils/transfer.test.js` | `encodeSnapshot`/`decodeSnapshot` round-trip (gzip + raw), error paths (empty/bad flag/corrupt/non-PunchIn), `buildShareUrl`, `parseImportCode`, `parseImportFromHash` |
| `src/utils/deviceId.test.js` | `getDeviceId` — generates 8-char hex, persists across calls, falls back to `'default'` when localStorage is unavailable |
| `src/utils/printDocument.test.js` | `PRINT_FONT_HEAD` (loads the three Noto webfonts); `openPrintWindow` — waits for `document.fonts.ready` before printing, falls back to a timed print when `document.fonts` is absent, returns `false` without throwing when the popup is blocked |
| `src/utils/inkOnAccent.test.js` | `readableInk` — white on dark/saturated accents, dark ink (`#0F1117`) on light/pastel accents (matches the design reference tiles), `#`/case tolerant |
| `src/iconSvg.test.js` | `iconSvg` — draws the stopwatch body + crown (not the old clock polyline), tints the glyph via the contrast guard (white on dark accent, ink on light), fills the tile with the accent |
| `src/components/TimerRail.test.jsx` | Desktop Timer rail — renders "This week" once entries load, lists only active jobs for quick punch + calls `onPunch` on click, renders the last session when provided |
| `src/components/LaborGlyph.test.jsx` | `glyphComponent` (Tag fallback for unknown ids), `LaborTag` (glyph + name + `aria-label`, renders nothing without a type), `LaborGlyphChip` (renders with color/glyph fallbacks), curated `LABOR_GLYPH_IDS` |
| `src/utils/format.test.js` | `formatMoney` (USD default, other ISO currencies, empty for null/NaN, no-throw fallback on an invalid/empty code); `currencySymbol` (symbol + no-throw on bad code) |
| `src/utils/image.test.js` | `fileToLogoDataUrl` — downscales via canvas to a PNG data URL; falls back to the raw data URL when canvas 2D is unavailable or the image can't be decoded |
| `src/views/settings/BillingPanel.test.jsx` | Edits a billing-profile field, changes the default currency, reveals the prefix/next-number inputs only when numbering is on, toggles "Number invoices" |
| `src/views/settings/components.test.jsx` | `WeekdayPicker` display order vs stored value (Monday-first display still stores absolute indices; Sunday-first when off); `PanelGroup` opt-in collapse (hidden when `defaultCollapsed`, reveals on click; renders directly when not collapsible) |
| `src/db.test.js` | Schema validation, default settings seed (41 keys incl. the sync + billing keys seeded as null, the per-reminder weekday defaults = all 7 days, and the time-display defaults `decimalHours`/`roundingMinutes`; matches `DEFAULT_SETTINGS`), indexed `punchIn` range queries (`between`/`aboveOrEqual`, issue #132), `deleteEntry` tombstones, basic CRUD for jobs/labor types/entries |
| `src/hooks/useSettings.test.js` | Loading state, settings object, `updateSetting` (boolean and string values) |
| `src/hooks/usePlatformContext.test.js` | OS detection (iOS/Android/desktop), `isIOSSafari` (Safari vs CriOS/FxiOS/EdgiOS), `isIPad` incl. desktop-mode iPad (touch-capable "Macintosh" → iOS) vs real Mac, standalone mode detection |
| `src/hooks/useHapticFeedback.test.jsx` | `hapticEl` JSX for iOS / null for others; `trigger` routes vibrate/label-click/no-op by platform |
| `src/hooks/useReminders.test.js` | fires a notification when an enabled reminder condition is met; no-ops when reminders disabled or permission not granted |
| `src/hooks/useInstallPrompt.test.js` | `canInstall`/`isInstalled` state from `pwa:install-ready`/`pwa:installed`; `promptInstall` accept/dismiss outcomes |
| `src/components/ChangelogModal.test.jsx` | Render, markdown parsing, close button/Escape/backdrop, focus trap, device-Back (popstate) dismiss |
| `src/components/LicenseModal.test.jsx` | Dialog a11y, default app-license (BUSL) tab, switch to third-party (aria-pressed), close button/Escape/backdrop, device-Back (popstate) dismiss |
| `src/components/InstallPromptModal.test.jsx` | All three modes (native / ios-safari / ios-other), dialog a11y, Install/Not-now/Got-it/Escape/backdrop |
| `src/components/ColorPicker.test.jsx` | Preset swatches, custom hex picker, `aria-pressed`, Escape close |
| `src/components/ConfirmModal.test.jsx` | Render, `onConfirm`/`onCancel`, Escape/backdrop, focus management, unique title id per instance (#156) |
| `src/hooks/useFocusTrap.test.jsx` | Initial focus (first / `[data-autofocus]` / `opts.initialFocus`), Escape→onClose, focus restoration on unmount (#152), focus pulled back into the dialog on Tab (#154) |
| `src/components/DataTransfer.test.jsx` | Share-link + QR generation, "Includes N jobs/entries" summary, import junk rejection, end-to-end import of a real encoded link with count (issue #77) |
| `src/components/EditEntryModal.test.jsx` | Add/edit/active-timer modes, validation, save/delete flows, keyboard |
| `src/components/EditEntryModal.helpers.test.js` | `formatDateToYYYYMMDD`, `formatTimeToHHMM`, `combineDateAndTime` |
| `src/components/ErrorBoundary.test.jsx` | Children render, fallback UI on throw, "Try again" reset |
| `src/components/InvoiceModal.test.jsx` | Line-item calc, period presets, CSV export, print, empty state, billable rounding (issue #208) |
| `src/components/Layout.test.jsx` | Logo button, nav items, `aria-current`, tab callbacks |
| `src/components/StartTimerModal.test.jsx` | Render, form validation, concurrent-timer guard |
| `src/components/TimerCard.test.jsx` | Job/labor-type display, stop timer, open/close EditEntryModal |
| `src/views/AnalyticsView.test.jsx` | Loading state, period toggle, summary cards, empty state, charts |
| `src/views/JobsView.test.jsx` | Jobs and labor types tabs, full CRUD, archive/restore |
| `src/views/SettingsView.test.jsx` | Drill-in root list + sub-pages, device-Back/Settings-tab-reselect returns to root, Data & Sync consolidation, toggles, theme, export/import, sync UI, danger zone, About rows (help-improve, License modal, Support link) |
| `src/utils/issueUrl.test.js` | `buildBugReportUrl` + `buildFeatureRequestUrl` (template/scope/URL) — browser/OS/device/install-type detection |
| `src/utils/backup.test.js` | `exportBackup` JSON shape (version + 3 tables); `exportCsv` header + skips running entries |
| `src/hooks/usePwaUpdate.test.js` | Initial state from window flag, `pwa:update-ready` event, on-mount `reg.waiting` re-surface (#57), apply-when-available, no-registration "latest" path |
| `src/views/SettingsView.syncUnconfigured.test.jsx` | Sync section with empty client IDs: friendly "not set up" message, no env-var jargon, no provider buttons (issue #59) |
| `src/views/SettingsView.haptics.test.jsx` | `hapticFeedback` toggle shown on iPhone/Android, hidden on iPad (no vibration motor) and web, toggles the setting (issue #65) |
| `src/views/SettingsView.reminders.test.jsx` | Reminders section (issue #54): unsupported message, master toggle requests permission + gates the setting on grant/deny, per-reminder options render when enabled, minutes input + sub-toggles, per-reminder `WeekdayPicker` (renders, toggling a day, clearing the last day turns the reminder off + restores all days) |
| `src/views/settings/LongRunningMinutesInput.test.jsx` | Long-running threshold 24h wheel (issue #111): splits the stored minutes across two ARIA spinbutton wheels, steps hours by 1 / minutes by 5 via arrow keys, snaps an off-grid value, caps minutes at 55, **carries minutes into the hour** (55→00 = +1h) and **borrows back** (00→55 = −1h), **flips the hour live mid-spin** (scroll event before settle, no commit yet), wraps the hours (23→0) wheel, turns the reminder off at 0h 0m |
| `src/views/settings/RemindersPanel.test.jsx` | Reminders panel local-delivery messaging (issue #112): explains reminders are local and a fully closed app can't alert at an exact time, no longer implies installed-but-closed delivery, hides the note until reminders are enabled |
| `src/views/settings/GeneralPanel.test.jsx` | Time display & billing controls (issue #208): toggles decimal hours, reflects the current state, sets the rounding increment from the select, defaults to Off |
| `src/views/TimerView.test.jsx` | Empty state, active timers, last session, punch-in modal |
| `src/views/TimesheetsView.test.jsx` | Daily/weekly tabs, period nav, search/filter, CSV/print, edit/delete |
| `src/App.test.jsx` | Accent color CSS variable, theme class, default view, OAuth callbacks (incl. GitHub username fetch + Settings navigation, issue #83), first-run install nudge gating (mobile-only, ios-other mode, desktop suppression), back-button history navigation (seed/push/popstate, issue #65), transfer-link import prompt (confirm/cancel/corrupt, issue #77) |
| `src/App.integration.test.jsx` | Integration (issue #170): mounts the REAL App over real views + real Dexie (fake-indexeddb) — renders the default Timer view, then navigates the bottom nav to the real Jobs view reading seeded data; catches App↔view prop-contract drift the fully-mocked `App.test.jsx` can't |
| `src/sync/config.test.js` | `SYNC_CONFIG` shape and env-var fallbacks |
| `src/sync/oauthState.test.js` | OAuth CSRF nonce (issue #125): `createOAuthState` (32-char hex, stored, unique per call), `consumeOAuthState` (one-time use, clears, fails closed on mismatched/empty/missing) |
| `src/sync/pkce.test.js` | Auth Code + PKCE helpers (issue #128): `createPkceChallenge` (stores verifier, returns base64url S256 challenge ≠ verifier), `consumePkceVerifier` (one-time read, null when none stored) |
| `src/sync/tokenStore.test.js` | Encrypted at-rest sync token (issue #126): `setSyncToken`/`getSyncToken` round-trip, no plaintext in `secrets` + non-extractable key, `clearSyncToken`, null when empty, lazy migration of a legacy plaintext `settings.syncToken` (removes the plaintext) |
| `src/sync/providers/github.test.js` | `buildGitHubOAuthUrl`, `fetchGitHubUser`, `findExistingPunchInGist` (pagination, marker file, device prefix, legacy file), `getDeviceFilename`, `createGist` (marker + device file), `fetchAllDeviceData` (multi-device, truncated, legacy, malformed), `pushDeviceData`, `deleteDeviceFile`, `updateGist`, `fetchGist` |
| `src/sync/providers/google.test.js` | `buildGoogleOAuthUrl`, `pushToDrive` (create + update path), `pullFromDrive` |
| `src/sync/providers/onedrive.test.js` | `buildOneDriveOAuthUrl`, `pushToOneDrive`, `pullFromOneDrive` (404 → null) |
| `src/sync/syncManager.test.js` | `exportSnapshot`, `disconnectSync` (deletes device file, clears all settings incl. syncUsername), `runSync` (auth guards, per-provider dispatch, multi-device merge via `fetchAllDeviceData`, existing-gist discovery, per-device push, create with marker) |
| `scripts/check-doc-sync.test.mjs` | Doc-sync CI check (tooling): `parseVersion`, `extractFences`, `isDocumented` (node + comment-summary styles), `hasStaleNode` (ignores comment cross-refs), `isTestPathListed`, `changelogHasVersion`, `parseNameStatus`; `evaluateDocSync` rules R1–R4 (incl. patch vs minor SECURITY.md gating), bypass, missing-doc fatal errors; plus a completeness meta-test asserting every current `src/`+`worker/` file is documented in `docs/ARCHITECTURE.md` |
