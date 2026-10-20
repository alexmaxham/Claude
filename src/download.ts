/** Saves `text` as a file through the browser's normal download flow. */
export function download(filename: string, text: string, type: string, { bom = false } = {}) {
  // A byte-order mark makes Excel read UTF-8 CSVs (accents, emoji) correctly.
  const blob = new Blob([bom ? '﻿' + text : text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
