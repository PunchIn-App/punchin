import { describe, it, expect } from 'vitest'
import {
  encodeSnapshot,
  decodeSnapshot,
  buildShareUrl,
  parseImportCode,
  parseImportFromHash,
} from './transfer'

const sample = {
  version: 1,
  exportedAt: '2026-06-03T00:00:00.000Z',
  jobs: [{ id: 1, name: 'Acme', isActive: true }],
  entries: [{ id: 1, jobId: 1, laborTypeId: null, punchIn: '2026-06-01T09:00:00.000Z', punchOut: '2026-06-01T10:00:00.000Z' }],
  laborTypes: [{ id: 1, name: 'Design', color: '#6366F1' }],
}

describe('encodeSnapshot / decodeSnapshot', () => {
  it('round-trips a snapshot losslessly', async () => {
    const code = await encodeSnapshot(sample)
    expect(typeof code).toBe('string')
    expect(['g', 'r']).toContain(code[0])
    const decoded = await decodeSnapshot(code)
    expect(decoded).toEqual(sample)
  })

  it('uses gzip (flag "g") when CompressionStream is available', async () => {
    const code = await encodeSnapshot(sample)
    expect(code[0]).toBe('g')
  })

  it('decodes a raw (uncompressed) code', async () => {
    // Build a raw code by hand to exercise the 'r' branch independently.
    const json = JSON.stringify(sample)
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const decoded = await decodeSnapshot('r' + b64)
    expect(decoded.jobs[0].name).toBe('Acme')
  })

  it('throws on an empty code', async () => {
    await expect(decodeSnapshot('')).rejects.toThrow()
    await expect(decodeSnapshot('g')).rejects.toThrow()
  })

  it('throws on an unrecognized flag', async () => {
    await expect(decodeSnapshot('xABCD')).rejects.toThrow(/transfer link/i)
  })

  it('throws when the payload is not PunchIn data', async () => {
    const json = JSON.stringify({ hello: 'world' })
    const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await expect(decodeSnapshot('r' + b64)).rejects.toThrow(/doesn’t contain PunchIn data/i)
  })

  it('throws on corrupt JSON', async () => {
    const b64 = btoa('not json{').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await expect(decodeSnapshot('r' + b64)).rejects.toThrow(/corrupted/i)
  })
})

describe('buildShareUrl', () => {
  it('builds a hash-fragment link', () => {
    expect(buildShareUrl('gABC', 'https://app.test', '/')).toBe('https://app.test/#import=gABC')
  })
})

describe('parseImportCode', () => {
  it('extracts the code from a full share URL', () => {
    expect(parseImportCode('https://app.test/#import=gABC_123-x')).toBe('gABC_123-x')
  })

  it('accepts a bare code', () => {
    expect(parseImportCode('gABC123')).toBe('gABC123')
    expect(parseImportCode('  rXYZ  ')).toBe('rXYZ')
  })

  it('returns null for junk', () => {
    expect(parseImportCode('')).toBeNull()
    expect(parseImportCode('https://app.test/#import=!!!')).toBeNull()
    expect(parseImportCode('hello world')).toBeNull()
  })
})

describe('parseImportFromHash', () => {
  it('reads a code from a location hash', () => {
    expect(parseImportFromHash('#import=gABC')).toBe('gABC')
    expect(parseImportFromHash('import=gABC')).toBe('gABC')
  })

  it('returns null for non-import hashes', () => {
    expect(parseImportFromHash('#sync_token=abc')).toBeNull()
    expect(parseImportFromHash('')).toBeNull()
    expect(parseImportFromHash('#import=@@@')).toBeNull()
  })
})
