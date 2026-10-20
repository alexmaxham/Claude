# SpecAtlas

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
| `npm run add-image -- <slug> <file-or-url> --credit "Brand" --source <url>` | Add a product photo to a device |

The site is hosted on Firebase Hosting in the `specdeck-db` project, at https://specdeck-db.web.app. Canonical links, the sitemap and structured data use that address; set `SITE_URL` when building to use another one (for example a custom domain).

## Deploying

```sh
npm run build
npx firebase-tools deploy --only hosting
```

`firebase.json` serves `dist/` with clean URLs and long-lived caching for hashed assets. `.firebaserc` points at the `specdeck-db` project.

## The admin page

Go to https://specdeck-db.web.app/admin/ and sign in with Google. From there you can:

- **Add a device:** a form with every spec field. Required fields and formats are checked before saving, using the same rules as the build.
- **Edit specs** of any device. The brand and model name can't change, since they set the page's URL.
- **Add or replace a photo:** pick an image file and enter the credit and source link. It's resized in the browser before upload.
- **Discard changes** that haven't been published yet.

Saved changes go live within about 15 minutes, with no other steps needed.

### Who can sign in

Only Google accounts listed in the Firestore document `config/editors` (field `emails`, a list) can read or save anything; `firestore.rules` enforces this. To add an editor, open the [Firestore console](https://console.firebase.google.com/project/specdeck-db/firestore/databases/-default-/data/~2Fconfig~2Feditors) and add their email to the list.

### How publishing works

1. Saving on the admin page stores the change in Firestore (`devices/<slug>` holds the device JSON, `photos/<slug>` the image).
2. The **SpecAtlas deploy** workflow (`.github/workflows/specdeck-deploy.yml`) runs every 10 minutes. When changes are waiting, `scripts/admin-sync.mjs` writes them into `src/data/devices/` and `src/assets/devices/`, then the site is built and deployed to Firebase Hosting, the files are committed to the default branch, and the changes are cleared from Firestore.
3. If a change breaks the build, nothing is deployed. The admin page shows that change as "Not published" with the reason, and other waiting changes go out on the next run. Fix it and save again.

The workflow also deploys on every push to the default branch that touches `specdeck/`, and can be started by hand from the Actions tab. It signs in to Google Cloud through Workload Identity Federation as the `specdeck-publisher` service account. No keys are stored in GitHub, and only this repository's default branch can use it. If the default branch is renamed, update the provider's condition in Google Cloud (IAM → Workload Identity Federation → `github` pool) and the branch in the workflow.

### Testing the admin page locally

```sh
npx firebase-tools emulators:start --only auth,firestore --project specdeck-db --config firebase.emulators.json
# in another terminal: add a test editor to the emulator
curl -X PATCH "http://localhost:8080/v1/projects/specdeck-db/databases/(default)/documents/config/editors" \
  -H "Authorization: Bearer owner" -H "Content-Type: application/json" \
  -d '{"fields":{"emails":{"arrayValue":{"values":[{"stringValue":"you@example.com"}]}}}}'
npm run build && npm run preview
# open http://localhost:4321/admin/?emulator=you@example.com
```

`FIRESTORE_URL=http://localhost:8080 ACCESS_TOKEN=owner node scripts/admin-sync.mjs import` pulls the emulator's saved changes into the repo, as the workflow does.

## Ads (Google AdSense)

Ad spots are built in but switched off. While `client` in `src/lib/ads.ts` is empty, no ad script loads, no spots render, `/ads.txt` is empty and the privacy policy says the site shows no ads.

To switch ads on:

1. Connect a custom domain to Firebase Hosting (AdSense won't approve a `web.app` address), and build with `SITE_URL` set to it.
2. Add the site in AdSense and wait for approval.
3. In AdSense, turn on a consent message for the EEA, UK and Switzerland (Privacy & messaging). It loads through the AdSense script, so no code change is needed.
4. Create a display ad unit for each spot, then fill in `src/lib/ads.ts`: `client` is your publisher ID (`ca-pub-…`), and each `slots` entry is a unit's `data-ad-slot` number.

The spots are below the device grid on listing pages, after the headline specs and after the spec sheet on device pages, and below the table on comparison pages. There are no ads on the admin page or the 404 page. Each spot is labelled "Advertisement" and reserves its height so the page doesn't jump when the ad loads. Once `client` is set, `/ads.txt` and the privacy policy's advertising section fill in automatically.

## Adding a new phone or tablet from the command line

The admin page is the easiest way. To do the same by hand:

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

### Adding a product photo

Devices without a photo show a generated illustration. To add one:

```sh
npm run add-image -- samsung-galaxy-s26-ultra ~/Downloads/s26-ultra.png \
  --credit "Samsung" --source "https://news.samsung.com/global/..."
```

The script accepts a local file or an image URL. Every device image is processed the same way (`scripts/lib/normalize-render.mjs`), so they all match: a plain background is removed, the device is trimmed and centered on a 1,200 px transparent square at the same size, and the result is saved as `src/assets/devices/<slug>.webp`. An image whose background isn't plain is refused. The script then adds an `image` entry (file, credit, source) to the device's JSON file. Pass `--alt` to override the default alt text, which is the device name.

At build time the photo is resized for each place it appears (cards, device page, compare table, 1× and 2× screens). It also becomes the link-preview image (`og:image`) and the `image` in the device's structured data. The device page shows the credit under the photo, linked to the source.

Use the maker's official press render of the **front** of the device, on a transparent or plain background. Manufacturers publish these in their newsroom or press kit for editorial use. Front renders keep the site uniform. Don't use photos from retailers or review sites unless you have permission.

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
| `image` | Written by `npm run add-image`; `file` must exist in `src/assets/devices/` |
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
