# Specdeck

A spec database for phones and tablets, built with [Astro](https://astro.build) as a fully static site and styled with Material 3 Expressive.

- Every device gets its own page with the full spec sheet, structured data (`Product`, `BreadcrumbList`) and a canonical URL.
- Anyone can compare up to four devices side by side. Popular pairs are pre-rendered as their own pages (`/compare/a-vs-b/`) so search engines can index them.
- Listing, brand and compare pages, the sitemap and the JSON feed (`/devices.json`) are all generated from the device files. Adding a device file is the only step.

## Commands

Run these from the `specdeck/` folder.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start a local server at http://localhost:4321 |
| `npm run build` | Check every device file against the schema, then build the site into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run new-device -- "Brand" "Model" phone` | Create a blank device file to fill in |

Set `SITE_URL` to the production domain when building for release, for example `SITE_URL=https://specdeck.com npm run build`. Canonical links, the sitemap and structured data use it.

## Adding a new phone or tablet

1. Create the file:

   ```sh
   npm run new-device -- "Samsung" "Galaxy S27 Ultra" phone
   # foldables: add book-fold or flip after "phone"
   # tablets:   npm run new-device -- "Apple" "iPad Pro 13\" (M6)" tablet
   ```

   This writes `src/data/devices/samsung-galaxy-s27-ultra.json` with every field present and empty. The file name becomes the URL: `/phones/samsung-galaxy-s27-ultra/`.

2. Fill in what you can confirm. Leave anything unknown as `null` (or `[]` for lists). The site shows it as "Not confirmed", which is better than a guess.

3. Add at least one URL to `sources` (the manufacturer's spec page first), and set `checked` to the date you checked them.

4. Run `npm run build`. If a value has the wrong shape, the build stops and names the file and field.

The new device then shows up automatically on the home page, its category and brand pages, the compare picker, rival suggestions, the pre-rendered comparisons and the sitemap.

### Field notes

| Field | Format |
| --- | --- |
| `announced`, `released`, `checked` | `"2026-09-09"`, or `"2026-09"` when the day is unknown |
| `price` | `{ "amount": 1199, "currency": "USD", "config": "256 GB" }` |
| `art` | Two hex colors for the generated illustration, light then dark |
| `memory.ram_gb`, `memory.storage_gb` | Lists of numbers in GB: `[256, 512, 1024]` shows as 256 GB / 512 GB / 1 TB |
| `display.ppi` | Leave `null` to calculate it from size and resolution |
| `battery.wireless_w` | `0` means no wireless charging, `null` means unknown |
| `battery.life` | Use when the maker publishes playback time rather than mAh |
| `display.cover`, `body.folded` | Foldables only |
| `verified` | Set to `true` once every value is checked against the manufacturer's own spec sheet. This removes the "compiled from launch coverage" notice |

### Adding a new spec

Specs are defined once in `src/lib/specs.ts`. To add one, add the field to `src/lib/schema.ts` and a row to the matching section in `specs.ts`. Device pages, the compare table and structured data pick it up. Give the row `rank` and `better` if a higher or lower value is clearly better, so compare can highlight the best device.

### Adding a new category (watches, laptops…)

Add the category to the `category` enum in `schema.ts` and to `CATEGORY_PATH` and `CATEGORY_LABEL` in `src/lib/names.ts`, then add a page at `src/pages/<category>/index.astro` like `phones/index.astro`.

## Project layout

```
src/
  data/devices/      one JSON file per device
  lib/schema.ts      the data schema (validated at build time)
  lib/specs.ts       spec rows, formatting and "best" ranking
  lib/devices.ts     loading devices, rivals, compare pairs
  lib/compare-table.ts  comparison table, shared by pages and the browser
  pages/             routes: /, /phones/, /tablets/, /[category]/[slug]/, /compare/, /brands/
  scripts/           browser code: theme toggle, compare tray, filters, compare builder
  styles/global.css  Material 3 color, shape and motion tokens (light and dark)
```

## About the launch data

The first 26 devices (flagship phones and tablets released in 2026) were compiled from manufacturer announcements and launch coverage on 2026-10-20. Where sources disagreed, the value was left blank. Every device is marked `"verified": false` until someone checks it against the manufacturer's own spec sheet.
