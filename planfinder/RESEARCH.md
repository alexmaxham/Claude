# Plan data research log

**Last researched: 1 November 2026.** The carriers' own websites were not reachable from the session that did this research, so every figure below comes from third-party sites found by web search. That's why every plan still has `"lastVerified": null` and shows "Price not yet verified" on the site.

**To verify a plan:** open its `sourceUrl` on the carrier's site and check the price (with and without AutoPay), the multi-line prices, premium data, hotspot and perks. Fix anything that's different, then set `lastVerified` to the date you checked.

## What changed from the first version

- **AT&T:** retired Unlimited Starter, Extra and Premium on 13 March 2026. Replaced them with Unlimited Value 2.0, Extra 2.0, Premium 2.0 and Elite 2.0.
- **Verizon:** added Unlimited Ultimate.
- **Mint Unlimited:** premium data went from 35GB to 50GB, and hotspot from 10GB to 20GB.
- **Visible+:** now $35 with unlimited premium data and a 10 Mbps hotspot. Added Visible+ Pro at $45.
- **Cricket:** "Unlimited" became Supreme Unlimited and Smart Unlimited.
- **Metro:** now Unlimited 5G Data and Unlimited Premium 5G Data, with a 5-year price guarantee.
- **Boost:** "Infinite Access" didn't appear in current sources. Replaced it with Unlimited and Unlimited+.
- **T-Mobile:** added the $5.49 per-line fee that started 12 October 2026.
- **New field:** `taxesIncluded`, true for Visible, US Mobile, Cricket and Metro.
- **New data:** multi-line prices (`multiLine`) where a source listed them.

## Open questions: check these first

| Plan | Question |
| --- | --- |
| Verizon Unlimited Ultimate | Sources say $95 or $90 for one line. Hotspot (60GB) and international details weren't in any source. 4-line price: $55 or $60? |
| Verizon Welcome / Plus | No 3-line price found. Plus has no 2-line price either. |
| AT&T 2.0 plans (all) | Is the 4-line price (Value $30, Extra $40, Premium $55) with or without AutoPay? One review says Premium is $50 at 4 lines. Perks and international weren't in any source. |
| AT&T Elite 2.0 | No multi-line price found. |
| T-Mobile (all) | No reliable multi-line prices: current deals are promotions such as a free third line. Is Essentials still $65 without AutoPay? |
| Mint Unlimited | Sources range from $20 to $35. $30 assumes a 12-month upfront payment. |
| Google Fi Unlimited Standard | The 4-line price is either $25/line or a 12-month promotion. Premium data (35GB) and hotspot (15GB) weren't confirmed. |
| Cricket Smart Unlimited; Metro, Boost (all) | Hotspot and premium data weren't in any source, so the site shows "Hotspot not listed" and "No premium data". |
| Boost | Does it still sell Infinite Access? |

## Sources

- T-Mobile: [UpPhone Experience More](https://www.upphone.com/cell-phone-plans/t-mobile/t-mobile-experience-more-plans-review-cost-price/), [UpPhone Experience Beyond](https://www.upphone.com/cell-phone-plans/t-mobile/t-mobile-experience-beyond-plans-review-cost-price/), [ShopCellPlans](https://shopcellplans.com/t-mobile-plans/), [Month13](https://month13mobile.com/leaving/t-mobile), [Reviews.org](https://www.reviews.org/mobile/t-mobile-cell-phone-plans/)
- Verizon: [Holafly](https://esim.holafly.com/reviews/verizon-postpaid-plans/), [Victra](https://victra.com/verizon-phone-plans/), [Compare Internet Hub](https://www.compareinternethub.com/verizon-mobile/), [CableTV.com](https://www.cabletv.com/verizon/wireless)
- AT&T: [AT&T family plans 2026 (get.att.com)](https://get.att.com/resources/att-plans-2026/), [WhistleOut](https://www.whistleout.com/CellPhones/Guides/best-att-unlimited-plans), [Reviews.org](https://www.reviews.org/mobile/att-unlimited-plans-explained/), [PhoneArena](https://www.phonearena.com/news/AT-Ts-new-2.0-plans-are-here-3-things-to-check-before-you-switch_id178908), [ShopCellPlans](https://shopcellplans.com/att-plans/)
- Mint: [WhistleOut plans](https://www.whistleout.com/CellPhones/Guides/best-mint-mobile-plans), [WhistleOut hotspot](https://www.whistleout.com/CellPhones/Guides/mint-mobile-hotspot), [ShopCellPlans](https://shopcellplans.com/mint-mobile-plans/)
- Visible: [Visible+ (visible.com)](https://www.visible.com/plans/plus), [WhistleOut](https://www.whistleout.com/CellPhones/Guides/visible-cell-phone-plans), [ShopCellPlans](https://shopcellplans.com/visible-plans/)
- Google Fi: [Unlimited Standard (fi.google.com)](https://fi.google.com/about/plans/unlimited-standard), [eCommerce Paradise](https://ecommerceparadise.com/google-fi-pricing/)
- US Mobile: [US Mobile family plan guide](https://www.usmobile.com/blog/best-family-phone-plan/)
- Cricket, Metro, Boost: [US Mobile prepaid roundup, Oct 2026](https://www.usmobile.com/blog/best-prepaid-phone-plans/), [SwitchNinja](https://switchninja.app/compare/cricket-vs-metro), [ShopBack](https://www.shopback.com/blog/finance/us-prepaid-mobile-mint-vs-visible-vs-cricket-vs-metro-2026)

## Logos

`att.svg`, `verizon.svg`, `boost.svg` and `tmobile.svg` in `public/logos/` come from [Simple Icons](https://simpleicons.org) (v16.36.0), colored with each brand's color. `tmobile.svg` is the magenta "T" mark that T-Mobile shares with its parent company, Deutsche Telekom. Simple Icons is CC0, but the logos are still the carriers' trademarks.

Still missing: Mint Mobile, Visible, Google Fi, US Mobile, Cricket and Metro. Add the official files from each carrier's press or brand page (see the README).
