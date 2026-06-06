# PunchIn — Versioning & Release Procedure

> **Canonical home for the full versioning rules, release checklist, release procedure, project-board / milestone automation, and CHANGELOG format**, extracted from `CLAUDE.md`. **Follow this whenever you bump the version or cut a release.** "Documentation Maintenance" referenced below lives in `CLAUDE.md`.

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
| `docs/screenshots/` | Regenerate if any visible UI changed (see Documentation Maintenance in `CLAUDE.md`) |

After the bump commit lands on `main`, also **create a GitHub release** (`gh release create vX.Y.Z …`) — it tags the version and surfaces it in the repo's Releases sidebar. This is a post-merge action (a tag points at a commit on `main`), not a file edit, so it's step 9 in the procedure below rather than a row in this table.

The `wrangler.jsonc` `compatibility_date` is **not** part of the version bump — update it only when intentionally upgrading the Cloudflare Workers runtime.

#### Step-by-step release procedure

1. Decide the new version using the decision guide above
2. Update `package.json` `"version"`
3. Add a new section at the top of `docs/CHANGELOG.md` (see format below)
4. Update the version badge URL in `README.md`
5. Update `**Version:**` in the `CLAUDE.md` Project Overview header
6. If any visible UI changed, regenerate screenshots (see Documentation Maintenance in `CLAUDE.md`)
7. Verify `npm run build` and `npm run test:run` both pass
8. Commit everything in a single commit: `chore: bump to vX.Y.Z` (or fold the bump into the feature PR)
9. Once the version commit has landed on `main`, create a GitHub release so the version is tagged and shows in the repo's **Releases**:
   ```bash
   gh release create vX.Y.Z --target <commit-on-main> --title "vX.Y.Z" --latest --notes "<the new docs/CHANGELOG.md section>"
   ```
   The tag `vX.Y.Z` is the canonical marker for the release; `--notes` should mirror that version's `docs/CHANGELOG.md` section. Pass the **full** commit SHA (or a branch name) to `--target` — the API rejects abbreviated SHAs.

   **Create a release for every version increment — major, minor, AND patch.** Publishing a **minor or major** release (`vX.Y.0`) additionally **auto-creates the `vX.Y.0` milestone and assigns every merged PR that doesn't yet have one** (= everything merged since the last minor/major release, including any intervening patch PRs), via `.github/workflows/milestone-on-release.yml`. **Patch (bug-fix) releases publish + tag but get NO milestone** — the workflow no-ops on a non-zero patch tag, and those PRs roll up into the next minor/major milestone (so every PR is milestoned exactly once, at its minor/major grouping). Manual fallback for a minor/major if that workflow is unavailable: `gh api repos/<owner>/<repo>/milestones -f title=vX.Y.0 -f state=closed`, then assign PRs with `gh pr edit <n> --milestone vX.Y.0`.

### Project board automation

`.github/workflows/project-automation.yml` keeps the [PunchIn project board](https://github.com/orgs/PunchIn-App/projects/3) populated as issues/PRs move: on open it auto-adds the item and sets **Labels** (from the conventional-commit type), **Priority** (bug/enhancement → P1, else P2), **Size** (from PR diff), and **Start**/**Target** (+3 days) dates; on close it sets **Completion Date** and **clears any assignees** (finished work shouldn't stay assigned). It deliberately leaves **Status** to the project's built-in workflows (Item added / Item closed / Pull request merged) so it never conflicts with them or the built-in Auto-close rule. **Milestones** are handled at release time (above), on **minor/major releases only** (patch releases get no milestone), not here. Both `project-automation.yml` and `milestone-on-release.yml` live in each repo the board tracks (punchin + punchin-email). Everything runs under the **`ADD_TO_PROJECT_PAT`** secret — the default `GITHUB_TOKEN` is kept read-only (issue #104), so the PAT must grant **Projects: read/write · Issues: read/write · Contents: read/write** on both repos (Projects for the board fields, Issues for labels + milestones, Contents write for the punchin-email → punchin release relay below).

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

