// One definition of the carrier logo tile, used by the Astro component and by browser-rendered markup.
import type { CarrierLite } from './model';

/** "brand" fills the tile with the carrier color; "white" is for placing on a carrier-colored background. */
export type LogoMode = 'brand' | 'white';

export function logoTile(c: CarrierLite, size: number, mode: LogoMode = 'brand') {
  const has = c.logoUrl !== null;
  const onWhite = has || mode === 'white';
  const bg = onWhite ? '#FFFFFF' : c.color;
  // On white, use the brand color for the letters unless the brand color is light (then its dark text color).
  const fg = !onWhite ? c.textOnColor : c.textOnColor === '#FFFFFF' ? c.color : c.textOnColor;
  const fontSize = Math.round(size * (c.monogram.length > 2 ? 0.26 : 0.4));
  const style = `width:${size}px;height:${size}px;border-radius:${Math.round(size / 4)}px;background:${bg};color:${fg};font-size:${fontSize}px;${has ? `padding:${Math.round(size / 8)}px;` : ''}`;
  return { has, style, className: `logo-tile${has ? ' has-logo' : ''}` };
}
