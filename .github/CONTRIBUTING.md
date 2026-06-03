# Contributing to PunchIn

Thanks for your interest in contributing!

## Contributor License Agreement

Before your pull request can be merged, you must agree to the
[Contributor License Agreement](CLA.md). Include the following statement in your
PR description or as a comment:

> I have read and agree to the PunchIn Time Tracker Contributor License Agreement.

---

## Getting Started

```bash
git clone https://github.com/PunchIn-App/punchin.git
cd punchin
npm install
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Serve the production build locally
```

A build is considered passing when **both** of the following succeed:

```bash
npm run build
npm run test:run
```

CI enforces this on every push and PR to `main`.

---

## Configuring Sync (self-hosting)

Cloud sync (GitHub Gist / Google Drive / OneDrive) is **optional** and **off by default**. Without configuration, the app runs fully offline and the Settings → Sync section shows a "not set up" note — this is expected, not a bug ([#59](https://github.com/PunchIn-App/punchin/issues/59)).

The provider buttons only appear when the matching `VITE_<provider>_CLIENT_ID` is present. Because Vite **inlines `import.meta.env.VITE_*` at build time**, these must be set wherever the production build runs (e.g. your Cloudflare Workers build environment), not just in local `.env.local`.

All `VITE_*` values are **public client IDs** — never put secrets in them. See [`.env.example`](../.env.example) for the full list and per-provider OAuth app setup notes.

### GitHub Gist (recommended — token never expires; worker already built)

GitHub is the only provider with a server-side token exchange, handled by [`worker/oauth.js`](../worker/oauth.js). It needs **both** build variables and runtime secrets:

1. Register a GitHub OAuth App at <https://github.com/settings/developers> with callback URL `https://<your-app>.workers.dev/oauth/github/callback`, then generate a client secret.
2. In your Cloudflare Worker → Settings → Variables and Secrets, set:
   - **Build variables** (inlined into the bundle): `VITE_GITHUB_CLIENT_ID`, `VITE_APP_URL`
   - **Runtime secrets** (read by the worker): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `APP_URL`
3. Redeploy so Vite re-inlines the build variable.

### Google Drive / OneDrive (implicit flow — no worker, no secret)

These use browser-side implicit OAuth, so they need **only** their build variable plus a registered OAuth app:

- **Google Drive** — `VITE_GOOGLE_CLIENT_ID` (Web app, Drive API + `drive.appdata` scope, redirect URI `https://<your-app>.workers.dev/`)
- **OneDrive** — `VITE_ONEDRIVE_CLIENT_ID` (SPA redirect `https://<your-app>.workers.dev/`, permissions `Files.ReadWrite.AppFolder` + `User.Read`)

> The most common setup mistake is setting only the build variable **or** only the runtime secret for GitHub — both are required.

---

## Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes — see [`CLAUDE.md`](CLAUDE.md) for full architecture conventions
3. Test manually at mobile width (≤ 412 px) and desktop width
4. Follow the **versioning**, **documentation**, and **testing** requirements below
5. Open a pull request with a clear description and your CLA sign-off

---

## Versioning

PunchIn uses **semantic versioning** (`MAJOR.MINOR.PATCH`). Pre-1.0 (current), `MINOR` is for user-visible features and `PATCH` is for everything else that ships to users.

### What triggers each increment

| Change type | Increment |
|---|---|
| New view, tab, or modal | `MINOR` |
| New setting exposed in UI | `MINOR` |
| New export/import format or data capability | `MINOR` |
| Significant UX or layout change | `MINOR` |
| New DB table or field users interact with | `MINOR` |
| Bug fix visible to users | `PATCH` |
| Accessibility improvement | `PATCH` |
| Performance improvement (no visible change) | `PATCH` |
| Internal refactor (no visible change) | `PATCH` |
| Dependency update (no visible change) | `PATCH` |
| Test additions only | no bump |
| CI / workflow config change only | no bump |
| Documentation-only change | no bump |

**Tiebreaker:** if a user would notice the change without being told about it, it's `MINOR`.

### When a version bump is required

A version bump commit must update **all** of the following in the same PR:

| File | What to change |
|---|---|
| `package.json` | `"version"` field — source of truth |
| `README.md` | Version badge URL |
| `CLAUDE.md` | `**Version:**` in the Project Overview header |
| `docs/CHANGELOG.md` | New section at the top (see format below) |
| `docs/screenshots/` | Regenerate if any visible UI changed (see below) |

Commit message convention: `chore: bump to vX.Y.Z`

---

## Documentation Requirements

Every PR that changes code must update the relevant documentation in the **same PR**. This is not optional — stale docs are treated as a bug.

### What needs updating

| What changed in your PR | `CLAUDE.md` | `README.md` | `docs/CHANGELOG.md` | Screenshots |
|---|---|---|---|---|
| New component | Add to Repository Structure | — | ✓ if user-visible | ✓ if it renders in a view |
| Renamed or removed component | Update Repository Structure | — | ✓ if user-visible | ✓ if it renders in a view |
| New view or tab | Add to Repository Structure | Consider feature description update | ✓ | ✓ |
| New or changed hook | Update Repository Structure | — | — | — |
| New or changed `time.js` helper | Update Time Utilities list | — | — | — |
| DB schema change (table, index, field) | Update Database → Collections table | — | ✓ if user-visible | — |
| New setting key | Add to Settings Keys table | — | ✓ | — |
| Any visible UI change | — | — | — | ✓ regenerate |
| Version bump | Update `**Version:**` in header | Update version badge | Add new section | ✓ if UI changed |

### What triggers a screenshot regeneration

**Regenerate** `docs/screenshots/` when:
- Layout, spacing, or sizing changes in any view
- UI element added or removed (button, card, badge, label)
- Color, font, or icon change
- Text content in a view changes (labels, placeholders, empty states)
- Any of these files change: `TimerView`, `JobsView`, `TimesheetsView`, `AnalyticsView`, `SettingsView`

**Do not regenerate** for: logic-only changes, hook/utility changes, DB schema changes with no visual effect, test additions, CI changes, or documentation-only updates.

See the Screenshots section of [`CLAUDE.md`](CLAUDE.md) for the Playwright regeneration script.

---

## CHANGELOG Format

Add a new section at the very top of `docs/CHANGELOG.md`. Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- Timer — short description of new capability from the user's perspective

### Changed
- Settings — what changed and how it differs from before

### Fixed
- Timesheets — what was broken and what it does now

### Removed
- Jobs — what was removed
```

Rules:
- Omit sections that have no entries
- Write from the **user's perspective**: "Timesheets now show..." not "Updated TimesheetsView to..."
- Start each bullet with the feature area: `Timer — `, `Analytics — `, `Settings — `, etc.
- Internal refactors with no visible effect go under `Changed` with an `(internal)` suffix
- One bullet per user-observable change

---

## Testing

- Run `npm run test:run` before opening a PR
- If you add new behaviour to a file listed under "Known gaps" in `CLAUDE.md`, add a test file alongside it
- Do not remove or weaken existing tests

---

## Code Conventions

The full conventions are in [`CLAUDE.md`](CLAUDE.md). Key rules:

- **No router** — navigation is tab-based state in `App.jsx`; this is intentional for PWA standalone mode
- **No custom backend** — keep all data local. Optional cloud sync exists via OAuth + provider-hosted storage (GitHub Gist / Google Drive / OneDrive); adding a **new** sync provider requires explicit agreement on the OAuth flow and its own Cloudflare Worker secret (see [`CLAUDE.md`](../CLAUDE.md) → "What NOT to Do" and the Configuring Sync section above)
- **Date math** — always use helpers from `src/utils/time.js`; never inline raw `Date` arithmetic
- **Theming** — use `appAccent` / `text-appAccent` for accent-colored elements; never hardcode `amber-*` classes
- **Modals** — follow the platform-native bottom-sheet pattern from `StartTimerModal.jsx`
- **Confirmations** — use `<ConfirmModal>` instead of `window.confirm()`
- **Haptics** — use `useHapticFeedback(os)`; never call `navigator.vibrate()` directly
- **Schema changes** — bump the Dexie version number and add an upgrade block in `db.js`
- **Bundle size** — check impact before adding a new dependency; the bundle is intentionally small
- **Accessibility** — icon-only buttons need `aria-label`; form inputs need a wired `<label>`; charts need an `sr-only` data table fallback
