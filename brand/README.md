# Maison Invitation: brand kit

Open **`brand/index.html`** in a browser for the visual guide. Every logo is a true vector: the lettering is
converted to outlines, so the files look identical in Figma, Illustrator, Canva, print shops and browsers with no
fonts installed. PNG exports (2000 px on the long side, transparent) are in `logo/png/`.

## Colours

| Name | Hex | Use |
|---|---|---|
| Cream | `#F7F3EC` | Backgrounds |
| Ink | `#1F1D1A` | Text, primary buttons, logo |
| Brass | `#A9824F` | Accent: "INVITATION", highlights, seals |
| Brass (text) | `#876740` | Brass for **small** text on cream (passes WCAG AA contrast) |
| Deep cream | `#EFE8DC` | Alternate sections, image backdrops |

## Typography

* **Fraunces** (serif display) for headlines. The wordmark uses Fraunces at weight 600, optical size 60.
* **Inter** (sans), widely tracked in capitals for labels (e.g. `INVITATION`).
* **Amiri** (Arabic serif) and **IBM Plex Sans Arabic** (Arabic UI). Never letter-space Arabic.
* Invitation designs also use Cormorant Garamond, Pinyon Script, Aref Ruqaa and Reem Kufi.
* All fonts are under the SIL Open Font License: free for commercial use and self-hosted in the theme.

## Logo files (`logo/`)

**Faithful to the original Canva logo**

| File | Use |
|---|---|
| `logo-primary.svg` | Main lockup: envelope-M + AISON, INVITATION in brass (transparent) |
| `logo-primary-on-cream.svg` / `logo-primary-on-ink.svg` | Same, with background |
| `logo-primary-reversed.svg` | Cream + brass for dark backgrounds (transparent) |
| `logo-primary-mono-black/ink/white.svg` | One-colour versions (stamps, embossing, single-colour print) |
| `logo-wordmark.svg` / `-cream` / `-brass-mark` | Mark + AISON only (website header, narrow spaces) |
| `logo-square.svg` / `-ink` / `-mono-black` | 1000 × 1000 square (social profile, marketplace listings) |
| `mark.svg`, `mark-brass.svg`, `mark-cream.svg` | The envelope-M on its own |

**Enhanced versions**

| File | Idea |
|---|---|
| `seal.svg` / `seal-ink.svg` | **Wax seal**: the mark inside a brass wax seal with MAISON / INVITATION around the edge. Stickers, packaging, the site hero, Instagram highlights |
| `mark-sealed.svg` | The envelope-M **sealed**: a brass wax dot where the flap meets. Favicon/app icon idea |
| `app-icon.svg` / `app-icon-cream.svg` | Rounded-square icon for Instagram/WhatsApp profile pictures and home-screen bookmarks |
| `logo-stacked.svg` / `-on-ink` | Monogram above MAISON · INVITATION in fine capitals: formal, centred uses (email signatures, thank-you cards) |
| `logo-arched.svg` | Arch-framed badge echoing the invitation designs: story covers, printed tags |
| `mark-fine.svg` | Hairline envelope-M for large decorative use (watermarks, backgrounds) |
| `favicon.svg` | Browser tab icon; switches to cream automatically in dark mode |

## Usage

* Keep clear space around the logo of at least the height of the "A".
* Don't stretch, recolour outside the palette, add effects, or re-set the wordmark in another font.
* On photos, use the reversed or mono-white version on a darkened area.
* Minimum widths: primary lockup 120 px, wordmark 90 px, mark 16 px.

## Regenerating

```bash
python3 tools/brand/build_logos.py   # rebuilds every SVG + the theme's logo snippet
npm run images                       # re-exports the PNGs
```
