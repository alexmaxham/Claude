import { isNative } from './native';

/**
 * Saves `text` as a file through the browser's normal download flow. In the iPhone
 * app, which can't download, it opens the share sheet (Save to Files, AirDrop, Mail…).
 */
export function download(filename: string, text: string, type: string, { bom = false } = {}) {
  // A byte-order mark makes Excel read UTF-8 CSVs (accents, emoji) correctly.
  const content = bom ? '﻿' + text : text;
  if (isNative) return void shareFile(filename, content);
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareFile(filename: string, content: string) {
  const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  try {
    const { uri } = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, files: [uri] });
  } catch {
    // Share sheet dismissed.
  }
}
