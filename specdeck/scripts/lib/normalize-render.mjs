// Turns a product render into the site's standard image: device only, on a transparent square canvas,
// scaled to the same size and centered. Used by npm run add-image and by the admin publishing job, so
// every device image on the site looks the same.
import sharp from 'sharp';

export const CANVAS = 1200;
const FILL = 0.92; // the device's longest side, as a share of the canvas

export class RenderError extends Error {}

/** Removes a plain background by flood-filling from the edges with the edge color. */
function removeBackground(data, width, height) {
  const at = (x, y) => (y * width + x) * 4;
  // Sample the border: it must be one plain color (white, grey, black or a flat tint).
  const border = [];
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 60))) border.push(at(x, 0), at(x, height - 1));
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 60))) border.push(at(0, y), at(width - 1, y));
  const avg = [0, 1, 2].map((c) => border.reduce((s, i) => s + data[i + c], 0) / border.length);
  const dist = (i) => Math.max(Math.abs(data[i] - avg[0]), Math.abs(data[i + 1] - avg[1]), Math.abs(data[i + 2] - avg[2]));
  const plain = border.filter((i) => data[i + 3] > 0 && dist(i) <= 18).length / border.length;
  if (plain < 0.9) {
    throw new RenderError('This image has a busy background. Use a press render on a plain or transparent background.');
  }

  const TOL = 26;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    const p = y * width + x;
    if (!seen[p] && dist(p * 4) <= TOL) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) push(x, 0), push(x, height - 1);
  for (let y = 0; y < height; y++) push(0, y), push(width - 1, y);
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  // Soften the cut edge: pixels next to removed background become partly transparent.
  for (let p = 0; p < width * height; p++) {
    if (seen[p]) continue;
    const x = p % width;
    const y = (p - x) / width;
    const near = (x > 0 && seen[p - 1]) || (x < width - 1 && seen[p + 1]) || (y > 0 && seen[p - width]) || (y < height - 1 && seen[p + width]);
    if (near) data[p * 4 + 3] = Math.min(data[p * 4 + 3], 150);
  }
}

export async function normalizeRender(input) {
  const { data, info } = await sharp(input).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (height * width - 1) * 4];
  const transparent = corners.every((i) => data[i + 3] < 10);
  if (!transparent) removeBackground(data, width, height);

  // Crop to the device: the bounding box of pixels that aren't (nearly) transparent.
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new RenderError('No device found in this image.');
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w * h > width * height * 0.97 && !transparent) {
    throw new RenderError('The device fills the whole image. Use a render with some plain background around it.');
  }

  const device = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: w, height: h })
    .resize({ width: Math.round(CANVAS * FILL), height: Math.round(CANVAS * FILL), fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: device.data, left: Math.round((CANVAS - device.info.width) / 2), top: Math.round((CANVAS - device.info.height) / 2) }])
    .webp({ quality: 88, alphaQuality: 100 })
    .toBuffer();
}
