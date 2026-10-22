import { describe, expect, it } from 'vitest';
import { amazonLinkFrom, cleanAmazonLink, isTechDeal, parseFeed, priceFromTitle, storeFromTitle, unwrapLink } from './fetch-deals.mjs';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Slickdeals Tech</title>
<item>
  <title>Apple AirPods Pro 2 $169.99 + Free Shipping at Amazon</title>
  <link>https://slickdeals.net/f/123-airpods?utm_source=rss&amp;utm_medium=RSS2</link>
  <pubDate>Wed, 22 Oct 2026 14:00:00 +0000</pubDate>
  <content:encoded><![CDATA[<div><img src="https://static.slickdealscdn.com/a.jpg" /> <a href="https://slickdeals.net/click?lno=1&amp;pno=123&amp;u2=https%3A%2F%2Fwww.amazon.com%2FApple-AirPods%2Fdp%2FB0D1XD1ZV3%2Fref%3Dsr_1_1%3Ftag%3Dslickdeals-20%26th%3D1">Amazon</a> Great price. Thumbs Up: 45</div>]]></content:encoded>
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
      published: '2026-10-22T14:00:00.000Z',
    });
    expect(deals[1]).toMatchObject({ link: 'https://slickdeals.net/f/456-tv', thread: 'https://slickdeals.net/f/456-tv', title: 'Samsung 65" OLED TV $1,299 at Best Buy', price: 1299, store: 'Best Buy', image: null, thumbs: null, published: null });
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

describe('Amazon links', () => {
  it('unwraps redirect links', () => {
    expect(unwrapLink('https://slickdeals.net/click?lno=1&u2=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D1XD1ZV3%3Ftag%3Dsd-20')).toBe(
      'https://www.amazon.com/dp/B0D1XD1ZV3?tag=sd-20',
    );
    expect(unwrapLink('https://click.linksynergy.com/deeplink?id=x&murl=https%3A%2F%2Fwww.bestbuy.com%2Fsite%2F123')).toBe(
      'https://www.bestbuy.com/site/123',
    );
    expect(unwrapLink('https://slickdeals.net/f/123-deal')).toBe('https://slickdeals.net/f/123-deal');
  });

  it('cleans product links down to the ASIN', () => {
    for (const href of [
      'https://www.amazon.com/dp/B0D1XD1ZV3?tag=slickdeals-20&ascsubtag=abc',
      'https://amazon.com/Some-Product-Name/dp/b0d1xd1zv3/ref=sr_1_3?th=1&psc=1',
      'https://www.amazon.com/gp/product/B0D1XD1ZV3/?linkCode=ll1&tag=x-20',
      'https://smile.amazon.com/gp/aw/d/B0D1XD1ZV3',
    ]) expect(cleanAmazonLink(href), href).toBe('https://www.amazon.com/dp/B0D1XD1ZV3');
  });

  it('strips tracking from other Amazon pages and ignores other stores', () => {
    expect(cleanAmazonLink('https://www.amazon.com/s/ref=nb_sb_noss?k=ssd&tag=sd-20&smid=ATVPDKIKX0DER')).toBe(
      'https://www.amazon.com/s?k=ssd&smid=ATVPDKIKX0DER',
    );
    expect(cleanAmazonLink('https://www.bestbuy.com/site/123')).toBeNull();
    expect(cleanAmazonLink('not a url')).toBeNull();
  });

  it('finds the first Amazon link in a description', () => {
    const html =
      '<a href="https://slickdeals.net/f/1">thread</a> <a href="https://www.walmart.com/ip/1">Walmart</a> ' +
      '<a href="https://slickdeals.net/click?u2=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB000000001%3Ftag%3Dsd-20">Amazon</a>';
    expect(amazonLinkFrom(html)).toBe('https://www.amazon.com/dp/B000000001');
    expect(amazonLinkFrom('<a href="https://amzn.to/3abcDEF">deal</a>')).toBe('https://amzn.to/3abcDEF');
    expect(amazonLinkFrom('<a href="https://www.walmart.com/ip/1">Walmart</a>')).toBeNull();
  });
});
