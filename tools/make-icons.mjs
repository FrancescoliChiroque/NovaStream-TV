/**
 * Genera los iconos PNG de la app sin dependencias externas.
 * Dibuja un cuadrado redondeado con la marca "N" en el color de la app.
 *
 * Uso: node tools/make-icons.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'icons');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function createCanvas(size) {
  const data = Buffer.alloc(size * size * 4, 0);
  return {
    size,
    data,
    set(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      const alpha = a / 255;
      const inv = 1 - alpha;
      data[i] = Math.round(r * alpha + data[i] * inv);
      data[i + 1] = Math.round(g * alpha + data[i + 1] * inv);
      data[i + 2] = Math.round(b * alpha + data[i + 2] * inv);
      data[i + 3] = Math.max(data[i + 3], Math.round(a + data[i + 3] * inv));
    }
  };
}

function roundedRect(canvas, x0, y0, x1, y1, radius, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = Math.min(x - x0, x1 - 1 - x);
      const dy = Math.min(y - y0, y1 - 1 - y);
      if (dx < radius && dy < radius) {
        const ox = radius - dx;
        const oy = radius - dy;
        if (ox * ox + oy * oy > radius * radius) continue;
      }
      canvas.set(x, y, color[0], color[1], color[2], color[3]);
    }
  }
}

function thickLine(canvas, x0, y0, x1, y1, thickness, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const half = thickness / 2;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        canvas.set(Math.round(x + ox), Math.round(y + oy), color[0], color[1], color[2], color[3]);
      }
    }
  }
}

function drawIcon(size) {
  const canvas = createCanvas(size);
  const pad = Math.round(size * 0.06);
  const radius = Math.round(size * 0.22);
  roundedRect(canvas, pad, pad, size - pad, size - pad, radius, [79, 124, 255, 255]);

  const left = Math.round(size * 0.3);
  const right = Math.round(size * 0.7);
  const top = Math.round(size * 0.26);
  const bottom = Math.round(size * 0.74);
  const thickness = Math.max(2, Math.round(size * 0.09));
  const white = [255, 255, 255, 255];

  thickLine(canvas, left, top, left, bottom, thickness, white);
  thickLine(canvas, left, top, right, bottom, thickness, white);
  thickLine(canvas, right, bottom, right, top, thickness, white);

  return encodePng(size, size, canvas.data);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const size of [80, 130]) {
    const png = drawIcon(size);
    const file = path.join(OUT_DIR, `icon${size}.png`);
    await writeFile(file, png);
    console.log(`icono: ${path.relative(ROOT, file)} (${png.length} bytes)`);
  }
}

main().catch((err) => {
  console.error('error en make-icons.mjs:', err.message);
  process.exit(1);
});
