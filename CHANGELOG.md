# Changelog

All notable changes to PunchIn are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
- **Labor type archive / restore** — Labor types can be archived (replacing hard deletion). Archived types are hidden from all dropdowns but retained for historical accuracy; a restore button brings them back.
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
