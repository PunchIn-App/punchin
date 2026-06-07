// Uses the suite's default jsdom environment: the shared src/test-setup.js stubs
// window.matchMedia unconditionally, so a 'node' environment would crash on load.
// This test only touches Node's fs/path (available in either environment).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  evaluateDocSync,
  parseVersion,
  extractFences,
  isDocumented,
  hasStaleNode,
  isTestPathListed,
  changelogHasVersion,
  parseNameStatus,
} from './check-doc-sync.mjs'

// The suite runs from the repo root (npm run test:run / CI both invoke it there).
const ROOT = process.cwd()

// A synthetic ARCHITECTURE.md tree exercising BOTH documentation styles:
//  - individual nodes (TimerCard.jsx)
//  - comment-summaries without extensions (the settings panels)
//  - a cross-reference to another file inside a comment (favicon.js)
const ARCH = [
  '```',
  'punchin/',
  '├── src/',
  '│   ├── App.jsx                # root shell',
  '│   ├── components/',
  '│   │   ├── TimerCard.jsx      # live running timer',
  '│   │   └── settings/          # panels: GeneralPanel/AppearancePanel + components.jsx',
  '│   └── utils/',
  '│       └── time.js            # time helpers; reused by favicon.js for the accent icon',
  '```',
].join('\n')

const TESTCOV = [
  '| File | What |',
  '|------|------|',
  '| `src/utils/time.test.js` | time helpers |',
  '| `src/components/Foo.helpers.test.js` | helper fns |',
].join('\n')

describe('parseVersion', () => {
  it('parses MAJOR.MINOR.PATCH and ignores prefix/suffix', () => {
    expect(parseVersion('0.20.3')).toEqual({ major: 0, minor: 20, patch: 3 })
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('1.2.3-rc.1')).toEqual({ major: 1, minor: 2, patch: 3 })
  })
  it('returns null for non-versions', () => {
    expect(parseVersion('banana')).toBeNull()
    expect(parseVersion(undefined)).toBeNull()
  })
})

describe('extractFences', () => {
  it('returns only fenced content', () => {
    const md = 'prose ColorPicker here\n```\n├── ColorPicker.jsx\n```\nmore prose'
    const fence = extractFences(md)
    expect(fence).toContain('ColorPicker.jsx')
    expect(fence).not.toContain('prose')
  })
})

describe('isDocumented', () => {
  it('matches an individual node (with extension)', () => {
    expect(isDocumented('src/components/TimerCard.jsx', extractFences(ARCH))).toBe(true)
  })
  it('matches a comment-summary entry without extension (stem)', () => {
    expect(isDocumented('src/views/settings/GeneralPanel.jsx', extractFences(ARCH))).toBe(true)
  })
  it('matches a comment-summary entry with extension', () => {
    expect(isDocumented('src/views/settings/components.jsx', extractFences(ARCH))).toBe(true)
  })
  it('rejects an undocumented file', () => {
    expect(isDocumented('src/utils/brandNewThing.js', extractFences(ARCH))).toBe(false)
  })
})

describe('hasStaleNode', () => {
  it('detects a leftover tree node', () => {
    expect(hasStaleNode('src/components/TimerCard.jsx', extractFences(ARCH))).toBe(true)
  })
  it('does not flag a name that only appears in a comment cross-reference', () => {
    expect(hasStaleNode('src/utils/favicon.js', extractFences(ARCH))).toBe(false)
  })
  it('does not flag a comment-summary panel (no node of its own)', () => {
    expect(hasStaleNode('src/views/settings/GeneralPanel.jsx', extractFences(ARCH))).toBe(false)
  })
})

describe('isTestPathListed', () => {
  it('matches the exact backtick-wrapped full path', () => {
    expect(isTestPathListed('src/utils/time.test.js', TESTCOV)).toBe(true)
  })
  it('does not match a different test in the same dir', () => {
    expect(isTestPathListed('src/components/Foo.test.js', TESTCOV)).toBe(false)
  })
})

describe('changelogHasVersion', () => {
  const cl = '# Changelog\n\n## [0.20.3] — 2026-06-05\n- thing\n'
  it('matches the heading for the exact version', () => {
    expect(changelogHasVersion(cl, '0.20.3')).toBe(true)
  })
  it('rejects when the new version section is absent', () => {
    expect(changelogHasVersion(cl, '0.20.4')).toBe(false)
  })
})

describe('parseNameStatus', () => {
  it('parses adds, deletes, and renames (3-field)', () => {
    const out = 'A\tsrc/a.js\nD\tsrc/b.js\nR100\tsrc/old.js\tsrc/new.js'
    expect(parseNameStatus(out)).toEqual([
      { status: 'A', path: 'src/a.js' },
      { status: 'D', path: 'src/b.js' },
      { status: 'R', path: 'src/new.js', oldPath: 'src/old.js' },
    ])
  })
})

describe('evaluateDocSync — R1 (new source file documented)', () => {
  const docs = { architecture: ARCH, testCoverage: TESTCOV, changelog: '' }
  it('passes when the new file is documented', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'A', path: 'src/components/TimerCard.jsx' }], ...docs })
    expect(r.violations).toEqual([])
  })
  it('fails when the new file is undocumented', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'A', path: 'src/utils/brandNewThing.js' }], ...docs })
    expect(r.violations.map((v) => v.rule)).toEqual(['R1'])
  })
  it('exempts test files, test-setup.js, and non-js/jsx', () => {
    const r = evaluateDocSync({
      changedFiles: [
        { status: 'A', path: 'src/test-setup.js' },
        { status: 'A', path: 'src/index.css' },
        { status: 'A', path: 'src/assets/logo.svg' },
      ],
      ...docs,
    })
    expect(r.violations).toEqual([])
    expect(r.errors).toEqual([])
  })
})

describe('evaluateDocSync — R2 (new test listed)', () => {
  const docs = { architecture: ARCH, testCoverage: TESTCOV, changelog: '' }
  it('passes when the test path is listed', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'A', path: 'src/utils/time.test.js' }], ...docs })
    expect(r.violations).toEqual([])
  })
  it('fails when the test path is missing', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'A', path: 'src/utils/brand.test.js' }], ...docs })
    expect(r.violations.map((v) => v.rule)).toEqual(['R2'])
  })
})

describe('evaluateDocSync — R3 (removed / renamed)', () => {
  const docs = { architecture: ARCH, testCoverage: TESTCOV, changelog: '' }
  it('fails when a deleted file leaves a stale node', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'D', path: 'src/components/TimerCard.jsx' }], ...docs })
    expect(r.violations.map((v) => v.rule)).toEqual(['R3'])
  })
  it('passes when a deleted file had only a comment cross-reference', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'D', path: 'src/utils/favicon.js' }], ...docs })
    expect(r.violations).toEqual([])
  })
  it('fails when a deleted test row is still listed', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'D', path: 'src/utils/time.test.js' }], ...docs })
    expect(r.violations.map((v) => v.rule)).toEqual(['R3'])
  })
  it('rename: flags stale old node AND undocumented new file', () => {
    const r = evaluateDocSync({
      changedFiles: [{ status: 'R', oldPath: 'src/components/TimerCard.jsx', path: 'src/components/TimerCardX.jsx' }],
      ...docs,
    })
    expect(r.violations.filter((v) => v.rule === 'R3').length).toBe(2)
  })
  it('rename: passes when old node removed and new file documented', () => {
    const renamedArch = ARCH.replace('TimerCard.jsx', 'TimerCardX.jsx')
    const r = evaluateDocSync({
      changedFiles: [{ status: 'R', oldPath: 'src/components/TimerCard.jsx', path: 'src/components/TimerCardX.jsx' }],
      architecture: renamedArch,
      testCoverage: TESTCOV,
      changelog: '',
    })
    expect(r.violations).toEqual([])
  })
})

describe('evaluateDocSync — R4 (version bump)', () => {
  const base = { architecture: ARCH, testCoverage: TESTCOV }
  const changelog = '## [0.20.3] — 2026-06-05\n## [0.21.0] — 2026-06-06\n'
  it('does not trigger when version is unchanged', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'M', path: 'package.json' }], ...base, changelog: '', version: { base: '0.20.3', head: '0.20.3' } })
    expect(r.violations).toEqual([])
  })
  it('patch bump requires only the changelog section (no SECURITY.md)', () => {
    const ok = evaluateDocSync({ changedFiles: [{ status: 'M', path: 'package.json' }], ...base, changelog, version: { base: '0.20.2', head: '0.20.3' } })
    expect(ok.violations).toEqual([])
    const bad = evaluateDocSync({ changedFiles: [{ status: 'M', path: 'package.json' }], ...base, changelog: '', version: { base: '0.20.2', head: '0.20.3' } })
    expect(bad.violations.map((v) => v.rule)).toEqual(['R4'])
  })
  it('minor bump also requires SECURITY.md to be touched', () => {
    const missing = evaluateDocSync({ changedFiles: [{ status: 'M', path: 'package.json' }], ...base, changelog, version: { base: '0.20.3', head: '0.21.0' } })
    expect(missing.violations.map((v) => v.path)).toContain('SECURITY.md')
    const ok = evaluateDocSync({
      changedFiles: [{ status: 'M', path: 'package.json' }, { status: 'M', path: 'SECURITY.md' }],
      ...base,
      changelog,
      version: { base: '0.20.3', head: '0.21.0' },
    })
    expect(ok.violations).toEqual([])
  })
  it('reports a fatal error for an unparseable head version', () => {
    const r = evaluateDocSync({ changedFiles: [], ...base, changelog, version: { base: '0.20.3', head: 'banana' } })
    expect(r.errors.length).toBe(1)
  })
})

describe('evaluateDocSync — bypass & missing docs', () => {
  it('bypass returns no violations regardless of input', () => {
    const r = evaluateDocSync({
      changedFiles: [{ status: 'A', path: 'src/utils/brandNewThing.js' }],
      architecture: ARCH,
      testCoverage: TESTCOV,
      changelog: '',
      bypass: true,
    })
    expect(r.violations).toEqual([])
  })
  it('missing ARCHITECTURE.md becomes a fatal error when a src rule needs it', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'A', path: 'src/utils/x.js' }], architecture: null, testCoverage: TESTCOV, changelog: '' })
    expect(r.errors.length).toBe(1)
    expect(r.violations).toEqual([])
  })
  it('missing TEST-COVERAGE.md becomes a fatal error when a test rule needs it', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'A', path: 'src/utils/x.test.js' }], architecture: ARCH, testCoverage: null, changelog: '' })
    expect(r.errors.length).toBe(1)
  })
})

describe('evaluateDocSync — review-hardening fixes', () => {
  const docs = { architecture: ARCH, testCoverage: TESTCOV, changelog: '' }

  it('rename INTO src/ from outside flags the undocumented new file (R3)', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'R', oldPath: 'app/legacy/widget.js', path: 'src/components/Widget.jsx' }], ...docs })
    expect(r.violations.map((v) => v.rule)).toEqual(['R3'])
  })
  it('rename a test INTO src/ from outside requires a TEST-COVERAGE row (R3)', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'R', oldPath: 'app/x.js', path: 'src/utils/x.test.js' }], ...docs })
    expect(r.violations.map((v) => v.rule)).toEqual(['R3'])
  })
  it('rename OUT of src/ enforces stale-node removal on the old path', () => {
    const r = evaluateDocSync({ changedFiles: [{ status: 'R', oldPath: 'src/components/TimerCard.jsx', path: 'scripts/TimerCard.js' }], ...docs })
    expect(r.violations.map((v) => v.rule)).toEqual(['R3'])
  })

  it('R4 fails closed when the base package.json is unreadable', () => {
    const r = evaluateDocSync({ changedFiles: [], ...docs, version: { base: null, head: '0.20.3', baseUnreadable: true } })
    expect(r.errors.length).toBe(1)
    expect(r.violations).toEqual([])
  })
  it('R4 skips quietly when base package.json was simply absent', () => {
    const r = evaluateDocSync({ changedFiles: [], ...docs, version: { base: null, head: '0.20.3', baseUnreadable: false } })
    expect(r.errors).toEqual([])
    expect(r.violations).toEqual([])
  })
  it('R4 accepts a normalized changelog heading for a pre-release head version', () => {
    const r = evaluateDocSync({
      changedFiles: [{ status: 'M', path: 'package.json' }, { status: 'M', path: 'SECURITY.md' }],
      architecture: ARCH,
      testCoverage: TESTCOV,
      changelog: '## [1.2.3] — 2026-06-06\n',
      version: { base: '0.20.3', head: '1.2.3-rc.1' },
    })
    expect(r.violations).toEqual([])
  })

  it('reports the missing TEST-COVERAGE.md fatal error only once for multiple added tests', () => {
    const r = evaluateDocSync({
      changedFiles: [{ status: 'A', path: 'src/a.test.js' }, { status: 'A', path: 'src/b.test.js' }],
      architecture: ARCH,
      testCoverage: null,
      changelog: '',
    })
    expect(r.errors.length).toBe(1)
  })
})

// Completeness meta-test: every current enforced source file must be "documented" in the
// REAL docs/ARCHITECTURE.md. This both proves the matcher against the live tree and guards
// the file map from silently going incomplete.
describe('docs/ARCHITECTURE.md completeness (meta)', () => {
  const walk = (dir, acc = []) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full, acc)
      else acc.push(full)
    }
    return acc
  }

  const archPath = join(ROOT, 'docs/ARCHITECTURE.md')
  const fence = extractFences(readFileSync(archPath, 'utf8'))

  const enforced = ['src', 'worker']
    .filter((d) => existsSync(join(ROOT, d)))
    .flatMap((d) => walk(join(ROOT, d)))
    .map((abs) => abs.slice(ROOT.length).replace(/\\/g, '/').replace(/^\//, ''))
    .filter((p) => /^(src|worker)\/.+\.(js|jsx)$/.test(p))
    .filter((p) => !/\.test\.(js|jsx)$/.test(p) && !/(^|\/)test-setup\.js$/.test(p))

  it('finds a non-trivial set of enforced files', () => {
    expect(enforced.length).toBeGreaterThan(20)
  })

  it.each(enforced)('documents %s', (p) => {
    expect(isDocumented(p, fence)).toBe(true)
  })

  // Positive control against the REAL doc: an obviously-new file must be flagged by R1.
  it('flags an undocumented new file (R1) using the real ARCHITECTURE.md', () => {
    const arch = readFileSync(archPath, 'utf8')
    const r = evaluateDocSync({
      changedFiles: [{ status: 'A', path: 'src/utils/__definitelyNotDocumentedYet.js' }],
      architecture: arch,
      testCoverage: '',
      changelog: '',
    })
    expect(r.violations.map((v) => v.rule)).toEqual(['R1'])
  })
})
