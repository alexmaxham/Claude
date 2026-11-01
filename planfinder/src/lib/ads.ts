// Ad settings. Ads are off until you turn them on here.
//
// To start showing Google AdSense ads:
// 1. Set `enabled: true` and `adsenseClient` to your publisher ID (ca-pub-…).
// 2. Create an ad unit in AdSense for each slot you want to use and paste its ID below.
//    A slot with no ID stays empty.
// 3. Build and deploy. Each slot then renders a responsive AdSense unit, labelled "Advertisement".
//
// To see where the slots are without real ads, run `npm run dev`, or build with
// PUBLIC_AD_PLACEHOLDERS=true: each slot shows a dashed placeholder box.
export const ADS = {
  enabled: false,
  adsenseClient: '',
  slots: {
    'home-mid': '',
    'plans-top': '',
    'plan-sidebar': '',
    'plan-bottom': '',
    'compare-bottom': '',
    'carrier-bottom': '',
    'vs-mid': '',
    'guide-inline': '',
    'savings-results': '',
    'discounts-bottom': '',
  } as Record<string, string>,
};

export type AdSlotName = keyof typeof ADS.slots;

export function adsLive(): boolean {
  return ADS.enabled && ADS.adsenseClient.startsWith('ca-pub-');
}

export function showAdPlaceholders(): boolean {
  return !adsLive() && (import.meta.env.DEV || import.meta.env.PUBLIC_AD_PLACEHOLDERS === 'true');
}
