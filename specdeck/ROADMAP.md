# SpecAtlas roadmap

Handoff notes for continuing work on SpecAtlas (this `specdeck/` folder). Read this together with `README.md`, which covers how the site, data, images, admin page and publishing work.

## Where things stand (October 20, 2026)

- **Live site:** https://specdeck-db.web.app (Firebase Hosting, project `specdeck-db`). There is no custom domain yet.
- **Content:** 28 devices. These are the 2026 flagship phones and tablets, plus the iPad Pro 11" and 13" (M5) from October 2025. Specs nobody could confirm are `null` and show as "Not confirmed".
- **Publishing:** merging to the default branch (`claude/gamified-todo-app-wc0pod`) deploys automatically through `.github/workflows/specdeck-deploy.yml`. Saves on the admin page (`/admin/`) publish within about 15 minutes through the same workflow.
- **Ads:** AdSense spots are built in but switched off (`src/lib/ads.ts` is empty). AdSense needs a custom domain before it will approve the site. Ad IDs come later.
- **Device images:** 16 devices have real images. These 12 still show the generated front-view drawing:
  - Galaxy S26, S26+, S26 Ultra
  - Galaxy Z Fold8, Z Fold8 Ultra, Z Flip8
  - Galaxy Tab S12 Ultra, Tab S12+
  - vivo X300 Ultra, Motorola Razr Fold, OnePlus 16, OnePlus Pad 4

## Decisions the owner has made

- **Merging:** open one PR per phase, then squash-merge it as soon as the build passes and the change has been checked in a browser. Tell the owner what went live. No need to wait for approval on each PR.
- **Analytics:** Google Analytics 4. Build it switched off until the owner provides a Measurement ID (`G-…`), and use Google's consent mode for visitors in the EEA, UK and Switzerland.
- **"Where to buy":** build it switched off. Links should work as plain links to the maker's store, Amazon and Best Buy now, and become affiliate links once tracking IDs are added. Price history waits for an affiliate price feed.
- **Device images:**
  - Use official renders. The owner likes **back-and-front** images (back and front of the device side by side). Front-only renders are fine too.
  - Every image goes through `scripts/lib/normalize-render.mjs`, which removes plain backgrounds, trims, and centers the device on a 1,200 px square.
  - Never use store photos, hands or busy scenes.
  - When the owner sends one image containing two models, split it down the gap between them.
- **Data:** never guess. Leave a value `null` when sources disagree, and keep a source URL on every device.
- **Hosting:** stay on Firebase for now. The owner is weighing Firebase plus a custom domain against moving to Hostinger. No change until they decide.

## Phases

Work top to bottom. Each phase is one PR.

### Phase 1: "Best of" pages and phone finder

**Done.** Rankings are defined in `src/lib/rankings.ts`; a ranking gets a page on its own once 3 devices qualify. The under-$800, under-$1,000, headphone jack and microSD lists have fewer than 3 today, so they don't appear yet.

- **Ranking pages** at `/best/<slug>/`, generated from the data, plus an index at `/best/`. Only generate a ranking with 3 or more qualifying devices.
  - Ranked lists use numbered positions, since the order is real.
  - Show the ranked value on every row, and say how many devices were left out because the value isn't confirmed.
  - Add `ItemList` JSON-LD, list the pages in the sitemap, and link them from the footer and a home-page section.
  - Candidate rankings:
    - phones: biggest battery, lightest, thinnest, biggest screen, brightest screen, fastest wired charging, fastest wireless charging, highest refresh rate, most RAM, highest-resolution main camera;
    - phones under $800 and under $1,000 (USD launch prices only);
    - foldables;
    - phones with a headphone jack, phones with microSD;
    - tablets: biggest battery, lightest, biggest screen.
- **Phone finder** at `/finder/`.
  - Filters: category, form factor, brand, maximum USD price, minimum battery, minimum RAM, screen size range, minimum charging speed, wireless charging, IP68, headphone jack, microSD.
  - Sort options: newest, price, battery, weight.
  - Keep filter state in the URL so searches can be shared.
  - When a filter is on, devices whose value is unconfirmed are hidden, and the page says how many were hidden.
  - Add the extra values as `data-*` attributes on `DeviceCard`.
  - Add "Finder" to the navigation rail and the bottom bar, with the `tune` icon.

### Phase 2: Size comparison, favourites, upcoming devices, spec search

**Done.** Size drawings come from `src/lib/size.ts`. Bar phones and tablets with an upright render use their image; foldables, sideways renders and devices without an image use the drawing. No devices are marked upcoming yet, so `/upcoming/` shows an empty state and stays out of the sitemap and footer until one is.

- **Size comparison:** draw 2 to 4 devices to scale side by side, using `body.dimensions` (height × width). Use their images when they have one, otherwise the drawing. Put it on the compare pages, and add a standalone `/size/` page.
- **Favourites:** a heart button on cards and device pages, stored in `localStorage` (no accounts), and a `/favorites/` page.
- **Upcoming:**
  - Use `status: "upcoming"` (already in the schema) for announced or rumoured devices.
  - Show a badge, and add an `/upcoming/` page.
  - Rumoured values must be labelled as such.
- **Spec search:** let the search box match spec values too (chipset, "IP68", "Wi-Fi 7" and so on), not just names. Pagefind, or a small index built from `devices.json`.

### Phase 3: Share images

- Generate an Open Graph image (1200 × 630 PNG) at build time:
  - for each device: its image, name and 3 or 4 key specs;
  - for each comparison: both devices, plus a "vs" line.
- Use them in `og:image` and the `Product` JSON-LD. Use `sharp` with an SVG template; no new services.

### Phase 4: "Where to buy" and Google Analytics 4 (both switched off)

- **`src/lib/affiliates.ts`:**
  - Store links per brand (official store) plus Amazon and Best Buy search links.
  - Add Amazon's tracking tag and other program IDs only once they're set.
  - Mark affiliate links `rel="sponsored"`, and add a disclosure line and a note in the privacy policy.
- **`src/lib/analytics.ts`:**
  - Empty Measurement ID means no script.
  - When set: gtag with consent mode v2 defaulted to denied for the EEA, UK and Switzerland, using Google's consent message. Update the privacy policy to match.
  - Track compare usage and finder filters as events.

### Phase 5: Admin tools

- **Completeness dashboard** on `/admin/`: for each device, the share of specs filled in, the missing fields and whether it has a photo, sortable so the gaps show first.
- **CSV import:** upload a spreadsheet, preview the parsed devices with validation errors, then save them as pending changes through the existing Firestore flow.
- **Change log:**
  - `admin-sync.mjs` records what changed in each publish, as a `changes` list on each device.
  - Device pages show "Updated <date>: <what changed>".
  - The sitemap's `lastmod` uses it.

### Phase 6: 2024–2025 flagships and previous models

- Research and add the major 2024–2025 flagships, roughly:
  - Galaxy S24 and S25 series, Z Fold/Flip 6 and 7;
  - iPhone 16 and 17 Pro, Pro Max and Air;
  - Pixel 9 and 10 series;
  - OnePlus 13 and 15;
  - Xiaomi 15 Ultra, vivo X200 Ultra, OPPO Find X8 Ultra, Sony Xperia 1 VII;
  - iPad Air M3, Galaxy Tab S10 and S11.
- Add a `predecessor` field (a slug) to the schema. Show "What changed from <previous model>" on device pages, and pre-render comparisons between each device and its predecessor.

## Working notes

- **Where the code is:**
  - Site code is in `specdeck/`.
  - The spec rows (the single source of truth for every spec shown) are in `src/lib/specs.ts`.
  - The data schema is in `src/lib/schema.ts`.
  - The comparison table, which is rendered both at build time and in the browser, is in `src/lib/compare-table.ts`.
- **Checks before any PR:**
  - `npm run build` (type check plus build).
  - Screenshots of the changed pages at 1280 px light and 390 px dark with Playwright. In the cloud environment it's at `/opt/node22/lib/node_modules/playwright`, with Chromium already installed.
- **Admin and publishing tests:**
  - Use the Firebase emulators: `firebase.emulators.json`, plus `/admin/?emulator=you@example.com`.
  - Run `admin-sync.mjs` with `FIRESTORE_URL=http://localhost:8080 ACCESS_TOKEN=owner`. The README has the steps.
- **Network in the cloud environment:**
  - It can't reach most websites, and WebFetch fails. Use web search for research.
  - Images or pages that need fetching can be collected by a one-off GitHub Actions job, since the runners have open internet. Review what it collects, then remove the job.
- **Writing:** plain, specific copy. Don't invent values. Every spec needs a source.
