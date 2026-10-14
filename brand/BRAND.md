# ccstatus brand kit

The ccstatus mark is **direction H — "Flow «"**: the tool's own powerline separator,
doubled and pointed back (`«`) so the pair reads as the two **C**'s of Claude Code rather
than a forward/next arrow. It is built from the exact glyph ccstatus paints between status
segments — the mark _is_ the product.

- **Ink** `#14171C` · rgb(20, 23, 28) — the primary chevron and all wordmark text
- **Terracotta** `#C15F3C` · rgb(193, 95, 60) — the second chevron; a warm nod to Claude

One accent, used only inside the mark. Everything else is ink on a neutral ground.

## Files

### Symbol

| File                                        | Use                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `ccstatus-symbol.svg`                       | **Primary** two-tone mark, on light backgrounds                            |
| `ccstatus-symbol-reversed.svg`              | For dark backgrounds (white + terracotta, strokes thinned for irradiation) |
| `ccstatus-symbol-small.svg`                 | Small-size cut (bolder strokes); source for favicons ≤ 24 px               |
| `ccstatus-black.svg` / `ccstatus-white.svg` | One-colour black / white (strokes and fills flattened)                     |
| `ccstatus-mono-c15f3c.svg`                  | One-colour terracotta                                                      |
| `ccstatus-square.svg`                       | Mark centred on a padded 256×256 canvas (avatars / social)                 |
| `ccstatus-app-icon.svg`                     | Dark rounded tile, white + terracotta mark (home-screen / README hero)     |

### Lockups

| File                               | Use                                              |
| ---------------------------------- | ------------------------------------------------ |
| `ccstatus-horizontal.svg`          | Symbol + wordmark, side by side (default lockup) |
| `ccstatus-horizontal-reversed.svg` | Horizontal lockup for dark backgrounds           |
| `ccstatus-stacked.svg`             | Symbol above wordmark (square-ish contexts)      |

### Web / app icons

`favicon.ico` (16/32/48), `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon-48.png`,
`apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `maskable-512.png`,
`site.webmanifest`, and `head-snippet.html` (drop the snippet into a docs site `<head>`;
it assumes the icons sit at the web root).

### Preview & presentation

`*-512.png` (flat previews of each SVG), `ccstatus-presentation.html` + `board/slide-*.png`
(a one-direction presentation board with dev-tool mockups), and `board-spec.json`
(the board's source, for regeneration).

## Clear space & minimum sizes

- **Clear space:** keep free space on all sides equal to at least the width of one chevron
  (≈ 40 % of the mark's height). Nothing — type, edges, other marks — enters that zone.
- **Minimum symbol size:** 16 px. At 24 px and below use `ccstatus-symbol-small.svg` (or the
  favicon assets), whose heavier strokes keep the gap between the two chevrons open.
- **Minimum lockup size:** horizontal ≥ 110 px wide (≈ 24 px tall); stacked ≥ 96 px wide.

## Backgrounds

- **Light** → `ccstatus-symbol.svg` / `ccstatus-horizontal.svg`.
- **Dark** → `-reversed` symbol / lockup, or `ccstatus-white.svg`.
- **Busy or photographic** → the `ccstatus-app-icon.svg` tile, or a one-colour version with
  enough contrast.

## Misuse

Do not:

- recolour the mark outside the two brand colours, or swap which chevron is which colour;
- **flip it to point right** (`»`) — it must point back (`«`) to read as CC, not "next";
- rotate, skew, stretch, or change the stroke weight;
- add shadows, gradients, glows, or outlines;
- place the two-tone mark on a low-contrast background (use reversed or one-colour instead);
- re-letter or re-space the wordmark, or set it in another typeface.

## Typography

Wordmark: **IBM Plex Mono, weight 600** — a fitting terminal/developer face, and it matches
the `ccstatus` command you type. The lockup SVGs ship the wordmark as editable `<text>` with a
monospace fallback stack; **for final/production artwork, convert the text to outlines using
the licensed IBM Plex Mono** (SIL Open Font License) so the lockup is font-independent.

## Regenerating

Symbols and lockups are generated from two chevron paths plus the palette; the icon set and
one-colour variants come from `export_variants.py`, and the board from
`presentation_board.py board-spec.json`. The geometry: a 256×256 viewBox, two round-capped,
round-joined chevron strokes — ink `M 191 70 L 133 128 L 191 186`, terracotta
`M 123 70 L 65 128 L 123 186`, stroke width 30 (34 for the small cut).
