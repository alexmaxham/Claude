# AH tools

Small web tools for AndroidHeadlines, styled with the AH Brand Kit. Everything runs in the browser; nothing is uploaded.

| Tool | Live | What it does |
|---|---|---|
| Image Resizer | https://alexmaxham.github.io/Claude/ | Resizes, watermarks and renames images in bulk, and adds alt text |
| Screenshot Framer | https://alexmaxham.github.io/Claude/screenshot-framer/ | Puts phone screenshots in a plain frame on an AH background |

The code is in [`tools/`](tools/). See [tools/README.md](tools/README.md) for what each tool does and how the files fit together. There is nothing to install or build: open `tools/index.html` in a browser to run them locally.

Every push to the default branch publishes the tools to GitHub Pages (`.github/workflows/deploy.yml`). Pull requests run the same checks without deploying.

This repo used to hold SwitchWise, a phone plan comparison site, in `planfinder/`. It was removed in November 2026 and is still in the git history.
