# Changelog

All notable changes to PunchIn are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.11.3] — 2026-06-02

### Fixed
- **Settings — "Check for updates" no longer gets stuck.** When a check found a new version, the button greyed out and couldn't be tapped to apply it (you had to leave Settings and come back). It now re-enables immediately so you can tap "Update available" to reload into the new version.

---

## [0.11.2] — 2026-06-02

### Fixed
- **Install — correct guidance in non-Safari iOS browsers.** Chrome, Firefox, and Edge on iPhone/iPad can't add web apps to the home screen — only Safari can — but the install prompt previously showed them the Safari-only "Add to Home Screen" steps, which lead nowhere there. Those browsers now get the right instruction: open the page in Safari first.

### Changed
- **Install — platform-aware prompts.** On desktop the install prompt no longer says "Add to Home Screen" (it installs as an app window), and the first-run install nudge now appears only on phones/tablets; on desktop the install option remains available in Settings.

---

## [0.11.1] — 2026-06-02

### Changed
- **Appearance — the browser-tab icon now follows your accent color.** The favicon is rendered live from your chosen accent, so the tab icon matches the in-app logo. (The installed home-screen icon stays the fixed brand mark — platforms bake that at install time and it can't track the accent.)

---

## [0.11.0] — 2026-06-02

### Added
- **Install — first-run install nudge** — After you've opened PunchIn a couple of times, a dismissible bottom sheet now offers to add it to your home screen. On Chrome/Edge it triggers the real one-tap install; on iOS Safari it shows the Share → Add to Home Screen steps (no install API exists there). Dismiss once and it won't ask again.
- **Settings — always-available install entry** — The Settings "Install" section is now shown on every supported platform: a one-tap install button on Chrome/Edge, expandable Share-sheet instructions on iOS, and an "Installed" confirmation once the app is added to the home screen.

### Fixed
- **Install — PWA install option missing on Android/desktop Chrome** — The web app manifest referenced `icon-192.png` and `icon-512.png`, but those files were never present, so the icon URLs returned 404. Chrome treats valid icons as an installability requirement, so it silently withheld both the install prompt and the "Install app" menu item — leaving no way to install the app. The icon set now ships (standard 192/512, a maskable 512 for Android adaptive icons, and an iOS `apple-touch-icon`), restoring the install option. ([#55](https://github.com/PunchIn-App/punchin/issues/55))

---

## [0.10.0] — 2026-06-02

### Added
- **Settings — Cloud Sync** — Sync your time-tracking data across devices using your choice of **GitHub Gist** (private), **Google Drive** (hidden app folder), or **OneDrive** (App Folder). Connect via OAuth, tap **Sync Now** to pull remote data and push a fresh snapshot. New entries from other devices are merged in using the same deduplication logic as the existing JSON import; no manual conflict resolution needed.
- **Settings — Sync token expiry** — Google and OneDrive implicit-flow tokens expire after ~1 hour. When a token expires, the Sync section shows a "Token expired — reconnect" prompt and disables the Sync Now button until the user re-authenticates.
- **Settings — Factory Reset** — Now clears all sync credentials (`syncProvider`, `syncToken`, `syncTokenExpiry`, `syncFileId`, `lastSyncedAt`, `syncError`) alongside all other data.
- **Infrastructure — GitHub OAuth Worker** — A Cloudflare Worker (`worker/oauth.js`) handles the GitHub OAuth server-side code→token exchange (GitHub does not support PKCE for OAuth Apps). All other routes fall through to static assets. The GitHub client secret is stored as a Cloudflare Worker secret and never embedded in the client bundle.

### Changed
- **Infrastructure — Cloudflare Worker** — `wrangler.jsonc` now sets `"main": "./worker/oauth.js"` and adds an `ASSETS` binding so the single Worker handles both OAuth callbacks and static asset serving.

---

## [0.9.0] — 2026-06-02

### Added
- **Settings — Install prompt** — "Add to Home Screen" row appears automatically when the browser offers a native install prompt (Android, desktop Chrome/Edge). Hides itself once the user installs the app. iOS does not surface this event; no row is shown there.
- **Settings — Passive update indicator** — "Check for updates" button now changes label to "Update available — tap to reload" and highlights in accent color as soon as a new service worker finishes installing, without any manual action required.
- **Layout — Update badge** — A red dot appears on the Settings nav icon when an update is waiting, so users notice it from any view.

### Changed
- **PWA — Update strategy** — Switched from `autoUpdate` to `prompt` mode. The app now controls when updates are applied; a new service worker parks in the waiting state rather than causing a surprise mid-session reload.
- **PWA — Service worker wiring** — `main.jsx` now explicitly registers the service worker via `virtual:pwa-register` with `onNeedRefresh` and `onOfflineReady` callbacks. State (update availability, install prompt) is shared app-wide through a new `src/utils/pwa.js` module using window events.
- **Settings — Check for updates** — Clicking the button when no update is known now calls `reg.update()` and waits up to 2.5 s for `onNeedRefresh` to fire before reporting "Already up to date" — replacing the old 400 ms race that could miss slow network fetches.
- **Repo — Config directory** — `postcss.config.js` and `tailwind.config.js` moved to `config/`. `wrangler.jsonc` stays at root (Cloudflare's Git integration requires it there). Deploy is now `npm run deploy` (builds then calls `wrangler deploy`).
- **Repo — GitHub directory** — `CONTRIBUTING.md` and `CLA.md` moved to `.github/` where GitHub resolves them natively as community health files.
- **README — Screenshots** — Tablet and desktop screenshots collapsed under a `<details>` block; all 20 screenshot `alt` attributes rewritten to describe visible UI rather than just naming the tab.
- **README — Features** — Each feature subsection collapsed under a `<details>/<summary>` block for scannability without full-page scroll.

### Fixed
- **Accessibility — Reduced motion** — CSS animations and transitions (`animate-pulse`, `animate-bounce`, `animate-spin`, theme transitions) now pause for users who have `prefers-reduced-motion` enabled in their OS.
- **Accessibility — Archive buttons** — "Archived (N)" expand/collapse buttons in Jobs view now carry `aria-expanded` so screen readers announce open/closed state correctly.
- **Mobile — Tap delay** — `touch-action: manipulation` applied globally to buttons, links, and interactive roles, eliminating the 300 ms double-tap-to-zoom delay.
- **Mobile — Number inputs** — Spin buttons (`+`/`−` steppers) hidden on hourly-rate number inputs; they were too small to tap accurately on mobile.
- **iOS — Status bar color** — `<meta name="theme-color">` now updates dynamically when the user switches themes; the status bar background no longer stays dark in light mode.

---

## [0.8.0] — 2026-06-02

### Changed
- **Settings — Accent color** — Default accent for new installs changed from amber (`#F59E0B`) to blue (`#1f6feb`). Preset swatches updated: Blue is now the first option, Amber moves to second, Sky (`#38BDF8`) removed.

### Fixed
- **Jobs — Archived folder toggle** — Chevron icons in the "Archived (N)" expand/collapse buttons are now hidden from screen readers, preventing duplicate announcements alongside the button label.
- **Settings — Import data** — The hidden file input now carries an accessible label so screen readers can identify it correctly.

---

## [0.7.0] — 2026-06-02

### Added
- Settings — "Report a bug" button in the About section opens a pre-filled GitHub issue with app version, install type (PWA or browser tab), browser, OS, and device auto-detected from the current session. Users only need to describe what happened and the steps to reproduce.

---

## [0.6.6] — 2026-06-02

### Changed (UI Polish)

- **Analytics responsive layout** — "Hours by job" and "By Labor Type" charts now sit side by side on tablet and desktop (`lg:` breakpoint) instead of stacking in a single column with a large void below. On mobile they continue to stack vertically.
- **Consistent chart colors** — "Hours by job" bar color changed from hardcoded indigo (`#6366F1`) to the user's chosen accent color, matching the daily bar chart and making all three Analytics charts visually coherent.
- **Stop button styling** — The Stop button on active timer cards is now red-tinted at rest (`bg-red-500/10`, `text-red-400`, red border) rather than plain gray, so its destructive intent is legible before hover without being visually alarming.
- **Desktop max-width constraints** — Timer view (max 896 px), Jobs view (max 672 px), Settings view (max 672 px), and Analytics view (max 1280 px) are now centered at a comfortable reading width on large displays rather than stretching to fill 1920 px.
- **Donut chart stability** — The labor-type `<figure>` element is given explicit `w-[100px] h-[100px]` so it never collapses in a flex context, preventing the SVG from rendering as a degenerate line.

---

## [0.6.5] — 2026-06-02

### Fixed (Accessibility & Usability)

**Critical accessibility**
- All three modals (`StartTimerModal`, `EditEntryModal`, `InvoiceModal`) now carry `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, a keyboard focus trap (Tab cycles inside the dialog), and an Escape key handler. Focus moves to the first interactive element when a modal opens.
- All icon-only buttons now have explicit `aria-label` values — edit, archive, restore, delete, stop, close, period-nav chevrons, export/print/invoice toolbar buttons, and filter selects.
- All `<label>` elements in modals and job/labor-type forms are linked to their controls via `htmlFor`/`id` pairs (using `useId()` for uniqueness within each form instance).
- The live elapsed timer has `role="timer"` and `aria-live="off"` with a descriptive `aria-label`; inline form errors use `role="alert"`.
- All three Recharts charts in the Analytics view are wrapped in `<figure role="img" aria-label="…">` with visually-hidden `<table>` fallbacks so screen readers can access the underlying data.

**Serious accessibility**
- The Toggle component now has `role="switch"` and `aria-checked` so screen readers announce on/off state. Both settings rows pass an `ariaLabel` prop.
- Icon button touch targets increased to a minimum of `p-2 min-w-[40px] min-h-[40px]`.
- Resting icon button color changed from `text-appTextDisabled` to `text-appTextMuted` on active controls, improving contrast to ~3.4:1 (passes WCAG 1.4.11 for UI components).
- `window.confirm()` replaced with a new accessible `ConfirmModal` component in all three locations (Edit Entry delete, Timesheets delete, Settings → Clear entries). The modal has its own focus trap and defaults focus to Cancel for destructive-action safety.
- Filter selects in Timesheets gained `aria-label`; the search field became `type="search"` with `aria-label`.

**Moderate accessibility**
- Tab bars (Jobs, Timesheets) now have `role="tablist"` + `role="tab"` + `aria-selected`.
- Bottom navigation has `aria-current="page"` on the active item and `focus-visible:ring` for keyboard visibility.
- Global `:focus-visible` rule added to `index.css` so all interactive elements show an accent-colored keyboard focus ring.
- All text inputs/selects updated from `focus:border-*` (invisible in dark mode) to `focus:ring-2 focus:ring-appAccent/50`.
- Decorative icons inside labeled buttons/links marked `aria-hidden="true"`.
- Accent color swatches and labor-type color pickers gained `aria-label`, `aria-pressed`, and `role="group"` on their containers. Swatch sizes increased from `w-6`/`w-8` to `w-8`/`w-9`.
- Danger Zone toggle has `aria-expanded`.
- Printed HTML output (invoice, timesheet) now includes `lang="en"`.
- `useHapticFeedback` now uses `useId()` to ensure the hidden iOS switch element never has a duplicate `id`.

**Usability**
- The stop button on TimerCard relabeled from "Out" to "Stop" to remove ambiguity with "log out".
- `StartTimerModal` now tracks a `submitting` state — the Punch In button is disabled and shows "Starting…" during the async write to prevent accidental double-submit.

---

## [0.6.0] — 2026-06-02

### Added
- **Accent color theming** — A new color swatch picker in Settings → Appearance lets you choose the app-wide highlight color from 6 presets: Amber (default), Orange, Lime, Teal, Sky, and Pink. The selection takes effect instantly across every component — nav, toggles, buttons, active states, and the analytics bar chart. Implemented via `--accent-rgb` CSS variable and an `appAccent` Tailwind token; hardcoded amber is fully replaced throughout.
- **Hourly rates on jobs** — Each job now has a collapsible **Hourly rates** section in the job form (Jobs tab → Add/Edit Job). Set a rate per labor type ($/hr). Rates are stored directly on the job record (`laborRates` object) — no schema migration required.
- **Invoice generator** — A new **Invoice** button in the Timesheets toolbar opens the invoice modal. Select a job and period (This week, Last week, This month, Last month, or Custom date range), then view a line-item table showing date, labor type, time range, hours, rate, and amount per entry. The totals row sums hours and, when rates are configured, the billed amount.
- **Invoice CSV export** — The invoice modal has an **Export CSV** button that downloads an invoice-formatted spreadsheet (header with job/client/period, line items, totals row).
- **Invoice print / PDF** — The invoice modal **Print / PDF** button generates a clean invoice document in a new browser window and triggers the system print dialog. Choosing "Save as PDF" in the print dialog produces a PDF without any extra dependencies.
- **Timesheet CSV export** — A **CSV** button in the Timesheets toolbar exports the current day or week as a spreadsheet (Date, Job, Client, Labor Type, Start, End, Duration, Notes). A separate **Export CSV** button in Settings → Data downloads all completed entries across all time.
- **Timesheet print / PDF** — A **Print** button in the Timesheets toolbar generates a print-optimized timesheet (with labor type color badges, duration totals) in a new window and triggers the system print dialog.

### Changed
- **Accent color replaces hardcoded amber** — All `amber-*` Tailwind classes replaced with the `appAccent` token so every UI element responds to the user's chosen accent color.
- **Factory Reset now restores accent color default** — The reset in Settings → Danger Zone also restores `accentColor` to `#F59E0B` (amber) alongside the other settings defaults.

---

## [0.5.0] — 2026-06-02

### Added
- **Last session card** — When no timers are running the Timer view now shows a muted "Last Session" card displaying the most recently completed entry (job, labor type, time range, and duration), so your previous work is always visible at a glance.

### Changed
- **Logo navigates home** — Tapping the PunchIn logo in the header navigates back to the Timer view from any tab.
- **Danger Zone is now collapsible** — The destructive data actions (Clear time entries and Factory Reset) are hidden behind a collapsible "Danger Zone" section header in Settings. The panel is collapsed by default so these actions can no longer be triggered accidentally. Both buttons still require confirmation steps once expanded.
- **Starting a new timer with concurrent timers off** — Previously punching in while a timer was already running (with concurrent timers disabled) showed an error and blocked the action. The app now automatically punches out any running timers and immediately starts the new one.
- **Check for updates** — The button in Settings > About now shows a spinner while checking and reports "Already up to date" if no new service worker is waiting, instead of always reloading.

### Fixed
- **Light mode text contrast** — The version string in the header and inactive bottom-nav icons were using `text-appTextDisabled` (`#D1D5DB` in light mode), which was nearly invisible against the white nav background. Both now use `text-appTextMuted` (`#6B7280`).
- **Toggle button border visibility** — The off-state toggle border was `border-appBorder` (`#2A2F45`) on `bg-appInput` (`#1E2232`) — too low contrast to see in dark mode. Border is now `border-2 border-gray-500/60`, clearly visible in both themes.
- **External link icon contrast** — The `ExternalLink` icons in the About section were using `text-appTextDisabled`, which is invisible in light mode. Now use `text-appTextMuted`.

---

## [0.4.0] — 2026-06-02

### Added
- **Platform detection** — New `usePlatformContext()` hook detects whether the app is running as an installed PWA (`display-mode: standalone` / iOS `navigator.standalone`) and the host OS (`ios` | `android` | `web`).
- **iOS safe-area insets** — When installed on iPhone/iPad, `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` are applied to the header and bottom nav so the UI never clips into the Dynamic Island, notch, or home indicator. `viewport-fit=cover` added to `index.html` as the required prerequisite.
- **Platform-native bottom sheets** — `StartTimerModal` branches its mobile sheet style based on OS:
  - *iOS standalone*: translucent scrim (`backdrop-blur-md`), grabber pill, swipe-down-to-dismiss gesture (80 px threshold).
  - *Android standalone*: Material Design 3 28 px top corner radius, 48 dp accessible drag handle, hardware back-button dismiss via `popstate` listener (prevents exiting the PWA on back press).
  - *Browser tab / desktop*: original behavior unchanged; `sm:` centered-dialog layout preserved on all platforms.
- **Haptic feedback** — New `useHapticFeedback(os)` hook routes to the correct engine per platform: Android uses `navigator.vibrate(40)`; iOS uses the WebKit switch polyfill (hidden `<input switch>` toggled via label click to fire the Taptic Engine); web is a no-op. Haptic fires exactly at gesture-dismissal threshold on swipe and on `popstate` for back-button.

---

## [0.3.0] — 2026-06-01

### Added
- **Factory Reset** — Settings > Danger Zone wipes all entries, jobs, labor types, and settings in two steps: a "Continue" confirmation followed by a final "Yes, wipe everything" confirmation. Settings defaults are restored after the reset.
- **Changelog link** — Settings > About now has a direct link to this file on GitHub.
- **Check for updates** — Settings > About has a button that triggers a service-worker update check and reloads the page, so users can pull the latest deployed version without clearing the cache manually.
- **GitHub link in About** — Tapping the PunchIn row in Settings > About opens the repository in a new tab.
- **Searchable archived folder** — Expanding the "Archived" section in Jobs or Labor Types reveals a live search input that filters archived items by name.

### Changed
- **Zero-state default** — Fresh installs now start with no jobs or labor types. Previously four labor types were seeded automatically.
- **Archived items are now hidden by default** — Active and archived records are separated. Archived jobs and labor types appear in a collapsed "Archived (N)" disclosure section at the bottom of each tab, keeping the main list clean.
- **Archive-only UX for jobs** — The delete button has been removed from job rows. Archiving is the only way to hide a job from the active list; archived jobs can be restored at any time. Historical entries always retain their references.
- **Nav label** — The bottom-nav label for the Timesheets tab was renamed from "Sheets" to "Timesheets" to match the view name.
- **Manual entry layout** — The Add/Edit Entry modal now puts each date and time field on its own full-width row (Start Date → Start Time → End Date → End Time), replacing the confusing two-column grid that put "Start Time" and "End Date" side by side. Modal height increased to 85 vh.

### Fixed
- **Dark mode input text** — Custom Tailwind color tokens (`bg-appBg`, `text-appText`, etc.) were not generating any CSS because they were missing from `tailwind.config.js`. Inputs fell back to white browser defaults with near-white inherited text, producing invisible text in dark mode. Tokens are now properly mapped to CSS custom properties.
- **Light mode toggle visibility** — The toggle track (`bg-appInput`) was barely distinguishable from the card background in light mode. Toggles now have an explicit border (`border-appBorder` when off, `border-amber-500` when on).
- **Browser-native form controls** — Added `color-scheme: dark` / `color-scheme: light` to `:root` and `.light` so date/time pickers, carets, and scrollbars render in the correct color scheme.

---

## [0.2.0] — 2026-06-01

### Added
- **Light / Dark / Auto theme** — Dynamic theme switching via CSS custom properties. "Auto" follows the OS `prefers-color-scheme` setting; users can override to force light or dark mode.
- **Timesheet CRUD** — Edit (pencil) and Delete (trash) actions on individual time entries in both the daily and weekly timesheet views.
- **Manual entry creation** — "Log Manual" button on the Timesheets page lets users add past time entries without punching in.
- **Active timer adjustments** — Start time of a running timer can be edited inline from the Timer view.
- **12-hour timer warning** — Timers running longer than 12 hours display an animated warning badge.
- **Timesheet search & filters** — Case-insensitive text search and per-job / per-labor-type filter dropdowns that dynamically adjust duration aggregates.
- **Labor Types archive / restore** — Labor Types can be archived (replacing hard deletion). Archived types are hidden from all dropdowns but retained for historical accuracy; a restore button brings them back.
- **Vitest test suite** — 87 tests covering time utilities, `EditEntryModal` date/time helpers, import deduplication logic, and the concurrent-timer guard in `StartTimerModal`.
- **README** — Full product introduction with screenshots across phone, tablet, and desktop, feature descriptions, tech stack table, data model, and contributing guide.
- **CLAUDE.md** — AI-assistant guide covering stack, repo structure, Dexie schema, data flow, theming conventions, and feature checklist.

### Changed
- **Soft job deletion** — Jobs are now hidden via `isActive: false` (archive) rather than being hard-deleted, preserving all historical time entries.

### Fixed
- **Timesheets edit handler crash** — `onEdit` was wired to an undefined `handleEdit` function in both `DailySheet` and `WeeklySheet`, crashing the component on load. Corrected to `setEditingEntry`.

---

## [0.1.0] — initial

### Added
- **Punch in / out** — Tap to start a live timer on any job; tap again to punch out. Each active timer shows elapsed time, job name, labor type, and start time, updated every second.
- **Concurrent timers** — Optional setting allows running multiple timers simultaneously across different jobs.
- **Job management** — Create, edit, and organize jobs by client name and default labor type.
- **Labor type categories** — Color-coded billable categories (e.g., Development, Design, Consulting) assignable to jobs and individual time entries.
- **Timesheets** — Daily and weekly views with period navigation, duration totals, and per-job breakdowns.
- **Analytics** — 7-day and 30-day dashboards: daily hours bar chart, hours-by-job horizontal bars, and a labor-type donut chart. Powered by Recharts.
- **JSON export / import** — Download a full backup of all data; restore from a backup with smart deduplication to prevent duplicate entries.
- **IndexedDB storage** — All data stored locally via Dexie; nothing ever leaves the device.
- **PWA** — Installable to home screen, works fully offline. Auto-update strategy via `vite-plugin-pwa`.
- **Cloudflare Workers hosting** — Static assets served globally via `wrangler`.
