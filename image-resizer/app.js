/* AH Image Resizer. Everything runs in the browser: images are never uploaded. */
(function () {
  'use strict';

  // Sizes come from the AH social media guide (03-AH-Social-Media-Posts.md, section 2).
  var PRESETS = [
    { id: 'wide', name: 'Wide', w: 1600, h: 900, use: 'X, link previews', platform: 'x' },
    { id: 'portrait', name: 'Portrait', w: 1080, h: 1350, use: 'Instagram, Threads, Facebook', platform: 'instagram' },
    { id: 'tall', name: 'Tall', w: 1080, h: 1920, use: 'Stories, Reels, TikTok, Shorts', platform: 'story' },
    { id: 'square', name: 'Square', w: 1080, h: 1080, use: 'X and Facebook square', platform: 'square' },
    { id: 'yt', name: 'YouTube thumbnail', w: 1280, h: 720, use: 'Keep under 2 MB', platform: 'youtube' },
    { id: 'link', name: 'Link preview', w: 1200, h: 628, use: 'X and Facebook links', platform: 'link-preview' },
    { id: 'header', name: 'X header', w: 1500, h: 500, use: 'Profile banner', platform: 'x-header' },
    { id: 'custom', name: 'Custom', use: 'Any size in pixels', platform: 'custom' }
  ];
  var POSITIONS = ['Top left', 'Top centre', 'Top right', 'Middle left', 'Centre', 'Middle right', 'Bottom left', 'Bottom centre', 'Bottom right'];
  var FIT_LABELS = { cover: 'Crop to fill, centred', contain: 'Fit inside, no crop', width: 'Width only' };
  var AH_PATTERN = 'ah-social-{topic}-{platform}-{date}-{number}';
  var STORE_KEY = 'ah-image-resizer-v1';
  var ALT_GOOD_LENGTH = 125;
  var WORDS = 'androidheadlines.com';
  var ICON_SIZE_DEFAULT = 8; // % of width, icon alone
  var WORDS_SIZE_DEFAULT = 4; // % of width for the icon when the words sit next to it (48 px on a 1080 post)

  var DEFAULTS = {
    preset: 'wide', customW: 1600, customH: 900, fit: 'cover',
    wmOn: true, pos: 8, mark: 'icon', words: 'white', wmSize: ICON_SIZE_DEFAULT, wmOpacity: 100, wmMargin: 4,
    rnOn: true, topic: '', pattern: AH_PATTERN, format: 'jpg',
    altOn: true
  };

  // ---------- Pure helpers (also used by the tests) ----------

  function targetSize(s) {
    if (s.preset === 'custom') {
      return { w: clampInt(s.customW, 16, 12000, 1600), h: clampInt(s.customH, 16, 12000, 900) };
    }
    var p = presetById(s.preset);
    return { w: p.w, h: p.h };
  }

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return PRESETS[0];
  }

  function clampInt(value, min, max, fallback) {
    var n = Math.round(Number(value));
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /** Works out the output size and which part of the source to draw. */
  function computeLayout(srcW, srcH, s) {
    var t = targetSize(s);
    if (s.fit === 'cover') {
      var scale = Math.max(t.w / srcW, t.h / srcH);
      var cw = t.w / scale;
      var ch = t.h / scale;
      return { w: t.w, h: t.h, sx: (srcW - cw) / 2, sy: (srcH - ch) / 2, sw: cw, sh: ch, stretched: scale > 1 };
    }
    var k = s.fit === 'width' ? t.w / srcW : Math.min(t.w / srcW, t.h / srcH);
    return {
      w: Math.max(1, Math.round(srcW * k)), h: Math.max(1, Math.round(srcH * k)),
      sx: 0, sy: 0, sw: srcW, sh: srcH, stretched: k > 1
    };
  }

  /** Where the watermark box (mw x mh) goes on a w x h image. pos is 0..8, reading left to right, top to bottom. */
  function markPosition(w, h, mw, mh, pos, marginPct) {
    var m = (w * marginPct) / 100;
    var col = pos % 3;
    var row = Math.floor(pos / 3);
    var x = col === 0 ? m : col === 1 ? (w - mw) / 2 : w - m - mw;
    var y = row === 0 ? m : row === 1 ? (h - mh) / 2 : h - m - mh;
    return { x: x, y: y };
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  }

  function splitName(fileName) {
    var dot = fileName.lastIndexOf('.');
    if (dot <= 0) return { base: fileName, ext: '' };
    return { base: fileName.slice(0, dot), ext: fileName.slice(dot + 1).toLowerCase() };
  }

  function formatFor(fileType, s) {
    if (s.format !== 'same') return s.format;
    if (fileType === 'image/png') return 'png';
    if (fileType === 'image/webp') return 'webp';
    return 'jpg';
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** New file names for every image, in order, with no two the same. files: [{ name, type }]. */
  function buildNames(files, s, date) {
    var digits = Math.max(2, String(files.length).length);
    var platform = presetById(s.preset).platform;
    var used = {};
    return files.map(function (file, i) {
      var parts = splitName(file.name);
      var base;
      if (s.rnOn) {
        base = (s.pattern || AH_PATTERN)
          .replace(/\{topic\}/g, s.topic || '')
          .replace(/\{platform\}/g, platform)
          .replace(/\{date\}/g, isoDate(date))
          .replace(/\{number\}/g, String(i + 1).padStart(digits, '0'))
          .replace(/\{name\}/g, parts.base);
        base = slug(base);
      } else {
        base = parts.base.replace(/[\\/:*?"<>|]+/g, '-');
      }
      if (!base) base = 'image';
      var ext = formatFor(file.type, s);
      var candidate = base;
      var n = 2;
      while (used[(candidate + '.' + ext).toLowerCase()]) candidate = base + '-' + n++;
      used[(candidate + '.' + ext).toLowerCase()] = true;
      return candidate + '.' + ext;
    });
  }

  function prettyBytes(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  window.AHResizer = { PRESETS: PRESETS, DEFAULTS: DEFAULTS, computeLayout: computeLayout, markPosition: markPosition, buildNames: buildNames, slug: slug, targetSize: targetSize };
  if (typeof document === 'undefined' || !document.getElementById('preview')) return;

  // ---------- State ----------

  var state = loadSettings();
  var items = []; // { id, file, name, type, size, w, h, thumb, alt, altSource: 'name' | 'you' }
  var currentId = null;
  var nextId = 1;
  var cache = { id: null, bitmap: null };
  var renderToken = 0;
  var busy = false;
  var autoMoved = false;
  var today = new Date();

  var icon = new Image();
  var iconReady = new Promise(function (resolve) {
    icon.onload = resolve;
    icon.onerror = resolve;
    icon.src = window.AH_ICON_DATA_URI;
  });

  function $(id) { return document.getElementById(id); }

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
    if (!PRESETS.some(function (p) { return p.id === s.preset; })) s.preset = DEFAULTS.preset;
    if (!FIT_LABELS[s.fit]) s.fit = DEFAULTS.fit;
    s.pos = clampInt(s.pos, 0, 8, 8);
    return s;
  }

  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  // ---------- Drawing ----------

  function decode(file) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () {
      return createImageBitmap(file);
    });
  }

  function drawOutput(canvas, bitmap, s, format) {
    var layout = computeLayout(bitmap.width, bitmap.height, s);
    canvas.width = layout.w;
    canvas.height = layout.h;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (format === 'jpg') {
      ctx.fillStyle = '#FFFFFF'; // JPG has no see-through areas
      ctx.fillRect(0, 0, layout.w, layout.h);
    } else {
      ctx.clearRect(0, 0, layout.w, layout.h);
    }
    ctx.drawImage(bitmap, layout.sx, layout.sy, layout.sw, layout.sh, 0, 0, layout.w, layout.h);
    if (s.wmOn && icon.naturalWidth) drawMark(ctx, layout.w, layout.h, s);
    return layout;
  }

  function drawMark(ctx, w, h, s) {
    var iconW = (w * s.wmSize) / 100;
    var iconH = (iconW * icon.naturalHeight) / icon.naturalWidth;
    var gap = 0;
    var textW = 0;
    var fontPx = iconW / 2; // the guide pairs a 48 px icon with 24 px words
    if (s.mark === 'words') {
      gap = iconW / 4;
      ctx.font = '700 ' + fontPx + 'px Archivo, Arial, sans-serif';
      textW = ctx.measureText(WORDS).width;
      // Never let the mark run wider than the image inside its margins.
      var room = w * (1 - (2 * s.wmMargin) / 100);
      var total = iconW + gap + textW;
      if (total > room) {
        var shrink = room / total;
        iconW *= shrink; iconH *= shrink; gap *= shrink; fontPx *= shrink; textW *= shrink;
      }
    }
    var mw = iconW + gap + textW;
    var at = markPosition(w, h, mw, iconH, s.pos, s.wmMargin);
    ctx.save();
    ctx.globalAlpha = s.wmOpacity / 100;
    ctx.drawImage(icon, at.x, at.y, iconW, iconH);
    if (s.mark === 'words') {
      ctx.font = '700 ' + fontPx + 'px Archivo, Arial, sans-serif';
      ctx.fillStyle = s.words === 'ink' ? '#1C1C1E' : '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(WORDS, at.x + iconW + gap, at.y + iconH / 2);
    }
    ctx.restore();
  }

  function canvasToBlob(canvas, format) {
    var type = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('The browser could not save this image.'));
      }, type, 0.92);
    });
  }

  function extFromBlob(blob, wanted) {
    // A browser that can't write WebP hands back a PNG instead; name the file for what it really is.
    if (blob.type === 'image/png') return 'png';
    if (blob.type === 'image/webp') return 'webp';
    if (blob.type === 'image/jpeg') return 'jpg';
    return wanted;
  }

  function swapExt(name, ext) {
    return splitName(name).base + '.' + ext;
  }

  // ---------- Adding images ----------

  function looksLikeImage(file) {
    return /^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name);
  }

  function makeThumb(bitmap) {
    var c = document.createElement('canvas');
    c.width = 104; c.height = 80;
    var k = Math.max(c.width / bitmap.width, c.height / bitmap.height);
    var sw = c.width / k, sh = c.height / k;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ECEAE4';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  async function addFiles(fileList) {
    if (busy) return;
    var files = Array.prototype.filter.call(fileList, looksLikeImage);
    var other = fileList.length - files.length;
    if (!files.length) {
      showNotice(other ? 'Nothing added: ' + plural(other, 'file') + (other === 1 ? ' is not an image.' : ' are not images.') : '');
      return;
    }
    files.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    setBusy(true);
    var failed = [];
    for (var i = 0; i < files.length; i++) {
      $('summary').textContent = 'Opening ' + (i + 1) + ' of ' + files.length + '…';
      try {
        var bitmap = await decode(files[i]);
        items.push({
          id: nextId++, file: files[i], name: files[i].name, type: files[i].type, size: files[i].size,
          w: bitmap.width, h: bitmap.height, thumb: makeThumb(bitmap),
          alt: window.AHAlt.fromName(files[i].name, state.topic), altSource: 'name'
        });
        bitmap.close();
      } catch (e) {
        failed.push(files[i].name);
      }
    }
    setBusy(false);
    var notes = [];
    if (failed.length) {
      notes.push('This browser could not open ' + plural(failed.length, 'file') + ': ' + failed.slice(0, 3).join(', ') + (failed.length > 3 ? ' and ' + (failed.length - 3) + ' more' : '') + '.');
    }
    if (other) notes.push('Skipped ' + plural(other, 'file') + ' that ' + (other === 1 ? 'is not an image.' : 'are not images.'));
    showNotice(notes.join(' '));
    if (currentId === null && items.length) currentId = items[0].id;
    renderAll();
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function showNotice(text) {
    $('add-notice').textContent = text;
    $('add-notice').hidden = !text;
  }

  function readEntry(entry) {
    return new Promise(function (resolve) {
      if (entry.isFile) {
        entry.file(function (file) { resolve([file]); }, function () { resolve([]); });
      } else if (entry.isDirectory) {
        var reader = entry.createReader();
        var all = [];
        (function next() {
          reader.readEntries(function (batch) {
            if (!batch.length) {
              Promise.all(all.map(readEntry)).then(function (lists) { resolve([].concat.apply([], lists)); });
            } else {
              all = all.concat(Array.prototype.slice.call(batch));
              next();
            }
          }, function () { resolve([]); });
        })();
      } else {
        resolve([]);
      }
    });
  }

  async function filesFromDrop(dataTransfer) {
    var entries = [];
    var dropped = dataTransfer.items || [];
    for (var i = 0; i < dropped.length; i++) {
      var entry = dropped[i].webkitGetAsEntry && dropped[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    if (!entries.length) return Array.prototype.slice.call(dataTransfer.files || []);
    var lists = await Promise.all(entries.map(readEntry));
    return [].concat.apply([], lists);
  }

  // ---------- Rendering the page ----------

  function currentIndex() {
    for (var i = 0; i < items.length; i++) if (items[i].id === currentId) return i;
    return -1;
  }

  function wmSummary() {
    return state.wmOn ? POSITIONS[state.pos] : 'Off';
  }

  function renderAll() {
    renderControls();
    renderList();
    renderPreview();
    renderSummary();
  }

  function renderControls() {
    Array.prototype.forEach.call($('presets').children, function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.id === state.preset));
    });
    $('custom-size').hidden = state.preset !== 'custom';
    if (document.activeElement !== $('custom-w')) $('custom-w').value = state.customW;
    if (document.activeElement !== $('custom-h')) $('custom-h').value = state.customH;
    $('fit').value = state.fit;

    $('wm-on').checked = state.wmOn;
    $('wm-body').classList.toggle('is-off', !state.wmOn);
    Array.prototype.forEach.call($('positions').children, function (btn, i) {
      btn.setAttribute('aria-pressed', String(i === state.pos));
    });
    $('pos-label').textContent = POSITIONS[state.pos];
    Array.prototype.forEach.call(document.getElementsByName('wm-mark'), function (radio) {
      radio.checked = radio.value === state.mark;
    });
    $('wm-words-field').hidden = state.mark !== 'words';
    $('wm-words').value = state.words;
    $('wm-size').value = state.wmSize; $('wm-size-out').textContent = state.wmSize;
    $('wm-opacity').value = state.wmOpacity; $('wm-opacity-out').textContent = state.wmOpacity;
    $('wm-margin').value = state.wmMargin; $('wm-margin-out').textContent = state.wmMargin;

    var note = '';
    if (state.wmOn && state.preset === 'yt') {
      if (state.pos === 6 && autoMoved) note = 'YouTube covers the bottom right of a thumbnail with the video length, so the mark moved to bottom left.';
      else if (state.pos === 8) note = 'Heads up: YouTube covers the bottom right of a thumbnail with the video length. The AH guide puts the mark bottom left here.';
    }
    $('wm-note').textContent = note;
    $('wm-note').hidden = !note;

    $('rn-on').checked = state.rnOn;
    $('rn-body').classList.toggle('is-off', !state.rnOn);
    if (document.activeElement !== $('rn-topic')) $('rn-topic').value = state.topic;
    if (document.activeElement !== $('rn-pattern')) $('rn-pattern').value = state.pattern;
    $('format').value = state.format;

    $('alt-on').checked = state.altOn;
    $('alt-body').classList.toggle('is-off', !state.altOn);
  }

  function renderList() {
    var list = $('file-list');
    list.textContent = '';
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'file-row' + (item.id === currentId ? ' is-current' : '');

      var pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'file-pick';
      if (item.id === currentId) pick.setAttribute('aria-current', 'true');
      pick.addEventListener('click', function () { currentId = item.id; renderAll(); });
      var img = document.createElement('img');
      img.className = 'file-thumb'; img.alt = ''; img.src = item.thumb;
      var text = document.createElement('span');
      text.className = 'file-text';
      var name = document.createElement('span');
      name.className = 'file-name'; name.textContent = item.name; name.title = item.name;
      var meta = document.createElement('span');
      meta.className = 'file-meta'; meta.textContent = item.w + ' × ' + item.h + ' · ' + prettyBytes(item.size);
      text.appendChild(name); text.appendChild(meta);
      pick.appendChild(img); pick.appendChild(text);

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn';
      remove.setAttribute('aria-label', 'Remove ' + item.name);
      remove.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';
      remove.addEventListener('click', function () { removeItem(item.id); });

      li.appendChild(pick); li.appendChild(remove);
      list.appendChild(li);
    });
    $('count-label').textContent = items.length ? plural(items.length, 'image') : 'No images yet';
    $('clear-all').hidden = !items.length;
  }

  function removeItem(id) {
    var i = items.findIndex(function (item) { return item.id === id; });
    if (i < 0 || busy) return;
    items.splice(i, 1);
    if (currentId === id) currentId = items.length ? items[Math.min(i, items.length - 1)].id : null;
    renderAll();
  }

  async function renderPreview() {
    var token = ++renderToken;
    var index = currentIndex();
    var item = items[index];
    var canvas = $('preview');
    $('prev').disabled = index <= 0;
    $('next').disabled = index < 0 || index >= items.length - 1;
    $('pager-label').textContent = item ? 'Image ' + (index + 1) + ' of ' + items.length : '';

    if (!item) {
      if (cache.bitmap) { cache.bitmap.close(); cache = { id: null, bitmap: null }; }
      canvas.hidden = true;
      $('stage-empty').hidden = false;
      $('facts').hidden = true;
      $('small-warning').hidden = true;
      $('name-row').hidden = true;
      $('alt-card').hidden = true;
      $('preview-h').textContent = 'Add an image to start';
      return;
    }

    $('preview-h').textContent = item.name;
    var layout = computeLayout(item.w, item.h, state);
    $('facts').hidden = false;
    $('fact-orig').textContent = item.w + ' × ' + item.h;
    $('fact-new').textContent = layout.w + ' × ' + layout.h;
    $('fact-fit').textContent = FIT_LABELS[state.fit];
    $('fact-wm').textContent = wmSummary();
    $('small-warning').hidden = !layout.stretched;
    $('small-warning').textContent = 'Smaller than the new size: it will be stretched and may look soft.';

    var names = buildNames(items, state, today);
    $('name-row').hidden = false;
    $('name-from').textContent = item.name;
    $('name-to').textContent = names[index];
    renderAlt(item);

    try {
      if (cache.id !== item.id) {
        var bitmap = await decode(item.file);
        if (token !== renderToken) { bitmap.close(); return; }
        if (cache.bitmap) cache.bitmap.close();
        cache = { id: item.id, bitmap: bitmap };
      }
      await iconReady;
      if (state.mark === 'words' && document.fonts && document.fonts.load) {
        try { await document.fonts.load('700 24px Archivo'); } catch (e) { /* falls back to Arial */ }
      }
      if (token !== renderToken) return;
      drawOutput(canvas, cache.bitmap, state, formatFor(item.type, state));
      canvas.hidden = false;
      $('stage-empty').hidden = true;
    } catch (e) {
      canvas.hidden = true;
      $('stage-empty').hidden = false;
      $('stage-empty').textContent = 'This image could not be opened.';
    }
  }

  var ALT_SOURCES = { name: 'Draft from the topic or file name', you: 'Edited by you' };

  function renderAlt(item) {
    $('alt-card').hidden = !state.altOn;
    if (!state.altOn) return;
    if (document.activeElement !== $('alt-text')) $('alt-text').value = item.alt;
    $('alt-source').textContent = item.alt ? ALT_SOURCES[item.altSource] : 'None yet';
    var n = item.alt.length;
    $('alt-count').textContent = n + ' characters' + (n > ALT_GOOD_LENGTH ? ': long, aim for ' + ALT_GOOD_LENGTH + ' or fewer' : '');
  }

  function renderSummary() {
    $('dl-one').disabled = busy || !items.length;
    $('dl-all').disabled = busy || !items.length;
    $('dl-all').textContent = items.length ? 'Download all ' + items.length + ' (ZIP)' : 'Download all (ZIP)';
    if (busy) return;
    if (!items.length) { $('summary').textContent = 'Add images to get started.'; return; }
    var t = targetSize(state);
    var size = state.fit === 'width' ? t.w + ' wide' : t.w + ' × ' + t.h + (state.fit === 'contain' ? ' at most' : '');
    var bits = [size, state.wmOn ? 'watermark ' + POSITIONS[state.pos].toLowerCase() : 'no watermark', state.rnOn ? 'renamed' : 'original names'];
    if (state.altOn) bits.push('alt text on ' + items.filter(function (item) { return item.alt; }).length + ' of ' + items.length);
    $('summary').innerHTML = '';
    var strong = document.createElement('strong');
    strong.textContent = plural(items.length, 'image');
    $('summary').appendChild(strong);
    $('summary').appendChild(document.createTextNode(' · ' + bits.join(' · ')));
  }

  function setBusy(flag) {
    busy = flag;
    ['dl-one', 'dl-all', 'pick-files', 'pick-folder', 'clear-all'].forEach(function (id) { $(id).disabled = flag; });
    if (!flag) { renderControls(); renderSummary(); }
  }

  function change(patch) {
    Object.assign(state, patch);
    if ('topic' in patch) {
      // Drafts made from words follow the topic; anything the user wrote is left alone.
      items.forEach(function (item) {
        if (item.altSource === 'name') item.alt = window.AHAlt.fromName(item.name, state.topic);
      });
    }
    saveSettings();
    renderControls();
    renderPreview();
    renderSummary();
  }

  // ---------- Downloading ----------

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  async function processItem(item, canvas) {
    var format = formatFor(item.type, state);
    var bitmap = await decode(item.file);
    try {
      drawOutput(canvas, bitmap, state, format);
    } finally {
      bitmap.close();
    }
    var blob = await canvasToBlob(canvas, format);
    var ext = extFromBlob(blob, format);
    var bytes = new Uint8Array(await blob.arrayBuffer());
    if (state.altOn && item.alt) bytes = window.AHMeta.embedAlt(bytes, ext, item.alt);
    return { bytes: bytes, type: blob.type, ext: ext };
  }

  async function prepare() {
    await iconReady;
    if (state.mark === 'words' && document.fonts && document.fonts.load) {
      try { await document.fonts.load('700 24px Archivo'); } catch (e) { /* falls back to Arial */ }
    }
  }

  async function downloadOne() {
    var index = currentIndex();
    if (index < 0 || busy) return;
    setBusy(true);
    $('summary').textContent = 'Working…';
    try {
      await prepare();
      var out = await processItem(items[index], document.createElement('canvas'));
      saveBlob(new Blob([out.bytes], { type: out.type }), swapExt(buildNames(items, state, today)[index], out.ext));
      setBusy(false);
    } catch (e) {
      setBusy(false);
      $('summary').textContent = 'Could not save ' + items[index].name + '. ' + (e && e.message ? e.message : '');
    }
  }

  async function downloadAll() {
    if (!items.length || busy) return;
    setBusy(true);
    var names = buildNames(items, state, today);
    var canvas = document.createElement('canvas');
    var files = [];
    var failed = [];
    var altRows = [];
    await prepare();
    for (var i = 0; i < items.length; i++) {
      $('summary').textContent = 'Working: ' + (i + 1) + ' of ' + items.length + '…';
      try {
        var out = await processItem(items[i], canvas);
        var saved = swapExt(names[i], out.ext);
        files.push({ name: saved, bytes: out.bytes });
        if (state.altOn && items[i].alt) altRows.push([saved, items[i].alt]);
      } catch (e) {
        failed.push(items[i].name);
      }
    }
    if (altRows.length) files.push({ name: 'alt-text.csv', bytes: new TextEncoder().encode(altCsv(altRows)) });
    if (files.length) {
      var label = state.rnOn && slug(state.topic) ? slug(state.topic) : 'images';
      saveBlob(window.AHZip.makeZip(files), 'ah-' + label + '-' + isoDate(today) + '.zip');
    }
    setBusy(false);
    if (failed.length) {
      $('summary').textContent = 'Saved ' + (files.length - (altRows.length ? 1 : 0)) + ' of ' + items.length + '. Could not process: ' + failed.join(', ') + '.';
    }
  }

  // ---------- Alt text ----------

  function csvCell(text) { return '"' + String(text).replace(/"/g, '""') + '"'; }

  /** A spreadsheet-friendly list of file name and alt text (the leading mark makes Excel read accents correctly). */
  function altCsv(rows) {
    return '\uFEFF' + [['File', 'Alt text']].concat(rows).map(function (row) { return row.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  // ---------- Wiring ----------

  function build() {
    PRESETS.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset';
      btn.dataset.id = p.id;
      var name = document.createElement('b'); name.textContent = p.name;
      var dims = document.createElement('span'); dims.textContent = p.w ? p.w + ' × ' + p.h : 'Your width × height';
      var use = document.createElement('span'); use.textContent = p.use;
      btn.appendChild(name); btn.appendChild(dims); btn.appendChild(use);
      btn.addEventListener('click', function () { pickPreset(p.id); });
      $('presets').appendChild(btn);
    });
    POSITIONS.forEach(function (label, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pos';
      btn.setAttribute('aria-label', label);
      btn.title = label;
      btn.addEventListener('click', function () { autoMoved = false; change({ pos: i }); });
      $('positions').appendChild(btn);
    });
  }

  function pickPreset(id) {
    var patch = { preset: id };
    // AH rule: on YouTube thumbnails the watermark goes bottom left, because the video length covers the bottom right.
    if (id === 'yt' && state.pos === 8) { patch.pos = 6; autoMoved = true; }
    else if (id !== 'yt' && state.preset === 'yt' && autoMoved && state.pos === 6) { patch.pos = 8; autoMoved = false; }
    change(patch);
  }

  function wire() {
    $('pick-files').addEventListener('click', function () { $('file-input').click(); });
    $('pick-folder').addEventListener('click', function () { $('folder-input').click(); });
    ['file-input', 'folder-input'].forEach(function (id) {
      $(id).addEventListener('change', function (e) {
        var files = Array.prototype.slice.call(e.target.files || []);
        e.target.value = '';
        addFiles(files);
      });
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
      filesFromDrop(e.dataTransfer).then(addFiles);
    });
    window.addEventListener('paste', function (e) {
      var files = e.clipboardData && e.clipboardData.files;
      if (files && files.length) addFiles(Array.prototype.slice.call(files));
    });

    $('clear-all').addEventListener('click', function () {
      if (busy) return;
      items = []; currentId = null; showNotice(''); renderAll();
    });
    $('prev').addEventListener('click', function () { var i = currentIndex(); if (i > 0) { currentId = items[i - 1].id; renderAll(); } });
    $('next').addEventListener('click', function () { var i = currentIndex(); if (i >= 0 && i < items.length - 1) { currentId = items[i + 1].id; renderAll(); } });

    $('custom-w').addEventListener('input', function (e) { change({ customW: clampInt(e.target.value, 16, 12000, state.customW) }); });
    $('custom-h').addEventListener('input', function (e) { change({ customH: clampInt(e.target.value, 16, 12000, state.customH) }); });
    $('fit').addEventListener('change', function (e) { change({ fit: e.target.value }); });

    $('wm-on').addEventListener('change', function (e) { change({ wmOn: e.target.checked }); });
    Array.prototype.forEach.call(document.getElementsByName('wm-mark'), function (radio) {
      radio.addEventListener('change', function () {
        var patch = { mark: radio.value };
        // Each mark has its own sensible starting size; keep any size the user chose themselves.
        if (radio.value === 'words' && state.wmSize === ICON_SIZE_DEFAULT) patch.wmSize = WORDS_SIZE_DEFAULT;
        if (radio.value === 'icon' && state.wmSize === WORDS_SIZE_DEFAULT) patch.wmSize = ICON_SIZE_DEFAULT;
        change(patch);
      });
    });
    $('wm-words').addEventListener('change', function (e) { change({ words: e.target.value }); });
    $('wm-size').addEventListener('input', function (e) { change({ wmSize: Number(e.target.value) }); });
    $('wm-opacity').addEventListener('input', function (e) { change({ wmOpacity: Number(e.target.value) }); });
    $('wm-margin').addEventListener('input', function (e) { change({ wmMargin: Number(e.target.value) }); });

    $('rn-on').addEventListener('change', function (e) { change({ rnOn: e.target.checked }); });
    $('rn-topic').addEventListener('input', function (e) { change({ topic: e.target.value }); });
    $('rn-pattern').addEventListener('input', function (e) { change({ pattern: e.target.value }); });
    $('rn-reset').addEventListener('click', function () { change({ pattern: AH_PATTERN }); });
    $('format').addEventListener('change', function (e) { change({ format: e.target.value }); });

    $('alt-on').addEventListener('change', function (e) { change({ altOn: e.target.checked }); });
    $('alt-text').addEventListener('input', function (e) {
      var item = items[currentIndex()];
      if (!item) return;
      item.alt = e.target.value.replace(/\s*\n\s*/g, ' ');
      item.altSource = 'you';
      renderAlt(item);
      renderSummary();
    });
    $('alt-copy').addEventListener('click', function () {
      var item = items[currentIndex()];
      if (!item || !navigator.clipboard) return;
      navigator.clipboard.writeText(item.alt).then(function () {
        $('alt-copy').textContent = 'Copied';
        setTimeout(function () { $('alt-copy').textContent = 'Copy'; }, 1500);
      }, function () { /* clipboard blocked: the text can still be selected by hand */ });
    });
    $('dl-one').addEventListener('click', downloadOne);
    $('dl-all').addEventListener('click', downloadAll);
  }

  build();
  wire();
  renderAll();
})();
