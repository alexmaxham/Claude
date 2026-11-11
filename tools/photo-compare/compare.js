/* AH Photo Compare. Puts photos from different phones next to each other in one image, each with the phone's name.
   Everything runs in the browser: photos are never uploaded. */
(function () {
  'use strict';

  // Canvas sizes come from the AH social media guide, the same ones the other tools use.
  var SIZES = [
    { id: 'wide', name: 'Wide · 1600 × 900 · X, articles', w: 1600, h: 900, platform: 'x' },
    { id: 'portrait', name: 'Portrait · 1080 × 1350 · Instagram, Threads', w: 1080, h: 1350, platform: 'instagram' },
    { id: 'square', name: 'Square · 1080 × 1080', w: 1080, h: 1080, platform: 'square' },
    { id: 'tall', name: 'Tall · 1080 × 1920 · Stories', w: 1080, h: 1920, platform: 'story' },
    { id: 'custom', name: 'Custom size', platform: 'custom' }
  ];
  var LAYOUTS = [
    { id: 'row', name: 'Side by side' },
    { id: 'stack', name: 'Stacked' },
    { id: 'grid', name: 'Grid' }
  ];
  var FITS = [
    { id: 'cover', name: 'Fill the space', note: 'Crops the edges' },
    { id: 'contain', name: 'Show it all', note: 'No cropping, any shape' }
  ];
  var LABELS = [
    { id: 'on', name: 'On the photo' },
    { id: 'below', name: 'Under it' },
    { id: 'off', name: 'Off' }
  ];
  // AH brand colours only.
  var BACKGROUNDS = [
    { id: 'ink', name: 'Ink', color: '#1C1C1E', dark: true },
    { id: 'paper', name: 'Paper', color: '#F5F4F0', dark: false },
    { id: 'white', name: 'White', color: '#FFFFFF', dark: false }
  ];
  var STORE_KEY = 'ah-photo-compare-v1';
  var DEFAULTS = {
    layout: 'row', fit: 'cover', zoom: 100, gap: 1, margin: 0,
    labels: 'on', labelPos: 'bl', labelSize: 4,
    bg: 'ink', canvas: 'wide', customW: 1600, customH: 900, autoW: 1600, wmOn: true,
    topic: '', format: 'jpg'
  };
  var MAX_OUT = 8000; // the longest side of a saved image
  var MAX_SIDE = 8192; // bigger photos are scaled down to this when they are added, to keep memory in check

  // ---------- Pure helpers ----------

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function clampInt(value, min, max, fallback) {
    var n = Math.round(Number(value));
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function clamp01(n) { return Math.min(1, Math.max(0, n)); }

  function canvasSize(s) {
    if (s.canvas === 'custom') return { w: clampInt(s.customW, 200, 8000, 1600), h: clampInt(s.customH, 200, 8000, 900) };
    var size = byId(SIZES, s.canvas);
    return { w: size.w, h: size.h };
  }

  /** Label text height in pixels. ref is the plan's reference length (the shorter side of a fixed canvas). */
  function labelPx(s, ref) {
    return (ref * s.labelSize) / 100;
  }

  function columnsFor(n, s) {
    return s.layout === 'row' ? n : s.layout === 'stack' ? 1 : Math.ceil(Math.sqrt(n));
  }

  function panel(x, y, w, photoH, stripH) {
    return { x: x, y: y, w: w, h: photoH, strip: stripH ? { x: x, y: y + photoH, w: w, h: stripH } : null };
  }

  /** A fixed canvas cut into equal boxes; the photos are cropped to fill them. */
  function planFixed(n, s) {
    var size = canvasSize(s);
    var W = size.w, H = size.h, ref = Math.min(W, H);
    var margin = (s.margin * ref) / 100, gap = (s.gap * ref) / 100;
    var stripH = s.labels === 'below' ? labelPx(s, ref) * 2 : 0;
    var cols = columnsFor(n, s);
    var rows = Math.ceil(n / cols);
    var cellH = (H - 2 * margin - gap * (rows - 1)) / rows;
    var panels = [];
    for (var r = 0; r < rows; r++) {
      // A short last row (three photos in a grid, say) is stretched to the full width.
      var inRow = Math.min(cols, n - r * cols);
      var cellW = (W - 2 * margin - gap * (inRow - 1)) / inRow;
      for (var c = 0; c < inRow; c++) {
        panels.push(panel(margin + c * (cellW + gap), margin + r * (cellH + gap), cellW, Math.max(1, cellH - stripH), stripH));
      }
    }
    return { w: W, h: H, ref: ref, panels: panels };
  }

  /**
   * A canvas shaped by the photos, so every photo shows whole with no bars. Each row is as wide as the canvas;
   * the photos in it share one height, and the canvas is as tall as the rows need.
   */
  function planAuto(imgs, s, width) {
    var n = imgs.length;
    var W = width, ref = W * 0.6;
    var margin = (s.margin * ref) / 100, gap = (s.gap * ref) / 100;
    var stripH = s.labels === 'below' ? labelPx(s, ref) * 2 : 0;
    var cols = columnsFor(n, s);
    var panels = [];
    var y = margin;
    for (var at = 0; at < n; at += cols) {
      var row = imgs.slice(at, at + cols);
      var shapes = 0;
      row.forEach(function (img) { shapes += img.w / img.h; });
      var rowH = Math.max(1, (W - 2 * margin - gap * (row.length - 1)) / shapes);
      var x = margin;
      row.forEach(function (img) {
        var w = (img.w / img.h) * rowH;
        panels.push(panel(x, y, w, rowH, stripH));
        x += w + gap;
      });
      y += rowH + stripH + gap;
    }
    return { w: W, h: y - gap + margin, ref: ref, panels: panels };
  }

  /**
   * Works out the canvas and where each photo goes. imgs: [{ w, h }]. Returns { w, h, ref, panels, auto, capped }.
   * Each panel is { x, y, w, h, strip }: the photo's box, and strip (or null), the band under it that holds the
   * name when names go under the photos. capped says the width asked for had to be cut to keep the height in range.
   */
  function plan(imgs, s) {
    if (!imgs.length) return { w: 0, h: 0, ref: 0, panels: [], auto: false, capped: false };
    if (s.fit !== 'contain') return Object.assign(planFixed(imgs.length, s), { auto: false, capped: false });
    var asked = clampInt(s.autoW, 200, MAX_OUT, 1600);
    var p = planAuto(imgs, s, asked);
    var capped = p.h > MAX_OUT;
    // Everything scales with the width, so a too-tall canvas is fixed by making it narrower.
    if (capped) p = planAuto(imgs, s, Math.max(1, Math.floor((asked * MAX_OUT) / p.h)));
    p.w = Math.round(p.w);
    p.h = Math.max(1, Math.round(p.h));
    return Object.assign(p, { auto: true, capped: capped });
  }

  /**
   * Where a photo is drawn in its box. img: { w, h, fx, fy } (fx, fy say which part shows when it is cropped: 0 is
   * the left or top, 1 the right or bottom). Returns the source rectangle, the destination rectangle and the scale.
   */
  function placePhoto(img, panel, s) {
    var base = s.fit === 'contain'
      ? Math.min(panel.w / img.w, panel.h / img.h)
      : Math.max(panel.w / img.w, panel.h / img.h);
    var k = base * (s.zoom / 100);
    var dw = Math.min(panel.w, img.w * k), dh = Math.min(panel.h, img.h * k);
    var sw = dw / k, sh = dh / k;
    return {
      sx: (img.w - sw) * clamp01(img.fx), sy: (img.h - sh) * clamp01(img.fy), sw: sw, sh: sh,
      dx: panel.x + (panel.w - dw) / 2, dy: panel.y + (panel.h - dh) / 2, dw: dw, dh: dh,
      scale: k
    };
  }

  /**
   * A first guess at the phone's name from the file name. Only the words before the first one that is not part of a
   * name are kept, so "Samsung-Galaxy-S26-Ultra-AH-20-1154x649.jpg" gives "Samsung Galaxy S26 Ultra". Camera names
   * like IMG_1234 give nothing.
   */
  function draftLabel(fileName) {
    var words = String(fileName || '').replace(/\.[a-z0-9]+$/i, '').split(/[\s_-]+/).filter(Boolean);
    var kept = [];
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      // Stop at AH's own tag, filler words, sizes like 1154x649, and long numbers (dates, upload ids).
      if (/^(ah|androidheadlines|img|pxl|dsc|dscf|dscn|mvimg|photo|image|view|screenshot|pasted|signal|whatsapp|camera|sample|samples|review|copy|edited|final|scaled)$/i.test(word)) break;
      if (/^\d+x\d+$/i.test(word) || /^\d{4,}$/.test(word) || /^\(\d+\)$/.test(word)) break;
      kept.push(/[a-z]/.test(word) && word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word);
    }
    return kept.length < 2 ? '' : kept.join(' ').slice(0, 40);
  }

  /**
   * Reads the camera's make and model and the time the photo was taken from a JPEG's EXIF block.
   * buffer: an ArrayBuffer with the start of the file. Returns { make, model, taken } with '' for anything missing;
   * taken looks like "2026:11:11 14:03:22", so it sorts as text.
   */
  function readExif(buffer) {
    var out = { make: '', model: '', taken: '' };
    var view = new DataView(buffer);
    try {
      if (view.getUint16(0) !== 0xFFD8) return out;
      var pos = 2;
      while (pos + 4 <= view.byteLength) {
        var marker = view.getUint16(pos);
        if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA || marker === 0xFFD9) break;
        var len = view.getUint16(pos + 2);
        // APP1 starting "Exif\0\0".
        if (marker === 0xFFE1 && view.getUint32(pos + 4) === 0x45786966 && view.getUint16(pos + 8) === 0) {
          readTiff(view, pos + 10, out);
          return out;
        }
        pos += 2 + len;
      }
    } catch (e) { /* a cut-off or broken block: keep what was read */ }
    return out;
  }

  function readTiff(view, start, out) {
    var little = view.getUint16(start) === 0x4949;
    function u16(at) { return view.getUint16(start + at, little); }
    function u32(at) { return view.getUint32(start + at, little); }
    if (u16(2) !== 42) return;
    function text(entry) {
      var count = u32(entry + 4);
      var at = count <= 4 ? entry + 8 : u32(entry + 8);
      var s = '';
      for (var i = 0; i < Math.min(count, 64); i++) {
        var c = view.getUint8(start + at + i);
        if (!c) break;
        s += String.fromCharCode(c);
      }
      return s.trim();
    }
    function eachTag(offset, fn) {
      var n = u16(offset);
      for (var i = 0; i < n; i++) fn(u16(offset + 2 + i * 12), offset + 2 + i * 12);
    }
    var exifAt = 0, changed = '';
    eachTag(u32(4), function (tag, entry) {
      if (tag === 0x010F) out.make = text(entry);
      else if (tag === 0x0110) out.model = text(entry);
      else if (tag === 0x0132) changed = text(entry);
      else if (tag === 0x8769) exifAt = u32(entry + 8);
    });
    if (exifAt) eachTag(exifAt, function (tag, entry) { if (tag === 0x9003) out.taken = text(entry); });
    if (!out.taken) out.taken = changed;
  }

  /**
   * Which phone took a photo, as best the browser can tell. key groups photos from the same phone: the camera model
   * from EXIF, else the phone name in the file name, else the camera's file name prefix (PXL_, IMG_), else ''.
   * label is a first guess at the phone's name: from the file name, else the camera model when it reads like a name
   * ("Pixel 9 Pro", not "SM-S938B").
   */
  function phoneGuess(fileName, exif) {
    var fromName = draftLabel(fileName);
    var model = (exif && exif.model) || '';
    var make = (exif && exif.make) || '';
    var key = '';
    if (model) key = 'camera:' + (make + ' ' + model).toLowerCase().trim();
    else if (fromName) key = 'name:' + fromName.toLowerCase();
    else {
      var prefix = /^([A-Za-z]{2,})[_-]?\d/.exec(String(fileName || ''));
      if (prefix) key = 'file:' + prefix[1].toUpperCase();
    }
    var label = fromName || (/[a-z]{2,}/.test(model) ? model.slice(0, 40) : '');
    return { key: key, label: label, camera: (make && model.toLowerCase().indexOf(make.toLowerCase()) < 0 ? make + ' ' : '') + model };
  }

  /** "2026:11:10 14:35:23" from a camera file name such as IMG_20261110_143523.jpg or PXL_20261110_143523123.jpg. */
  function timeFromName(name) {
    var m = /(20\d{2})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/.exec(String(name || ''));
    return m ? m[1] + ':' + m[2] + ':' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + m[6] : '';
  }

  /**
   * Pairs the photos into comparisons. phones: [{ photos: [...] }], in order from left to right. The first photo from
   * each phone goes in the first set, the second in the second, and so on. With only one phone, its photos make one set.
   */
  function buildSets(phones) {
    if (!phones.length) return [];
    if (phones.length === 1) return phones[0].photos.length ? [phones[0].photos.slice()] : [];
    var most = 0;
    phones.forEach(function (phone) { most = Math.max(most, phone.photos.length); });
    var sets = [];
    for (var i = 0; i < most; i++) {
      sets.push(phones.map(function (phone) { return phone.photos[i]; }).filter(Boolean));
    }
    return sets;
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** number and total (both optional) add "-02" and so on when there are several sets. */
  function fileName(s, date, ext, number, total) {
    // A canvas shaped by the photos is not made for any one platform.
    var platform = s.fit === 'contain' ? '' : byId(SIZES, s.canvas).platform;
    var count = total > 1 ? String(number).padStart(String(total).length < 2 ? 2 : String(total).length, '0') : '';
    return ['ah-compare', slug(s.topic), platform, isoDate(date), count].filter(Boolean).join('-') + '.' + ext;
  }

  window.AHCompare = {
    SIZES: SIZES, DEFAULTS: DEFAULTS, plan: plan, placePhoto: placePhoto, draftLabel: draftLabel, canvasSize: canvasSize,
    fileName: fileName, readExif: readExif, timeFromName: timeFromName, phoneGuess: phoneGuess, buildSets: buildSets
  };
  if (typeof document === 'undefined' || !document.getElementById('preview')) return;

  // ---------- State ----------

  var state = loadSettings();
  // Photos are kept by the phone that took them. Phones go left to right; a phone's photos are in the order they pair up.
  var phones = []; // { id, key, label, camera, photos: [{ id, name, key, guess, taken, w, h, origW, origH, fx, fy, bitmap, thumb, phone }] }
  var current = 0; // the set showing in the preview
  var nextId = 1;
  var busy = false;
  var today = new Date();
  var drawQueued = false;
  var lastPanels = [];

  var icon = new Image();
  var iconReady = new Promise(function (resolve) {
    icon.onload = resolve;
    icon.onerror = resolve;
    icon.src = window.AH_ICON_DATA_URI;
  });
  // The names are drawn in Archivo, so wait for it (or give up quietly when offline).
  var fontReady = document.fonts && document.fonts.load
    ? Promise.race([
      document.fonts.load('700 32px Archivo').catch(function () {}),
      new Promise(function (resolve) { setTimeout(resolve, 2500); })
    ])
    : Promise.resolve();
  var assetsReady = Promise.all([iconReady, fontReady]);

  function $(id) { return document.getElementById(id); }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function loadSettings() {
    var s = Object.assign({}, DEFAULTS);
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.keys(DEFAULTS).forEach(function (key) {
          if (typeof saved[key] === typeof DEFAULTS[key]) s[key] = saved[key];
        });
      }
    } catch (e) { /* storage can be blocked; the defaults are fine */ }
    s.layout = byId(LAYOUTS, s.layout).id;
    s.fit = byId(FITS, s.fit).id;
    s.labels = byId(LABELS, s.labels).id;
    s.bg = byId(BACKGROUNDS, s.bg).id;
    s.canvas = byId(SIZES, s.canvas).id;
    s.topic = '';
    return s;
  }

  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  // ---------- Drawing ----------

  function roundedRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Sets the font, shrinking it until the text fits the width. Returns the size used. */
  function fitFont(ctx, text, px, maxWidth) {
    for (var size = px; size > 8; size -= 1) {
      ctx.font = '700 ' + size + 'px Archivo, Arial, sans-serif';
      if (ctx.measureText(text).width <= maxWidth) return size;
    }
    return 8;
  }

  function drawLabel(ctx, text, panel, s, bg, ref, mark) {
    text = text.trim();
    if (!text || s.labels === 'off') return;
    var px = labelPx(s, ref);
    ctx.textBaseline = 'middle';
    if (s.labels === 'below') {
      var strip = panel.strip;
      fitFont(ctx, text, px, strip.w - px);
      ctx.textAlign = 'center';
      ctx.fillStyle = bg.dark ? '#FFFFFF' : '#1C1C1E';
      ctx.fillText(text, strip.x + strip.w / 2, strip.y + strip.h / 2);
      return;
    }
    var pad = px * 0.55, inset = px * 0.6;
    var top = s.labelPos.charAt(0) === 't', centre = s.labelPos.charAt(1) === 'c';
    // Keep a name at the bottom of the last photo clear of the watermark.
    var room = panel.w;
    if (mark && !top && mark.x < panel.x + panel.w && mark.x > panel.x && mark.y < panel.y + panel.h && mark.y + mark.h > panel.y + panel.h - inset - px * 1.7) {
      room = Math.max(px * 3, mark.x - panel.x);
    }
    var used = fitFont(ctx, text, px, room - 2 * inset - 2 * pad);
    var w = ctx.measureText(text).width + 2 * pad, h = used * 1.7;
    var x = centre ? panel.x + (room - w) / 2 : panel.x + inset;
    var y = top ? panel.y + inset : panel.y + panel.h - inset - h;
    roundedRect(ctx, x, y, w, h, used * 0.28);
    ctx.fillStyle = 'rgba(28, 28, 30, 0.9)';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, x + pad, y + h / 2 + used * 0.04);
  }

  function allPhotos() {
    return phones.reduce(function (all, phone) { return all.concat(phone.photos); }, []);
  }

  function sets() { return buildSets(phones); }

  function currentSet() {
    var all = sets();
    current = Math.max(0, Math.min(current, all.length - 1));
    return all[current] || [];
  }

  function phoneName(phone) {
    return phone.label.trim() || 'Phone ' + (phones.indexOf(phone) + 1);
  }

  function drawAll(canvas, s, photos) {
    var layout = plan(photos, s);
    var size = { w: layout.w, h: layout.h };
    var bg = byId(BACKGROUNDS, s.bg);
    canvas.width = size.w;
    canvas.height = size.h;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, size.w, size.h);
    var panels = layout.panels;
    var mark = null;
    if (s.wmOn && icon.naturalWidth) {
      // The AH icon, bottom right, as the brand kit asks for every image.
      var markW = Math.min(size.w * 0.06, size.h * 0.14);
      mark = { w: markW, h: (markW * icon.naturalHeight) / icon.naturalWidth };
      mark.x = size.w - markW * 0.5 - mark.w;
      mark.y = size.h - markW * 0.5 - mark.h;
    }
    var stretched = [];
    panels.forEach(function (panel, i) {
      var photo = photos[i];
      var p = placePhoto(photo, panel, s);
      ctx.drawImage(photo.bitmap, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
      // More than the photo's own pixels (as it was before any scaling down on the way in) can show.
      if (p.scale * (photo.w / photo.origW) > 1.01) stretched.push(i);
      drawLabel(ctx, photo.phone.label, panel, s, bg, layout.ref, mark);
    });
    if (mark) ctx.drawImage(icon, mark.x, mark.y, mark.w, mark.h);
    return { w: size.w, h: size.h, panels: panels, stretched: stretched, capped: layout.capped };
  }

  // ---------- Adding photos ----------

  function makeThumb(bitmap) {
    var c = document.createElement('canvas');
    c.width = 104; c.height = 80;
    var k = Math.max(c.width / bitmap.width, c.height / bitmap.height);
    var sw = c.width / k, sh = c.height / k;
    c.getContext('2d').drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  async function openPhoto(file) {
    var exif = { make: '', model: '', taken: '' };
    try { exif = readExif(await file.slice(0, 262144).arrayBuffer()); } catch (e) { /* no camera details */ }
    var guess = phoneGuess(file.name, exif);
    var bitmap = await createImageBitmap(file);
    var origW = bitmap.width, origH = bitmap.height;
    var longest = Math.max(origW, origH);
    if (longest > MAX_SIDE) {
      var k = MAX_SIDE / longest;
      var smaller = await createImageBitmap(bitmap, { resizeWidth: Math.round(origW * k), resizeHeight: Math.round(origH * k), resizeQuality: 'high' });
      bitmap.close();
      bitmap = smaller;
    }
    return {
      id: nextId++, name: file.name || 'Pasted photo', key: guess.key, guess: guess.label, camera: guess.camera, taken: exif.taken || timeFromName(file.name),
      w: bitmap.width, h: bitmap.height, origW: origW, origH: origH, fx: 0.5, fy: 0.5,
      bitmap: bitmap, thumb: makeThumb(bitmap)
    };
  }

  function showNotice(text) {
    $('add-notice').textContent = text;
    $('add-notice').hidden = !text;
  }

  async function addFiles(fileList) {
    if (busy) return;
    var files = Array.prototype.filter.call(fileList, function (f) {
      return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name);
    });
    var other = fileList.length - files.length;
    files.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    busy = true;
    renderPreview();
    var failed = [];
    var opened = [];
    for (var i = 0; i < files.length; i++) {
      $('summary').textContent = 'Opening ' + (i + 1) + ' of ' + files.length + '…';
      try {
        opened.push(await openPhoto(files[i]));
      } catch (e) {
        failed.push(files[i].name);
      }
    }
    placePhotos(opened);
    busy = false;
    var notes = [];
    // Nothing told the phones apart (both name files IMG_..., say, and the camera details are gone). The usual way a
    // batch is dropped is every photo from one phone, then every photo from the other, so pair the halves.
    if (opened.length && cannotTell()) {
      splitPhones();
      notes.push('These photos don\'t say which phone took them, so the first half are paired with the second half. If a pair is wrong, use the photo\'s menu or arrows to fix it.');
    }
    if (failed.length) notes.push('This browser could not open ' + plural(failed.length, 'file') + ': ' + failed.slice(0, 3).join(', ') + '. HEIC photos need converting to JPG first.');
    if (other) notes.push('Skipped ' + plural(other, 'file') + ' that ' + (other === 1 ? 'is not an image.' : 'are not images.'));
    showNotice(notes.join(' '));
    renderAll();
  }

  /**
   * Sorts new photos onto their phones: a photo joins the phone whose other photos came from the same camera, or
   * starts a new one. A phone's new photos go in the order they were taken (or by file name), so the first photo
   * from each phone pairs with the first from the others. Photos with nothing to go on get a phone each.
   */
  function placePhotos(opened) {
    var buckets = [];
    opened.forEach(function (photo) {
      var bucket = photo.key ? buckets.filter(function (b) { return b.key === photo.key; })[0] : null;
      if (!bucket) { bucket = { key: photo.key, photos: [] }; buckets.push(bucket); }
      bucket.photos.push(photo);
    });
    buckets.forEach(function (bucket) {
      var timed = bucket.photos.every(function (p) { return p.taken; });
      bucket.photos.sort(function (a, b) {
        if (timed && a.taken !== b.taken) return a.taken < b.taken ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
      var phone = bucket.key ? phones.filter(function (p) { return p.key === bucket.key; })[0] : null;
      if (!phone) { phone = newPhone(bucket.key); phones.push(phone); }
      bucket.photos.forEach(function (photo) { addToPhone(photo, phone); });
    });
  }

  function newPhone(key) {
    return { id: nextId++, key: key || '', label: '', camera: '', photos: [] };
  }

  function addToPhone(photo, phone, at, unnamed) {
    photo.phone = phone;
    if (at === undefined) phone.photos.push(photo); else phone.photos.splice(at, 0, photo);
    if (!phone.label && photo.guess && !unnamed) phone.label = photo.guess;
    if (!phone.camera && photo.camera) phone.camera = photo.camera;
  }

  function takeOut(photo) {
    var phone = photo.phone;
    phone.photos.splice(phone.photos.indexOf(photo), 1);
    if (!phone.photos.length) phones.splice(phones.indexOf(phone), 1);
  }

  function moveToPhone(photo, phoneId) {
    var from = photo.phone;
    var at = from.photos.indexOf(photo);
    takeOut(photo);
    var target = phones.filter(function (p) { return String(p.id) === String(phoneId); })[0];
    if (!target) {
      target = newPhone('');
      var after = phones.indexOf(from);
      phones.splice(after < 0 ? phones.length : after + 1, 0, target);
    }
    // Keep its place in the pairing where it can, so set 3 stays set 3.
    addToPhone(photo, target, Math.min(at, target.photos.length), target.photos.length === 0);
  }

  /** Puts the first half of the photos (in the order shown) on one phone and the second half on another. */
  /** True when the photos could be paired in halves but nothing tells their phones apart. */
  function cannotTell() {
    var count = allPhotos().length;
    var lonely = phones.every(function (phone) { return phone.photos.length === 1; });
    return count >= 4 && count % 2 === 0 && (phones.length === 1 || lonely);
  }

  function splitInHalf() {
    splitPhones();
    showNotice('');
    renderAll();
  }

  function splitPhones() {
    var all = allPhotos();
    var half = Math.ceil(all.length / 2);
    var first = newPhone(''), second = newPhone('');
    first.label = all[0].phone.label;
    second.label = all[half].phone.label !== first.label ? all[half].phone.label : '';
    phones = [first, second];
    all.forEach(function (photo, i) {
      var phone = i < half ? first : second;
      phone.photos.push(photo);
      photo.phone = phone;
      if (!phone.camera && photo.camera) phone.camera = photo.camera;
    });
    current = 0;
  }

  // ---------- Rendering the page ----------

  function choiceButtons(container, list, key, row) {
    list.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice' + (row ? ' choice-row' : '');
      btn.dataset.id = item.id;
      if (item.color) {
        var dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = item.color;
        var wrap = document.createElement('span');
        wrap.appendChild(dot);
        wrap.appendChild(document.createTextNode(item.name));
        btn.appendChild(wrap);
      } else {
        btn.appendChild(document.createTextNode(item.name));
      }
      if (item.note) {
        var note = document.createElement('small');
        note.textContent = item.note;
        btn.appendChild(note);
      }
      btn.addEventListener('click', function () { var patch = {}; patch[key] = item.id; change(patch); });
      container.appendChild(btn);
    });
  }

  function build() {
    choiceButtons($('layouts'), LAYOUTS, 'layout');
    choiceButtons($('fits'), FITS, 'fit');
    choiceButtons($('label-modes'), LABELS, 'labels');
    choiceButtons($('backgrounds'), BACKGROUNDS, 'bg', true);
    SIZES.forEach(function (size) {
      var option = document.createElement('option');
      option.value = size.id;
      option.textContent = size.name;
      $('canvas-size').appendChild(option);
    });
  }

  function press(container, id) {
    Array.prototype.forEach.call(container.children, function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.id === id));
    });
  }

  function renderControls() {
    press($('layouts'), state.layout);
    press($('fits'), state.fit);
    press($('label-modes'), state.labels);
    press($('backgrounds'), state.bg);
    $('zoom').value = state.zoom; $('zoom-out').textContent = state.zoom;
    $('gap').value = state.gap; $('gap-out').textContent = state.gap;
    $('margin').value = state.margin; $('margin-out').textContent = state.margin;
    $('label-options').hidden = state.labels === 'off';
    $('label-pos-field').hidden = state.labels !== 'on';
    $('label-pos').value = state.labelPos;
    $('label-size').value = state.labelSize; $('label-size-out').textContent = state.labelSize;
    var auto = state.fit === 'contain';
    $('fixed-size').hidden = auto;
    $('auto-size').hidden = !auto;
    if (document.activeElement !== $('auto-w')) $('auto-w').value = state.autoW;
    $('canvas-size').value = state.canvas;
    $('custom-size').hidden = auto || state.canvas !== 'custom';
    if (document.activeElement !== $('custom-w')) $('custom-w').value = state.customW;
    if (document.activeElement !== $('custom-h')) $('custom-h').value = state.customH;
    $('wm-on').checked = state.wmOn;
    if (document.activeElement !== $('topic')) $('topic').value = state.topic;
    $('format').value = state.format;
  }

  function iconButton(label, path, onClick, disabled) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.disabled = Boolean(disabled);
    btn.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
    btn.addEventListener('click', onClick);
    return btn;
  }

  var UP = 'M18 15l-6-6-6 6', DOWN = 'M6 9l6 6 6-6', LEFT = 'M15 6l-6 6 6 6', RIGHT = 'M9 6l6 6-6 6', CROSS = 'M6 6l12 12M18 6L6 18';

  /** "14:03:22" from EXIF's "2026:11:11 14:03:22". */
  function clock(taken) {
    var m = /\d{2}:\d{2}:\d{2}$/.exec(taken || '');
    return m ? m[0] : '';
  }

  function renderList() {
    var list = $('file-list');
    list.textContent = '';
    var paired = phones.length > 1;
    var setCount = sets().length;
    phones.forEach(function (phone, p) {
      var group = document.createElement('li');
      group.className = 'phone-group';
      var head = document.createElement('div');
      head.className = 'phone-head';
      var title = document.createElement('span');
      title.className = 'phone-title';
      var where = paired ? (p === 0 ? 'Left · ' : p === phones.length - 1 && phones.length === 2 ? 'Right · ' : '') : '';
      title.textContent = 'Phone ' + (p + 1) + ' · ' + where + plural(phone.photos.length, 'photo');
      if (phone.camera) title.title = 'The camera details say ' + phone.camera;
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'photo-label';
      input.value = phone.label;
      input.maxLength = 40;
      input.placeholder = phone.camera ? 'Phone name (camera: ' + phone.camera + ')' : 'Phone name';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Name of phone ' + (p + 1));
      input.addEventListener('input', function () { phone.label = input.value; renderPreview(); });
      input.addEventListener('change', function () { renderList(); });
      var moves = document.createElement('span');
      moves.className = 'move';
      if (paired) {
        moves.appendChild(iconButton('Move phone ' + (p + 1) + ' to the left', LEFT, function () { swapPhones(p, p - 1); }, p === 0));
        moves.appendChild(iconButton('Move phone ' + (p + 1) + ' to the right', RIGHT, function () { swapPhones(p, p + 1); }, p === phones.length - 1));
      }
      head.appendChild(title); head.appendChild(input); head.appendChild(moves);
      group.appendChild(head);

      var rows = document.createElement('ul');
      rows.className = 'phone-photos';
      phone.photos.forEach(function (photo, i) {
        var batch = paired && setCount > 1;
        var n = (batch ? 'set ' + (i + 1) : 'photo ' + (i + 1)) + ' (' + photo.name + ')';
        var li = document.createElement('li');
        li.className = 'file-row photo-row' + (batch && i === current ? ' is-current' : '');
        var pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'photo-pick';
        pick.setAttribute('aria-label', 'Show ' + n + ' in the preview');
        var img = document.createElement('img');
        img.className = 'file-thumb'; img.alt = ''; img.src = photo.thumb;
        pick.appendChild(img);
        pick.addEventListener('click', function () { if (batch) { current = i; renderAll(); } });
        var meta = document.createElement('span');
        meta.className = 'photo-meta';
        var time = clock(photo.taken);
        var first = document.createElement('span');
        first.className = 'photo-set';
        first.textContent = [batch ? 'Set ' + (i + 1) : '', time ? 'taken ' + time : ''].filter(Boolean).join(' · ') || photo.origW + ' × ' + photo.origH;
        var second = document.createElement('span');
        second.className = 'file-meta';
        second.textContent = photo.name + (batch || time ? ' · ' + photo.origW + ' × ' + photo.origH : '');
        meta.title = photo.name + ' · ' + photo.origW + ' × ' + photo.origH + (photo.taken ? ' · taken ' + photo.taken : '');
        meta.appendChild(first); meta.appendChild(second);
        var select = document.createElement('select');
        select.className = 'photo-phone';
        select.setAttribute('aria-label', 'Which phone took ' + n);
        phones.forEach(function (other, o) {
          var option = document.createElement('option');
          option.value = other.id;
          option.textContent = 'Phone ' + (o + 1) + (other.label.trim() ? ': ' + other.label.trim() : '');
          option.selected = other === phone;
          select.appendChild(option);
        });
        var fresh = document.createElement('option');
        fresh.value = 'new';
        fresh.textContent = 'A new phone';
        select.appendChild(fresh);
        select.addEventListener('change', function () { moveToPhone(photo, select.value); renderAll(); });
        var controls = document.createElement('span');
        controls.className = 'move';
        controls.appendChild(iconButton('Move ' + n + ' earlier', UP, function () { swapPhotos(phone, i, i - 1); }, i === 0));
        controls.appendChild(iconButton('Move ' + n + ' later', DOWN, function () { swapPhotos(phone, i, i + 1); }, i === phone.photos.length - 1));
        controls.appendChild(iconButton('Remove ' + n, CROSS, function () {
          photo.bitmap.close();
          takeOut(photo);
          renderAll();
        }));
        var tools = document.createElement('span');
        tools.className = 'photo-tools';
        tools.appendChild(select); tools.appendChild(controls);
        li.appendChild(pick); li.appendChild(meta); li.appendChild(tools);
        rows.appendChild(li);
      });
      group.appendChild(rows);
      list.appendChild(group);
    });
    var count = allPhotos().length;
    $('count-label').textContent = count ? plural(count, 'photo') + (paired ? ' from ' + phones.length + ' phones' : '') : 'No photos yet';
    $('clear-all').hidden = !count;
    // Nothing told the photos apart (or they all came from one camera): offer the usual way people shoot a batch.
    $('split').hidden = !cannotTell();
    var counts = phones.map(function (phone) { return phone.photos.length; });
    var uneven = paired && Math.min.apply(null, counts) !== Math.max.apply(null, counts);
    $('pair-notice').hidden = !uneven;
    if (uneven) {
      $('pair-notice').textContent = phones.map(function (phone) { return phoneName(phone) + ' has ' + plural(phone.photos.length, 'photo'); }).join(', ') +
        ', so some sets are missing a photo. Remove the extras, or use each photo\'s menu to move it to the right phone.';
    }
  }

  function swapPhotos(phone, a, b) {
    if (b < 0 || b >= phone.photos.length) return;
    var held = phone.photos[a]; phone.photos[a] = phone.photos[b]; phone.photos[b] = held;
    if (phones.length > 1 && current === a) current = b;
    renderAll();
  }

  function swapPhones(a, b) {
    if (b < 0 || b >= phones.length) return;
    var held = phones[a]; phones[a] = phones[b]; phones[b] = held;
    renderAll();
  }

  function renderPreview() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(async function () {
      await assetsReady;
      drawQueued = false;
      var photos = currentSet();
      var total = sets().length;
      var has = photos.length > 0;
      $('pager').hidden = total < 2;
      $('prev').disabled = current <= 0;
      $('next').disabled = current >= total - 1;
      $('pager-label').textContent = 'Set ' + (current + 1) + ' of ' + total;
      $('download-all').hidden = total < 2;
      $('download-all').disabled = busy;
      $('download-all').textContent = 'Download all ' + total + ' (ZIP)';
      $('download').textContent = total > 1 ? 'Download this set' : 'Download';
      // The main button is the one that saves everything.
      $('download').classList.toggle('btn-solid', total < 2);
      $('download').classList.toggle('btn-outline', total > 1);
      $('preview').hidden = !has;
      $('stage-empty').hidden = has;
      $('facts').hidden = !has;
      $('name-row').hidden = !has;
      $('drag-hint').hidden = !has;
      $('copy').disabled = !has || busy;
      $('download').disabled = !has || busy;
      if (!has) { $('preview-h').textContent = 'Add two photos to start'; lastPanels = []; $('small-warning').hidden = true; $('summary').textContent = 'Add photos to get started.'; return; }
      var result = drawAll($('preview'), state, photos);
      var size = result;
      $('preview-h').textContent = size.w + ' × ' + size.h;
      lastPanels = result.panels;
      var layoutName = byId(LAYOUTS, state.layout).name;
      var named = photos.filter(function (p) { return p.phone.label.trim(); }).length;
      $('fact-layout').textContent = layoutName;
      $('fact-fit').textContent = byId(FITS, state.fit).name + (state.zoom > 100 ? ', zoomed ' + state.zoom + '%' : '');
      $('fact-labels').textContent = state.labels === 'off' ? 'Off' : named + ' of ' + photos.length + ' named';
      $('fact-wm').textContent = state.wmOn ? 'Bottom right' : 'Off';
      var warnings = [];
      if (photos.length === 1) warnings.push(total > 1 ? 'This set has only one photo.' : 'Add a second photo to compare.');
      if (result.capped) warnings.push('Made narrower than the width you set, to keep the height under ' + MAX_OUT + ' pixels.');
      if (result.stretched.length) {
        warnings.push((result.stretched.length === photos.length ? 'The photos are' : 'Photo ' + result.stretched.map(function (i) { return i + 1; }).join(' and ') + (result.stretched.length === 1 ? ' is' : ' are')) + ' shown larger than full size, so may look soft.');
      }
      $('small-warning').hidden = !warnings.length;
      $('small-warning').textContent = warnings.join(' ');
      $('name-to').textContent = fileName(state, today, state.format, current + 1, total);
      $('summary').textContent = '';
      var strong = document.createElement('strong');
      strong.textContent = (total > 1 ? 'Set ' + (current + 1) + ' of ' + total + ' · ' : '') + plural(photos.length, 'photo');
      $('summary').appendChild(strong);
      $('summary').appendChild(document.createTextNode(' · ' + size.w + ' × ' + size.h + ' · ' + layoutName.toLowerCase()));
    });
  }

  function renderAll() {
    renderControls();
    renderList();
    renderPreview();
  }

  function change(patch) {
    Object.assign(state, patch);
    saveSettings();
    renderControls();
    renderPreview();
  }

  // ---------- Moving a photo inside its box ----------

  function wireDrag() {
    var canvas = $('preview');
    var drag = null;

    function toCanvas(e) {
      var box = canvas.getBoundingClientRect();
      var k = canvas.width / box.width;
      return { x: (e.clientX - box.left) * k, y: (e.clientY - box.top) * k, k: k };
    }
    function panelAt(pt) {
      for (var i = 0; i < lastPanels.length; i++) {
        var p = lastPanels[i];
        if (pt.x >= p.x && pt.x <= p.x + p.w && pt.y >= p.y && pt.y <= p.y + p.h) return i;
      }
      return -1;
    }

    canvas.addEventListener('pointerdown', function (e) {
      var pt = toCanvas(e);
      var i = panelAt(pt);
      var photos = currentSet();
      if (i < 0 || !photos[i]) return;
      drag = { photo: photos[i], panel: lastPanels[i], x: e.clientX, y: e.clientY, fx: photos[i].fx, fy: photos[i].fy, k: pt.k };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-dragging');
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = placePhoto(drag.photo, drag.panel, state);
      // How far the photo can slide: the part of it that is cropped off, in canvas pixels.
      var spareX = drag.photo.w * p.scale - p.dw, spareY = drag.photo.h * p.scale - p.dh;
      if (spareX > 0.5) drag.photo.fx = clamp01(drag.fx - ((e.clientX - drag.x) * drag.k) / spareX);
      if (spareY > 0.5) drag.photo.fy = clamp01(drag.fy - ((e.clientY - drag.y) * drag.k) / spareY);
      renderPreview();
    });
    function end() {
      drag = null;
      canvas.classList.remove('is-dragging');
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('dblclick', function (e) {
      var i = panelAt(toCanvas(e));
      var photos = currentSet();
      if (i < 0 || !photos[i]) return;
      photos[i].fx = 0.5; photos[i].fy = 0.5;
      renderPreview();
    });
  }

  // ---------- Saving ----------

  function toBlob(format, photos) {
    var canvas = document.createElement('canvas');
    drawAll(canvas, state, photos || currentSet());
    var type = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('The browser could not save this image.')); }, type, 0.92);
    });
  }

  function extOf(blob, wanted) {
    if (blob.type === 'image/png') return 'png';
    if (blob.type === 'image/webp') return 'webp';
    if (blob.type === 'image/jpeg') return 'jpg';
    return wanted;
  }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  async function download() {
    var photos = currentSet();
    if (!photos.length) return;
    try {
      await assetsReady;
      var blob = await toBlob(state.format, photos);
      saveBlob(blob, fileName(state, today, extOf(blob, state.format), current + 1, sets().length));
    } catch (e) {
      $('summary').textContent = 'Could not save the image. ' + (e && e.message ? e.message : '');
    }
  }

  /** Every set as its own image, in one ZIP. */
  async function downloadAll() {
    var all = sets();
    if (all.length < 2 || busy) return;
    busy = true;
    $('download').disabled = true;
    $('download-all').disabled = true;
    var files = [];
    try {
      await assetsReady;
      for (var i = 0; i < all.length; i++) {
        $('summary').textContent = 'Saving ' + (i + 1) + ' of ' + all.length + '…';
        var blob = await toBlob(state.format, all[i]);
        files.push({ name: fileName(state, today, extOf(blob, state.format), i + 1, all.length), bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      var zipName = ['ah-compare', slug(state.topic), isoDate(today)].filter(Boolean).join('-') + '.zip';
      saveBlob(window.AHZip.makeZip(files), zipName);
      busy = false;
      renderPreview();
    } catch (e) {
      busy = false;
      renderPreview();
      $('summary').textContent = 'Could not save the images. ' + (e && e.message ? e.message : '');
    }
  }

  async function copyImage() {
    var photos = currentSet();
    if (!photos.length) return;
    var button = $('copy');
    try {
      await assetsReady;
      // Clipboards take PNG.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob('png', photos) })]);
      button.textContent = 'Copied';
    } catch (e) {
      button.textContent = "Couldn't copy";
    }
    setTimeout(function () { button.textContent = 'Copy image'; }, 1800);
  }

  // ---------- Wiring ----------

  function wire() {
    $('pick-files').addEventListener('click', function () { $('file-input').click(); });
    $('file-input').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      addFiles(files);
    });
    var drop = $('drop');
    var depth = 0;
    window.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; drop.classList.add('is-over'); });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('is-over'); });
    window.addEventListener('drop', function (e) {
      e.preventDefault();
      depth = 0;
      drop.classList.remove('is-over');
      addFiles(Array.prototype.slice.call(e.dataTransfer.files || []));
    });
    window.addEventListener('paste', function (e) {
      var files = e.clipboardData && e.clipboardData.files;
      if (files && files.length) addFiles(Array.prototype.slice.call(files));
    });
    $('clear-all').addEventListener('click', function () {
      allPhotos().forEach(function (photo) { photo.bitmap.close(); });
      phones = [];
      current = 0;
      showNotice('');
      renderAll();
    });

    $('zoom').addEventListener('input', function (e) { change({ zoom: Number(e.target.value) }); });
    $('gap').addEventListener('input', function (e) { change({ gap: Number(e.target.value) }); });
    $('margin').addEventListener('input', function (e) { change({ margin: Number(e.target.value) }); });
    $('label-pos').addEventListener('change', function (e) { change({ labelPos: e.target.value }); });
    $('label-size').addEventListener('input', function (e) { change({ labelSize: Number(e.target.value) }); });
    $('canvas-size').addEventListener('change', function (e) { change({ canvas: e.target.value }); });
    $('auto-w').addEventListener('input', function (e) { change({ autoW: clampInt(e.target.value, 200, MAX_OUT, state.autoW) }); });
    $('custom-w').addEventListener('input', function (e) { change({ customW: clampInt(e.target.value, 200, 8000, state.customW) }); });
    $('custom-h').addEventListener('input', function (e) { change({ customH: clampInt(e.target.value, 200, 8000, state.customH) }); });
    $('wm-on').addEventListener('change', function (e) { change({ wmOn: e.target.checked }); });
    $('topic').addEventListener('input', function (e) { change({ topic: e.target.value }); });
    $('format').addEventListener('change', function (e) { change({ format: e.target.value }); });
    $('download').addEventListener('click', download);
    $('download-all').addEventListener('click', downloadAll);
    $('split').addEventListener('click', splitInHalf);
    $('prev').addEventListener('click', function () { if (current > 0) { current--; renderAll(); } });
    $('next').addEventListener('click', function () { if (current < sets().length - 1) { current++; renderAll(); } });
    document.addEventListener('keydown', function (e) {
      // Left and right arrows step through the sets, unless someone is typing.
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (sets().length < 2 || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' && current > 0) { current--; renderAll(); }
      if (e.key === 'ArrowRight' && current < sets().length - 1) { current++; renderAll(); }
    });
    $('copy').addEventListener('click', copyImage);
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') $('copy').hidden = true;
    wireDrag();
  }

  build();
  wire();
  renderAll();
})();
