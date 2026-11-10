/* AH Screenshot Framer. Puts phone screenshots in a plain drawn frame (or none) on an AH background.
   Everything runs in the browser: screenshots are never uploaded. */
(function () {
  'use strict';

  // Canvas sizes come from the AH social media guide, the same ones the Image Resizer uses.
  var SIZES = [
    { id: 'wide', name: 'Wide · 1600 × 900 · X, articles', w: 1600, h: 900, platform: 'x' },
    { id: 'portrait', name: 'Portrait · 1080 × 1350 · Instagram, Threads', w: 1080, h: 1350, platform: 'instagram' },
    { id: 'square', name: 'Square · 1080 × 1080', w: 1080, h: 1080, platform: 'square' },
    { id: 'tall', name: 'Tall · 1080 × 1920 · Stories', w: 1080, h: 1920, platform: 'story' },
    { id: 'custom', name: 'Custom size', platform: 'custom' }
  ];
  var FRAMES = [
    { id: 'phone', name: 'AH frame', note: 'A plain drawn phone' },
    { id: 'none', name: 'No frame', note: 'Rounded corners only' }
  ];
  var LAYOUTS = [
    { id: 'row', name: 'Side by side' },
    { id: 'stagger', name: 'Staggered' },
    { id: 'fan', name: 'Fanned' }
  ];
  // AH brand colours only.
  var BACKGROUNDS = [
    { id: 'ink', name: 'Ink', color: '#1C1C1E', dark: true },
    { id: 'paper', name: 'Paper', color: '#F5F4F0', dark: false },
    { id: 'white', name: 'White', color: '#FFFFFF', dark: false }
  ];
  var COLOURS = [
    { id: 'black', name: 'Black', color: '#101012' },
    { id: 'silver', name: 'Silver', color: '#C9C9CE' },
    { id: 'white', name: 'White', color: '#FFFFFF' }
  ];
  var STORE_KEY = 'ah-screenshot-framer-v1';
  var DEFAULTS = {
    frame: 'phone', colour: 'black', camera: 'centre', round: 12,
    layout: 'row', size: 78, gap: 4,
    bg: 'ink', canvas: 'wide', customW: 1600, customH: 900, wmOn: true,
    topic: '', format: 'png'
  };
  var EDGE = 0.05; // clear space kept around the group, as a share of the canvas's shorter side
  var PHONE_SHAPE = 0.46; // width of an ordinary phone as a share of its height (about 9:19.5)
  var BEZEL = 0.035; // frame thickness, as a share of that ordinary phone width
  var FAN_DEGREES = 7;

  // ---------- Pure helpers (also used by the tests) ----------

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function clampInt(value, min, max, fallback) {
    var n = Math.round(Number(value));
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function canvasSize(s) {
    if (s.canvas === 'custom') return { w: clampInt(s.customW, 200, 8000, 1600), h: clampInt(s.customH, 200, 8000, 900) };
    var size = byId(SIZES, s.canvas);
    return { w: size.w, h: size.h };
  }

  /**
   * Works out where each phone goes. shots: [{ w, h }] (screenshot pixels).
   * Returns { phones: [{ x, y, w, h, angle, bezel, unit }], rows, shrunk }. x,y is a phone's centre and w,h its outer
   * size. unit is the width of an ordinary phone at this height: frame thickness, corner roundness and the camera dot
   * are sized from it, so a tablet or foldable next to a phone gets the same frame, not a fatter one.
   * shrunk says the phones had to be made smaller than the size asked for to fit the canvas.
   */
  function layoutPhones(shots, s, W, H) {
    var n = shots.length;
    if (!n) return { phones: [], rows: 0, shrunk: false };
    var framed = s.frame === 'phone';
    var edge = Math.min(W, H) * EDGE;
    var gap = (W * s.gap) / 100;
    var gapY = Math.max(gap, H * 0.03);
    var asked = (H * s.size) / 100;

    function angleOf(i, count) {
      if (s.layout !== 'fan' || count === 1) return 0;
      return (((i / (count - 1)) * 2 - 1) * FAN_DEGREES * Math.PI) / 180;
    }
    function liftOf(i, count, height) {
      if (count === 1) return 0;
      if (s.layout === 'stagger') return (i % 2 === 0 ? 1 : -1) * height * 0.06;
      if (s.layout === 'fan') return Math.abs((i / (count - 1)) * 2 - 1) * height * 0.05 - height * 0.02;
      return 0;
    }

    /** One row of phones at a given height: their sizes, the row's width, and how far it reaches above and below its centre line. */
    function measureRow(rowShots, height) {
      var unit = height * PHONE_SHAPE;
      var bezel = framed ? unit * BEZEL : 0;
      var total = 0, top = Infinity, bottom = -Infinity;
      var phones = rowShots.map(function (shot, i) {
        var w = (shot.w / shot.h) * (height - 2 * bezel) + 2 * bezel;
        var angle = angleOf(i, rowShots.length);
        var c = Math.abs(Math.cos(angle)), sn = Math.abs(Math.sin(angle));
        var boxW = w * c + height * sn, boxH = w * sn + height * c; // the space it takes once tilted
        var lift = liftOf(i, rowShots.length, height);
        total += boxW;
        top = Math.min(top, lift - boxH / 2);
        bottom = Math.max(bottom, lift + boxH / 2);
        return { w: w, h: height, angle: angle, bezel: bezel, unit: unit, boxW: boxW, lift: lift };
      });
      return { phones: phones, total: total + gap * (rowShots.length - 1), top: top, bottom: bottom };
    }

    function split(rowCount) {
      var rows = [], at = 0;
      for (var r = 0; r < rowCount; r++) {
        var take = Math.ceil((n - at) / (rowCount - r));
        rows.push(shots.slice(at, at + take));
        at += take;
      }
      return rows;
    }

    /** The tallest phones that fit when the screenshots are split over this many rows. */
    function tryRows(rowCount) {
      var rows = split(rowCount);
      function fits(height) {
        var tall = gapY * (rowCount - 1);
        for (var r = 0; r < rows.length; r++) {
          var m = measureRow(rows[r], height);
          if (m.total > W - 2 * edge) return false;
          tall += m.bottom - m.top;
        }
        return tall <= H - 2 * edge;
      }
      var cap = (asked - gapY * (rowCount - 1)) / rowCount;
      if (cap <= 0) return null;
      var height = cap;
      if (!fits(cap)) {
        var lo = 0, hi = cap;
        for (var k = 0; k < 30; k++) {
          var mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid; else hi = mid;
        }
        height = lo;
      }
      return { rows: rows, height: height };
    }

    // Use one row unless splitting into more rows makes the phones clearly bigger (tall canvases, many screenshots).
    var best = tryRows(1);
    for (var count = 2; count <= Math.min(n, 3); count++) {
      var option = tryRows(count);
      if (option && option.height > best.height * 1.15) best = option;
    }

    var measured = best.rows.map(function (row) { return measureRow(row, best.height); });
    var groupTall = gapY * (measured.length - 1);
    measured.forEach(function (m) { groupTall += m.bottom - m.top; });
    var y = (H - groupTall) / 2;
    var phones = [];
    measured.forEach(function (m) {
      var x = (W - m.total) / 2;
      var centre = y - m.top;
      m.phones.forEach(function (p) {
        phones.push({ x: x + p.boxW / 2, y: centre + p.lift, w: p.w, h: p.h, angle: p.angle, bezel: p.bezel, unit: p.unit });
        x += p.boxW + gap;
      });
      y += m.bottom - m.top + gapY;
    });
    return { phones: phones, rows: measured.length, shrunk: best.height < asked * 0.999 };
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fileName(s, date, ext) {
    return ['ah-screens', slug(s.topic), byId(SIZES, s.canvas).platform, isoDate(date)].filter(Boolean).join('-') + '.' + ext;
  }

  window.AHFramer = { SIZES: SIZES, DEFAULTS: DEFAULTS, layoutPhones: layoutPhones, canvasSize: canvasSize, fileName: fileName };
  if (typeof document === 'undefined' || !document.getElementById('preview')) return;

  // ---------- State ----------

  var state = loadSettings();
  var shots = []; // { id, name, w, h, bitmap, thumb }
  var nextId = 1;
  var busy = false;
  var today = new Date();
  var drawQueued = false;

  var icon = new Image();
  var iconReady = new Promise(function (resolve) {
    icon.onload = resolve;
    icon.onerror = resolve;
    icon.src = window.AH_ICON_DATA_URI;
  });

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
    s.frame = byId(FRAMES, s.frame).id;
    s.layout = byId(LAYOUTS, s.layout).id;
    s.bg = byId(BACKGROUNDS, s.bg).id;
    s.colour = byId(COLOURS, s.colour).id;
    s.canvas = byId(SIZES, s.canvas).id;
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

  function drawPhone(ctx, shot, p, s, dark, scale) {
    var framed = s.frame === 'phone';
    var radius = (p.unit * s.round) / 100;
    var line = Math.max(1, 2 * scale);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    var x = -p.w / 2, y = -p.h / 2;

    if (framed) {
      roundedRect(ctx, x, y, p.w, p.h, radius);
      ctx.fillStyle = byId(COLOURS, s.colour).color;
      ctx.fill();
      // A thin line so a black frame shows on Ink and a white one shows on White.
      ctx.lineWidth = line;
      ctx.strokeStyle = dark ? '#4A4A4F' : '#8C8C8F';
      ctx.stroke();
    }

    var sx = x + p.bezel, sy = y + p.bezel, sw = p.w - 2 * p.bezel, sh = p.h - 2 * p.bezel;
    ctx.save();
    roundedRect(ctx, sx, sy, sw, sh, Math.max(0, radius - p.bezel));
    ctx.clip();
    ctx.fillStyle = '#ECEAE4';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.drawImage(shot.bitmap, sx, sy, sw, sh);
    ctx.restore();

    if (!framed) {
      // The guide's framed-picture line.
      roundedRect(ctx, sx, sy, sw, sh, radius);
      ctx.lineWidth = line;
      ctx.strokeStyle = dark ? '#3A3A40' : '#D9D6CE';
      ctx.stroke();
    } else if (s.camera !== 'none') {
      var r = p.unit * 0.022;
      var cx = s.camera === 'left' ? sx + p.unit * 0.09 : 0;
      ctx.beginPath();
      ctx.arc(cx, sy + p.unit * 0.055, r, 0, Math.PI * 2);
      ctx.fillStyle = '#101012';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAll(canvas, s) {
    var size = canvasSize(s);
    var bg = byId(BACKGROUNDS, s.bg);
    canvas.width = size.w;
    canvas.height = size.h;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, size.w, size.h);
    var result = layoutPhones(shots, s, size.w, size.h);
    var scale = Math.min(size.w, size.h) / 900;
    result.phones.forEach(function (p, i) { drawPhone(ctx, shots[i], p, s, bg.dark, scale); });
    if (s.wmOn && icon.naturalWidth) {
      // The AH icon, bottom right, as the brand kit asks for every image.
      var w = size.w * 0.06;
      var h = (w * icon.naturalHeight) / icon.naturalWidth;
      var m = size.w * 0.03;
      ctx.drawImage(icon, size.w - m - w, size.h - m - h, w, h);
    }
    return result;
  }

  // ---------- Adding screenshots ----------

  function makeThumb(bitmap) {
    var c = document.createElement('canvas');
    c.width = 60; c.height = 104;
    var k = Math.max(c.width / bitmap.width, c.height / bitmap.height);
    var sw = c.width / k, sh = c.height / k;
    c.getContext('2d').drawImage(bitmap, (bitmap.width - sw) / 2, 0, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
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
        var bitmap = await createImageBitmap(files[i]);
        shots.push({ id: nextId++, name: files[i].name || 'Pasted screenshot', w: bitmap.width, h: bitmap.height, bitmap: bitmap, thumb: makeThumb(bitmap) });
      } catch (e) {
        failed.push(files[i].name);
      }
    }
    busy = false;
    var notes = [];
    if (failed.length) notes.push('This browser could not open ' + plural(failed.length, 'file') + ': ' + failed.slice(0, 3).join(', ') + '.');
    if (other) notes.push('Skipped ' + plural(other, 'file') + ' that ' + (other === 1 ? 'is not an image.' : 'are not images.'));
    showNotice(notes.join(' '));
    renderAll();
  }

  // ---------- Rendering the page ----------

  function choiceButtons(container, list, key, extra) {
    list.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice' + (extra ? ' choice-row' : '');
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
    choiceButtons($('frames'), FRAMES, 'frame');
    choiceButtons($('layouts'), LAYOUTS, 'layout');
    choiceButtons($('backgrounds'), BACKGROUNDS, 'bg', true);
    COLOURS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.id = c.id;
      btn.setAttribute('aria-label', c.name + ' frame');
      btn.title = c.name;
      var dot = document.createElement('span');
      dot.style.background = c.color;
      btn.appendChild(dot);
      btn.addEventListener('click', function () { change({ colour: c.id }); });
      $('colours').appendChild(btn);
    });
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
    press($('frames'), state.frame);
    press($('layouts'), state.layout);
    press($('backgrounds'), state.bg);
    press($('colours'), state.colour);
    $('frame-options').hidden = state.frame !== 'phone';
    $('camera').value = state.camera;
    $('round').value = state.round; $('round-out').textContent = state.round;
    $('size').value = state.size; $('size-out').textContent = state.size;
    $('gap').value = state.gap; $('gap-out').textContent = state.gap;
    $('canvas-size').value = state.canvas;
    $('custom-size').hidden = state.canvas !== 'custom';
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
    shots.forEach(function (shot, i) {
      var li = document.createElement('li');
      li.className = 'file-row shot-row';
      var img = document.createElement('img');
      img.className = 'file-thumb shot-thumb'; img.alt = ''; img.src = shot.thumb;
      var name = document.createElement('span');
      name.className = 'file-name shot-name'; name.textContent = shot.name; name.title = shot.name;
      var meta = document.createElement('span');
      meta.className = 'file-meta'; meta.textContent = shot.w + ' × ' + shot.h;
      var controls = document.createElement('span');
      controls.className = 'move';
      controls.appendChild(iconButton('Move ' + shot.name + ' earlier', 'M18 15l-6-6-6 6', function () { swap(i, i - 1); }, i === 0));
      controls.appendChild(iconButton('Move ' + shot.name + ' later', 'M6 9l6 6 6-6', function () { swap(i, i + 1); }, i === shots.length - 1));
      controls.appendChild(iconButton('Remove ' + shot.name, 'M6 6l12 12M18 6L6 18', function () {
        shot.bitmap.close();
        shots.splice(i, 1);
        renderAll();
      }));
      li.appendChild(img); li.appendChild(name); li.appendChild(meta); li.appendChild(controls);
      list.appendChild(li);
    });
    $('count-label').textContent = shots.length ? plural(shots.length, 'screenshot') : 'No screenshots yet';
    $('clear-all').hidden = !shots.length;
  }

  function swap(a, b) {
    if (b < 0 || b >= shots.length) return;
    var held = shots[a]; shots[a] = shots[b]; shots[b] = held;
    renderAll();
  }

  function renderPreview() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(async function () {
      drawQueued = false;
      var has = shots.length > 0;
      var size = canvasSize(state);
      $('preview').hidden = !has;
      $('stage-empty').hidden = has;
      $('facts').hidden = !has;
      $('name-row').hidden = !has;
      $('preview-h').textContent = has ? size.w + ' × ' + size.h : 'Add a screenshot to start';
      $('copy').disabled = !has || busy;
      $('download').disabled = !has || busy;
      if (!has) { $('small-warning').hidden = true; $('summary').textContent = 'Add screenshots to get started.'; return; }
      await iconReady;
      var result = drawAll($('preview'), state);
      var frameName = state.frame === 'phone' ? 'AH frame, ' + byId(COLOURS, state.colour).name.toLowerCase() : 'No frame';
      $('fact-frame').textContent = frameName;
      $('fact-bg').textContent = byId(BACKGROUNDS, state.bg).name;
      $('fact-layout').textContent = byId(LAYOUTS, state.layout).name;
      $('fact-wm').textContent = state.wmOn ? 'Bottom right' : 'Off';
      $('small-warning').hidden = !result.shrunk;
      $('small-warning').textContent = result.rows > 1
        ? 'Split over ' + result.rows + ' rows and made smaller than the size you set, so everything fits.'
        : 'Made smaller than the size you set, so everything fits on the canvas.';
      $('name-to').textContent = fileName(state, today, state.format);
      $('summary').textContent = '';
      var strong = document.createElement('strong');
      strong.textContent = plural(shots.length, 'screenshot');
      $('summary').appendChild(strong);
      $('summary').appendChild(document.createTextNode(' · ' + size.w + ' × ' + size.h + ' · ' + frameName.toLowerCase().replace('ah ', 'AH ') + ' · ' + byId(BACKGROUNDS, state.bg).name + ' background'));
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
    if (!shots.length) return;
    try {
      await iconReady;
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
    if (!shots.length) return;
    var button = $('copy');
    try {
      await iconReady;
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
      shots.forEach(function (shot) { shot.bitmap.close(); });
      shots = [];
      showNotice('');
      renderAll();
    });

    $('camera').addEventListener('change', function (e) { change({ camera: e.target.value }); });
    $('round').addEventListener('input', function (e) { change({ round: Number(e.target.value) }); });
    $('size').addEventListener('input', function (e) { change({ size: Number(e.target.value) }); });
    $('gap').addEventListener('input', function (e) { change({ gap: Number(e.target.value) }); });
    $('canvas-size').addEventListener('change', function (e) { change({ canvas: e.target.value }); });
    $('custom-w').addEventListener('input', function (e) { change({ customW: clampInt(e.target.value, 200, 8000, state.customW) }); });
    $('custom-h').addEventListener('input', function (e) { change({ customH: clampInt(e.target.value, 200, 8000, state.customH) }); });
    $('wm-on').addEventListener('change', function (e) { change({ wmOn: e.target.checked }); });
    $('topic').addEventListener('input', function (e) { change({ topic: e.target.value }); });
    $('format').addEventListener('change', function (e) { change({ format: e.target.value }); });
    $('download').addEventListener('click', download);
    $('copy').addEventListener('click', copyImage);
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') $('copy').hidden = true;
  }

  build();
  wire();
  renderAll();
})();
