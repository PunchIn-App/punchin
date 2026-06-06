# Design: `docs-sync` CI check

**Date:** 2026-06-06
**Status:** Approved (pending spec review)
**Author:** PunchIn App (Claude)

## Problem

`CLAUDE.md` was recently trimmed from 69 KB to 38 KB by extracting three reference docs:
`docs/ARCHITECTURE.md` (the file map), `docs/TEST-COVERAGE.md` (the test table), and
`docs/RELEASING.md` (the release process). Only `CLAUDE.md` is auto-loaded into an agent's
context; the extracted docs are read on demand. That makes them prone to **drift** — an agent
(or human) can add a source file, a test, or bump the version and forget to update the
corresponding doc, and nothing stops the PR from merging.

The pointers in `CLAUDE.md` are a *nudge*. This feature adds *teeth*: a CI check that fails a
pull request when source/test/version changes are not reflected in the docs.

## Goal

A blocking-but-escapable CI check on pull requests to `main` that enforces four
documentation-sync rules, with a clear violation report and a single label-based override.

## Non-goals / scope boundaries (v1, by design)

- **Not covered by R1:** additions under `scripts/` and `config/` (low churn; documented in
  ARCHITECTURE.md but not CI-enforced).
- **Not covered by R4:** README.md version badge and the `CLAUDE.md` `**Version:**` header
  (high-touch, eyeballed during release prep; low drift risk).
- **Tamper model:** a PR can edit `scripts/check-doc-sync.mjs` to weaken the check. This is the
  same trust posture as the existing test suite (the PR's own code runs in CI) and is caught by
  code review. The *workflow YAML* is always taken from the base ref, so it can't be silently
  altered. A future hardening (run the script from the base ref) is explicitly out of scope.
- **No version bump:** this is CI/workflow + tooling + tests + a docs note. Per
  `docs/RELEASING.md`, CI-only and docs-only changes get **no** version bump.

## Architecture (Approach A)

Two artifacts plus small edits:

1. **`scripts/check-doc-sync.mjs`** — a Node ESM module with:
   - a **pure rule-evaluation function** `evaluateDocSync(input)` (no git, no filesystem) that
     is the unit-tested core, and
   - a **thin wrapper** (`main()`) that gathers inputs from git + the filesystem + the GitHub
     event payload, calls the pure function, prints a report, and sets the process exit code.
2. **`.github/workflows/docs-sync.yml`** — a new workflow that runs the script on pull requests
   to `main`. The existing `.github/workflows/ci.yml` is **not modified**.

Plus: an `npm run check:docs` script, a unit + meta test file, and a short docs note.

### Pure function contract

```js
// returns { violations: Violation[], errors: FatalError[] }
evaluateDocSync({
  changedFiles,   // Array<{ status: 'A'|'M'|'D'|'R', path: string, oldPath?: string }>
  architecture,   // string | null  — head content of docs/ARCHITECTURE.md
  testCoverage,   // string | null  — head content of docs/TEST-COVERAGE.md
  changelog,      // string | null  — head content of docs/CHANGELOG.md
  version,        // { base: string|null, head: string|null } — package.json .version
  bypass,         // boolean — skip-docs-check label present
})

// Violation  = { rule: 'R1'|'R2'|'R3'|'R4', path: string, message: string }
// FatalError = { message: string }
```

- If `bypass` is true → return `{ violations: [], errors: [] }` immediately (wrapper logs the bypass).
- If a doc needed by a triggered rule is `null` (missing/deleted) → push a **FatalError**, not a
  violation (the wrapper exits 2). Rules that aren't triggered don't require their doc.

### Wrapper responsibilities (`main()`)

1. **Determine context.**
   - **CI:** `GITHUB_EVENT_PATH` is set and the event is `pull_request`. Read
     `pull_request.base.sha`, `pull_request.head.sha`, and `pull_request.labels[].name` from the
     event JSON. `bypass = labels.includes('skip-docs-check')`.
   - **Local:** no event file. `bypass = false`. `base = git merge-base origin/main HEAD`,
     `head = HEAD`. Support `--base <ref>` / `--head <ref>` overrides for manual runs.
2. **Compute changed files (fail closed).** `git diff --name-status -M <base>...<head>` (three-dot).
   Parse each line:
   - rename lines have **three** tab-separated fields: `R<score>\t<oldPath>\t<newPath>` → emit
     `{ status:'R', path:newPath, oldPath }`;
   - all other statuses have two fields: `<status>\t<path>` → first letter is the status
     (`A`/`M`/`D`/`C`/`T`).
   - If the `git diff` command errors (bad SHA, shallow clone, etc.) → **exit 2** with a clear
     message. Never default to "no changes."
3. **Read head doc contents** from the working tree (in CI the checkout *is* the head/merge
   tree; locally it's the working tree): `docs/ARCHITECTURE.md`, `docs/TEST-COVERAGE.md`,
   `docs/CHANGELOG.md`. Missing file → pass `null` (the pure fn decides if that's fatal).
4. **Read versions.** Head: working-tree `package.json` `.version`. Base:
   `git show <base>:package.json` then `JSON.parse`. Wrap parsing in try/catch → on malformed
   JSON or missing `version` field, **exit 2** with a guiding message.
5. **Evaluate**, then **report**: group violations by rule, print each with a one-line fix hint;
   print fatal errors separately.
6. **Exit code:** `0` clean/bypassed · `1` violations · `2` fatal error. The workflow treats any
   non-zero as a failed (blocking) check.

## The four rules

### R1 — new source file must be documented

- **Trigger:** a changed file with status `A` whose path matches
  `^(src|worker)/.+\.(js|jsx)$` and is **not** excluded.
- **Exclusions:** `*.test.{js,jsx}` (→ R2), `**/test-setup.js`, and any non-`.js/.jsx` file
  (CSS, SVG, images, assets are exempt — ARCHITECTURE.md is a code-structure document).
- **Requirement:** the file is **"documented"** in `docs/ARCHITECTURE.md` (see Matching).
- **Renamed files** (status `R`) do **not** trigger R1's add-path; they're handled by R3.

### R2 — new test file must be in the coverage table

- **Trigger:** a changed file with status `A` matching `\.(test)\.(js|jsx)$` anywhere under
  `src/` or `worker/`.
- **Requirement:** the file's **full repo-relative path** appears in `docs/TEST-COVERAGE.md`,
  backtick-wrapped as in the existing rows (e.g. `` `src/utils/foo.test.js` ``). Full-path match
  disambiguates `foo.test.js` from `foo.helpers.test.js`.

### R3 — removed/renamed file must not leave a stale entry

- **Trigger (delete):** status `D` for a path matching `^(src|worker)/.+\.(js|jsx)$` (incl. test
  files).
- **Trigger (rename):** status `R` for such a path (uses `oldPath` + `path`).
- **Requirement (delete & rename-old):** the old basename must have **no stale tree node** in
  `docs/ARCHITECTURE.md` (see Matching). For a **test** file, also require its old full path is
  **absent** from `docs/TEST-COVERAGE.md`.
- **Requirement (rename-new):** the new basename must be **"documented"** (same as R1), and a
  renamed **test** file's new path must appear in `docs/TEST-COVERAGE.md` (same as R2).

### R4 — version bump must update the changelog (and security policy on minor/major)

- **Trigger:** normalized `version.head` ≠ `version.base` (compare `MAJOR.MINOR.PATCH` only;
  strip a leading `v`; ignore pre-release/metadata). If only `package.json` deps changed and the
  version is unchanged → **no trigger**.
- **Requirement (always):** `docs/CHANGELOG.md` contains a heading
  `^##\s*\[<headVersion>\]` for the exact new version string (Keep-a-Changelog format). Touching
  the file without adding the new section is a violation.
- **Requirement (minor/major only):** if `head.major ≠ base.major` **or** `head.minor ≠
  base.minor`, then `SECURITY.md` (repo **root** — *not* `docs/SECURITY.md`) must be among the
  changed files. **Patch** bumps (e.g. `0.20.2 → 0.20.3`) do **not** require SECURITY.md — this
  matches `docs/RELEASING.md` (its Supported-Versions table is minor-granular).

## Matching semantics (the subtle part)

`docs/ARCHITECTURE.md` documents files in **two** styles, both of which must count as
"documented":
- individual tree nodes — e.g. `├── TimerCard.jsx       # …`
- comment-summaries on a parent node — e.g. the `settings/` node lists
  `GeneralPanel/AppearancePanel/…` (note: **without** `.jsx` extensions).

Definitions operate on the **fenced code block(s)** of `docs/ARCHITECTURE.md` (extract all
` ``` … ``` ` blocks and concatenate). All matching is **case-sensitive**.

- **"Documented"(name)** — true if either the basename **with** its extension (`Foo.jsx`) **or**
  the basename **without** its final extension (`Foo`) appears as a **bounded token** in the
  fence. Bounded = not flanked by `[A-Za-z0-9_]`. This accepts both doc styles; a genuinely new,
  descriptive name will not appear by coincidence.
- **"Stale node"(name)** — true if a line in the fence matches a tree connector immediately
  followed by the basename label: `/(├──|└──)\s*<name>(\.[a-z]+)?(?![A-Za-z0-9_])/`. Anchoring to
  the connector means a lingering mention **inside a `#` comment** (a cross-reference to another
  file) does **not** count as stale — only an actual leftover node does.

Rationale for the asymmetry: "did you *document* the new file?" is lenient (presence anywhere,
either style); "did you *remove* the stale entry?" is precise (node position only) to avoid
false positives from comment cross-references.

**Accepted limitations of this matching model (v1):**
- A new file with a *generic* basename (e.g. `format.js`, whose stem `format` may already appear
  in prose like "format strings") can pass R1 as a **false negative** even if undocumented. The
  with-extension form is the stronger signal; the without-extension fallback exists only to
  accept the comment-summary style. Distinctive component/module names (the common case) are
  unaffected. Backstops: the completeness meta-test and code review.
- Deleting a file that was documented *only* inside a parent's comment-summary (e.g. a
  `settings/` panel, which has no node of its own) won't be caught by R3's node-absence check.

## Git / CI mechanics (non-negotiable)

Each of these was identified as a "permanent red CI" failure mode:

- **`actions/checkout@v4` with `fetch-depth: 0`.** A shallow clone leaves `base.sha` out of the
  local object store, so the diff reads *every* file as added and the check is permanently red.
- **Three-dot diff against event-payload SHAs.** Use `git diff -M <base.sha>...<head.sha>` where
  the SHAs come from the `pull_request` event payload — **not** inferred from `HEAD` (which is a
  temporary merge commit whose parents are unreliable). Three-dot diffs from the merge base,
  matching GitHub's "Files changed" tab; two-dot would pick up unrelated commits landed on `main`
  after the PR opened.
- **Rename detection (`-M`)** is best-effort. A rename with a large edit may surface as
  delete+add instead of `R`; that degrades **safely** — the delete triggers R3-absent and the add
  triggers R1-present, so correctness is preserved either way.
- **Fail closed.** Any git/parse/IO failure → exit 2, never a silent pass.

## Escape hatch

- **Label:** `skip-docs-check` on the PR bypasses **all four rules** (all-or-nothing in v1).
- **Trigger types:** the workflow uses
  `on: pull_request: { branches: [main], types: [opened, synchronize, reopened, labeled, unlabeled] }`
  so that *adding the label re-runs the check* (default types omit label events).
- **Always-run, always-report.** The job has **no** `if:` skip-condition. It always runs and
  always reports a status under a stable name; the *script* decides pass/bypass/fail. A job that
  is `if:`-skipped never reports, which would deadlock a required check at "Expected — waiting for
  status to be reported."
- **Read-only token.** Labels are read from `GITHUB_EVENT_PATH`, not the GitHub API, so the
  workflow needs only `contents: read` (matching `ci.yml`'s posture). No PR comment is posted;
  the violation report goes to the job log.
- **Maintainer-only by nature.** Fork contributors can't self-apply the label (needs write
  perms); they ask a maintainer. Documented as intentional.

## Testing strategy

- **`scripts/check-doc-sync.test.mjs`**, first line `// @vitest-environment node` (the pure
  logic needs no jsdom). The repo's Vitest config sets no `test.include`, so the default glob
  (`**/*.{test,spec}.{js,mjs,…}`) **auto-discovers** this file under the existing
  `npm run test:run`. `scripts/` is outside the coverage `include` (`src/**`, `worker/**`), so it
  does **not** affect coverage thresholds.
- **Unit tests** of `evaluateDocSync` (pure, table-driven), covering at least:
  - R1 pass (node style), R1 pass (comment-summary style, no extension), R1 fail, R1 exclusions
    (test file, `test-setup.js`, `.css`).
  - R2 pass (full path present), R2 fail, `foo.test.js` vs `foo.helpers.test.js` disambiguation.
  - R3 delete: stale node present → fail; comment cross-reference present but node gone → pass.
  - R3 rename: old node gone + new documented → pass; old node lingering → fail.
  - R4: patch bump needs only changelog heading; minor bump also needs SECURITY.md; deps-only
    change (version unchanged) → no trigger; changelog touched but heading missing → fail.
  - `bypass: true` → no violations regardless of input.
  - Missing required doc → FatalError; malformed version → FatalError.
- **Meta-test** (reads real files, node env): glob the current `src/**` + `worker/**`
  `*.{js,jsx}` minus exclusions, and assert each is **"documented"** in the real
  `docs/ARCHITECTURE.md`. This proves the matcher against the actual tree and guards the doc
  against silent incompleteness going forward. (As prep, fill any gap this surfaces — the audit
  during design found the relevant files are present, so this is expected to pass immediately.)

## Manual setup (owner-only, documented but not automated)

1. **Create the label once:**
   `gh label create skip-docs-check --description "Bypass all doc-sync CI rules" --color FFC300`
2. **Make it blocking:** in the repo's branch-protection rule for `main`, add the check named
   **`Docs Sync`** to *Required status checks*. (The workflow failing is necessary but only
   branch protection blocks the merge.) The check name is a stable contract — renaming the job
   later is a migration that must update branch protection.

## Files changed

| File | Change |
|------|--------|
| `scripts/check-doc-sync.mjs` | **new** — pure `evaluateDocSync` + git/IO/event wrapper |
| `scripts/check-doc-sync.test.mjs` | **new** — unit tests + completeness meta-test (`// @vitest-environment node`) |
| `.github/workflows/docs-sync.yml` | **new** — PR-only workflow; `fetch-depth: 0`; read-only token; documented contract header |
| `package.json` | add `"check:docs": "node scripts/check-doc-sync.mjs"` |
| `docs/ARCHITECTURE.md` | fill any file-map gap the meta-test reveals (expected: none/minimal) |
| `docs/TEST-COVERAGE.md` | *not required* by R2 (it tracks `src/`+`worker/` tests, not `scripts/` tooling); optional row for the new tooling test by convention |
| `CLAUDE.md` | short note: doc-sync is CI-enforced; the `skip-docs-check` label; the `Docs Sync` required check |
| `.github/CONTRIBUTING.md` | mention the check + label under the docs/testing guidance |

## Open questions

None. All rule semantics, matching, mechanics, and the escape hatch are pinned above.
