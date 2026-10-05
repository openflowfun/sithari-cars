/* Shared bits for the browser tests: finding Chrome, and a tiny assert that
   reports what it got alongside what it wanted. */

import { existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find(p => existsSync(p));
  if (!found) {
    throw new Error('No Chrome found. Install Google Chrome or set CHROME_PATH to a Chromium binary.');
  }
  return found;
}

/* Collects results so one failing assertion does not hide the rest. */
export function reporter() {
  const results = [];
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    results.push({ ok, name, got, want });
    return ok;
  };
  return { check, results };
}

export function report(suite, results) {
  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    if (r.ok) console.log(`  ✓ ${r.name}`);
    else {
      console.log(`  ✗ ${r.name}`);
      console.log(`      got  ${JSON.stringify(r.got)}`);
      console.log(`      want ${JSON.stringify(r.want)}`);
    }
  }
  console.log(`  ${results.length - failed.length}/${results.length} passed in ${suite}\n`);
  return failed.length;
}

export const settle = ms => new Promise(r => setTimeout(r, ms));

/* Minimal PNG decoder for Chrome's own screenshots (8-bit RGB/RGBA, not
   interlaced) — enough to measure contrast against real pixels without making
   the suite depend on an image library or ffmpeg. */
export function decodePNG(buf) {
  let pos = 8, width, height, depth, type, interlace;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), chunk = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (chunk === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (chunk === 'IDAT') idat.push(data);
    else if (chunk === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || ![2, 6].includes(type) || interlace) throw new Error(`unsupported PNG: depth ${depth}, colour type ${type}, interlace ${interlace}`);
  const bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[line + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { width, height, at: (x, y) => { const i = y * stride + x * bpp; return [px[i], px[i + 1], px[i + 2]]; } };
}

/* WCAG relative luminance and contrast ratio */
export const luminance = rgb => {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const L1 = luminance(a), L2 = luminance(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};
