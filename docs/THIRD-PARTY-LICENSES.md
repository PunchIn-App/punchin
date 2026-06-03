# Third-Party Licenses

PunchIn's own source is licensed under the [Business Source License 1.1](../LICENSE).
This file documents third-party assets bundled with or used by the project whose
licenses differ from the project license.

## Fonts — Noto Sans family

PunchIn's interface uses Google's **Noto** typeface family:

| Family | Where it's used | Copyright |
|--------|-----------------|-----------|
| **Noto Sans** | Body / UI text (Tailwind `font-sans`) | © 2022 The Noto Project Authors |
| **Noto Sans Display** | Headings and the brand wordmark (Tailwind `font-display`) | © 2012 Google Inc. |
| **Noto Sans Mono** | Monospaced numerals / timers (Tailwind `font-mono`) | © 2022 The Noto Project Authors |

All three are licensed under the **SIL Open Font License, Version 1.1 (OFL-1.1)**.
The full license text is included at [`docs/licenses/OFL-1.1.txt`](licenses/OFL-1.1.txt)
and is also available with a FAQ at <https://openfontlicense.org>.

### How the fonts are used

- **At runtime** the fonts are loaded from the **Google Fonts CDN**
  (`fonts.googleapis.com` / `fonts.gstatic.com`), declared in
  [`app/index.html`](../app/index.html). The project does **not** bundle,
  self-host, or redistribute the font binaries — they are served by Google to
  the user's browser. This is plain *use* of the fonts, which the OFL permits
  freely.

- **At build time** the social-preview cards
  ([`docs/social-preview.svg`](social-preview.svg),
  [`docs/social-preview-light.svg`](social-preview-light.svg), and
  [`docs/social-preview.png`](social-preview.png)) render the wordmark and
  tagline by converting Noto glyphs to vector **outlines** (see
  [`scripts/social-preview.py`](../scripts/social-preview.py)). Per the OFL FAQ,
  artwork/documents created with a font — including text converted to outlines —
  are **not** bound by the OFL, and no font binary is committed to this repo.

Because no Noto font software is redistributed in this repository, the OFL's
bundling conditions are not triggered; the license is included here for
attribution and transparency.
