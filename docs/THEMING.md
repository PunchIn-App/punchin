# PunchIn — Theming & Design-System Token Reference

> **Canonical home for the full Tailwind/CSS token tables, the typography/font setup, and the design-system token layer**, extracted from `CLAUDE.md` to keep that file lean. **`CLAUDE.md` → Theming keeps the colour conventions and the must-not-violate rules; this file holds the exhaustive value tables.** When you add or change a token, update it here. (`CLAUDE.md` → Documentation Maintenance points back to this file.)

## Typography & Fonts

The UI uses Google's **Noto** type family, mapped to Tailwind tokens in `tailwind.config.js`:

| Tailwind class | Family | Use |
|---|---|---|
| `font-sans` | Noto Sans | Default body / UI text |
| `font-display` | Noto Sans Display (falls back to Noto Sans) | Headings, the brand wordmark |
| `font-mono` | Noto Sans Mono | Timers / numerals |

- The fonts are **self-hosted** (no CDN): five variable WOFF2 files (Noto Sans normal+italic, Noto Sans Display normal+italic, Noto Sans Mono normal) live in `app/public/fonts/`, served at `/fonts/`, with `@font-face` rules at the top of `src/index.css` (each spans the full 100–900 weight axis). The Google Fonts `<link>` is gone from `app/index.html` (which now `preload`s the body face); the worker CSP (`worker/oauth.js`) is correspondingly tightened to `font-src 'self'` / `style-src 'self' 'unsafe-inline'`. The fonts are precached by the service worker (they sit in `app/public`, outside the `icons/**` glob-ignore) so the brand renders offline. **Noto Sans JP is intentionally not shipped** — it only existed in the design system for a "bad font" illustration the app never renders.
- **Print / export documents use the brand font too.** The invoice (`InvoiceModal.jsx`) and timesheet (`TimesheetsView.jsx`) print/PDF paths build a standalone print popup, which does **not** inherit the app stylesheet — so they go through `src/utils/printDocument.js`: `PRINT_FONT_HEAD` declares the same self-hosted `@font-face` (the popup is same-origin, so `/fonts/*.woff2` resolve), and `openPrintWindow()` waits for `document.fonts.ready` before printing (falling back to a short delay) so exports render in Noto instead of a system-UI fallback. Set print `font-family` to `'Noto Sans'` / `'Noto Sans Display'` / `'Noto Sans Mono'` (never `-apple-system` or `SF Mono`).
- All three Noto families are licensed under the **SIL Open Font License 1.1**. The license text lives at `docs/licenses/OFL-1.1.txt`, and `docs/THIRD-PARTY-LICENSES.md` records the attribution and how the fonts are used. Now that the binaries are committed and redistributed, the OFL requires shipping that license alongside them — it does.
- The social-preview cards render the wordmark/tagline as **outlined vector paths** (not `<text>` + font, and not embedded font binaries) so they show Noto on GitHub without a webfont. Regenerate them with `scripts/social-preview.py` whenever the wordmark, tagline, or brand mark changes — never hand-edit the `<path>` data.

## Tailwind Custom Color Tokens

`tailwind.config.js` maps semantic token names to CSS custom properties so both Tailwind utilities and CSS variables stay in sync:

| Tailwind class | CSS variable | Dark | Light |
|---|---|---|---|
| `bg-appBg` | `--bg-primary` | `#0F1117` | `#F4F5F7` |
| `bg-appCard` | `--bg-secondary` | `#161923` | `#FFFFFF` |
| `bg-appInput` | `--bg-tertiary` | `#1E2232` | `#EDEFF3` |
| `bg-appNav` | `--bg-nav` | `#0C0E14` | `#FFFFFF` |
| `border-appBorder` | `--border-color` | `#2A2F45` | `#E3E6EC` |
| `border-appBorderLight` | `--border-light` | `#1E2232` | `#E5E7EB` |
| `text-appText` | `--text-primary` | `#FFFFFF` | `#111827` |
| `text-appTextMuted` | `--text-muted` | `#8A93A6` | `#6B7280` |
| `text-appTextDisabled` | `--text-disabled` | `#374151` | `#D1D5DB` |
| `bg-appAccent` / `text-appAccent` | `--accent-rgb` | `#2D5BF5` (user-configurable) | `#2348DB` (default; user-configurable) |
| `text-appOnAccent` | `--on-accent` | `#FFFFFF` (legible ink ON the accent) | flips to `#0F1117` on a light/pastel accent |

Two additional CSS variables exist in `index.css` but have **no Tailwind token** — use them via `var()` in CSS files or Recharts style props only, not via Tailwind utilities:

| CSS variable | Dark | Light | Use |
|---|---|---|---|
| `--text-secondary` | `#C7D0E0` | `#374151` | secondary labels, axis text |
| `--text-darker` | `#4B5563` | `#9CA3AF` | tertiary/dimmed text |

The accent color is stored as a hex string in the `accentColor` setting. `App.jsx` converts it to space-separated RGB values and writes them to `--accent-rgb` on the root element (plus `--accent` as raw hex, and `--on-accent` = `readableInk(accent)` for legible on-accent text). The Tailwind token uses `rgb(var(--accent-rgb) / <alpha-value>)` so opacity modifiers like `bg-appAccent/30` work correctly. **Never use hardcoded `amber-*` Tailwind classes** — always use `appAccent` so the user's chosen color is respected. **For text/icons sitting ON an accent fill, use `text-appOnAccent`** (never a hardcoded `text-[#0F1117]` / `text-white`) so the foreground stays legible when the user picks a light/pastel accent.

In JSX, use Tailwind token classes rather than raw hex values or inline `var()` calls — except for `--text-secondary` and `--text-darker` which have no token. `color-scheme: dark/light` is set on `:root`/`.light` in `index.css` so browser-native controls (date/time pickers, caret, scrollbars) render in the correct scheme.

## Design-system tokens

`index.css` also defines the PunchIn design-system token layer (CSS custom properties; reference via `var()`):

- **Type scale / weights / tracking:** `--text-display|h1|h2|lg|base|sm|xs|2xs`, `--weight-regular…black`, `--track-tight|normal|over`
- **Radii:** `--radius-sm` 8 · `--radius` 11 · `--radius-md` 13 · `--radius-lg` 16 · `--radius-xl` 20 · `--radius-pill`
- **Spacing:** `--space-1…8` (4px base)
- **Elevation:** `--shadow-card|pop|modal` + `--shadow-accent` (`color-mix` against `--accent`)
- **Status colours (per theme):** `--green --violet --amber --red`
- **Pastel presets:** `--pastel-red…gray` — the suggested accent + labor-type colours (users may still pick any custom hex)

The radii/spacing/type/shadow/pastel scales are theme-independent; `--accent`, `--accent-rgb`, and the status colours are overridden under `.light`.
