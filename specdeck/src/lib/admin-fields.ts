// The admin form, one entry per input. Paths match the device schema (src/lib/schema.ts).

export type FieldType = 'text' | 'number' | 'select' | 'color' | 'numbers' | 'texts' | 'lines' | 'bool' | 'checkbox' | 'textarea';

export type Field = {
  path: string;
  label: string;
  type?: FieldType;
  hint?: string;
  required?: boolean;
  options?: [string, string][];
  /** Optional input placeholder. */
  placeholder?: string;
};

export type FieldGroup = { id: string; title: string; fields: Field[] };

export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'basics',
    title: 'Basics',
    fields: [
      { path: 'brand', label: 'Brand', required: true, placeholder: 'Samsung' },
      { path: 'name', label: 'Model name', required: true, placeholder: 'Galaxy S27 Ultra', hint: 'Without the brand, unless the brand is part of the name (e.g. "OnePlus 16").' },
      { path: 'category', label: 'Category', type: 'select', required: true, options: [['phone', 'Phone'], ['tablet', 'Tablet']] },
      {
        path: 'formFactor', label: 'Form factor', type: 'select', required: true,
        options: [['bar', 'Regular phone'], ['book-fold', 'Book-style foldable'], ['flip', 'Flip foldable'], ['tablet', 'Tablet']],
      },
      { path: 'announced', label: 'Announced', required: true, placeholder: '2026-09-09', hint: 'YYYY-MM-DD, or YYYY-MM if the day is unknown.' },
      { path: 'released', label: 'Released', placeholder: '2026-09-18', hint: 'YYYY-MM-DD or YYYY-MM.' },
      { path: 'status', label: 'Status', type: 'select', options: [['available', 'Available'], ['upcoming', 'Upcoming'], ['discontinued', 'Discontinued']] },
      { path: 'markets', label: 'Markets', placeholder: 'China only', hint: 'Leave empty if sold worldwide.' },
    ],
  },
  {
    id: 'price',
    title: 'Launch price',
    fields: [
      { path: 'price.amount', label: 'Price', type: 'number', placeholder: '1199' },
      { path: 'price.currency', label: 'Currency', placeholder: 'USD', hint: 'Three letters: USD, EUR, GBP, CNY…' },
      { path: 'price.config', label: 'For configuration', placeholder: '12 GB / 256 GB' },
    ],
  },
  {
    id: 'look',
    title: 'Illustration colors',
    fields: [
      { path: 'art.0', label: 'Highlight color', type: 'color', hint: 'Used for the drawing when there is no photo.' },
      { path: 'art.1', label: 'Shadow color', type: 'color' },
    ],
  },
  {
    id: 'body',
    title: 'Body',
    fields: [
      { path: 'body.dimensions', label: 'Dimensions', placeholder: '163.6 × 78.1 × 7.9 mm' },
      { path: 'body.folded', label: 'Folded size', placeholder: '85.7 × 75.4 × 13.1 mm', hint: 'Foldables only.' },
      { path: 'body.weight_g', label: 'Weight (g)', type: 'number' },
      { path: 'body.thickness_mm', label: 'Thickness (mm)', type: 'number' },
      { path: 'body.build', label: 'Build', placeholder: 'Titanium frame, glass back' },
      { path: 'body.colors', label: 'Colors', type: 'texts', placeholder: 'Black, Silver, Blue', hint: 'Separate with commas.' },
      { path: 'body.ip', label: 'Water & dust rating', placeholder: 'IP68' },
      { path: 'body.sim', label: 'SIM', placeholder: 'Nano-SIM + eSIM' },
    ],
  },
  {
    id: 'display',
    title: 'Display',
    fields: [
      { path: 'display.size_in', label: 'Size (inches)', type: 'number' },
      { path: 'display.type', label: 'Type', placeholder: 'LTPO OLED' },
      { path: 'display.resolution', label: 'Resolution', placeholder: '1440 × 3120' },
      { path: 'display.ppi', label: 'Pixel density (ppi)', type: 'number', hint: 'Leave empty to calculate from size and resolution.' },
      { path: 'display.refresh', label: 'Refresh rate (text)', placeholder: '1–120 Hz' },
      { path: 'display.refresh_hz', label: 'Max refresh rate (Hz)', type: 'number', hint: 'Used to rank devices in compare.' },
      { path: 'display.peak_nits', label: 'Peak brightness (nits)', type: 'number' },
      { path: 'display.protection', label: 'Protection', placeholder: 'Gorilla Armor 2' },
      { path: 'display.cover', label: 'Cover screen', placeholder: '6.5", 1080 × 2520', hint: 'Foldables only.' },
    ],
  },
  {
    id: 'platform',
    title: 'Platform',
    fields: [
      { path: 'platform.os', label: 'OS at launch', placeholder: 'Android 17, One UI 9' },
      { path: 'platform.chipset', label: 'Chipset', placeholder: 'Snapdragon 8 Elite Gen 5 (3 nm)' },
      { path: 'platform.cpu', label: 'CPU' },
      { path: 'platform.gpu', label: 'GPU' },
      { path: 'platform.updates', label: 'Update policy', placeholder: '7 years OS and security' },
    ],
  },
  {
    id: 'memory',
    title: 'Memory',
    fields: [
      { path: 'memory.ram_gb', label: 'RAM options (GB)', type: 'numbers', placeholder: '12, 16' },
      { path: 'memory.storage_gb', label: 'Storage options (GB)', type: 'numbers', placeholder: '256, 512, 1024', hint: 'Use 1024 for 1 TB.' },
      { path: 'memory.card', label: 'Card slot', placeholder: 'microSD, up to 2 TB' },
    ],
  },
  {
    id: 'camera',
    title: 'Main camera',
    fields: [
      { path: 'camera.main', label: 'Wide', placeholder: '200 MP, f/1.7, OIS' },
      { path: 'camera.ultrawide', label: 'Ultrawide' },
      { path: 'camera.telephoto', label: 'Telephoto', hint: 'Write "None" if it has no telephoto.' },
      { path: 'camera.video', label: 'Video', placeholder: '8K 30 fps, 4K 120 fps' },
    ],
  },
  {
    id: 'selfie',
    title: 'Selfie camera',
    fields: [
      { path: 'selfie.main', label: 'Sensor', placeholder: '12 MP, f/2.2' },
      { path: 'selfie.video', label: 'Video' },
    ],
  },
  {
    id: 'battery',
    title: 'Battery',
    fields: [
      { path: 'battery.mah', label: 'Capacity (mAh)', type: 'number' },
      { path: 'battery.wh', label: 'Capacity (Wh)', type: 'number', hint: 'Only if the maker publishes Wh instead of mAh.' },
      { path: 'battery.life', label: 'Rated battery life', placeholder: 'Up to 36 h video (Apple)' },
      { path: 'battery.wired_w', label: 'Wired charging (W)', type: 'number' },
      { path: 'battery.wireless_w', label: 'Wireless charging (W)', type: 'number', hint: 'Enter 0 if it has no wireless charging.' },
      { path: 'battery.reverse', label: 'Reverse charging', placeholder: '4.5 W wireless' },
    ],
  },
  {
    id: 'connectivity',
    title: 'Connectivity',
    fields: [
      { path: 'connectivity.network', label: 'Network', placeholder: '5G sub-6 and mmWave' },
      { path: 'connectivity.wifi', label: 'Wi-Fi', placeholder: 'Wi-Fi 7' },
      { path: 'connectivity.bluetooth', label: 'Bluetooth', placeholder: 'Bluetooth 6.0' },
      { path: 'connectivity.nfc', label: 'NFC', type: 'bool' },
      { path: 'connectivity.usb', label: 'USB', placeholder: 'USB-C 3.2' },
      { path: 'connectivity.satellite', label: 'Satellite', placeholder: 'Emergency SOS' },
    ],
  },
  {
    id: 'features',
    title: 'Sensors & audio',
    fields: [
      { path: 'features.biometrics', label: 'Biometrics', placeholder: 'Ultrasonic fingerprint, face unlock' },
      { path: 'features.speakers', label: 'Speakers', placeholder: 'Stereo' },
      { path: 'features.jack', label: 'Headphone jack', type: 'bool' },
      { path: 'features.stylus', label: 'Stylus', placeholder: 'S Pen included' },
    ],
  },
  {
    id: 'sources',
    title: 'Sources and notes',
    fields: [
      { path: 'sources', label: 'Source links', type: 'lines', required: true, hint: 'One URL per line. The manufacturer\'s spec page first.' },
      { path: 'checked', label: 'Checked on', required: true, placeholder: '2026-10-20', hint: 'The date you checked the sources (YYYY-MM-DD).' },
      { path: 'verified', label: 'Every value is checked against the manufacturer\'s own spec sheet', type: 'checkbox' },
      { path: 'notes', label: 'Notes', type: 'textarea', hint: 'Shown on the device page, e.g. why a value is missing.' },
    ],
  },
];
