# Changelog

All notable changes to PunchIn are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.31.0] — 2026-06-11

### Changed
- **Round billed time — rebuilt as per-task duration rounding (#274).** "Round billed time" now rounds each task's logged **duration** on its own, and the control offers two modes: **Nearest** (the new default — standard round-to-the-nearest ¼ or ½ hour) and **Round up** (rounds each task up so short, real-world minutes are never dropped to zero). This replaces the previous endpoint "in your favour" rounding, whose continuous-session detection relied on tasks being bit-exact back-to-back and so misfired on a normal hard cut between timers — inflating a short task's neighbours or leaving totals that didn't reconcile. Because each task rounds independently, a task switch is never double-billed, per-row hours sum exactly to the day/week total, and per-rate invoice amounts stay correct. Existing installs keep their current increment and default to **Nearest**; pick **Round up** in Settings → General if you'd rather never lose a short task.
- **Timesheets reconcile with exports for overnight shifts.** A time entry that crosses midnight is now billed wholly on the day it started — its full (rounded) duration counts on its start day rather than being split across the two days it spans. This makes the daily total, the weekly total, and the CSV / print / invoice exports all agree on the same number for that entry (previously the weekly view's total and its per-day rows could disagree by a rounding increment).

### Fixed
- **Android — the Start Timer sheet no longer dismisses itself (#276).** On an installed Android PWA with a timer already running, the punch-in sheet would close on its own a second or two after opening, making it impossible to start (or switch) a timer. The live "stats while running" ticker (v0.30.0) was re-rendering the screen behind the open sheet, which made its back-button handler re-arm each second and trip its own dismiss. The sheet now sets up its back-button handling once, so it stays open until you act on it.
- **Settings → Reminders — removed the duplicate ⓘ.** The Reminders row's info (ⓘ) popover repeated the permanent "checked on your device while PunchIn is open" notice already shown beneath it, so it's been dropped — the standing notice is the single source of that explanation.

---

## [0.30.0] — 2026-06-11

### Added
- **Timer / Timesheets / Analytics — live stats while a timer runs.** Today, This week, and Avg-per-day on the Timer home, the Timesheets totals, and the Analytics totals and charts now include the running timer's accrued time and update live, instead of staying frozen until you punch out. CSV, Print, and Invoice exports still bill completed time only, and the screen shows a notice when a running timer would make an export total less than what you see. (#265)
- **Settings — info (ⓘ) popovers.** Long setting descriptions are trimmed to one line, with the full explanation moved into a tappable ⓘ that opens a small, keyboard- and screen-reader-accessible help popover. Applied to Time format, Round billed time, Decimal hours, Concurrent timers, Reminders, Number invoices, and Theme.

### Fixed
- **Timesheets — rounding no longer over-bills back-to-back work.** With "Round billed time" on, a continuous workday split into several tasks is now rounded as one session, so the hand-off between tasks isn't rounded up on both sides. A 9.14-hour day that previously totalled 10.00 h at quarter-hour rounding now reads 9.25 h, and the per-row hours, day/week totals, CSV, print, and invoices all agree. (#274)
- **Settings — "Auto" time format follows your region more reliably.** It now reads the device locale's 12/24-hour convention (and picks up the OS 24-hour setting on Android). On iPhone the system clock setting isn't exposed to web apps — choose 12- or 24-hour explicitly to override. (#264)
- **Accessibility follow-ups** to the v0.29 remediation: keyboard focus now lands inside a dropdown when it opens (arrow keys work); the glyph picker's "More glyphs" button no longer changes the selection on an arrow key, and a glyph chosen from search stays reachable in the quick row; swipe-down-to-dismiss tolerates iOS overscroll; the sidebar status no longer briefly reads "Off the clock" while loading; and the import-result and blocked-notification messages are announced to screen readers more reliably.

---

## [0.29.7] — 2026-06-10

### Fixed
- **Final accessibility polish.**
  - **Labor-type glyphs are now legible inside their tinted chips in light mode** — the pastel icon was washing out against the near-white tint; it now darkens just enough to stay readable (≥3:1) while keeping its colour.
  - **On tablet, the side-rail "on the clock" indicator no longer relies on colour alone** — the amber dot now appears only while a timer is running (its presence, not just its hue, signals the state), and a screen-reader status text states whether you're on or off the clock.

---

## [0.29.6] — 2026-06-10

### Fixed
- **Page headings & a safer bottom-sheet swipe (accessibility).**
  - The **Timesheets** and **Settings** screens now expose a top-level heading (and Timesheets' "Week total" / "By job" are now real headings), so screen-reader users can navigate by heading the way they can on every other screen.
  - Swiping down to dismiss a bottom sheet no longer fires while you're **scrolling the content inside it** — so scrolling a long job list can't accidentally close the sheet and discard what you'd entered.

---

## [0.29.5] — 2026-06-10

### Fixed
- **Keyboard navigation & screen-reader semantics for menus, pickers, and charts (accessibility).**
  - The job and labor-type dropdowns, the labor-type chips, the AM/PM control, and the glyph picker now support full arrow-key navigation (↑ ↓ / ← →, Home/End) as a single Tab stop — matching the behaviour their screen-reader roles already advertised, instead of every option being its own Tab stop with arrow keys doing nothing.
  - The date-picker calendar now exposes proper row / cell / column-header table structure to assistive tech.
  - The Timesheets (Daily/Weekly) and Jobs (Jobs/Labor Types) switchers now correctly announce which option is active (they were exposed as an incomplete, broken "tab" widget).
  - **Analytics charts** — the per-day, per-job, and per-labor-type breakdowns are now actually reachable by screen readers (the detailed description was being suppressed and the data tables were hidden inside the chart's image role); the labor-type donut gained a data table it previously lacked entirely.

---

## [0.29.4] — 2026-06-10

### Fixed
- **Screen readers now hear status changes (accessibility).** Several actions used to change the screen silently; they're now announced via ARIA live regions, without moving your place on the page:
  - Cloud-sync errors and the "token expired — reconnect" notice after **Sync Now**.
  - The result of importing shared data (the new-entry count, or an error).
  - The **Check for updates** result (which otherwise vanished after a few seconds before a screen reader could reach it).
  - Punching in/out ("N timers running" / "No active timers").
  - Timesheet search/filter results (the entry count and total as you type or filter).
  - The "Notifications are blocked" notice when turning on Reminders is denied.

---

## [0.29.3] — 2026-06-10

### Fixed
- **Form labels, names & validation (accessibility).**
  - Every form field now has a proper accessible name for screen readers — the custom hex-colour input, the per-labor-type hourly-rate fields (each one announces which labor type it's for), the job / client / labor-type name fields, and the archived-item search boxes — where several previously announced as blank or identical.
  - Saving a job or labor type with an empty name now shows an inline "Enter a … name." error (announced to screen readers and tied to the field) instead of silently doing nothing.
  - The **Auto / Light / Dark** theme control now tells assistive tech which option is selected.
  - Billing identity fields (name, business, email, phone, address) carry autofill hints so the browser can complete them.

---

## [0.29.2] — 2026-06-10

### Fixed
- **Text legibility & contrast across the app (accessibility).** Faint text that fell below the WCAG AA contrast minimum is now darker and readable — most noticeably in light mode, where some of it was nearly invisible:
  - Input placeholders; empty-state messages ("No entries this day", "No jobs yet", "No rates set", "No completed entries"); timesheet entry durations and times; the running timer's "started …" time and client name; and chart axis labels.
  - The keyboard **focus outline** is now full-strength (it was too faint against the dark background), and the invoice/date fields show a proper focus ring.
  - **Destructive buttons** (delete confirmation, disconnect, factory reset) use a slightly deeper red so their white label stays legible.
  - The light-mode **"On the clock"** status pill uses a darker amber for its text.
  - A **custom accent colour** that's too light now automatically switches accent-button text to dark ink so the label stays readable.

---

## [0.29.1] — 2026-06-10

### Fixed
- **Keyboard & screen-reader focus handling across dialogs and pickers (accessibility).**
  - **Delete confirmations no longer hijack the keyboard.** When a confirm dialog opened on top of another dialog (e.g. confirming a time-entry delete while editing it), one Escape used to close *both* and Tab got stuck on the Delete button — now only the top dialog responds to Escape/Tab, and Cancel is reachable again.
  - **The first-run "Bring your data over?" dialog and the enlarged share-QR now trap focus properly** — focus moves into the dialog on open, Tab stays inside it, Escape and a tap on the backdrop close it, and focus returns to where you were.
  - **Selecting from a dropdown or picker no longer drops your place.** Choosing a job, labor type, glyph, colour, time, date, or the long-running-reminder duration — or pressing Escape to close one — now returns keyboard focus to the control you opened, instead of jumping to the top of the page. Pressing **Enter** in a time/duration field now confirms and closes its popover.

---

## [0.29.0] — 2026-06-09

### Added
- **Google Drive & OneDrive now show which account you're connecting** — and ask you to confirm it first, the same way GitHub always has. After you sign in, PunchIn shows a "Connect Google Drive as you@example.com?" dialog before saving anything, and the connected account is shown in the Data & Sync panel. This closes a gap where you could accidentally link the wrong account (e.g. a work or secondary login) with nothing on screen to catch it.
  - OneDrive uses the Microsoft profile permission PunchIn already requested; Google adds a one-time, non-sensitive `openid email` consent so it can display your address. Neither widens file access — sync still only ever touches PunchIn's own hidden app folder.

---

## [0.28.0] — 2026-06-08

### Changed
- **Google Drive & OneDrive sync now stay signed in.** Previously these connections lasted only about an hour before asking you to reconnect. PunchIn now renews the sign-in silently in the background — through the same Cloudflare Worker that already handled GitHub — so auto-sync keeps working seamlessly on every provider, indefinitely (Google) or for ~90 days at a stretch (OneDrive), with no interruption. You're only prompted to reconnect if you revoke access yourself or stay away long enough for the provider to expire the session.
  - **One-time reconnect:** if you're already connected to Google Drive or OneDrive, your current sign-in has no renewal token yet — it'll expire once as before and show the usual "Reconnect" prompt; reconnecting then enables seamless background renewal from there on.

### Security
- The OAuth **refresh token** for Google/OneDrive is stored encrypted at rest with the same non-extractable WebCrypto key as the access token (issue #243). OneDrive's sign-in now completes via the Worker (a confidential client) rather than entirely in the browser, so — like Google and GitHub — its token briefly transits the URL fragment on return and is scrubbed immediately. Holding a long-lived refresh token widens the value of an active same-origin XSS beyond a single ~1-hour token; the Worker's Content-Security-Policy remains the primary control. See `SECURITY.md`.

---

## [0.27.0] — 2026-06-08

### Added
- **Auto-sync.** Once you connect a cloud account, PunchIn now keeps it in sync automatically — on open, when you make changes, when you return to the tab, and on a light background timer — so you no longer have to tap **Sync Now**. It's a per-device toggle in **Settings › Data & Sync** that defaults **on** when you connect, and you can switch it off any time. On GitHub it's fully seamless; on Google Drive / OneDrive it syncs until the ~1-hour sign-in expires, then shows the existing "Reconnect" prompt (longer-lived sessions are coming next). Background syncs never interrupt you with transient network errors — only an expired sign-in surfaces.

---

## [0.26.1] — 2026-06-08

### Changed
- **Share QR codes are now tap-to-enlarge.** The inline share QR was often too small to scan from across a desk — tap it to blow the code up full-screen on a dark backdrop (tap anywhere or press Escape to close).

---

## [0.26.0] — 2026-06-08

### Added
- **Custom date picker.** A branded calendar popover — arrow-key navigable (←/→ a day, ↑/↓ a week, Page Up/Down a month, Enter to select) — replaces the browser's native date control on a time entry's start/end dates and the invoice custom range.

### Changed
- **Time & date fields now use PunchIn's own pickers.** A time entry's start/end times and the reminder times open a branded picker where you can **type the hour and minute** (great on a desktop keyboard) or **spin the wheel** (great on touch) — and unlike the native control, it follows your 12-hour / 24-hour preference from Settings. Date fields move to the matching branded **calendar** described above.
- **The Long-running timer reminder** (Settings › Reminders) now uses the same branded picker — its duration is a tidy "1h 30m" button you tap to **type or spin** the hours/minutes, instead of the always-on-screen wheel.

---

## [0.25.1] — 2026-06-08

### Changed
- **Settings — the Danger Zone matches the design system.** The destructive-actions section (clear entries · factory reset) now shows as a clear red-outlined card with a warning icon and a one-line summary when collapsed, and a red section heading above icon-tiled rows when expanded — instead of the faint red link it was before.

---

## [0.25.0] — 2026-06-08

### Fixed
- **Sheets now close when you tap outside them or swipe the handle down.** The Start Timer and Edit Entry sheets ignored a tap on the dimmed backdrop, and the drag handle only dismissed on the installed iOS app — now a backdrop tap closes any sheet, and a swipe-down dismisses on every touch platform (Android and mobile web included), alongside the existing close button and Escape.

---

## [0.24.0] — 2026-06-08

### Added
- **Sync — disconnecting now revokes this device's access at the provider, not just locally.** Disconnecting GitHub or Google cloud sync now tells the provider to revoke this device's token, so a still-signed-in browser can't be handed a fresh token silently on the next connect. It's scoped to this device — your other synced devices keep working — and it removes access only: your synced data is left untouched and is found again the moment you reconnect.

### Changed
- **Sync — reconnecting now lets you pick the account.** Connecting Google or OneDrive always shows the provider's account chooser instead of pushing straight through to the previously signed-in account, so you can switch accounts (or confirm the right one) when you reconnect.

---

## [0.23.3] — 2026-06-08

### Changed
- **Faster Timer screen on large histories.** The desktop "This week" rail now reads the current week straight from the time index instead of loading every completed entry ever recorded — same numbers, far less work on the app's most-visited screen. (internal)

---

## [0.23.2] — 2026-06-08

### Fixed
- **Pinch-zoom is no longer blocked (accessibility).** The page viewport no longer disables zoom, so you can pinch-to-zoom anywhere in the app — a WCAG 1.4.4 fix for low-vision users. (The tap-delay this used to guard against is handled another way, so nothing feels slower.)
- **Light theme — the browser chrome bar now matches the app surface** exactly, removing a faint one-shade seam at the top of the screen in light mode.
- **Printed invoices & timesheets — the labor-type badge now matches the on-screen chip** (same rounded tinted chip with its colour border), so paper and screen read identically.

### Changed
- Internal: a single shared hex-colour helper and one source for the brand-mark geometry, plus a unified print HTML escaper — de-duplication only, with no change to how anything looks or works. (internal)

---

## [0.23.1] — 2026-06-08

### Changed
- **Timer — a long-running timer is calmer.** A timer past 12 hours no longer pulses or bounces for attention; it now shows a quiet "Still running · 12h+" note instead. The gentle pulse stays reserved for the live "On the clock" status (design-system motion rule).
- **Design-system polish.** Default job / labor-type colours, the uppercase overline labels, and the light theme's surface tones were nudged to match the design-system tokens exactly. Sub-perceptual — nothing about how the app works changes.

---

## [0.23.0] — 2026-06-07

PunchIn brand refresh — new identity (PunchIn Blue + stopwatch mark), self-hosted fonts, a desktop/tablet layout, labor-type glyphs, a billing profile, and more.

### Changed
- **Field labels use the design system's overline style.** The small labels above inputs and settings sections are now a mono, upper-case, wide-tracked "overline" (matching the redesigned Start Timer / Edit Entry sheets) for a more consistent, considered feel across the Timer, Analytics, Jobs, and Settings screens. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Labor-type tags read cleaner.** A labor tag is now a **neutral pill with a coloured glyph chip** and a plain-text name, instead of coloured text on a coloured-tint pill (which could wash out — especially in light mode). The colour and glyph still tell types apart by shape; the name just stays crisply legible. Applies everywhere tags show — timer ticket, timesheets, analytics, invoices. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Redesigned Punch In sheet.** The Start Timer modal now matches the design system: a **job picker** that shows each job's colour dot and client name (and opens a proper list with a check on the current one) instead of a plain dropdown, **labor types as tappable chips** — each with its own glyph and colour, the selected one filled in its colour — a title + subtitle, mono field labels, and a "Punch In" button with a play icon. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Bespoke job & labor pickers everywhere they carry colour/glyph.** The plain dropdowns for picking a job or a labor type are replaced by a custom picker that shows each job's **colour dot + client** and each labor type's **glyph in its colour**, with a check on the current choice — across the **Add / Edit time entry** sheet, the **invoice** job selector, a job's **default labor type**, and the **Timesheets job & labor filters** (compact toolbar chips that keep their colour/glyph). Labor types without a chosen glyph fall back to the **PunchIn brand mark**, so the glyph always rides along. (The theme, currency, and weekday menus keep the native control.) ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Design-system fidelity pass.** Brought the redesign closer to the PunchIn design system across screens: the sidebar's active item gets an accent left-rail + a bordered "On the clock" status card (amber, with a live duration); the Timer screen adds Today / This week / Avg-day stat tiles, a two-column card grid, live per-timer earnings, and a richer overview rail (per-job progress bars, filled quick-punch); Jobs becomes a two-column grid of ticket cards with a colour left-rail, a "rates set" indicator, and a segmented tab control; invoices make **Print** the primary action and print colour labor badges + an "Amount due" footer; labor glyph chips are softened to tinted chips; timesheet by-job bars use each job's colour; **Timesheets** gains a segmented Daily/Weekly control, a single grouped toolbar, compact daily entry rows (a job-colour dot, the labor tag, the time, and the duration on one line), and a two-column weekly view whose day list is a clean **day-totals list** — each day collapsed to its total and tapped to reveal its entries — beside a hero week-total + by-job rail; **Settings** becomes a desktop master-detail (a persistent category rail beside the detail pane); Analytics gets a segmented period toggle, inline hour values on the job bars, and the total logged in the donut centre; the **Jobs and Labor-type cards are tightened to the design system's compact rhythm** (shorter rows, lighter icon buttons, snugger spacing); and **headings, the live timer and stat values now use the design system's heavier display weight**, with the muted/secondary text greys retuned to the design-system palette. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Weekday pickers follow "Week starts Monday."** The reminder day pickers and the weekly-reminder day selector now display Monday-first when you have that preference on (the stored days are unchanged). ([brand refresh](https://github.com/PunchIn-App/punchin))
- **The Settings "Danger Zone" is now collapsed by default** behind an expander, so destructive actions (clear data, factory reset) aren't a mis-tap away. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **New default accent — PunchIn Blue.** New installs now default to `#2D5BF5` (dark) / `#2348DB` (light), replacing the old `#1f6feb`. The default accent automatically uses the slightly darker blue in light mode for contrast; a custom accent is used as-is in both themes. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Labor-type colour presets** are now the design-system **pastel rainbow** (10 soft hues) instead of the older saturated set — you can still pick any custom colour. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Brand fonts are now self-hosted** (no Google Fonts CDN): the Noto Sans / Display / Mono variable webfonts ship with the app and render offline, so there's no third-party font request and the brand shows instantly. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **New brand mark — a stopwatch.** The clock-in-a-square mark is now a stopwatch (crown + clock hands), and the **wordmark** tints its capital "I" with your accent. The mark glyph automatically flips between white and dark ink so it stays crisp on any accent — including light pastels — across the header, browser-tab favicon, and home-screen icon. ([brand refresh](https://github.com/PunchIn-App/punchin))

### Added
- **Report a bug or request a feature without a GitHub account.** Settings → About now has a second button next to each of the GitHub options that opens a self-hosted web form (the new `punchin-feedback` service) — no account needed. The bug form arrives with your version, install type, browser, OS, and device pre-filled, exactly like the GitHub one, and the form opens in **your current theme and accent colour** so it feels like part of the app. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Jobs can have their own colour.** Pick a colour for a job in its add/edit form — it shows on the job's card left-rail. If you don't pick one, the job keeps deriving its colour from its labor type, so existing jobs are unaffected. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Billable earnings in Analytics.** When your jobs have hourly rates set, Analytics now shows your **billable earnings** for the period (in your chosen currency), alongside the existing hours. It's hidden if you don't use rates. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Billing profile + invoice band.** A new **Billing** settings section captures your "Billed from" identity (name, business, email, phone, address, payment terms, notes); invoices now print a **Billed from / Billed to** band — including an optional **business logo** — and an optional **invoice number** (prefix + counter). The number is **editable per invoice** — a plain number, or a custom **alphanumeric code** (letters and symbols allowed) for manual / per-client / reset numbering. Plain numbers zero-pad and auto-advance the counter; a custom code prints exactly as typed and leaves the counter alone. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Your settings travel with your data.** Backups, transfer links, and cloud sync now carry your **preferences** — theme, accent, billing profile, currency, time format, reminders, and the rest (your sync/account credentials are deliberately left out). Restoring a backup or opening a transfer link brings them across, and connecting cloud sync on a **brand-new install** seeds them once (an already-set-up device keeps its own look & settings). This is the practical fix for the fact that an installed PWA gets a *separate* data store from the browser that installed it, so nothing carries over automatically — and a fresh install now greets you with a one-tap prompt to restore a backup or connect sync instead of a blank app. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Invoice or filter a whole client.** The job picker in the **invoice** generator and the **Timesheets** job filter now also lists each **client/company** — pick one to bill (or scan) *all* of that client's jobs together. A client invoice lists every job's work, each line priced at that job's own rate, with the client as "Billed to". ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Time format & currency.** New settings let you choose **12- or 24-hour** clock times — or **Auto**, which follows your device's preference (the default) — across timers, timesheets, and invoices, plus a **default currency** so invoice and CSV amounts format with the right symbol and separators instead of a hardcoded `$`. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Labor types now have an icon.** Pick a glyph when you create or edit a labor type — from a single quick-pick row (led by the PunchIn mark), or search the full glyph set in the "more" dropdown. It shows up alongside the colour everywhere the type appears (timer, timesheets, analytics legend, invoices), so categories are told apart by shape as well as colour (better for colour-blind users). Existing labor types keep working and default to the **PunchIn brand mark**. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Desktop & tablet layout.** On wider screens PunchIn now uses a persistent left navigation instead of the phone's bottom tab bar: a labelled sidebar on desktop (with the brand and a live "On the clock" status) and a compact icon rail on tablets. The phone layout is unchanged. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Timer overview rail** on wide desktop screens — the Timer screen gains a right-hand rail with your last session, **Quick punch** shortcuts for your **3 most recently used jobs** (tapping opens the Start Timer sheet on that job so you choose the task), and a **This week** total with a per-job breakdown. ([brand refresh](https://github.com/PunchIn-App/punchin))
- Design-system **token layer** in `index.css` — type scale, weights, tracking, radii, spacing, elevation/shadows (incl. an accent glow), per-theme status colours, and the pastel preset palette — plus an `--accent` (raw hex) token alongside `--accent-rgb`. ([brand refresh](https://github.com/PunchIn-App/punchin))

### Fixed
- **Printed timesheets & invoices now show the labor-type glyph, not just its colour.** The print/PDF labor badge carries the same glyph as on screen, so types are still told apart by shape — readable even on a black-and-white printout. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **No more being thrown to Settings while navigating.** Switching to another tab from inside a Settings sub-page (e.g. Billing) used to leave a stray Settings entry in the back history, so a later Back gesture would resurface Settings instead of returning home. The tab switch now unwinds the sub-page first, so Back behaves. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Settings category list no longer jumps down** on desktop when you open the Billing, Data, or About panels — the persistent category rail now stays aligned with the detail pane (and still pins as you scroll). ([brand refresh](https://github.com/PunchIn-App/punchin))
- **0-minute entries no longer round up to 0.25 h.** With "round billed time" on, a timer under a minute stays `0m` instead of being inflated to a full 15-minute increment. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Custom accent install icons now render in the exact colour on Android — without ever breaking "Add to Home Screen."** Presets use their pre-rendered icon set; a custom colour shows the **exact** colour, rendered on demand at the edge, wherever that render route is served, and falls back to the nearest pre-rendered swatch otherwise — so a custom accent can never leave the install prompt with an invalid manifest. (iOS already gets the exact colour from the page.) ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Week start now follows your device.** New installs default the "week starts Monday" preference from your locale (e.g. Sunday for the US, Monday for the UK) instead of always starting on Monday. ([brand refresh](https://github.com/PunchIn-App/punchin))
- **Buttons and toggles on the accent colour now keep legible text** on any accent: the on-accent text/icon ink automatically flips between white and dark so primary buttons (Punch In, Save, Print, …) stay readable even when you pick a light or pastel accent. ([brand refresh](https://github.com/PunchIn-App/punchin))
- Printed and PDF-exported **invoices and timesheets now render in the brand Noto font** instead of falling back to the OS's system-UI face. The print document loads the Noto webfonts and waits for them before printing, so exports match the app. ([brand refresh](https://github.com/PunchIn-App/punchin))

---

## [0.20.3] — 2026-06-05

### Changed
- Reminders — the long-running-timer duration wheel now **carries between the hours and minutes in real time**: the hour rolls over the moment you spin the minutes past 55 (or back below 00) mid-spin, instead of waiting until you let go. ([#111](https://github.com/PunchIn-App/punchin/issues/111))

---

## [0.20.2] — 2026-06-05

### Changed
- Reminders — the long-running-timer duration wheel now **carries between hours and minutes**: spin the minutes past 55 and it rolls the hour up by one (and spinning below 0 rolls it back down), so the two wheels stay in sync like a real clock. ([#111](https://github.com/PunchIn-App/punchin/issues/111))

---

## [0.20.1] — 2026-06-05

### Changed
- Reminders — the long-running-timer duration wheel is now more compact (one row above/below the selection instead of two) and **wraps around** — spin past 55 minutes or 23 hours and it rolls over to the start (arrow keys wrap too). ([#111](https://github.com/PunchIn-App/punchin/issues/111))

---

## [0.20.0] — 2026-06-05

### Changed
- Reminders — the long-running-timer **"Notify after" threshold is now a 24-hour scroll wheel** (hours + minutes, 5-minute steps) instead of dropdowns. It's always 24-hour with no AM/PM — a native `<input type="time">` can't be forced out of AM/PM on a 12-hour device, so this is a purpose-built control. Spin it, or use the arrow keys. ([#111](https://github.com/PunchIn-App/punchin/issues/111))

---

## [0.19.0] — 2026-06-05

### Added
- Appearance — the **home-screen icon now matches your chosen accent**. Pick a colour, install, and the installed icon is that colour: the preset colours and any custom colour are rendered to their exact shade, on iOS, Android, and desktop. (The icon is set at install time only — an already-installed icon can't be changed; that's an OS limitation.) ([#228](https://github.com/PunchIn-App/punchin/issues/228))

### Changed
- Reminders — the long-running-timer **"Notify after" threshold is now an hours + minutes picker** instead of a free-text box, so you pick the duration instead of typing it. ([#111](https://github.com/PunchIn-App/punchin/issues/111))

### Internal
- CI — the milestone-on-release automation now bounds its sweep to "since the previous release," so a one-time un-milestoned backlog can't all pile into one milestone; added a one-shot workflow to backfill project-board dates. (internal)

---

## [0.18.0] — 2026-06-04

A small feature + fixes release from the post-assessment follow-up issues.

### Added
- Timesheets — **Decimal hours** (Settings → General): show durations as `1.50 h` instead of `1h 30m`, for clients who read time as decimals. ([#208](https://github.com/PunchIn-App/punchin/issues/208))
- Timesheets — **Round billed time** (Settings → General): round each entry in your favour — start floored, end ceiled — to the nearest quarter or half hour, so e.g. 8:07–8:20 bills as 8:00–8:30. Applies to the Timesheets totals and rows, their CSV + print exports, and the Invoice generator. Off by default. ([#208](https://github.com/PunchIn-App/punchin/issues/208))

### Fixed
- Reminders — the long-running-timer **"Notify after N minutes" field can now be cleared and retyped.** It previously snapped back to 60 on every keystroke, so the number couldn't be changed; clearing it (or entering 0) now simply turns that reminder off. ([#111](https://github.com/PunchIn-App/punchin/issues/111))

### Changed
- Reminders — clearer, honest wording about delivery: reminders are checked on your device while PunchIn is open and **catch up when you reopen it**; a fully closed app can't alert you at an exact time. The previous copy implied an installed-but-closed app would still notify. ([#112](https://github.com/PunchIn-App/punchin/issues/112))

---

## [0.17.0] — 2026-06-04

A maintenance release from a full internal code assessment ([#172](https://github.com/PunchIn-App/punchin/issues/172)): cross-device sync now propagates edits and deletions (not just new entries), a set of security improvements, and a broad sweep of correctness, accessibility, and performance fixes. No new features.

### Security
- Sync — the cloud-sync **access token is now encrypted at rest** with a non-extractable WebCrypto key, instead of being stored in plaintext. ([#126](https://github.com/PunchIn-App/punchin/issues/126))
- Sync — OneDrive now uses the **Authorization Code + PKCE** flow, so the access token is never placed in the page URL. ([#128](https://github.com/PunchIn-App/punchin/issues/128))
- Sync — every provider's OAuth return is verified against a **CSRF `state` nonce**; a mismatched callback is rejected, and the token is scrubbed from the URL even on an unrecognized return. ([#125](https://github.com/PunchIn-App/punchin/issues/125), [#139](https://github.com/PunchIn-App/punchin/issues/139))
- Sync — the GitHub connect dialog now **discloses the broad gist scope** before you authorize. ([#127](https://github.com/PunchIn-App/punchin/issues/127))
- The app shell is now served with a **Content-Security-Policy** and hardening headers, and OAuth errors map to fixed messages instead of reflecting text from the URL. ([#129](https://github.com/PunchIn-App/punchin/issues/129))

### Fixed
- Sync — **edits, deletions, archive state, and per-labor-type rates now sync across devices.** Sync was previously additive-only, so a record edited or deleted on one device could reappear or stay stale on another. Records now carry a stable cross-device id and merge by last-write-wins, with deletions propagated as tombstones. ([#118](https://github.com/PunchIn-App/punchin/issues/118))
- Sync — a token that expires mid-sync now prompts you to reconnect, and download-vs-upload failures are reported separately and are safe to retry.
- Timesheets — the **Daily/Weekly totals now match the CSV, print, and Analytics figures**: a still-running timer no longer inflates them, and an entry that crosses midnight is split across the days it actually covers instead of its whole duration landing on the start day. ([#136](https://github.com/PunchIn-App/punchin/issues/136), [#137](https://github.com/PunchIn-App/punchin/issues/137))
- Analytics — per-day bars clip cross-midnight entries to each local day, and the "Avg / day" figure lines up with the days shown. ([#140](https://github.com/PunchIn-App/punchin/issues/140))
- Timer — the view no longer briefly flashes "No active timers" while it is still loading. ([#135](https://github.com/PunchIn-App/punchin/issues/135))
- Settings — **Factory Reset now deletes this device's remote sync file** and clears leftover local storage, so a wipe can't be undone by reconnecting. ([#143](https://github.com/PunchIn-App/punchin/issues/143))
- Invoices — **Print** no longer fails silently when pop-ups are blocked (it tells you and points to CSV), and a custom end-date now includes the whole final day. ([#150](https://github.com/PunchIn-App/punchin/issues/150), [#157](https://github.com/PunchIn-App/punchin/issues/157))
- Editing an active timer now rejects a start time in the future, which had rendered a negative running duration. ([#153](https://github.com/PunchIn-App/punchin/issues/153))
- Color picker — pressing Escape in the custom-color popover now dismisses only the popover, not the dialog it is inside. ([#155](https://github.com/PunchIn-App/punchin/issues/155))
- Reminders — no longer fire twice with multiple tabs open or after the device clock moves backward, and now begin working if you grant notification permission mid-session. ([#158](https://github.com/PunchIn-App/punchin/issues/158)–[#162](https://github.com/PunchIn-App/punchin/issues/162))
- Install guidance — iOS in-app browsers (Facebook, Instagram, etc.) no longer show "Add to Home Screen" steps that can't work there. ([#163](https://github.com/PunchIn-App/punchin/issues/163))
- The browser-tab icon is rendered at a higher resolution so it stays sharp on high-DPI screens. ([#164](https://github.com/PunchIn-App/punchin/issues/164))

### Changed
- Accessibility — modals now **return keyboard focus to the control that opened them** when they close, and keep focus trapped inside the dialog while open. ([#151](https://github.com/PunchIn-App/punchin/issues/151), [#152](https://github.com/PunchIn-App/punchin/issues/152), [#154](https://github.com/PunchIn-App/punchin/issues/154))
- Performance — timesheet and analytics queries use the indexed time range instead of scanning the whole table, the views memoize their derived data, running timers stop ticking while the tab is backgrounded, and the charts library now loads only when you open Analytics — shrinking the initial download. ([#132](https://github.com/PunchIn-App/punchin/issues/132), [#138](https://github.com/PunchIn-App/punchin/issues/138), [#142](https://github.com/PunchIn-App/punchin/issues/142), [#167](https://github.com/PunchIn-App/punchin/issues/167))

### Internal
- Refactors with no user-facing change: the Settings view split into per-panel components; shared modal focus-trap / bottom-sheet / PWA-update hooks; extracted backup and issue-URL helpers; manual import reuses the cloud-sync merge; a single source of truth for default settings. Plus new tests (OAuth worker callback, case-insensitive merge dedup, an App↔views integration test), reproducible CI installs via `npm ci`, and a smaller-bundle guardrail. (internal)

## [0.16.0] — 2026-06-04

### Added
- Reminders — the "no timer running", "timer still running", and "daily timesheet" reminders can now be limited to specific days of the week; clearing every day simply turns that reminder off.
- Settings — "Help improve PunchIn" opens a pre-filled GitHub feature request, alongside the existing bug report.
- Settings — "License & legal" shows the app license (BUSL-1.1) and third-party attributions in-app.
- Settings — a "Support the App" button links out to Buy Me a Coffee, styled in your chosen accent color.

### Changed
- Settings — reorganized into an iOS-style drill-in: a list of categories you tap into, instead of one long accordion. Backup, Sync, Transfer, and Danger Zone now live together under a single "Data & Sync" page.
- Settings — the device Back gesture and re-tapping the Settings tab both return to the top-level Settings list.
- About — the Changelog and License dialogs now close on the device Back gesture.

### Fixed
- Appearance — the brand accent now falls back to the default blue (not the old amber) on first paint, before your saved color loads.

## [0.15.2] — 2026-06-03

### Changed
- Internal — upgraded core dependencies to their latest major versions: React 19, Vite 8, Tailwind CSS 4, Dexie 4, Recharts 3, date-fns 4, lucide-react 1, and @vitejs/plugin-react 6. No user-facing changes. (internal)

---

## [0.15.1] — 2026-06-03

### Changed
- Sync — GitHub Gist now uses a **multi-file gist** structure: a `- PunchIn Sync` marker file (identifies the gist as PunchIn's, sorts first) plus a separate `punchin-data-{deviceId}.json` per device. Each device only writes its own file, so concurrent pushes from different devices can never overwrite each other. Existing single-file gists are read and merged automatically on first sync with the new format. Disconnecting deletes your device's file from the gist. ([#83](https://github.com/PunchIn-App/punchin/issues/83))

### Fixed
- Sync — GitHub Gist: after connecting on a second device the app now searches for an existing PunchIn gist before creating a new one, so both devices share the same gist. ([#83](https://github.com/PunchIn-App/punchin/issues/83))
- Sync — after completing GitHub / Google / OneDrive OAuth, the app now returns to the **Settings** tab (Sync section) instead of jumping to the Timer view. ([#83](https://github.com/PunchIn-App/punchin/issues/83))
- Sync — GitHub Gist: the connected status now shows your GitHub username (e.g. **@username**) so you can confirm which account is linked. ([#83](https://github.com/PunchIn-App/punchin/issues/83))
- Sync — GitHub Gist: after the OAuth redirect, a confirmation dialog now shows which GitHub account was used before saving anything — so you can catch a wrong account (GitHub silently uses whichever account is signed in to your browser) and Cancel to sign in to a different one first. ([#83](https://github.com/PunchIn-App/punchin/issues/83))

---

## [0.15.0] — 2026-06-03

### Added
- Transfer — a new **Transfer** section in Settings to move your data between devices **without an account**: tap **Create share link** to get a compressed link plus a **QR code**, then open or scan it on the other device. ([#77](https://github.com/PunchIn-App/punchin/issues/77))
- Transfer — opening a PunchIn share link shows an **import confirmation** before merging, and you can also paste a link into **Import from a link**. Imports reuse the same dedup as cloud sync, so nothing is duplicated. Large histories that exceed QR/URL limits fall back to the copyable link with a clear note.

---

## [0.14.0] — 2026-06-03

### Added
- Reminders — a new **Reminders** section in Settings with opt-in local notifications: a **long-running timer** alert (after a configurable number of minutes), a **no timer running** nudge by a chosen time, a **timer still running** alert at a chosen time, and **daily** / **weekly** timesheet reminders. Turning reminders on asks for notification permission. ([#54](https://github.com/PunchIn-App/punchin/issues/54))
- Reminders work without any account or server, so they only fire while PunchIn is open or installed and running in the background — the Settings copy makes this clear and points iPhone/iPad users to add the app to their Home Screen first.

---

## [0.13.0] — 2026-06-03

### Changed
- Settings — the settings screen is now organised into **collapsible sections** that open one at a time, so the list stays tidy instead of one long scroll. Opening a section automatically closes the previously open one. ([#60](https://github.com/PunchIn-App/punchin/issues/60))
- Settings — the single-item **Timer** and **Calendar** groups (and the Haptic feedback toggle on phones) are consolidated into one **General** section, removing the lonely one-row categories. ([#60](https://github.com/PunchIn-App/punchin/issues/60))

---

## [0.12.2] — 2026-06-03

### Changed
- Appearance — **refreshed the app's typography to the Noto family** (Noto Sans for text, Noto Sans Display for headings, Noto Sans Mono for timer digits) for a cleaner, more legible look across every screen. ([#74](https://github.com/PunchIn-App/punchin/issues/74))

---

## [0.12.1] — 2026-06-03

### Fixed
- Sync — **GitHub Gist login now works in the installed app.** Inside the home-screen PWA the GitHub sign-in could never complete: the service worker was answering the OAuth callback with the cached app shell, so the token exchange never ran and you were left unable to connect, see sync status, or disconnect. The callback now passes straight through to the network, so connecting, syncing, and disconnecting all work again. ([#79](https://github.com/PunchIn-App/punchin/issues/79))
- Navigation — the device **Back button no longer piles up history across a session.** Tapping through tabs used to add a new Back step every time, so leaving the app meant pressing Back many times. Back now returns to the Timer home from any tab, and once more exits — no matter how many tabs you visited. ([#80](https://github.com/PunchIn-App/punchin/issues/80))

---

## [0.12.0] — 2026-06-03

### Added
- Settings — new **Haptic feedback** toggle (on by default, shown on phones); vibration now fires on navigation, punch-in, and punch-out, not just inside a couple of modals.
- Navigation — the device **Back button/gesture now moves between tabs** instead of immediately closing the installed app.
- Sync — the connected card shows an explicit **Connected** badge (or **Reconnect** when the session token has expired) so it's clear when sync is set up.

### Changed
- App — the installed PWA now **rotates with your device** instead of being locked to portrait.
- Sync — disconnecting now uses the standard in-app confirmation dialog, so it works reliably when installed to the home screen.

### Fixed
- Settings — **Factory Reset** now restores the default blue accent color instead of switching it to amber.
- Settings — **Check for updates** now recognizes an update that already downloaded in a previous session (e.g. after a reset/reload), so it can be applied instead of reporting "Already up to date".
- iPad — Safari requests the desktop site by default, which previously hid the install instructions entirely; iPads are now detected correctly and shown the **Add to Home Screen** guidance (and the haptics toggle is hidden, since iPads have no vibration).

## [0.11.4] — 2026-06-02

### Changed
- **Settings — clearer message when sync isn't available.** On builds where cloud sync hasn't been configured, the Sync section now shows a plain-language note ("Sync isn't set up on this version") that points you to the data export, instead of developer setup instructions referencing environment variables.

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
