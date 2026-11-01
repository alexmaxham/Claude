# Plan finder

A site for comparing phone plans from Verizon, AT&T and T-Mobile plus MVNOs and prepaid carriers. Visitors answer three questions, get a ranked list, and shortlist up to four plans to compare side by side.

Built with [Astro](https://astro.build) as a fully static site. Live at https://alexmaxham.github.io/Claude/plans/ once merged (the repo's GitHub Pages deploy builds it into `/plans/`).

## Commands

Run these from the `planfinder/` folder.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Local server at http://localhost:4321/Claude/plans/ |
| `npm test` | Unit tests for ranking and comparison |
| `npm run build` | Type-check, check every data file against the schema, build into `dist/` |
| `npm run preview` | Serve the built site |

## Pages

- `/` guided finder: three questions rank every plan, with a "why it fits" line. Answers are kept in the URL so a ranking can be shared.
- `/plans/` every plan, filterable by carrier type, network and price. Accepts `?kind=mvno` and `?network=Verizon`.
- `/plans/<slug>/` one plan: full details, source link, when it was last checked, similar plans.
- `/carriers/` and `/carriers/<slug>/` carriers grouped by type, with their plans.
- `/compare/` the shortlist side by side, best value in each row marked. `?plans=a,b,c` opens a shared comparison.
- `/about/` how plans are ranked and compared.

The shortlist (max 4) is stored in the browser's localStorage, so it follows the visitor across pages.

## Editing plans and carriers

Every plan is one JSON file in `src/data/plans/`, every carrier one file in `src/data/carriers/`. The build fails with a clear message if a file is missing a field, uses a wrong value, or names a carrier that doesn't exist. Field meanings are documented in `src/lib/schema.ts`.

**The current plan data is a starting point, not checked facts.** Every plan has `"lastVerified": null`, which shows a "Price not yet verified" label on the site. To verify a plan, check it against the carrier page in its `sourceUrl`, fix anything that's different, and set `lastVerified` to today's date (`"2026-11-01"`).

To add a plan, copy a file in `src/data/plans/`, rename it (the file name becomes the URL), and edit it.

## Carrier logos

Logos are off until you add the files. Put the official logo (SVG preferred, or PNG with a transparent background) in `public/logos/`, then add its file name to the carrier, for example in `src/data/carriers/tmobile.json`:

```json
"logo": "tmobile.svg"
```

Until then, each carrier shows its monogram on its brand color. Check each carrier's brand guidelines before using its logo.

## Settings

- Site name: `SITE_NAME` in `src/lib/site.ts` (currently the placeholder "bars.").
- Colors and fonts: `src/styles/global.css`.
- Hosting somewhere else, e.g. a custom domain: build with `SITE_URL=https://example.com BASE_PATH=/ npm run build`.
