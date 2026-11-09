# AH Image Resizer

A small web app for AndroidHeadlines that resizes images, adds the AH watermark and renames them, one at a time or in bulk. Everything runs in the browser; images are never uploaded.

**Live:** https://alexmaxham.github.io/Claude/

The code is in [`image-resizer/`](image-resizer/). See [image-resizer/README.md](image-resizer/README.md) for what it does and how the files fit together. There is nothing to install or build: open `image-resizer/index.html` in a browser to run it locally.

Every push to the default branch publishes the tool to GitHub Pages (`.github/workflows/deploy.yml`). Pull requests run the same checks without deploying.

This repo used to hold SwitchWise, a phone plan comparison site, in `planfinder/`. It was removed in November 2026 and is still in the git history.
