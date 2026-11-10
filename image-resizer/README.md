# AH Image Resizer

A small web app for AndroidHeadlines that resizes images, adds the AH watermark and renames them, one at a time or in bulk. It follows the AH Brand Kit (style guide v1 and the social media guide).

Everything runs in the browser. Images are never uploaded anywhere.

## Run it

Use the live link below, or open `index.html` in a browser. There is nothing to install or build.

The page loads the Archivo and Roboto fonts from Google Fonts, so it looks right when online and falls back to Arial offline.

## What it does

- **Bulk:** drop any number of images or a whole folder, or paste an image. One click downloads everything as a ZIP.
- **Sizes:** Wide 1600 × 900, Portrait 1080 × 1350, Tall 1080 × 1920, Square 1080 × 1080, YouTube thumbnail 1280 × 720, Link preview 1200 × 628, X header 1500 × 500, or a custom size. Images can be cropped to fill, fitted inside without cropping, or resized by width only.
- **Watermark:** the AH icon, or the icon plus androidheadlines.com, in any of nine positions, with size, opacity and edge spacing. Bottom right is the default. Picking the YouTube thumbnail size moves it to bottom left, as the brand kit asks.
- **Rename:** the kit's pattern, `ah-social-{topic}-{platform}-{date}-{number}`, which you can edit. `{name}` inserts the original file name.
- **Alt text:** every image gets alt text you can edit. It starts as a draft from the topic or file name; the tool does not look at the picture itself, so finish the wording by hand. The alt text is saved inside each JPG and PNG (in the standard IPTC "Alt Text (Accessibility)" field and the description field) and listed in `alt-text.csv` in the ZIP. WebP files can't carry it yet, so for those it is only in the list.
- **Formats:** JPG, PNG, WebP, or the same as the original.
- Settings are remembered in the browser. Light and dark mode follow the computer's setting.

## Files

| File | What it is |
|---|---|
| `index.html`, `styles.css` | The page and its AH styling |
| `app.js` | Resizing, watermark, renaming and downloads |
| `zip.js` | A small ZIP writer (no outside libraries) |
| `alt-text.js` | Alt text drafts from the topic or file name |
| `meta.js` | Writes alt text into JPG and PNG files |
| `assets/` | The real AH logo and icon files from the brand kit |
| `moved.html` | The redirect served at the tool's old address |
| `assets.js` | The AH icon embedded for the watermark; rebuild with `node make-assets.js` after replacing `assets/ah-icon.png` |

## Hosting

**Live:** https://alexmaxham.github.io/Claude/

The repo's GitHub Pages deploy (`.github/workflows/deploy.yml`) publishes this folder as the whole site on every push to the default branch. The old address, `/Claude/image-resizer/`, redirects to the new one (`moved.html`). The page asks search engines not to index it, but anyone with the link can open it.
