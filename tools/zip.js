/* A tiny ZIP writer. Files are stored without extra compression (images are already compressed). */
(function () {
  'use strict';

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    var time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    var day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time: time, day: day };
  }

  /** files: [{ name: string, bytes: Uint8Array }]. Returns a Blob holding the ZIP. */
  function makeZip(files) {
    var encoder = new TextEncoder();
    var stamp = dosDateTime(new Date());
    var parts = [];
    var central = [];
    var offset = 0;

    files.forEach(function (file) {
      var name = encoder.encode(file.name);
      var crc = crc32(file.bytes);
      var size = file.bytes.length;

      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // names are UTF-8
      local.setUint16(8, 0, true); // stored
      local.setUint16(10, stamp.time, true);
      local.setUint16(12, stamp.day, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);
      local.setUint32(22, size, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(local.buffer, name, file.bytes);

      var entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(8, 0x0800, true);
      entry.setUint16(10, 0, true);
      entry.setUint16(12, stamp.time, true);
      entry.setUint16(14, stamp.day, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, size, true);
      entry.setUint32(24, size, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      central.push(entry.buffer, name);

      offset += 30 + name.length + size;
    });

    var centralSize = central.reduce(function (sum, part) { return sum + part.byteLength; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }

  window.AHZip = { makeZip: makeZip, crc32: crc32 };
})();
