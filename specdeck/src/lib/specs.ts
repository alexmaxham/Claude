import type { Device } from './schema';

// The spec registry: every row shown on device pages and in compare is defined here once.
// To add a spec, add the field to schema.ts and a row below; pages pick it up automatically.
// This module is shared by server-rendered pages and the client-side compare page.

export type Row = {
  key: string;
  label: string;
  value: (d: Device) => string | null;
  /** Numeric value used to pick the best device in compare. */
  rank?: (d: Device) => number | null;
  better?: 'higher' | 'lower';
};

export type Section = { id: string; label: string; icon: string; rows: Row[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return d ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${y}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatPrice(p: Device['price']): string | null {
  if (!p) return null;
  const amount = p.amount.toLocaleString('en-US', {
    style: 'currency',
    currency: p.currency,
    maximumFractionDigits: Number.isInteger(p.amount) ? 0 : 2,
  });
  return p.config ? `${amount} (${p.config})` : amount;
}

const gb = (n: number) => (n >= 1024 ? `${n / 1024} TB` : `${n} GB`);
const list = (ns: number[]) => (ns.length ? ns.map(gb).join(' / ') : null);
const yesNo = (b: boolean | null) => (b === null ? null : b ? 'Yes' : 'No');
const watts = (w: number | null, none = 'None') => (w === null ? null : w === 0 ? none : `${w} W`);

export function ppi(d: Device): number | null {
  if (d.display.ppi) return d.display.ppi;
  const m = d.display.resolution?.match(/(\d+)\s*[×x]\s*(\d+)/);
  if (!m || !d.display.size_in) return null;
  return Math.round(Math.hypot(Number(m[1]), Number(m[2])) / d.display.size_in);
}

export function batteryLabel(d: Device): string | null {
  const b = d.battery;
  if (b.mah) return `${formatNumber(b.mah)} mAh`;
  if (b.wh) return `${b.wh} Wh`;
  return b.life;
}

export const SECTIONS: Section[] = [
  {
    id: 'launch',
    label: 'Launch',
    icon: 'event',
    rows: [
      { key: 'announced', label: 'Announced', value: (d) => formatDate(d.announced) },
      { key: 'released', label: 'Released', value: (d) => formatDate(d.released) },
      { key: 'price', label: 'Launch price', value: (d) => formatPrice(d.price) },
      { key: 'markets', label: 'Markets', value: (d) => d.markets ?? 'Global' },
    ],
  },
  {
    id: 'body',
    label: 'Body',
    icon: 'straighten',
    rows: [
      { key: 'dimensions', label: 'Dimensions', value: (d) => d.body.dimensions },
      { key: 'folded', label: 'Folded', value: (d) => d.body.folded },
      {
        key: 'weight',
        label: 'Weight',
        value: (d) => (d.body.weight_g ? `${d.body.weight_g} g` : null),
        rank: (d) => d.body.weight_g,
        better: 'lower',
      },
      {
        key: 'thickness',
        label: 'Thickness',
        value: (d) => (d.body.thickness_mm ? `${d.body.thickness_mm} mm` : null),
        rank: (d) => d.body.thickness_mm,
        better: 'lower',
      },
      { key: 'build', label: 'Build', value: (d) => d.body.build },
      { key: 'colors', label: 'Colors', value: (d) => (d.body.colors.length ? d.body.colors.join(', ') : null) },
      { key: 'ip', label: 'Water & dust', value: (d) => d.body.ip },
      { key: 'sim', label: 'SIM', value: (d) => d.body.sim },
    ],
  },
  {
    id: 'display',
    label: 'Display',
    icon: 'mobile',
    rows: [
      {
        key: 'size',
        label: 'Size',
        value: (d) => (d.display.size_in ? `${d.display.size_in}"` : null),
        rank: (d) => d.display.size_in,
        better: 'higher',
      },
      { key: 'cover', label: 'Cover screen', value: (d) => d.display.cover },
      { key: 'type', label: 'Type', value: (d) => d.display.type },
      { key: 'resolution', label: 'Resolution', value: (d) => d.display.resolution },
      {
        key: 'ppi',
        label: 'Pixel density',
        value: (d) => {
          const p = ppi(d);
          return p ? `${p} ppi` : null;
        },
        rank: ppi,
        better: 'higher',
      },
      {
        key: 'refresh',
        label: 'Refresh rate',
        value: (d) => d.display.refresh ?? (d.display.refresh_hz ? `${d.display.refresh_hz} Hz` : null),
        rank: (d) => d.display.refresh_hz,
        better: 'higher',
      },
      {
        key: 'brightness',
        label: 'Peak brightness',
        value: (d) => (d.display.peak_nits ? `${formatNumber(d.display.peak_nits)} nits` : null),
        rank: (d) => d.display.peak_nits,
        better: 'higher',
      },
      { key: 'protection', label: 'Protection', value: (d) => d.display.protection },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    icon: 'memory',
    rows: [
      { key: 'os', label: 'OS at launch', value: (d) => d.platform.os },
      { key: 'chipset', label: 'Chipset', value: (d) => d.platform.chipset },
      { key: 'cpu', label: 'CPU', value: (d) => d.platform.cpu },
      { key: 'gpu', label: 'GPU', value: (d) => d.platform.gpu },
      { key: 'updates', label: 'Update policy', value: (d) => d.platform.updates },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: 'sd_card',
    rows: [
      {
        key: 'ram',
        label: 'RAM',
        value: (d) => list(d.memory.ram_gb),
        rank: (d) => (d.memory.ram_gb.length ? Math.max(...d.memory.ram_gb) : null),
        better: 'higher',
      },
      {
        key: 'storage',
        label: 'Storage',
        value: (d) => list(d.memory.storage_gb),
        rank: (d) => (d.memory.storage_gb.length ? Math.max(...d.memory.storage_gb) : null),
        better: 'higher',
      },
      { key: 'card', label: 'Card slot', value: (d) => d.memory.card },
    ],
  },
  {
    id: 'camera',
    label: 'Main camera',
    icon: 'photo_camera',
    rows: [
      { key: 'main', label: 'Wide', value: (d) => d.camera.main },
      { key: 'ultrawide', label: 'Ultrawide', value: (d) => d.camera.ultrawide },
      { key: 'telephoto', label: 'Telephoto', value: (d) => d.camera.telephoto },
      { key: 'video', label: 'Video', value: (d) => d.camera.video },
    ],
  },
  {
    id: 'selfie',
    label: 'Selfie camera',
    icon: 'photo_camera_front',
    rows: [
      { key: 'selfie', label: 'Sensor', value: (d) => d.selfie.main },
      { key: 'selfie-video', label: 'Video', value: (d) => d.selfie.video },
    ],
  },
  {
    id: 'battery',
    label: 'Battery',
    icon: 'battery_charging_full',
    rows: [
      {
        key: 'capacity',
        label: 'Capacity',
        value: (d) => (d.battery.mah ? `${formatNumber(d.battery.mah)} mAh` : d.battery.wh ? `${d.battery.wh} Wh` : null),
        rank: (d) => d.battery.mah,
        better: 'higher',
      },
      { key: 'life', label: 'Rated battery life', value: (d) => d.battery.life },
      {
        key: 'wired',
        label: 'Wired charging',
        value: (d) => watts(d.battery.wired_w),
        rank: (d) => d.battery.wired_w,
        better: 'higher',
      },
      {
        key: 'wireless',
        label: 'Wireless charging',
        value: (d) => watts(d.battery.wireless_w),
        rank: (d) => d.battery.wireless_w,
        better: 'higher',
      },
      { key: 'reverse', label: 'Reverse charging', value: (d) => d.battery.reverse },
    ],
  },
  {
    id: 'connectivity',
    label: 'Connectivity',
    icon: 'wifi',
    rows: [
      { key: 'network', label: 'Network', value: (d) => d.connectivity.network },
      { key: 'wifi', label: 'Wi-Fi', value: (d) => d.connectivity.wifi },
      { key: 'bluetooth', label: 'Bluetooth', value: (d) => d.connectivity.bluetooth },
      { key: 'nfc', label: 'NFC', value: (d) => yesNo(d.connectivity.nfc) },
      { key: 'usb', label: 'USB', value: (d) => d.connectivity.usb },
      { key: 'satellite', label: 'Satellite', value: (d) => d.connectivity.satellite },
    ],
  },
  {
    id: 'features',
    label: 'Sensors & audio',
    icon: 'fingerprint',
    rows: [
      { key: 'biometrics', label: 'Biometrics', value: (d) => d.features.biometrics },
      { key: 'speakers', label: 'Speakers', value: (d) => d.features.speakers },
      { key: 'jack', label: 'Headphone jack', value: (d) => yesNo(d.features.jack) },
      { key: 'stylus', label: 'Stylus', value: (d) => d.features.stylus },
    ],
  },
];

/** Rows that only apply to some devices (e.g. a cover screen) are hidden when every device lacks them. */
const OPTIONAL_ROWS = new Set(['folded', 'cover', 'stylus', 'life', 'thickness']);

export function visibleRows(section: Section, devices: Device[]): Row[] {
  return section.rows.filter(
    (r) => !OPTIONAL_ROWS.has(r.key) || devices.some((d) => r.value(d) !== null),
  );
}

/** Index of the single best device for a row, or -1 when the row is not ranked or there is a tie. */
export function bestIndex(row: Row, devices: Device[]): number {
  if (!row.rank || !row.better || devices.length < 2) return -1;
  const values = devices.map((d) => row.rank!(d));
  if (values.some((v) => v === null)) return -1;
  const nums = values as number[];
  const target = row.better === 'higher' ? Math.max(...nums) : Math.min(...nums);
  return nums.filter((n) => n === target).length === 1 ? nums.indexOf(target) : -1;
}

/** The four headline specs used on cards and in meta descriptions. */
export function keySpecs(d: Device) {
  return {
    display: d.display.size_in ? `${d.display.size_in}" ${d.display.type?.split(/[,(]/)[0].trim() ?? ''}`.trim() : null,
    chip: d.platform.chipset?.replace(/\s*\(.*\)$/, '').replace(/ for Galaxy$/, '') ?? null,
    camera: d.camera.main?.split(',')[0] ?? null,
    battery: batteryLabel(d),
  };
}

export const NOT_CONFIRMED = 'Not confirmed';

/** One plain sentence summarizing a device, built only from known values. Used on device pages and in meta descriptions. */
export function describe(d: Device): string {
  const parts: string[] = [];
  const display = d.display.size_in
    ? `a ${d.display.size_in}-inch ${d.display.type ? d.display.type.split(/[,(]/)[0].trim() + ' ' : ''}display`
    : null;
  if (display) parts.push(display);
  if (d.platform.chipset) parts.push(`the ${d.platform.chipset.replace(/\s*\(.*\)$/, '')} chip`);
  if (d.memory.ram_gb.length) parts.push(`${list(d.memory.ram_gb)} of RAM`);
  const bat = batteryLabel(d);
  if (d.battery.mah || d.battery.wh) parts.push(`a ${bat} battery`);
  const has = parts.length
    ? `It has ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0]}.`
    : '';
  const launch = `Announced ${formatDate(d.announced)}${d.price ? ` at ${formatPrice({ ...d.price, config: undefined })}` : ''}.`;
  return `${launch} ${has}`.trim();
}

/** How many spec values are filled in, out of the rows that apply to the device. */
export function completeness(d: Device): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const s of SECTIONS) {
    for (const r of visibleRows(s, [d])) {
      total++;
      if (r.value(d) !== null) filled++;
    }
  }
  return { filled, total };
}
