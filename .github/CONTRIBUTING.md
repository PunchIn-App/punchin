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

### Build vs runtime — the part that trips people up

Cloudflare's Worker settings have **two** separate sections, and each variable belongs in exactly one:

- **Build** ("variables and secrets used during the build") — Vite reads these when `npm run build` runs and **inlines them into the JavaScript bundle**. All `VITE_*` variables go here. If a `VITE_*` value is only in the runtime section, the build never sees it and the provider button stays hidden.
- **Runtime** ("variables and secrets used at runtime") — read by the Worker *while it serves a request* ([`worker/oauth.js`](../worker/oauth.js) reads `env.*`). These are never compiled into the frontend. Only GitHub needs runtime values, and `GITHUB_CLIENT_SECRET` **must** live here as a secret — never in the build section.

After changing any **build** variable you must trigger a fresh deploy — Vite only re-inlines on a new build; an already-deployed bundle won't pick up the change.

### GitHub Gist (recommended — token never expires; worker already built)

GitHub is the only provider with a server-side token exchange, so it needs entries in **both** sections. Register a GitHub OAuth App at <https://github.com/settings/developers> with callback URL `https://<your-app>.workers.dev/oauth/github/callback`, generate a client secret, then set:

| Variable | Section | Value | Secret? |
|---|---|---|---|
| `VITE_GITHUB_CLIENT_ID` | Build | your client ID | no (public) |
| `VITE_APP_URL` | Build | `https://<your-app>.workers.dev` | no |
| `GITHUB_CLIENT_ID` | Runtime | your client ID (same value) | no (public) |
| `GITHUB_CLIENT_SECRET` | Runtime | your generated secret | **yes** |
| `APP_URL` | Runtime | `https://<your-app>.workers.dev` | no |

> Setting everything in **runtime only** → the button never appears (build didn't get the `VITE_*` vars). Setting everything in **build only** → the OAuth callback fails when GitHub redirects back (the worker can't exchange the code without its runtime secret). You need both.

> **Why dashboard runtime vars sometimes vanish after a deploy:** by default a deploy deletes any plaintext runtime var not declared in `wrangler.jsonc`, then re-applies what the config lists (secrets are never deleted — which is why `GITHUB_CLIENT_SECRET` survives but `GITHUB_CLIENT_ID` / `APP_URL` disappear). This repo sets [`keep_vars: true`](../wrangler.jsonc) so dashboard-set runtime vars persist across deploys. If you fork and remove that flag, declare the non-secret runtime vars under `vars` in `wrangler.jsonc` instead.

### Google Drive (implicit flow — build only, no worker, no secret)

Browser-side implicit OAuth, so there's no runtime value and no client secret. Register a Web application OAuth client at <https://console.cloud.google.com> (enable the Google Drive API, scope `drive.appdata`, authorized redirect URI `https://<your-app>.workers.dev/`), then set:

| Variable | Section | Value | Secret? |
|---|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Build | your client ID | no (public) |

### OneDrive (implicit flow — build only, no worker, no secret)

Also browser-side implicit OAuth. Register an app at <https://portal.azure.com> (personal Microsoft accounts, SPA redirect `https://<your-app>.workers.dev/`, API permissions `Files.ReadWrite.AppFolder` + `User.Read`), then set:

| Variable | Section | Value | Secret? |
|---|---|---|---|
| `VITE_ONEDRIVE_CLIENT_ID` | Build | your client ID | no (public) |

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
