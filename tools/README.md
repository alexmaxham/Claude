# AH tools

Three tools share this folder and its styles: the **Image Resizer** (this folder's `index.html`), the **Screenshot Framer** (`screenshot-framer/`) and **Photo Compare** (`photo-compare/`). All follow the AH Brand Kit and run entirely in the browser.

# Image Resizer

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

# Screenshot Framer

Puts one or more phone screenshots in a frame, lines them up on an AH background, and saves one image.

- **Frames:** "AH frame" is a plain phone drawn by the tool; "No frame" just rounds the corners. The drawn frame takes the shape of whatever screenshot it is given, so a new phone, foldable or tablet works without adding anything. It is deliberately generic and unnamed: the brand kit rules out drawn pictures of real phones.
- **Frame options:** black, silver or white; a camera dot at the top centre, top left or none; corner roundness.
- **Layout:** side by side, staggered or fanned, with phone size and spacing. If the screenshots don't fit in one row at a useful size, they are split over two or three rows.
- **Canvas:** Ink, Paper or White; Wide, Portrait, Square, Tall or a custom size; the AH icon watermark bottom right.
- **Saving:** PNG, JPG or WebP, named `ah-screens-topic-platform-date`, or copied straight to the clipboard.

| File | What it is |
|---|---|
| `screenshot-framer/index.html`, `framer.css` | The page, and the few styles it adds to `styles.css` |
| `screenshot-framer/framer.js` | Layout, drawing and saving |

# Photo Compare

Puts photos taken on different phones into one image so they can be compared, for example the Xiaomi 18 Pro Max on the left and the Oppo Find X10 Pro Max on the right.

- **Photos:** drop one photo from each phone, two or more. The first is on the left; the arrows change the order.
- **Phone names:** type each phone's name next to its photo. Names go on the photo (bottom or top, left or centre), under it, or off. A file called `xiaomi-18-pro-max.jpg` fills its name in for you; camera names like `IMG_1234` don't.
- **Layout:** side by side, stacked or a grid, with space between the photos and around the edge.
- **Fill the space or show it all:** "Fill the space" uses a set canvas size (Wide 1600 × 900 and the rest) and crops each photo to fill its box. "Show it all" shows every photo whole: you set the width, and the image takes whatever height the photos need, with no bars. Drag a photo in the preview to choose which part shows; double-click to centre it. One zoom slider zooms every photo by the same amount, for close-up comparisons. A warning shows when a photo is enlarged past its real size.
- **Canvas and saving:** the same sizes, backgrounds, watermark and formats as the Screenshot Framer. Files are named `ah-compare-topic-platform-date`; the platform is left out with "Show it all".
- Photos longer than 8192 pixels on a side are scaled down to that when added. HEIC photos have to be converted to JPG first.

| File | What it is |
|---|---|
| `photo-compare/index.html`, `compare.css` | The page, and the few styles it adds to `styles.css` and the framer's `framer.css` |
| `photo-compare/compare.js` | Layout, drawing, dragging and saving |

## Hosting

**Live:** https://alexmaxham.github.io/Claude/ (Image Resizer), https://alexmaxham.github.io/Claude/screenshot-framer/ and https://alexmaxham.github.io/Claude/photo-compare/

The repo's GitHub Pages deploy (`.github/workflows/deploy.yml`) publishes this folder as the whole site on every push to the default branch. The resizer's first address, `/Claude/image-resizer/`, redirects to the root (`moved.html`). The pages ask search engines not to index them, but anyone with the link can open them.
