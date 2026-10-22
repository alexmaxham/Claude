import { describe, expect, it } from 'vitest';
import { parseFeed, priceFromTitle, storeFromTitle } from './fetch-deals.mjs';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Slickdeals Tech</title>
<item>
  <title>Apple AirPods Pro 2 $169.99 + Free Shipping at Amazon</title>
  <link>https://slickdeals.net/f/123-airpods?utm_source=rss&amp;utm_medium=RSS2</link>
  <pubDate>Wed, 22 Oct 2026 14:00:00 +0000</pubDate>
  <content:encoded><![CDATA[<div><img src="https://static.slickdealscdn.com/a.jpg" /> Great price. Thumbs Up: 45</div>]]></content:encoded>
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
      link: 'https://slickdeals.net/f/123-airpods?utm_source=rss&utm_medium=RSS2',
      price: 169.99,
      store: 'Amazon',
      image: 'https://static.slickdealscdn.com/a.jpg',
      thumbs: 45,
      published: '2026-10-22T14:00:00.000Z',
    });
    expect(deals[1]).toMatchObject({ title: 'Samsung 65" OLED TV $1,299 at Best Buy', price: 1299, store: 'Best Buy', image: null, thumbs: null, published: null });
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
