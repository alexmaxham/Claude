/* Writes alt text into an image file's own details (XMP metadata), for JPG and PNG. */
(function () {
  'use strict';

  function escapeXml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** The XMP packet. Alt text goes in the IPTC "Alt Text (Accessibility)" field and in the general description. */
  function xmpPacket(alt) {
    var li = '<rdf:Alt><rdf:li xml:lang="x-default">' + escapeXml(alt) + '</rdf:li></rdf:Alt>';
    return '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">' +
      '<Iptc4xmpCore:AltTextAccessibility>' + li + '</Iptc4xmpCore:AltTextAccessibility>' +
      '<dc:description>' + li + '</dc:description>' +
      '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  }

  function concat(parts) {
    var total = parts.reduce(function (n, p) { return n + p.length; }, 0);
    var out = new Uint8Array(total);
    var at = 0;
    parts.forEach(function (p) { out.set(p, at); at += p.length; });
    return out;
  }

  function ascii(text) {
    var out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }

  function embedJpeg(bytes, xmp) {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
    var header = ascii('http://ns.adobe.com/xap/1.0/\0');
    var length = 2 + header.length + xmp.length;
    if (length > 0xffff) return bytes; // one JPEG segment can't hold more
    // Keep the JFIF header first if the file starts with one.
    var at = 2;
    if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + ((bytes[4] << 8) | bytes[5]);
    var marker = new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff]);
    return concat([bytes.subarray(0, at), marker, header, xmp, bytes.subarray(at)]);
  }

  function embedPng(bytes, xmp) {
    var signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (var i = 0; i < 8; i++) if (bytes[i] !== signature[i]) return bytes;
    var afterHeader = 8 + 8 + ((bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11]) + 4; // signature + IHDR chunk
    // iTXt: keyword, 0, compression flag, compression method, language tag, 0, translated keyword, 0, text
    var data = concat([ascii('XML:com.adobe.xmp\0'), new Uint8Array([0, 0, 0, 0]), xmp]);
    var typed = concat([ascii('iTXt'), data]);
    var chunk = new Uint8Array(4 + typed.length + 4);
    var view = new DataView(chunk.buffer);
    view.setUint32(0, data.length);
    chunk.set(typed, 4);
    view.setUint32(4 + typed.length, window.AHZip.crc32(typed));
    return concat([bytes.subarray(0, afterHeader), chunk, bytes.subarray(afterHeader)]);
  }

  /** Returns the file's bytes with the alt text written in. WebP and anything unrecognised come back unchanged. */
  function embedAlt(bytes, ext, alt) {
    if (!alt) return bytes;
    var xmp = new TextEncoder().encode(xmpPacket(alt));
    if (ext === 'jpg') return embedJpeg(bytes, xmp);
    if (ext === 'png') return embedPng(bytes, xmp);
    return bytes;
  }

  function canEmbed(ext) { return ext === 'jpg' || ext === 'png'; }

  window.AHMeta = { embedAlt: embedAlt, canEmbed: canEmbed, xmpPacket: xmpPacket };
})();
