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

- `/` guided finder: four questions (lines, data, priority, hotspot) rank every plan, with a "why it fits" line. Answers are kept in the URL so a ranking can be shared.
- `/plans/` every plan, filterable by carrier type, network and price. Accepts `?kind=mvno` and `?network=Verizon`.
- `/plans/<slug>/` one plan: description, a pricing table for 1–4 lines with and without AutoPay, the AutoPay discount and how to qualify, plan details, current deals, source link, when it was last checked, and similar plans.
- `/carriers/` and `/carriers/<slug>/` carriers grouped by type, with their plans.
- `/compare/` the shortlist side by side, best value in each row marked, priced for 1–4 lines. `?plans=a,b,c&lines=4` opens a shared comparison.
- `/about/` how plans are ranked and compared.

The shortlist (max 4) and the number of lines are stored in the browser's localStorage, so they follow the visitor across pages.

## Multi-line pricing

A plan's `multiLine` field holds the price per line with 2, 3 or 4 lines, for example `"multiLine": { "2": 55, "4": 30 }`. When a visitor picks a number of lines the plan doesn't list, the site uses the one-line price and says so.

## Editing plans and carriers

Every plan is one JSON file in `src/data/plans/`, every carrier one file in `src/data/carriers/`. The build fails with a clear message if a file is missing a field, uses a wrong value, or names a carrier that doesn't exist. Field meanings are documented in `src/lib/schema.ts`.

**The current plan data is researched but not checked against the carriers' own sites.** Every plan has `"lastVerified": null`, which shows a "Price not yet verified" label on the site. [RESEARCH.md](RESEARCH.md) lists where each figure came from and what to check first. To verify a plan, check it against the carrier page in its `sourceUrl`, fix anything that's different, and set `lastVerified` to today's date (`"2026-11-01"`).

To add a plan, copy a file in `src/data/plans/`, rename it (the file name becomes the URL), and edit it.

## Carrier logos

Verizon, AT&T, T-Mobile and Boost have logos (see RESEARCH.md for where they came from). For the rest, put the official logo (SVG preferred, or PNG with a transparent background) in `public/logos/`, then add its file name to the carrier, for example in `src/data/carriers/tmobile.json`:

```json
"logo": "tmobile.svg"
```

Until then, each carrier shows its monogram on its brand color. Check each carrier's brand guidelines before using its logo.

## Settings

- Site name: `SITE_NAME` in `src/lib/site.ts` (currently the placeholder "bars.").
- Colors and fonts: `src/styles/global.css`.
- Hosting somewhere else, e.g. a custom domain: build with `SITE_URL=https://example.com BASE_PATH=/ npm run build`.
