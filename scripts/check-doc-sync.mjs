#!/usr/bin/env node
// Documentation-sync CI check.
//
// Fails a pull request when source/test/version changes are not reflected in the
// extracted reference docs. See the design spec:
//   docs/superpowers/specs/2026-06-06-docs-sync-ci-check-design.md
//
// Rules:
//   R1  added src/|worker/ *.{js,jsx} (excl. tests, test-setup.js) -> named in docs/ARCHITECTURE.md
//   R2  added *.test.{js,jsx} under src/|worker/                  -> full path listed in docs/TEST-COVERAGE.md
//   R3  removed/renamed tracked file -> no stale entry left behind (and rename's new path documented)
//   R4  package.json "version" change -> docs/CHANGELOG.md has the new section; SECURITY.md updated on minor/major
//
// Exit codes: 0 = pass/bypassed, 1 = rule violations, 2 = fatal error (fail closed).
// Escape hatch: a `skip-docs-check` PR label bypasses all rules.

import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const SKIP_LABEL = 'skip-docs-check'

// ----------------------------------------------------------------------------
// Pure helpers (no git, no filesystem) — unit-tested directly.
// ----------------------------------------------------------------------------

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const basename = (p) => p.slice(p.lastIndexOf('/') + 1)
const stripExt = (name) => {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

const isSrcCode = (p) => /^(src|worker)\/.+\.(js|jsx)$/.test(p)
const isTestFile = (p) => /^(src|worker)\/.+\.test\.(js|jsx)$/.test(p)
const isR1Excluded = (p) => /\.test\.(js|jsx)$/.test(p) || /(^|\/)test-setup\.js$/.test(p)

/** Parse "v?MAJOR.MINOR.PATCH..." -> {major,minor,patch} or null. Ignores pre-release/metadata. */
export function parseVersion(v) {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/)
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null
}

/** Concatenate the contents of all fenced ``` code blocks in a markdown string. */
export function extractFences(md) {
  if (!md) return ''
  const blocks = []
  const re = /```[^\n]*\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(md))) blocks.push(m[1])
  return blocks.join('\n')
}

const hasToken = (token, text) =>
  new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(token)}(?![A-Za-z0-9_])`).test(text)

/**
 * "Documented": the file's basename (with extension) OR its stem (without the final
 * extension) appears as a bounded token anywhere in the ARCHITECTURE.md tree fence.
 * Accepts both node-style (`├── Foo.jsx`) and comment-summary-style (`GeneralPanel/...`) docs.
 */
export function isDocumented(path, fence) {
  const base = basename(path)
  return hasToken(base, fence) || hasToken(stripExt(base), fence)
}

/**
 * "Stale node": a tree connector immediately labels the file. Anchored to the connector so a
 * lingering mention inside a `#` comment (a cross-reference) does NOT count — only a real node.
 */
export function hasStaleNode(path, fence) {
  const base = basename(path)
  const re = new RegExp(
    `(├──|└──)\\s*(${escapeRegExp(base)}|${escapeRegExp(stripExt(base))})(?![A-Za-z0-9_])`
  )
  return re.test(fence)
}

/** R2/R3: the test file's full repo-relative path is listed (backtick-wrapped) in TEST-COVERAGE.md. */
export function isTestPathListed(path, testCovMd) {
  return !!testCovMd && testCovMd.includes('`' + path + '`')
}

/** R4: docs/CHANGELOG.md has a `## [<version>]` heading for the exact new version string. */
export function changelogHasVersion(changelog, version) {
  if (!changelog || !version) return false
  return new RegExp(`^##\\s*\\[${escapeRegExp(version)}\\]`, 'm').test(changelog)
}

// ----------------------------------------------------------------------------
// Pure rule engine.
// ----------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {Array<{status:'A'|'M'|'D'|'R', path:string, oldPath?:string}>} input.changedFiles
 * @param {string|null} input.architecture  head content of docs/ARCHITECTURE.md
 * @param {string|null} input.testCoverage  head content of docs/TEST-COVERAGE.md
 * @param {string|null} input.changelog     head content of docs/CHANGELOG.md
 * @param {{base:string|null, head:string|null}} input.version
 * @param {boolean} input.bypass
 * @returns {{violations:Array<{rule:string,path:string,message:string}>, errors:Array<{message:string}>}}
 */
export function evaluateDocSync(input) {
  const {
    changedFiles = [],
    architecture = null,
    testCoverage = null,
    changelog = null,
    version = {},
    bypass = false,
  } = input || {}

  if (bypass) return { violations: [], errors: [] }

  const violations = []
  const errors = []
  const fence = extractFences(architecture)

  let archErrored = false
  let testCovErrored = false
  const archAvailable = (rule) => {
    if (architecture == null) {
      if (!archErrored) {
        archErrored = true
        errors.push({ message: `docs/ARCHITECTURE.md is missing or unreadable; cannot evaluate ${rule}.` })
      }
      return false
    }
    return true
  }

  const requireDocumented = (rule, path, label) => {
    if (archAvailable(rule) && !isDocumented(path, fence)) {
      violations.push({ rule, path, message: `${label}: add ${basename(path)} to the file map in docs/ARCHITECTURE.md.` })
    }
  }
  const requireNoStaleNode = (rule, path, label) => {
    if (archAvailable(rule) && hasStaleNode(path, fence)) {
      violations.push({ rule, path, message: `${label}: remove the stale ${basename(path)} entry from docs/ARCHITECTURE.md.` })
    }
  }
  const requireTestListed = (rule, path, label) => {
    if (testCoverage == null) {
      if (!testCovErrored) {
        testCovErrored = true
        errors.push({ message: `docs/TEST-COVERAGE.md is missing or unreadable; cannot evaluate ${rule}.` })
      }
    } else if (!isTestPathListed(path, testCoverage)) {
      violations.push({ rule, path, message: `${label}: add a row for \`${path}\` to docs/TEST-COVERAGE.md.` })
    }
  }
  const requireTestNotListed = (rule, path, label) => {
    if (testCoverage != null && isTestPathListed(path, testCoverage)) {
      violations.push({ rule, path, message: `${label}: remove the stale \`${path}\` row from docs/TEST-COVERAGE.md.` })
    }
  }

  for (const f of changedFiles) {
    const { status, path, oldPath } = f

    if (status === 'A' && isTestFile(path)) {
      requireTestListed('R2', path, 'New test file')
    } else if (status === 'A' && isSrcCode(path) && !isR1Excluded(path)) {
      requireDocumented('R1', path, 'New source file')
    } else if (status === 'D' && isSrcCode(path)) {
      requireNoStaleNode('R3', path, 'Removed file')
      if (isTestFile(path)) requireTestNotListed('R3', path, 'Removed test file')
    } else if (status === 'R' && oldPath && (isSrcCode(oldPath) || isSrcCode(path))) {
      // old side: if it was a tracked source file, it must leave no stale entry
      if (isSrcCode(oldPath)) {
        requireNoStaleNode('R3', oldPath, 'Renamed-away file')
        if (isTestFile(oldPath)) requireTestNotListed('R3', oldPath, 'Renamed-away test file')
      }
      // new side: if it is now a tracked source file, it must be documented
      // (covers renames INTO src/ from elsewhere, not just within-src renames)
      if (isTestFile(path)) requireTestListed('R3', path, 'Renamed-to test file')
      else if (isSrcCode(path) && !isR1Excluded(path)) requireDocumented('R3', path, 'Renamed-to file')
    }
  }

  // R4 — version change.
  const baseV = parseVersion(version.base)
  const headV = parseVersion(version.head)
  if (version.head != null && headV == null) {
    errors.push({ message: `package.json head version "${version.head}" is not a valid MAJOR.MINOR.PATCH.` })
  } else if (headV && version.base == null && version.baseUnreadable) {
    // base package.json exists but couldn't be read/parsed — fail closed rather than skip R4.
    errors.push({ message: 'Could not read package.json at the base commit to verify a possible version bump.' })
  } else if (baseV && headV) {
    const changed =
      baseV.major !== headV.major || baseV.minor !== headV.minor || baseV.patch !== headV.patch
    if (changed) {
      // Accept the changelog heading in either the raw form (e.g. 1.2.3-rc.1) or the
      // normalized MAJOR.MINOR.PATCH form (e.g. 1.2.3), so pre-release tags don't false-fail.
      const headNorm = `${headV.major}.${headV.minor}.${headV.patch}`
      const changelogOk =
        changelogHasVersion(changelog, version.head) ||
        (headNorm !== version.head && changelogHasVersion(changelog, headNorm))
      if (!changelogOk) {
        violations.push({
          rule: 'R4',
          path: 'docs/CHANGELOG.md',
          message: `Version bumped to ${version.head}; add a "## [${version.head}]" section to docs/CHANGELOG.md.`,
        })
      }
      const minorOrMajor = baseV.major !== headV.major || baseV.minor !== headV.minor
      if (minorOrMajor) {
        const securityChanged = changedFiles.some(
          (f) => f.path === 'SECURITY.md' && (f.status === 'A' || f.status === 'M' || f.status === 'R')
        )
        if (!securityChanged) {
          violations.push({
            rule: 'R4',
            path: 'SECURITY.md',
            message: `Minor/major bump to ${version.head} requires updating SECURITY.md (Supported Versions table).`,
          })
        }
      }
    }
  }

  return { violations, errors }
}

// ----------------------------------------------------------------------------
// Thin git / filesystem / GitHub-event wrapper (the CLI entry point).
// ----------------------------------------------------------------------------

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const getArg = (argv, name) => {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}

const readMaybe = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)

/** Parse `git diff --name-status -M` output into {status, path, oldPath?}. */
export function parseNameStatus(out) {
  const files = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    const code = parts[0][0] // first letter (R100 -> R, C75 -> C)
    if ((code === 'R' || code === 'C') && parts.length >= 3) {
      files.push({ status: code === 'R' ? 'R' : 'A', path: parts[2], oldPath: parts[1] })
    } else {
      files.push({ status: code, path: parts[1] })
    }
  }
  return files
}

function readEventContext() {
  // Only treat this as CI when GitHub says the event is a pull_request. In that mode a
  // missing/corrupt event file is fatal (fail closed) rather than a silent local fallback.
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') return null
  const p = process.env.GITHUB_EVENT_PATH
  if (!p || !existsSync(p)) fail(2, 'pull_request event but GITHUB_EVENT_PATH is unset or missing.')
  let ev
  try {
    ev = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    fail(2, `GitHub event payload is not valid JSON: ${e.message}`)
  }
  const pr = ev.pull_request
  if (!pr?.base?.sha || !pr?.head?.sha) {
    fail(2, 'GitHub event payload is missing pull_request base/head SHA.')
  }
  return { base: pr.base.sha, head: pr.head.sha, labels: (pr.labels ?? []).map((l) => l.name) }
}

function fail(code, message) {
  console.error(`\n✖ docs-sync: ${message}`)
  process.exit(code)
}

function readHeadVersion() {
  let raw
  try {
    raw = readFileSync('package.json', 'utf8')
  } catch (e) {
    fail(2, `Could not read package.json: ${e.message}`)
  }
  try {
    const v = JSON.parse(raw).version
    if (typeof v !== 'string') fail(2, 'package.json has no string "version" field.')
    return v
  } catch (e) {
    fail(2, `package.json is not valid JSON: ${e.message}`)
  }
}

function readBaseVersion(base) {
  // Distinguish "package.json did not exist at base" (legit — skip R4) from "it exists but is
  // unreadable/unparseable" (suspicious — fail closed). The latter is signalled by `unreadable`.
  let existed = false
  try {
    execFileSync('git', ['cat-file', '-e', `${base}:package.json`], { stdio: 'ignore' })
    existed = true
  } catch {
    existed = false
  }
  if (!existed) return { version: null, unreadable: false }
  try {
    const v = JSON.parse(git(['show', `${base}:package.json`])).version
    return { version: typeof v === 'string' ? v : null, unreadable: false }
  } catch {
    return { version: null, unreadable: true }
  }
}

function report(violations, errors, bypass) {
  if (bypass) {
    console.log(`✓ docs-sync: bypassed via "${SKIP_LABEL}" label.`)
    return
  }
  if (!violations.length && !errors.length) {
    console.log('✓ docs-sync: all documentation in sync.')
    return
  }
  if (violations.length) {
    console.error(`\n✖ docs-sync: ${violations.length} documentation drift issue(s):\n`)
    for (const v of violations) console.error(`  [${v.rule}] ${v.message}`)
    console.error(`\n  To override intentionally, add the "${SKIP_LABEL}" label to this PR.`)
  }
  if (errors.length) {
    console.error(`\n✖ docs-sync: ${errors.length} fatal error(s):\n`)
    for (const e of errors) console.error(`  ${e.message}`)
  }
}

function main() {
  const argv = process.argv.slice(2)
  const ctx = readEventContext()
  let base, head, labels

  if (ctx) {
    base = getArg(argv, '--base') || ctx.base
    head = getArg(argv, '--head') || ctx.head
    labels = ctx.labels
  } else {
    labels = []
    try {
      head = getArg(argv, '--head') || git(['rev-parse', 'HEAD']).trim()
      base = getArg(argv, '--base') || git(['merge-base', 'origin/main', 'HEAD']).trim()
    } catch (e) {
      fail(2, `Could not determine base/head for a local run: ${e.message}. Pass --base <ref> --head <ref>.`)
    }
  }

  const bypass = labels.includes(SKIP_LABEL)

  let diffOut
  try {
    // core.quotePath=false keeps non-ASCII paths un-escaped so isSrcCode() matches them.
    diffOut = git(['-c', 'core.quotePath=false', 'diff', '--name-status', '-M', `${base}...${head}`])
  } catch (e) {
    fail(2, `git diff ${base}...${head} failed: ${e.message}. (In CI, ensure actions/checkout uses fetch-depth: 0.)`)
  }

  const baseVer = readBaseVersion(base)
  const result = evaluateDocSync({
    changedFiles: parseNameStatus(diffOut),
    architecture: readMaybe('docs/ARCHITECTURE.md'),
    testCoverage: readMaybe('docs/TEST-COVERAGE.md'),
    changelog: readMaybe('docs/CHANGELOG.md'),
    version: { base: baseVer.version, head: readHeadVersion(), baseUnreadable: baseVer.unreadable },
    bypass,
  })

  report(result.violations, result.errors, bypass)
  if (result.errors.length) process.exit(2)
  if (result.violations.length) process.exit(1)
  process.exit(0)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
