# PunchIn — Settings Keys

> **Canonical home for the full settings-key reference table**, extracted from `CLAUDE.md` to keep that file lean. **Add a row here when you add a new setting key.** Every key + default lives in the single `DEFAULT_SETTINGS` object in `src/db.js` (both `populate` and `factoryReset` consume it via `defaultSettingsRows()`); because `useSettings` merges live rows over `DEFAULT_SETTINGS`, consumers read `settings.yourKey` directly without a fallback. (`CLAUDE.md` → Documentation Maintenance points back to this file.)

## Settings Keys

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
