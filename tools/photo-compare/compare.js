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

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fileName(s, date, ext) {
    // A canvas shaped by the photos is not made for any one platform.
    var platform = s.fit === 'contain' ? '' : byId(SIZES, s.canvas).platform;
    return ['ah-compare', slug(s.topic), platform, isoDate(date)].filter(Boolean).join('-') + '.' + ext;
  }

  window.AHCompare = { SIZES: SIZES, DEFAULTS: DEFAULTS, plan: plan, placePhoto: placePhoto, draftLabel: draftLabel, canvasSize: canvasSize, fileName: fileName };
  if (typeof document === 'undefined' || !document.getElementById('preview')) return;

  // ---------- State ----------

  var state = loadSettings();
  var photos = []; // { id, name, label, w, h, origW, origH, fx, fy, bitmap, thumb }
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

  function drawAll(canvas, s) {
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
      drawLabel(ctx, photo.label, panel, s, bg, layout.ref, mark);
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
      id: nextId++, name: file.name || 'Pasted photo', label: draftLabel(file.name),
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
    var failed = [];
    for (var i = 0; i < files.length; i++) {
      try {
        photos.push(await openPhoto(files[i]));
      } catch (e) {
        failed.push(files[i].name);
      }
    }
    busy = false;
    var notes = [];
    if (failed.length) notes.push('This browser could not open ' + plural(failed.length, 'file') + ': ' + failed.slice(0, 3).join(', ') + '. HEIC photos need converting to JPG first.');
    if (other) notes.push('Skipped ' + plural(other, 'file') + ' that ' + (other === 1 ? 'is not an image.' : 'are not images.'));
    showNotice(notes.join(' '));
    renderAll();
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

  function renderList() {
    var list = $('file-list');
    list.textContent = '';
    photos.forEach(function (photo, i) {
      var li = document.createElement('li');
      li.className = 'file-row photo-row';
      var img = document.createElement('img');
      img.className = 'file-thumb photo-thumb'; img.alt = ''; img.src = photo.thumb;
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'photo-label';
      input.value = photo.label;
      input.maxLength = 40;
      input.placeholder = 'Phone name';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Phone name for photo ' + (i + 1) + ' (' + photo.name + ')');
      input.addEventListener('input', function () { photo.label = input.value; renderPreview(); });
      var meta = document.createElement('span');
      meta.className = 'file-meta photo-meta';
      meta.textContent = photo.name + ' · ' + photo.origW + ' × ' + photo.origH;
      meta.title = photo.name;
      var controls = document.createElement('span');
      controls.className = 'move';
      controls.appendChild(iconButton('Move photo ' + (i + 1) + ' earlier', 'M18 15l-6-6-6 6', function () { swap(i, i - 1); }, i === 0));
      controls.appendChild(iconButton('Move photo ' + (i + 1) + ' later', 'M6 9l6 6 6-6', function () { swap(i, i + 1); }, i === photos.length - 1));
      controls.appendChild(iconButton('Remove photo ' + (i + 1), 'M6 6l12 12M18 6L6 18', function () {
        photo.bitmap.close();
        photos.splice(i, 1);
        renderAll();
      }));
      li.appendChild(img); li.appendChild(input); li.appendChild(meta); li.appendChild(controls);
      list.appendChild(li);
    });
    $('count-label').textContent = photos.length ? plural(photos.length, 'photo') : 'No photos yet';
    $('clear-all').hidden = !photos.length;
  }

  function swap(a, b) {
    if (b < 0 || b >= photos.length) return;
    var held = photos[a]; photos[a] = photos[b]; photos[b] = held;
    renderAll();
  }

  function renderPreview() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(async function () {
      await assetsReady;
      drawQueued = false;
      var has = photos.length > 0;
      $('preview').hidden = !has;
      $('stage-empty').hidden = has;
      $('facts').hidden = !has;
      $('name-row').hidden = !has;
      $('drag-hint').hidden = !has;
      $('copy').disabled = !has || busy;
      $('download').disabled = !has || busy;
      if (!has) { $('preview-h').textContent = 'Add two photos to start'; lastPanels = []; $('small-warning').hidden = true; $('summary').textContent = 'Add photos to get started.'; return; }
      var result = drawAll($('preview'), state);
      var size = result;
      $('preview-h').textContent = size.w + ' × ' + size.h;
      lastPanels = result.panels;
      var layoutName = byId(LAYOUTS, state.layout).name;
      var named = photos.filter(function (p) { return p.label.trim(); }).length;
      $('fact-layout').textContent = layoutName;
      $('fact-fit').textContent = byId(FITS, state.fit).name + (state.zoom > 100 ? ', zoomed ' + state.zoom + '%' : '');
      $('fact-labels').textContent = state.labels === 'off' ? 'Off' : named + ' of ' + photos.length + ' named';
      $('fact-wm').textContent = state.wmOn ? 'Bottom right' : 'Off';
      var warnings = [];
      if (photos.length === 1) warnings.push('Add a second photo to compare.');
      if (result.capped) warnings.push('Made narrower than the width you set, to keep the height under ' + MAX_OUT + ' pixels.');
      if (result.stretched.length) {
        warnings.push((result.stretched.length === photos.length ? 'The photos are' : 'Photo ' + result.stretched.map(function (i) { return i + 1; }).join(' and ') + (result.stretched.length === 1 ? ' is' : ' are')) + ' shown larger than full size, so may look soft.');
      }
      $('small-warning').hidden = !warnings.length;
      $('small-warning').textContent = warnings.join(' ');
      $('name-to').textContent = fileName(state, today, state.format);
      $('summary').textContent = '';
      var strong = document.createElement('strong');
      strong.textContent = plural(photos.length, 'photo');
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
      if (i < 0 || !photos[i]) return;
      photos[i].fx = 0.5; photos[i].fy = 0.5;
      renderPreview();
    });
  }

  // ---------- Saving ----------

  function toBlob(format) {
    var canvas = document.createElement('canvas');
    drawAll(canvas, state);
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

  async function download() {
    if (!photos.length) return;
    try {
      await assetsReady;
      var blob = await toBlob(state.format);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName(state, today, extOf(blob, state.format));
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    } catch (e) {
      $('summary').textContent = 'Could not save the image. ' + (e && e.message ? e.message : '');
    }
  }

  async function copyImage() {
    if (!photos.length) return;
    var button = $('copy');
    try {
      await assetsReady;
      // Clipboards take PNG.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob('png') })]);
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
      photos.forEach(function (photo) { photo.bitmap.close(); });
      photos = [];
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
    $('copy').addEventListener('click', copyImage);
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') $('copy').hidden = true;
    wireDrag();
  }

  build();
  wire();
  renderAll();
})();
