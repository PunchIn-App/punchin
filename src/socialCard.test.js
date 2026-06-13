import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolve from this file's directory rather than `new URL(..., import.meta.url)`:
// under the jsdom test environment a relative `new URL()` resolves against the
// jsdom document base (http://localhost), so `fileURLToPath` rejects it. The
// real filesystem path in `import.meta.dirname` sidesteps that entirely.
const pngPath = join(import.meta.dirname, '../app/public/social-card.png');
const indexHtmlPath = join(import.meta.dirname, '../app/index.html');

describe('social share card asset', () => {
  it('social-card.png is a valid 1200x630 PNG', () => {
    const png = readFileSync(pngPath);
    // PNG 8-byte signature
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    // IHDR chunk: width @ byte offset 16, height @ 20 (big-endian uint32)
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('index.html declares the Open Graph + Twitter card tags', () => {
    const html = readFileSync(indexHtmlPath, 'utf8');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('content="https://trackmytime.today/social-card.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('property="og:url" content="https://trackmytime.today/"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });
});
