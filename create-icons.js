const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function generatePng(size) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Draw rounded card on dark background
      const cx = x - width / 2;
      const cy = y - height / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const maxR = width * 0.45;

      if (dist < maxR) {
        // Inner desk icon
        if (y > height * 0.35 && y < height * 0.65 && x > width * 0.25 && x < width * 0.75) {
          // Accent cyan bar / desk card
          rawData[pxOffset] = 56;     // R (0x38)
          rawData[pxOffset + 1] = 189; // G (0xbd)
          rawData[pxOffset + 2] = 248; // B (0xf8)
          rawData[pxOffset + 3] = 255; // A
        } else {
          // Dark background
          rawData[pxOffset] = 21;      // R
          rawData[pxOffset + 1] = 27;  // G
          rawData[pxOffset + 2] = 38;  // B
          rawData[pxOffset + 3] = 255; // A
        }
      } else {
        // Transparent outer
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', zlib.deflateSync(rawData));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.join(__dirname, 'extension', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[16, 48, 128].forEach(sz => {
  const pngBuf = generatePng(sz);
  fs.writeFileSync(path.join(outDir, `icon${sz}.png`), pngBuf);
  console.log(`Generated icon${sz}.png (${pngBuf.length} bytes)`);
});
