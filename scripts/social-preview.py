#!/usr/bin/env python3
"""Generate the GitHub social-preview cards (docs/social-preview*.svg + .png).

The cards mirror the in-app brand: the lucide-style Clock mark on the accent
square (#1f6feb), the "PunchIn" wordmark, and the product tagline. The wordmark
and tagline are rendered in the app's own type family — Noto Sans Display
(wordmark) and Noto Sans (tagline) — to match the UI.

Why outlines instead of <text>?
  GitHub does not load the Google Fonts stylesheet for an inline SVG, so a
  <text font-family="Noto Sans"> element would silently fall back to whatever
  sans-serif the viewer happens to have. We therefore convert the glyphs to
  vector <path> outlines so the cards render in Noto everywhere, with no font
  dependency at view time.

  Outlining the glyphs into artwork does NOT redistribute the font software, so
  no font binary is committed and no SIL OFL redistribution obligation is
  triggered by these assets. The fonts themselves are licensed under the SIL
  Open Font License 1.1 — see docs/licenses/OFL-1.1.txt and
  docs/THIRD-PARTY-LICENSES.md.

Run from the project root (build-time tools are not committed deps, like sharp
for icons.mjs and Playwright for screenshots):

    python3 -m venv /tmp/sp-venv && /tmp/sp-venv/bin/pip install fonttools
    npm install --no-save sharp
    /tmp/sp-venv/bin/python scripts/social-preview.py

The script downloads the Noto variable fonts on first run (cached under the
font dir) and shells out to `sharp` via Node for the PNG rasterization.
"""

import os
import subprocess
import sys
import tempfile
import urllib.request

ACCENT = "#1f6feb"
DARK = "#0F1117"
MUTED = "#6B7280"
WORDMARK_DARK_BG = "#FFFFFF"   # wordmark fill on dark backgrounds
WORDMARK_LIGHT_BG = "#111827"  # wordmark fill on light backgrounds

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
FONT_DIR = os.environ.get("NOTO_FONT_DIR", os.path.join(tempfile.gettempdir(), "punchin-noto"))

FONTS = {
    "display": (
        "NotoSansDisplay.ttf",
        "https://github.com/google/fonts/raw/main/ofl/notosansdisplay/NotoSansDisplay%5Bwdth%2Cwght%5D.ttf",
    ),
    "sans": (
        "NotoSans.ttf",
        "https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf",
    ),
}


def ensure_fonts():
    os.makedirs(FONT_DIR, exist_ok=True)
    paths = {}
    for key, (name, url) in FONTS.items():
        path = os.path.join(FONT_DIR, name)
        if not os.path.exists(path):
            print(f"downloading {name} …")
            urllib.request.urlretrieve(url, path)
        paths[key] = path
    return paths


def text_to_paths(font_path, text, font_size, weight, cx, baseline, letter_spacing=0.0):
    """Return an SVG <g> of outlined glyphs, centered horizontally on cx,
    sitting on the given baseline (SVG y-down coordinates)."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools.pens.svgPathPen import SVGPathPen

    f = TTFont(font_path)
    instantiateVariableFont(f, {"wght": weight, "wdth": 100}, inplace=True)
    upm = f["head"].unitsPerEm
    scale = font_size / upm
    cmap = f.getBestCmap()
    glyphset = f.getGlyphSet()
    hmtx = f["hmtx"]
    ls_fu = (letter_spacing / scale) if scale else 0  # letter-spacing px → font units

    pen_x = 0.0
    glyph_paths = []
    for ch in text:
        gname = cmap.get(ord(ch), ".notdef")
        pen = SVGPathPen(glyphset)
        glyphset[gname].draw(pen)
        d = pen.getCommands()
        if d:
            glyph_paths.append(f'<path transform="translate({pen_x:.2f},0)" d="{d}"/>')
        pen_x += hmtx[gname][0] + ls_fu
    total_fu = pen_x - ls_fu  # drop trailing letter-spacing
    origin_x = cx - (total_fu * scale) / 2
    # scale(scale,-scale) flips the font's y-up outlines into SVG's y-down space.
    return (
        f'<g transform="translate({origin_x:.2f},{baseline}) scale({scale:.5f},{-scale:.5f})">'
        + "".join(glyph_paths)
        + "</g>"
    )


def build_svg(fonts, wordmark_fill, glow_opacity):
    wordmark = text_to_paths(fonts["display"], "PunchIn", 96, 700, 640, 415, letter_spacing=-2)
    tagline = text_to_paths(
        fonts["sans"], "Precision time tracking for freelancers", 26, 400, 640, 460
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640">
  <defs>
    <radialGradient id="glow" cx="50%" cy="39%" r="30%">
      <stop offset="0%" stop-color="{ACCENT}" stop-opacity="{glow_opacity}"/>
      <stop offset="100%" stop-color="{ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Subtle blue glow behind icon -->
  <rect width="1280" height="640" fill="url(#glow)"/>
  <!-- Icon: blue rounded square (logo icon scaled 48→140, factor ≈2.917) -->
  <rect x="570" y="180" width="140" height="140" rx="28" fill="{ACCENT}"/>
  <!-- Clock face -->
  <circle cx="640" cy="250" r="41" fill="none" stroke="{DARK}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Clock hands -->
  <polyline points="640,225.5 640,250 656.3,258.2" fill="none" stroke="{DARK}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Wordmark (Noto Sans Display 700, outlined) -->
  <g fill="{wordmark_fill}">{wordmark}</g>
  <!-- Tagline (Noto Sans 400, outlined) -->
  <g fill="{MUTED}">{tagline}</g>
  <!-- Blue accent bar -->
  <rect x="0" y="628" width="1280" height="3" fill="{ACCENT}" opacity="0.6"/>
</svg>
'''


def rasterize_png(svg_path, png_path):
    """Flatten the (transparent) dark SVG onto the brand navy and write a PNG
    via Node + sharp — the same rasterizer scripts/icons.mjs uses."""
    node_script = f'''
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync({svg_path!r});
sharp(svg, {{ density: 144 }})
  .resize(1280, 640)
  .flatten({{ background: '{DARK}' }})
  .png()
  .toFile({png_path!r})
  .then(() => console.log('wrote', {png_path!r}))
  .catch((e) => {{ console.error(e); process.exit(1); }});
'''
    subprocess.run(["node", "-e", node_script], cwd=ROOT, check=True)


def main():
    fonts = ensure_fonts()
    dark = build_svg(fonts, WORDMARK_DARK_BG, 0.18)
    light = build_svg(fonts, WORDMARK_LIGHT_BG, 0.08)
    dark_path = os.path.join(DOCS, "social-preview.svg")
    light_path = os.path.join(DOCS, "social-preview-light.svg")
    with open(dark_path, "w") as fh:
        fh.write(dark)
    with open(light_path, "w") as fh:
        fh.write(light)
    print("wrote", dark_path)
    print("wrote", light_path)
    try:
        rasterize_png(dark_path, os.path.join(DOCS, "social-preview.png"))
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(
            "\nPNG step skipped — install Node + sharp first:\n"
            "  npm install --no-save sharp\n"
            f"({e})",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
