import { describe, expect, it } from 'vitest';
import { amazonLinkFrom, isTechDeal, parseFeed, priceFromTitle, storeFromTitle } from './fetch-deals.mjs';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Slickdeals Tech</title>
<item>
  <title>Apple AirPods Pro 2 $169.99 + Free Shipping at Amazon</title>
  <link>https://slickdeals.net/f/123-airpods?utm_source=rss&amp;utm_medium=RSS2</link>
  <pubDate>Wed, 22 Oct 2026 14:00:00 +0000</pubDate>
  <content:encoded><![CDATA[<div><img src="https://static.slickdealscdn.com/a.jpg" height="300" width="300"></div><br /><div>Thumb Score: +45 </div><div><a href="https://slickdeals.net/click?sdfib=1&amp;lno=1&amp;trd=Amazon&amp;pv=&amp;au=&amp;u3=MgNuyE56" target="_blank" data-product-forum="Hot Deals" data-cta="outclick" data-product-exitWebsite="amazon.com" data-store-id="1" data-store-slug="amazon" data-aps-asin="B0D1XD1ZV3" data-aps-asc-tag="slickdeals09-20" data-aps-asc-subtag="%ascsubtag%" rel="nofollow">Amazon</a> has a great price. Coupon Code: <span data-role='couponCode'><span class='icon icon-coupon inlineCouponIcon'></span><span class='code' data-couponid='10814028'><strong>E4239GZT</strong></span></span></div>]]></content:encoded>
</item>
<item>
  <title><![CDATA[Samsung 65&quot; OLED TV $1,299 at Best Buy]]></title>
  <link>https://slickdeals.net/f/456-tv</link>
  <description>No image here</description>
</item>
<item><title>Missing link</title></item>
</channel></rss>`;

describe('parseFeed', () => {
  it('reads each deal and skips items without a link', () => {
    const deals = parseFeed(FEED);
    expect(deals).toHaveLength(2);
    expect(deals[0]).toEqual({
      title: 'Apple AirPods Pro 2 $169.99 + Free Shipping at Amazon',
      link: 'https://www.amazon.com/dp/B0D1XD1ZV3',
      thread: 'https://slickdeals.net/f/123-airpods?utm_source=rss&utm_medium=RSS2',
      price: 169.99,
      store: 'Amazon',
      image: 'https://static.slickdealscdn.com/a.jpg',
      thumbs: 45,
      coupon: 'E4239GZT',
      published: '2026-10-22T14:00:00.000Z',
    });
    expect(deals[1]).toMatchObject({ link: 'https://slickdeals.net/f/456-tv', thread: 'https://slickdeals.net/f/456-tv', title: 'Samsung 65" OLED TV $1,299 at Best Buy', price: 1299, store: 'Best Buy', image: null, thumbs: null, coupon: null, published: null });
  });

  it('returns nothing for a page that is not a feed', () => {
    expect(parseFeed('<!doctype html><html><body>Tech deals</body></html>')).toEqual([]);
  });
});

describe('title parsing', () => {
  it('finds the store name', () => {
    expect(storeFromTitle('Logitech MX Master 3S $79 at Amazon.com')).toBe('Amazon');
    expect(storeFromTitle('Steam Deck OLED $449 at Walmart Free Shipping')).toBe('Walmart');
    expect(storeFromTitle('64GB microSD card $8 @ Newegg')).toBe('Newegg');
    expect(storeFromTitle('Free game this week')).toBe('');
  });

  it('finds the first price', () => {
    expect(priceFromTitle('Monitor $199.99 (Reg. $299)')).toBe(199.99);
    expect(priceFromTitle('Free VPN for a year')).toBeNull();
  });
});

describe('isTechDeal', () => {
  it('keeps tech deals', () => {
    for (const title of [
      'Apple AirPods Pro 2 $169 at Amazon',
      'Samsung 65" OLED TV $1,299 at Best Buy',
      'Crucial 2TB NVMe SSD $99',
      'TP-Link Deco Wi-Fi 7 mesh system $199',
      'Anker 20,000mAh Power Bank $29',
      'Nintendo Switch 2 Mario Kart bundle $499',
      'Lenovo IdeaPad Slim 5 Laptop $549',
      'Fire HD 10 Tablet $74.99',
    ]) expect(isTechDeal(title), title).toBe(true);
  });

  it('drops deals from other categories', () => {
    for (const title of [
      "Levi's Men's 505 Jeans $24 at Amazon",
      'Finish Quantum Dishwasher Tablets 82-Count $14',
      'Cuisinart 10 pc Cookware Set $89',
      'DeWalt 20V Drill and Impact Driver Kit $129',
      'Apple Cider Vinegar 32oz $4',
      'Hanes Crew T-Shirts 6-Pack $15',
    ]) expect(isTechDeal(title), title).toBe(false);
  });
});

describe('amazonLinkFrom', () => {
  const link = (attrs) => `<a href="https://slickdeals.net/click?lno=1&amp;u3=Mx" ${attrs} rel="nofollow">Store</a>`;

  it('builds a clean product link from the Amazon product ID', () => {
    const html =
      link('data-product-exitWebsite="walmart.com" data-store-slug="walmart"') +
      link('data-product-exitWebsite="amazon.com" data-store-slug="amazon" data-aps-asin="b07q32kx3j" data-aps-asc-tag="slickdeals09-20"');
    expect(amazonLinkFrom(html)).toBe('https://www.amazon.com/dp/B07Q32KX3J');
  });

  it('ignores deals from other stores and Amazon links without a product ID', () => {
    expect(amazonLinkFrom(link('data-product-exitWebsite="wayfair.com" data-store-slug="wayfair"'))).toBeNull();
    expect(amazonLinkFrom(link('data-product-exitWebsite="amazon.com" data-store-slug="amazon"'))).toBeNull();
    expect(amazonLinkFrom('No links here')).toBeNull();
  });
});
