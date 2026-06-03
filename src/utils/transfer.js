// Account-free, device-to-device data transfer (issue #77). A snapshot of the
// local database is serialised to JSON, gzip-compressed (native CompressionStream
// when available, otherwise sent uncompressed), encoded as URL-safe base64, and
// packed into a link fragment that can be opened or scanned on another device.
//
// A static link can't *sync* — it's a one-time snapshot — so this is a manual
// transfer, not continuous sync. Large histories can exceed URL/QR limits; the
// UI warns when that happens and falls back to the plain link.

const IMPORT_HASH_PREFIX = '#import='

function bytesToBase64Url(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function gzip(text) {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(new TextEncoder().encode(text))
  writer.close()
  const buf = await new Response(cs.readable).arrayBuffer()
  return new Uint8Array(buf)
}

async function gunzip(bytes) {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return new TextDecoder().decode(buf)
}

// Encodes a snapshot object into a transfer code. The first character flags the
// encoding: 'g' = gzip, 'r' = raw (uncompressed), so decode is self-describing.
export async function encodeSnapshot(snapshot) {
  const json = JSON.stringify(snapshot)
  if (typeof CompressionStream !== 'undefined') {
    try {
      const bytes = await gzip(json)
      return 'g' + bytesToBase64Url(bytes)
    } catch {
      /* fall through to raw encoding */
    }
  }
  return 'r' + bytesToBase64Url(new TextEncoder().encode(json))
}

export async function decodeSnapshot(code) {
  if (!code || code.length < 2) throw new Error('This transfer link is empty or incomplete.')
  const flag = code[0]
  const bytes = base64UrlToBytes(code.slice(1))

  let json
  if (flag === 'g') {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser can’t read compressed transfer links.')
    }
    json = await gunzip(bytes)
  } else if (flag === 'r') {
    json = new TextDecoder().decode(bytes)
  } else {
    throw new Error('This doesn’t look like a PunchIn transfer link.')
  }

  let obj
  try {
    obj = JSON.parse(json)
  } catch {
    throw new Error('This transfer link is corrupted.')
  }
  if (!obj || !Array.isArray(obj.jobs) || !Array.isArray(obj.entries) || !Array.isArray(obj.laborTypes)) {
    throw new Error('This transfer link doesn’t contain PunchIn data.')
  }
  return obj
}

export function buildShareUrl(code, origin, pathname) {
  const o = origin ?? (typeof location !== 'undefined' ? location.origin : '')
  const p = pathname ?? (typeof location !== 'undefined' ? location.pathname : '/')
  return `${o}${p}${IMPORT_HASH_PREFIX}${code}`
}

// Accepts a full share URL or a bare transfer code and returns the code, or
// null if the input isn't a recognisable transfer code.
export function parseImportCode(input) {
  if (!input) return null
  const trimmed = String(input).trim()
  const idx = trimmed.indexOf(IMPORT_HASH_PREFIX)
  if (idx !== -1) {
    const code = trimmed.slice(idx + IMPORT_HASH_PREFIX.length)
    return /^[gr][A-Za-z0-9\-_]+$/.test(code) ? code : null
  }
  return /^[gr][A-Za-z0-9\-_]+$/.test(trimmed) ? trimmed : null
}

// Reads an #import=… transfer code straight from a location hash.
export function parseImportFromHash(hash) {
  if (!hash) return null
  const h = hash.startsWith('#') ? hash : `#${hash}`
  if (!h.startsWith(IMPORT_HASH_PREFIX)) return null
  const code = h.slice(IMPORT_HASH_PREFIX.length)
  return /^[gr][A-Za-z0-9\-_]+$/.test(code) ? code : null
}
