#!/usr/bin/env python3
"""Generate the GitHub social-preview cards (docs/social-preview*.svg + .png).

The cards mirror the in-app brand: the stopwatch mark on the accent square
(PunchIn Blue #2D5BF5), the "PunchIn" wordmark (with the accent-tinted capital
I), and the product tagline. The wordmark and tagline are rendered in the app's
own type family — Noto Sans Display (wordmark) and Noto Sans (tagline).

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

import base64
import os
import subprocess
import sys
import tempfile
import urllib.request

ACCENT = "#2D5BF5"             # PunchIn Blue (default accent)
DARK = "#0F1117"
MUTED = "#6B7280"
WORDMARK_DARK_BG = "#FFFFFF"   # wordmark fill on dark backgrounds
WORDMARK_LIGHT_BG = "#111827"  # wordmark fill on light backgrounds


def readable_ink(hex_color):
    """Foreground ink that stays legible on `hex_color`: white by default, dark
    ink once white drops below WCAG 3:1 graphic contrast. Mirror of
    src/utils/inkOnAccent.js readableInk — keep the two in sync."""
    h = hex_color.lstrip("#")
    def lin(c):
        s = int(c, 16) / 255
        return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4
    lum = 0.2126 * lin(h[0:2]) + 0.7152 * lin(h[2:4]) + 0.0722 * lin(h[4:6])
    white_contrast = (1 + 0.05) / (lum + 0.05)
    return "#FFFFFF" if white_contrast >= 3 else DARK


def stopwatch_group(tile_x, tile_y, tile_side, ink):
    """The stopwatch mark (24×24 geometry from src/iconSvg.js) scaled into the
    accent tile and stroked in `ink`."""
    glyph = tile_side * 0.58
    gscale = glyph / 24
    gx = tile_x + (tile_side - glyph) / 2
    gy = tile_y + (tile_side - glyph) / 2
    return (
        f'<g transform="translate({gx:.2f} {gy:.2f}) scale({gscale:.4f})" '
        f'fill="none" stroke="{ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M9.5 2.6h5"/>'
        '<path d="M12 2.6v2.4"/>'
        '<circle cx="12" cy="13.4" r="8.2"/>'
        '<path d="M12 13.4V8.6"/>'
        '<path d="M12 13.4l3 1.9"/>'
        f'<circle cx="12" cy="13.4" r="0.9" fill="{ink}" stroke="none"/>'
        "</g>"
    )

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


def text_to_paths(font_path, text, font_size, weight, cx, baseline, letter_spacing=0.0, tint=None, anchor="middle"):
    """Return an SVG <g> of outlined glyphs, centered horizontally on cx,
    sitting on the given baseline (SVG y-down coordinates). `tint`, if given, is
    a (set_of_char_indices, color) pair that fills those glyphs in `color`
    (overriding the parent group fill) — used for the accent-tinted capital I."""
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

    tint_idx, tint_color = tint or (set(), None)
    pen_x = 0.0
    glyph_paths = []
    for i, ch in enumerate(text):
        gname = cmap.get(ord(ch), ".notdef")
        pen = SVGPathPen(glyphset)
        glyphset[gname].draw(pen)
        d = pen.getCommands()
        if d:
            fill_attr = f' fill="{tint_color}"' if i in tint_idx else ""
            glyph_paths.append(f'<path transform="translate({pen_x:.2f},0)" d="{d}"{fill_attr}/>')
        pen_x += hmtx[gname][0] + ls_fu
    total_fu = pen_x - ls_fu  # drop trailing letter-spacing
    if anchor == "start":
        origin_x = cx                                  # cx is the left edge
    else:
        origin_x = cx - (total_fu * scale) / 2         # cx is the center
    # scale(scale,-scale) flips the font's y-up outlines into SVG's y-down space.
    return (
        f'<g transform="translate({origin_x:.2f},{baseline}) scale({scale:.5f},{-scale:.5f})">'
        + "".join(glyph_paths)
        + "</g>"
    )


def build_svg(fonts, wordmark_fill, glow_opacity):
    # Tint the capital I (index 5 of "PunchIn") with the accent, like the wordmark.
    wordmark = text_to_paths(fonts["display"], "PunchIn", 96, 700, 640, 415, letter_spacing=-2, tint=({5}, ACCENT))
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
  <!-- Icon: accent rounded square (logo icon scaled to 140) -->
  <rect x="570" y="180" width="140" height="140" rx="28" fill="{ACCENT}"/>
  <!-- Stopwatch mark (matches src/iconSvg.js), tinted for contrast -->
  {stopwatch_group(570, 180, 140, readable_ink(ACCENT))}
  <!-- Wordmark (Noto Sans Display 700, outlined) -->
  <g fill="{wordmark_fill}">{wordmark}</g>
  <!-- Tagline (Noto Sans 400, outlined) -->
  <g fill="{MUTED}">{tagline}</g>
  <!-- Blue accent bar -->
  <rect x="0" y="628" width="1280" height="3" fill="{ACCENT}" opacity="0.6"/>
</svg>
'''


def build_web_card(fonts, shot_b64):
    """The web Open Graph card (1200x630): brand lockup + tagline on the left,
    the real dark phone timer screenshot bleeding off the right edge."""
    # Phone screenshot rect: left edge at 768 (right third of the 1200 canvas),
    # 34px top inset, 360 wide, 644 tall — intentionally 14px taller than the 630
    # canvas so it bleeds off the bottom, lifted/sized so the first active timer
    # (running time + earnings) sits fully in frame. rx = rounded-corner radius.
    px, py, pw, ph, rx = 768, 34, 360, 644, 34

    tile_x, tile_y, tile_side = 72, 56, 60
    wordmark = text_to_paths(
        fonts["display"], "PunchIn", 40, 700,
        tile_x + tile_side + 22, 100, letter_spacing=-1, tint=({5}, ACCENT), anchor="start",
    )
    head1 = text_to_paths(fonts["display"], "Precision time tracking", 56, 700, 72, 255, anchor="start")
    head2 = text_to_paths(fonts["display"], "for freelancers", 56, 700, 72, 320, anchor="start")
    subline = text_to_paths(fonts["sans"], "Free · offline · no account", 26, 400, 72, 388, anchor="start")
    url = text_to_paths(fonts["sans"], "trackmytime.today", 26, 600, 72, 432, anchor="start")

    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="glow" cx="78%" cy="50%" r="45%">
      <stop offset="0%" stop-color="{ACCENT}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="{ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="phoneClip"><rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="{rx}" ry="{rx}"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="{DARK}"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <image xlink:href="data:image/png;base64,{shot_b64}" x="{px}" y="{py}" width="{pw}" height="{ph}"
         preserveAspectRatio="xMidYMin slice" clip-path="url(#phoneClip)"/>
  <rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="{rx}" ry="{rx}" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/>
  <rect x="{tile_x}" y="{tile_y}" width="{tile_side}" height="{tile_side}" rx="14" fill="{ACCENT}"/>
  {stopwatch_group(tile_x, tile_y, tile_side, readable_ink(ACCENT))}
  <g fill="{WORDMARK_DARK_BG}">{wordmark}</g>
  <g fill="#FFFFFF">{head1}{head2}</g>
  <g fill="{MUTED}">{subline}</g>
  <g fill="{ACCENT}">{url}</g>
  <rect x="0" y="626" width="1200" height="4" fill="{ACCENT}" opacity="0.65"/>
</svg>
'''


def rasterize_png(svg_path, png_path, width=1280, height=640):
    """Flatten the (transparent) dark SVG onto the brand navy and write a PNG
    via Node + sharp — the same rasterizer scripts/icons.mjs uses."""
    node_script = f'''
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync({svg_path!r});
sharp(svg, {{ density: 144 }})
  .resize({width}, {height})
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
        shot_path = os.path.join(DOCS, "screenshots", "phone-dark", "timer.png")
        if not os.path.exists(shot_path):
            print(f"\nweb card skipped — screenshot not found: {shot_path}", file=sys.stderr)
            sys.exit(1)
        with open(shot_path, "rb") as fh:
            shot_b64 = base64.b64encode(fh.read()).decode("ascii")
        web_svg = build_web_card(fonts, shot_b64)
        app_public = os.path.join(ROOT, "app", "public")
        web_png = os.path.join(app_public, "social-card.png")
        with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as tf:
            tf.write(web_svg)            # the base64 image makes this SVG large — temp only, not committed
            web_svg_tmp = tf.name
        try:
            rasterize_png(web_svg_tmp, web_png, 1200, 630)
        finally:
            os.remove(web_svg_tmp)
        print("wrote", web_png)
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
