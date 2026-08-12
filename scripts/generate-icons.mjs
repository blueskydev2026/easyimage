import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";

const colors = {
  bg: [15, 23, 42, 255],
  paper: [248, 250, 252, 255],
  teal: [45, 212, 191, 255],
  sky: [56, 189, 248, 255],
  amber: [245, 158, 11, 255],
};

function makeIcon(path, size, maskable = false) {
  const bytes = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    bytes[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      bytes.set(pixel(x, y, size, maskable), offset);
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png(size, size, bytes));
}

function pixel(x, y, size, maskable) {
  const pad = size * (maskable ? 0.22 : 0.16);
  const inCard = x >= pad && x <= size - pad && y >= size * 0.22 && y <= size * 0.78;
  if (!inCard) return colors.bg;
  const border = x < pad + size * 0.045 || x > size - pad - size * 0.045 || y < size * 0.22 + size * 0.045 || y > size * 0.78 - size * 0.045;
  if (border) return colors.teal;
  const sun = (x - size * 0.68) ** 2 + (y - size * 0.38) ** 2 <= (size * 0.07) ** 2;
  if (sun) return colors.amber;
  const ridgeA = y > size * 0.70 - Math.abs(x - size * 0.42) * 0.78;
  const ridgeB = y > size * 0.69 - Math.abs(x - size * 0.70) * 0.58;
  if (ridgeA || ridgeB) return colors.sky;
  return colors.paper;
}

function png(width, height, raw) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const name = Buffer.from(type);
  return Buffer.concat([u32(data.length), name, data, u32(crc32(Buffer.concat([name, data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

for (const root of ["icons"]) {
  makeIcon(`${root}/icon-192.png`, 192);
  makeIcon(`${root}/icon-512.png`, 512);
  makeIcon(`${root}/icon-maskable-512.png`, 512, true);
}
