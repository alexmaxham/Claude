# Plan data research log

**Last verified: 1 November 2026, against the carriers' own websites.** 27 of the 28 plans now have `"lastVerified": "2026-11-01"`. The one exception is Mint Unlimited (see "Still unverified").

**How the pages were read:** most carrier plan pages load their prices with JavaScript, so each page was opened in headless Chromium and the line-count selectors were clicked through 1, 2, 3 and 4 lines. Where a page also published an FCC Broadband Facts label or a plan-facts table, those numbers were cross-checked against the cards.

**Pricing rules used here** (see `src/lib/schema.ts`):
- `price` is 1 line with AutoPay, before taxes, unless `taxesIncluded` is true.
- `multiLine` is the regular per-line price with AutoPay at 2, 3 and 4 lines. Some carriers price 3 lines in a way that doesn't divide evenly, so those per-line values are rounded to the cent (e.g. $71.67).
- Limited-time promotions are left out. They are listed under "Promotions seen" below.

## Verified, by carrier

| Carrier | Page used | Notes |
| --- | --- | --- |
| Verizon | [myPlan](https://www.verizon.com/plans/unlimited/myplan), [Simplicity](https://www.verizon.com/plans/unlimited/), [Important plan information](https://www.verizon.com/support/important-plan-information/) | `/plans/unlimited/` now shows the new Simplicity Plan, so the myPlan plans point to `/plans/unlimited/myplan`. 1-line prices come from the plan cards and the Broadband Facts labels ($75 / $90 / $105 before AutoPay). 3- and 4-line prices are the "standard rates" in the page's own footnote. |
| AT&T | [Wireless plans](https://www.att.com/plans/wireless/) | Prices come from the line selector and the page's plan-facts table. |
| T-Mobile | [Cell phone plans](https://www.t-mobile.com/cell-phone-plans) | Prices come from the Broadband Facts labels (full price at 1–4 lines) minus the $5/line AutoPay discount. The $5.49 per-line fee is confirmed on the labels. |
| Google Fi | [Plans](https://fi.google.com/about/plans) | The people selector doesn't respond in a headless browser, but every price at 1–6 people is in the page's HTML. |
| Visible | [Plans](https://www.visible.com/plans) | Regular prices come from the "plan facts" labels. |
| Cricket | [Phone plans](https://www.cricketwireless.com/plans/phone) | `cell-phone-plans` now redirects here. 2–4 line totals come from the line selector. |
| Boost | [Plans](https://www.boostmobile.com/plans), [Multi-line](https://www.boostmobile.com/plans/multiline) | |
| Metro | [Phone plans](https://www.metrobyt-mobile.com/phone-plans) | The old `cell-phone-plans` URL returns 404. |
| US Mobile | [Plans](https://www.usmobile.com/plans) | curl gets a Cloudflare challenge, but the headless browser loads the page. The FAQ confirms there are no multi-line discounts. |

## What changed (old → new)

### Prices
- **AT&T, all four 2.0 plans: prices went up by $15 at 1 line.** The old figures were $10 too low, and AT&T's advertised prices also include a $5/line "wireless discount". That discount is a bill credit for up to 36 months that only applies to new lines where you bring your own phone, so it's treated as a promotion and left out. The carrier's advertised 1-line AutoPay prices are $50 / $70 / $90 / $110, and ours are $5 higher. Each AT&T plan's `terms` explains the credit.
  - Value 2.0: $40 → $55 ($50 → $65 without AutoPay). Multi-line {4: $30} → {2: $50, 3: $40, 4: $35}.
  - Extra 2.0: $60 → $75 ($70 → $85). {4: $40} → {2: $65, 3: $55, 4: $45}.
  - Premium 2.0: $80 → $95 ($90 → $105). {4: $55} → {2: $85, 3: $70, 4: $55}.
  - Elite 2.0: $100 → $115 ($110 → $125). Multi-line added: {2: $105, 3: $90, 4: $75}.
- **Verizon:** 1-line prices confirmed (Welcome $65, Plus $80, Ultimate $95, and $10 more without AutoPay). Multi-line filled in. Welcome: {2: $55, 4: $30} → {2: $55, 3: $40, 4: $30}. Plus: {4: $45} → {2: $70, 3: $55, 4: $45}. Ultimate: added {2: $85, 3: $70, 4: $60}.
- **T-Mobile:** 1-line prices confirmed. Multi-line added. Essentials 2.0: {2: $45, 3: $35, 4: $30}. Experience More 2.0: {2: $70, 3: $56.67, 4: $50}. Experience Beyond 2.0: {2: $85, 3: $71.67, 4: $65}.
- **Google Fi Unlimited Standard:** $50 confirmed. Multi-line added: {2: $40, 3: $30, 4: $25}.
- **Cricket:** 1-line prices confirmed. Multi-line added. Smart: {2: $37.50, 3: $31.67, 4: $27.50}. Supreme: {2: $45, 3: $36.67, 4: $32.50}.
- **Boost Unlimited+:** $50 confirmed. Multi-line added: {2: $40, 3: $36.67, 4: $30}. These are ongoing account credits, not a promotion.
- Unchanged and confirmed: Visible+ $35, Visible+ Pro $45, Metro $50 and $55, Boost Unlimited $25, US Mobile Unlimited Premium $44.

### Names
- T-Mobile: Essentials → **Essentials 2.0**, Experience More → **Experience More 2.0**, Experience Beyond → **Experience Beyond 2.0**.

### Features
- **Verizon Unlimited Ultimate:** hotspot 60GB → 200GB (then unlimited at 6 Mbps). International "Calling, texting and data in many countries" → talk, text and 15GB of data in 210+ countries, plus Global Choice calling. Perks added: Verizon Family Plus, Identity Secure, 50% off two watch or tablet plans.
- **Verizon Welcome / Plus:** international "Mexico & Canada as an add-on" / "Calling and texting to Mexico & Canada" → every myPlan plan includes calls to Mexico & Canada and talk, text & data while there. Plus gets the perk "50% off one watch or tablet plan".
- **AT&T:** perks and international were missing. Premium 2.0 adds 20 Latin American countries and 50% off one tablet or watch line. Elite 2.0 adds talk, text & 20GB of data in 210+ destinations, a free tablet and watch line, and AT&T Turbo.
- **T-Mobile Experience Beyond 2.0:** perks Netflix, Apple TV, Hulu → Netflix Standard with ads, Hulu, T-Satellite. Apple TV is now $3/mo, not included. International → texting and 15GB of data in 215+ countries, 30GB in Canada & Mexico.
- **T-Mobile Experience More 2.0:** perks Netflix, Apple TV → Netflix Standard with ads. International → 5GB in 215+ countries, 15GB in Canada & Mexico.
- **Google Fi Unlimited Standard:** premium data 35GB → 50GB. Hotspot 15GB → 25GB. International "Data in 200+ destinations" → Canada & Mexico only, because 200+ destinations is only on Unlimited Premium. The "Works abroad" highlight was removed.
- **Visible+ / Visible+ Pro:** international detail filled in (Global Pass days, roaming in Mexico & Canada).
- **Cricket Smart Unlimited:** hotspot "Not listed" → 15GB. Perk: 100GB cloud storage.
- **Cricket Supreme Unlimited:** perks added: HBO Max Basic with Ads, 150GB cloud storage. Premium data stays 0, because its Broadband Facts label still says Cricket may slow data when the network is busy, even though the card says "Unlimited high-speed data".
- **Boost Unlimited:** premium data 0 → 30GB. Hotspot "Not listed" → add-on only. International "Mexico & Canada included" → not included.
- **Boost Unlimited+:** premium data 0 → 40GB. Hotspot "Not listed" → included (draws from plan data, no separate amount given). International → calls to 100+ and texts to 191+ countries.
- **Metro Unlimited 5G Data:** premium data 0 → 50GB. Hotspot "Not listed" → 8GB. Perk: 100GB Google One. International "Mexico & Canada included" → not listed on the page.
- **Metro Unlimited Premium 5G Data:** premium data 0 → unlimited. Hotspot "Not listed" → 25GB. Perk: 100GB Google One. International → texts to 210+ countries.
- **US Mobile Unlimited Premium:** premium data 150GB → unlimited. Hotspot 50GB → unlimited on the Dark Star network (varies by network). Networks: added T-Mobile, because US Mobile now offers all three (Warp, Dark Star, Light Speed). Perk "One perk of your choice" → free smartwatch plan on Warp, and one streaming perk (up to $15/mo) with 3+ lines.

### `sourceUrl` changes
- Verizon myPlan plans: `/plans/unlimited/` → `/plans/unlimited/myplan`.
- Cricket: `/cell-phone-plans` → `/plans/phone`.
- Metro: `/cell-phone-plans` (404) → `/phone-plans`.

### Plans added (7)
- **Verizon Simplicity Plan:** $45/line at any number of lines ($55 without AutoPay), or $30/line with the $15/mo switch discount for port-ins. 10GB hotspot, Mexico & Canada. Premium data is set to 500GB: Verizon's plan terms list no congestion slowdown for Simplicity (they do for Welcome), only a cut to 4 Mbps after 500GB.
- **Google Fi Unlimited Premium:** $65. {2: $55, 3: $45, 4: $40}. 100GB high-speed data, 50GB hotspot, 50GB of data in 200+ destinations.
- **Visible:** the base plan, labelled "Most popular". $25. Hotspot unlimited at 5 Mbps.
- **Cricket Select Unlimited:** $35 ($40 without AutoPay). {2: $32.50, 3: $30, 4: $25}. New lines only, hotspot add-on only.
- **Boost Unlimited Premium:** $60 ($65 without AutoPay). {2: $50, 3: $46.67, 4: $40}. 50GB premium data, North America Connect.
- **Metro $40 Period:** $40, taxes included, no AutoPay needed. 35GB before slowdowns.
- **US Mobile Unlimited Starter:** $25 at any number of lines. 20GB hotspot on Dark Star.

No plan files were deleted: every existing plan is still sold.

## Promotions seen (left out of the data)

- **Verizon myPlan:** a $10/mo account credit for 3+ new lines, for 36 months (e.g. Welcome at 4 lines shown as $27.50). Phone promo credits.
- **Verizon Simplicity:** the $15/mo switch discount is shown in `terms`, not `price`, because it depends on porting a number. Add-on bundles (perk bundles from $20/mo) aren't included.
- **AT&T:** the $5/line wireless (BYOD) credit for up to 36 months, and an extra $5/mo off each new line for 12 months at 4+ lines, so the 4-line card shows $25 / $35 / $45 / $65.
- **T-Mobile:** "3rd line free" via monthly bill credits.
- **Google Fi:** 50% off for 12 months when you bring a Pixel (ends 10 Nov 2026).
- **Visible:** code HOLIDAYHACK: Visible $19 for a year, and Visible+ $29 and Visible+ Pro $39 on the plan cards.
- **Boost Unlimited:** $10/mo for the first 6 months for new customers (needs AutoPay).
- **US Mobile:** port-in offer, Unlimited Premium $25 and Unlimited Starter $15 for 6 months. The page also mentions a $15/mo perk credit "for a year" with 3 Premium lines, but the FAQ describes it as ongoing.

## AutoPay discounts (checked 1 November 2026)

Every price on the site includes the AutoPay discount where a carrier offers one. Each plan page now shows the discount, how to qualify, and a pricing table with and without AutoPay. The terms are stored in each carrier's `autopayTerms`, and the per-line amount is `priceWithoutAutopay − price`.

| Carrier | Discount per line | How to qualify | Source |
| --- | --- | --- | --- |
| Verizon | $10 (labels say "up to $10") | Auto Pay and paper-free billing from a bank account or Verizon Visa Card. Debit and other credit cards don't qualify, except debit cards enrolled before 14 Feb 2024. | [Auto Pay FAQs](https://www.verizon.com/support/auto-pay-faqs/), [myPlan](https://www.verizon.com/plans/unlimited/myplan) |
| AT&T | $10 | AutoPay and paperless billing from a bank account or AT&T Points Plus Card. $5 with a debit card, $0 with other credit cards. Starts within 2 bills. | [Plans page legal text](https://www.att.com/plans/wireless/) |
| T-Mobile | $5 | AutoPay with an eligible payment method. Optional. | [Plans page](https://www.t-mobile.com/cell-phone-plans) |
| Cricket | $5 | Auto Pay. The first month is charged at the full price. | [Phone plans](https://www.cricketwireless.com/plans/phone) |
| Metro | $5 ($0 on $40 Period) | AutoPay. The first month is charged at the full price. | [Phone plans](https://www.metrobyt-mobile.com/phone-plans) |
| Boost | $5 | AutoPay. Turning it off adds $5. | [Plans](https://www.boostmobile.com/plans) |
| Google Fi, Visible, US Mobile | None | No AutoPay discount on their plan pages. US Mobile's AutoPay only renews the plan, though its port-in deals need it. | Plan pages |
| Mint | Unknown | Not checked: Cloudflare blocks the site from this environment. | — |

Assumption: the AutoPay discount applies to every line, so the "without AutoPay" multi-line prices add the per-line discount to each line. Verizon, AT&T, T-Mobile, Cricket, Metro and Boost all describe it as per line.

## Plan descriptions and deals

- `description` is a short, plain summary written from the verified plan details.
- `deals` holds limited-time offers seen on 1 November 2026 (listed under "Promotions seen" above). They appear in each plan page's Deals section and are never included in prices. The AT&T BYOD credit moved from `terms` to `deals`.
- Metro $40 Period: added `multiLine` at a flat $40 per line, from its Broadband Facts label ($40 / $80 / $120 / $160). Other Metro plans' multi-line prices are still not listed.

## Fees, discounts and coverage (checked 1 November 2026)

**Fees** (from the carriers' plan pages):
- T-Mobile: $5.49 per line monthly, and a $35 device connection charge per line ([plans](https://www.t-mobile.com/cell-phone-plans)).
- AT&T: activation fee up to $50 per line ([plans legal text](https://www.att.com/plans/wireless/)). We count the full $50.
- Metro: no activation fee when you order online ([phone plans](https://www.metrobyt-mobile.com/phone-plans)).
- Cricket and Metro: the first month is charged at the full price, and AutoPay savings start in month two.
- Verizon, Visible, Google Fi, US Mobile, Cricket and Boost: no activation fee is listed on their plan pages, so `oneTimePerLine` is null and the site says "+ any activation fee". Third-party sources say Verizon dropped its fee in June 2026, Cricket charges $25 in store (free online) and Boost charges $10 for used phones. Not confirmed on the carriers' sites.

**Discounts** (`src/data/discounts.json`):
- Verizon: Those Who Serve, 10% off each line (military, first responders, nurses, teachers). Students 10% ([first responders](https://www.verizon.com/featured/first-responders/), [teachers](https://www.verizon.com/featured/teachers/), [nurses](https://www.verizon.com/featured/nurses/), [students](https://www.verizon.com/featured/students/)). Employer discounts ([discounts](https://www.verizon.com/discounts/)).
- AT&T Appreciation Savings: 20% / 15% / 10% off Premium / Extra / Value 2.0 ([appreciation](https://www.att.com/offers/discount-program/appreciation/), [support article](https://www.att.com/support/article/wireless/KM1436361)).
- T-Mobile: 55+ two lines at $30 each ([55+](https://www.t-mobile.com/cell-phone-plans/unlimited-55-senior-discount-plans)), military savings ([military](https://www.t-mobile.com/cell-phone-plans/military-discount-plans)), and 15% Work Perks (plans page). The first responder page wasn't found.
- Lifeline ([Verizon Lifeline](https://www.verizon.com/support/lifeline/)). fcc.gov wasn't reachable, so no dollar amount is given.

**Coverage maps:** each carrier's `coverageUrl` was opened and loads. Boost's coverage page returned 404, so Boost plans link to the AT&T map. Mint couldn't be checked, so it links to the T-Mobile map.

## Carriers added 1 November 2026 (not yet verified)

xfinity.com, spectrum.com and straighttalk.com weren't reachable from this environment, so these plans come from web search and keep `lastVerified: null`. Verify them on the carriers' sites once those domains are allowed.

- **Xfinity Mobile, Mobile Plus:** $45/line, unlimited premium data, Global Travel Pass ([Comcast](https://corporate.comcast.com/stories/discover-the-best-value-with-xfinity-mobile-plus-the-ultimate-premium-wireless-experience), [UpPhone](https://www.upphone.com/cell-phone-plans/xfinity/xfinity-mobile-plus/)). The hotspot amount conflicts: 30GB (UpPhone) vs unlimited, slowed after 50GB ([Reviews.org](https://www.reviews.org/mobile/xfinity-mobile-cell-phone-plans/)). Requires Xfinity Internet. A $15/line promo for 12 months has been reported.
- **Spectrum Mobile (Charter), Unlimited Plus:** $50 for 1 line, $40/line from 2 lines, 50GB full-speed data, then 1 Mbps ([Navi](https://www.yournavi.com/plans/spectrum-unlimited-plus), [BestPhonePlans](https://www.bestphoneplans.net/plans/spectrum-mobile-unlimited-plus)). The hotspot amount conflicts (10GB vs 5GB). Requires Spectrum Internet, with $10/line more if a line keeps service without it ([HighSpeedInternet](https://www.highspeedinternet.com/providers/spectrum/mobile)).
- **Straight Talk:** Silver $45 (15GB hotspot), Gold $55 (50GB hotspot, Walmart+, 100GB cloud) and Platinum $65 (unlimited premium data and hotspot, 200+ destinations, Walmart+, 500GB cloud), after the 19 Oct 2026 upgrade ([GlobeNewswire](https://www.globenewswire.com/news-release/2026/10/19/3383537/0/en/straight-talk-supercharges-unlimited-plans-with-more-data-faster-5g-and-expanded-benefits.html), [GSMArena](https://www.gsmarena.com/verizons_straight_talk_upgrades_its_unlimited_plans_without_raising_prices-news-75128.php)). AutoPay terms, taxes and multi-line prices weren't confirmed.
- **Brand colors** for these three are approximate.

## More logos (1 November 2026)

- **Cricket** (`cricket.png`), **Metro** (`metro.svg`) and **US Mobile** (`us-mobile.svg`) come from the logo in each carrier's website header. US Mobile's logo is made for dark backgrounds, so its carrier file sets `logoBackground` to a dark tile instead of recoloring the logo.
- **Still missing:** Google Fi (hosted on www.gstatic.com) and Visible (hosted on s7d1.scene7.com), both blocked here. Mint is behind a Cloudflare check (challenges.cloudflare.com). Xfinity, Spectrum and Straight Talk sites are blocked too.

## Still unverified

| Plan | Why |
| --- | --- |
| Mint Unlimited | mintmobile.com returns a Cloudflare "you have been blocked" page to curl. In the headless browser, the Cloudflare challenge can't load because `challenges.cloudflare.com` isn't reachable from this environment. Nothing was changed. `lastVerified` stays null. |

These plans are verified for price and main details, but one field wasn't shown on the carrier's page:

| Plan | Field |
| --- | --- |
| T-Mobile Essentials 2.0 | `international` ("Mexico & Canada included") isn't on the current plan card or label. Left as it was. |
| Metro Unlimited 5G Data, $40 Period | International isn't listed on the plans page, so it's set to "Not listed". |
| Boost Unlimited+ and Unlimited Premium | Hotspot is included, but no separate amount is given, so it shows "Included (uses plan data)". |
| Boost, Google Fi | `networks` (AT&T for Boost, T-Mobile for Fi) isn't stated on the plan pages. Left as it was. |

## Open questions

| Plan | Question |
| --- | --- |
| Mint Unlimited | Check price ($30 on a 12-month upfront payment, $40 on 3 months), 50GB premium data and 20GB hotspot from a browser that can pass Cloudflare's check. |
| Verizon Simplicity Plan | Is premium data really 500GB (no congestion slowdown), or will Verizon add a deprioritization clause? Check the plan terms again. |
| Not yet added | Lower-tier unlimited plans left out to keep the list focused: Google Fi Unlimited Essentials ($35), T-Mobile Essentials Saver 2.0 ($50, up to 2 lines), Boost Global Connection ($40). |

## Logos

`att.svg`, `verizon.svg`, `boost.svg` and `tmobile.svg` in `public/logos/` come from [Simple Icons](https://simpleicons.org) (v16.36.0), colored with each brand's color. `tmobile.svg` is the magenta "T" mark that T-Mobile shares with its parent company, Deutsche Telekom. Simple Icons is CC0, but the logos are still the carriers' trademarks.

Still missing: Mint Mobile, Visible, Google Fi, US Mobile, Cricket and Metro. Add the official files from each carrier's press or brand page (see the README).
