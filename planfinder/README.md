# Plan finder

A site for comparing phone plans from Verizon, AT&T and T-Mobile plus MVNOs and prepaid carriers. Visitors answer four questions, get a ranked list, and shortlist up to four plans to compare side by side. A savings calculator, real total costs, discounts, coverage links and buying guides help them pay less.

Built with [Astro](https://astro.build) as a fully static site. Live at https://alexmaxham.github.io/Claude/ (published by `.github/workflows/deploy.yml` on every push to the default branch).

## Commands

Run these from the `planfinder/` folder.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Local server at http://localhost:4321/Claude/ |
| `npm test` | Unit tests for ranking and comparison |
| `npm run build` | Type-check, check every data file against the schema, build into `dist/` |
| `npm run preview` | Serve the built site |

## Pages

- `/` guided finder: four questions (lines, data, priority, hotspot) rank every plan, with a "why it fits" line. Answers are kept in the URL so a ranking can be shared.
- `/plans/` every plan, filterable by carrier type, network and price. Accepts `?kind=mvno` and `?network=Verizon`.
- `/plans/<slug>/` one plan: description, a pricing table for 1–4 lines with and without AutoPay, the AutoPay discount and how to qualify, plan details, current deals, source link, when it was last checked, and similar plans.
- `/carriers/` and `/carriers/<slug>/` carriers grouped by type, with their plans.
- `/compare/` the shortlist side by side, best value in each row marked, priced for 1–4 lines. `?plans=a,b,c&lines=4` opens a shared comparison.
- `/savings/` savings calculator: current bill, lines and needs → plans that fit, first-year cost and yearly savings.
- `/discounts/` discount programs (military, first responders, nurses, teachers, students, 55+, employer, Lifeline), filterable with `?for=military` etc.
- `/guides/` how much data you use, checking coverage, switching carriers, phone deals vs bringing your own (with a calculator), and a glossary.
- `/vs/` head-to-head pages for popular pairs (list in `src/data/versus.json`).
- `/changes/` and `/changes.xml` (RSS): log of plan data changes (`src/data/changes.json`).
- `/about/` how plans are ranked and compared. `/privacy/` privacy page.

The shortlist (max 4) and the number of lines are stored in the browser's localStorage, so they follow the visitor across pages.

## Multi-line pricing

A plan's `multiLine` field holds the price per line with 2, 3 or 4 lines, for example `"multiLine": { "2": 55, "4": 30 }`. When a visitor picks a number of lines the plan doesn't list, the site uses the one-line price and says so.

## Editing plans and carriers

Every plan is one JSON file in `src/data/plans/`, every carrier one file in `src/data/carriers/`. The build fails with a clear message if a file is missing a field, uses a wrong value, or names a carrier that doesn't exist. Field meanings are documented in `src/lib/schema.ts`.

**The current plan data is researched but not checked against the carriers' own sites.** Every plan has `"lastVerified": null`, which shows a "Price not yet verified" label on the site. [RESEARCH.md](RESEARCH.md) lists where each figure came from and what to check first. To verify a plan, check it against the carrier page in its `sourceUrl`, fix anything that's different, and set `lastVerified` to today's date (`"2026-11-01"`).

To add a plan, copy a file in `src/data/plans/`, rename it (the file name becomes the URL), and edit it.

## Real cost and fees

Each carrier file has `fees` (`monthlyPerLine`, `oneTimePerLine` or null if not listed, plus notes) and `autopayStartsMonth2`. First-year and two-year costs (`src/lib/cost.ts`) add these to the plan price; the finder ranks on price plus monthly fees. Taxes are left out unless a plan includes them.

## Discounts and price changes

- `src/data/discounts.json`: one entry per program, with the groups it covers, a source link and the date it was checked.
- `src/data/changes.json`: add an entry whenever plan data changes. It shows on `/changes/`, in the RSS feed and on the plan's page.

## Ads

Ad slots are placed on the home, plans, plan, carrier, compare, savings, discounts, head-to-head and guide pages. They render nothing until you turn ads on in `src/lib/ads.ts` (AdSense publisher ID plus one ad unit ID per slot). To see where they are, run `npm run dev` or build with `PUBLIC_AD_PLACEHOLDERS=true`.

Before turning ads on: update `/privacy/` if needed (it switches to an ads notice automatically), and note that AdSense needs `ads.txt` at the root of your domain, which requires a custom domain rather than the github.io project URL.

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
