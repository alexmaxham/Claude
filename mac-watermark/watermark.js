// Resize & Watermark: resizes images and stamps a watermark image on them.
// JavaScript for Automation (JXA), so it runs on any Mac with nothing to install:
//   osascript -l JavaScript watermark.js photo1.jpg photo2.png ...
// The Finder Quick Action calls it with the selected files.
// Settings live in ~/Library/Application Support/ResizeWatermark/config.json.

ObjC.import('AppKit');

const SUPPORT_DIR = $.NSHomeDirectory().js + '/Library/Application Support/ResizeWatermark';

const DEFAULTS = {
  width: 1600,              // output size in pixels
  height: 900,
  fit: 'crop',              // crop: fill width x height exactly, trimming the edges that overflow
                            // fit: shrink to fit inside width x height, keeping the whole photo
  watermark: SUPPORT_DIR + '/watermark.png',
  position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left, center
  watermarkSize: 0.25,      // watermark width as a fraction of the image's shorter edge
  margin: 0.03,             // gap from the edges as a fraction of the shorter edge
  opacity: 1,               // 0 (invisible) to 1 (solid)
  suffix: '-watermarked',   // added to the file name; the original is never touched
  outputFolder: '',         // subfolder to save into, e.g. "Watermarked"; empty saves alongside
  jpegQuality: 0.9,         // 0 to 1
};

const JPEG = 3; // NSBitmapImageFileTypeJPEG
const PNG = 4;  // NSBitmapImageFileTypePNG
const SOURCE_OVER = 2; // NSCompositingOperationSourceOver
const INTERPOLATION_HIGH = 3;

function run(argv) {
  const app = Application.currentApplication();
  app.includeStandardAdditions = true;

  if (argv.length === 0) {
    app.displayAlert('Resize & Watermark', { message: 'Select one or more images first.' });
    return;
  }

  let config;
  let watermark;
  try {
    config = loadConfig();
    watermark = $.NSImage.alloc.initWithContentsOfFile(config.watermark);
    if (watermark.isNil()) throw new Error('Watermark image not found at ' + config.watermark + '. Run install.sh with your watermark image.');
  } catch (e) {
    app.displayAlert('Resize & Watermark', { message: String(e.message || e), as: 'critical' });
    return;
  }

  const failed = [];
  let done = 0;
  for (const path of argv) {
    try {
      processImage(path, watermark, config);
      done++;
    } catch (e) {
      failed.push(basename(path) + ': ' + (e.message || e));
    }
  }

  if (failed.length) {
    app.displayAlert('Resize & Watermark', {
      message: `${done} done, ${failed.length} failed:\n\n${failed.join('\n')}`,
      as: 'warning',
    });
  } else {
    app.displayNotification(`${done} image${done === 1 ? '' : 's'} saved`, { withTitle: 'Resize & Watermark' });
  }
}

function loadConfig() {
  const path = SUPPORT_DIR + '/config.json';
  if (!$.NSFileManager.defaultManager.fileExistsAtPath(path)) return Object.assign({}, DEFAULTS);
  const text = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  let user;
  try {
    user = JSON.parse(text.js);
  } catch (e) {
    throw new Error('config.json is not valid JSON: ' + e.message);
  }
  const config = Object.assign({}, DEFAULTS, user);
  config.watermark = expandHome(config.watermark);
  return config;
}

function processImage(path, watermark, config) {
  const image = $.NSImage.alloc.initWithContentsOfFile(path);
  if (image.isNil()) throw new Error('not an image');

  // NSImage.size is in points and already accounts for EXIF rotation, so its shape is
  // what the viewer sees.
  const shape = image.size;
  let width = config.width;
  let height = config.height;
  let scale;
  if (config.fit === 'fit') {
    // Shrink to fit inside width x height without cropping; the output keeps the photo's shape.
    scale = Math.min(width / shape.width, height / shape.height);
    width = Math.max(1, Math.round(shape.width * scale));
    height = Math.max(1, Math.round(shape.height * scale));
  } else {
    // Fill exactly width x height, cropping evenly from the sides that overflow.
    scale = Math.max(width / shape.width, height / shape.height);
  }
  const drawWidth = shape.width * scale;
  const drawHeight = shape.height * scale;

  const outType = /\.png$/i.test(path) ? PNG : JPEG;

  const canvas = $.NSBitmapImageRep.alloc
    .initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
      null, width, height, 8, 4, true, false, 'NSCalibratedRGBColorSpace', 0, 0);
  canvas.setSize($.NSMakeSize(width, height)); // 1 point = 1 pixel, regardless of Retina

  const context = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(canvas);
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext(context);
  context.setImageInterpolation(INTERPOLATION_HIGH);

  const full = $.NSMakeRect(0, 0, width, height);
  if (outType === JPEG) {
    // JPEG has no transparency; keep transparent areas white rather than black.
    $.NSColor.whiteColor.setFill;
    $.NSBezierPath.fillRect(full);
  }
  image.drawInRectFromRectOperationFraction(
    $.NSMakeRect((width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight),
    $.NSMakeRect(0, 0, 0, 0), SOURCE_OVER, 1.0);

  const short = Math.min(width, height);
  const wmShape = watermark.size;
  const wmWidth = short * config.watermarkSize;
  const wmHeight = wmWidth * wmShape.height / wmShape.width;
  const margin = short * config.margin;
  const [x, y] = place(config.position, width, height, wmWidth, wmHeight, margin);
  watermark.drawInRectFromRectOperationFraction(
    $.NSMakeRect(x, y, wmWidth, wmHeight), $.NSMakeRect(0, 0, 0, 0), SOURCE_OVER, config.opacity);

  context.flushGraphics;
  $.NSGraphicsContext.restoreGraphicsState;

  const props = outType === JPEG
    ? $.NSDictionary.dictionaryWithObjectForKey($(config.jpegQuality), 'NSImageCompressionFactor')
    : $.NSDictionary.dictionary;
  const data = canvas.representationUsingTypeProperties(outType, props);
  const out = outputPath(path, outType === PNG ? 'png' : 'jpg', config);
  if (!data.writeToFileAtomically(out, true)) throw new Error('could not save ' + out);
}

// Cocoa's origin is the bottom-left corner.
function place(position, width, height, w, h, margin) {
  const left = margin;
  const right = width - w - margin;
  const bottom = margin;
  const top = height - h - margin;
  switch (position) {
    case 'bottom-left': return [left, bottom];
    case 'top-left': return [left, top];
    case 'top-right': return [right, top];
    case 'center': return [(width - w) / 2, (height - h) / 2];
    default: return [right, bottom];
  }
}

function outputPath(path, ext, config) {
  const fm = $.NSFileManager.defaultManager;
  let dir = $(path).stringByDeletingLastPathComponent.js;
  if (config.outputFolder) {
    dir += '/' + config.outputFolder;
    fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(dir, true, null, null);
  }
  const name = $(path).lastPathComponent.stringByDeletingPathExtension.js + config.suffix;
  let out = `${dir}/${name}.${ext}`;
  for (let n = 2; fm.fileExistsAtPath(out); n++) out = `${dir}/${name} ${n}.${ext}`;
  return out;
}

function basename(path) {
  return $(path).lastPathComponent.js;
}

function expandHome(path) {
  return String(path).replace(/^~(?=\/|$)/, $.NSHomeDirectory().js);
}
