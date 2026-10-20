// Google AdSense settings. Ads stay off until `client` is set: no script loads and no ad spots render.
// Fill these in from AdSense (Ads → By ad unit → each unit's code shows its data-ad-slot).
// The publisher ID is not a secret; it appears in every page's source once ads are on.
export const ADSENSE = {
  /** Publisher ID, e.g. "ca-pub-1234567890123456". */
  client: '',
  /** One display ad unit per spot. A spot with no unit ID stays empty. */
  slots: {
    listing: '', // below the device grid on home, phones, tablets and brand pages
    deviceTop: '', // device pages, after the headline specs
    deviceBottom: '', // device pages, after the full spec sheet
    compare: '', // comparison pages, below the table
  },
};

export type AdSpot = keyof typeof ADSENSE.slots;
export const adsEnabled = () => /^ca-pub-\d{10,20}$/.test(ADSENSE.client);
