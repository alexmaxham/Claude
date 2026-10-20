# Resize & Watermark (macOS)

Right-click images in Finder → **Quick Actions → Resize & Watermark**. Each image is resized to 1600×900 (cropped to fill) and stamped with your watermark image, then saved next to the original as `name-watermarked.jpg` (PNGs stay PNG). Originals are never changed. Works on many images at once.

Nothing to install beyond this folder: it's a Finder Quick Action that runs a JavaScript for Automation script built into macOS.

## Install

1. Download this `mac-watermark` folder to your Mac.
2. In Terminal:

   ```bash
   cd path/to/mac-watermark
   ./install.sh ~/Pictures/my-logo.png
   ```

   Use a PNG with a transparent background for the best-looking watermark.
3. Right-click any image in Finder → **Quick Actions** → **Resize & Watermark**.

If it doesn't show up, right-click any image → **Quick Actions → Customize…** and tick **Resize & Watermark**. (Or System Settings → **General → Login Items & Extensions** → ⓘ next to **Finder** on macOS 15+, **Privacy & Security → Extensions → Finder** on macOS 13–14.)

The first run may ask to allow notifications or file access; allow it.

**Keyboard shortcut (optional):** System Settings → Keyboard → Keyboard Shortcuts → Services → Files and Folders → Resize & Watermark.

## Settings

Edit `~/Library/Application Support/ResizeWatermark/config.json`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `width`, `height` | `1600`, `900` | Output size in pixels. |
| `fit` | `"crop"` | `crop` fills the size exactly, trimming evenly from the edges that don't fit. `fit` shrinks the whole photo to fit inside the size instead, so it may come out narrower or shorter. |
| `position` | `"bottom-right"` | `bottom-right`, `bottom-left`, `top-right`, `top-left` or `center`. |
| `watermarkSize` | `0.25` | Watermark width as a fraction of the image's shorter edge. |
| `margin` | `0.03` | Gap from the edges, as a fraction of the shorter edge. |
| `opacity` | `1` | `0` invisible to `1` solid. |
| `suffix` | `"-watermarked"` | Added to the output file name. |
| `outputFolder` | `""` | Save into a subfolder (e.g. `"Watermarked"`) instead of alongside. |
| `jpegQuality` | `0.9` | `0` to `1`. |
| `watermark` | support folder's `watermark.png` | Path to a different watermark image. |

Changes take effect on the next run. To change the watermark image, run `./install.sh new-logo.png` again (your settings are kept).

## Run from Terminal

```bash
osascript -l JavaScript ~/Library/Application\ Support/ResizeWatermark/watermark.js *.jpg
```

## Uninstall

```bash
./uninstall.sh
```
