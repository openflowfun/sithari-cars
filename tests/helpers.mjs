/* Shared bits for the browser tests: finding Chrome, and a tiny assert that
   reports what it got alongside what it wanted. */

import { existsSync } from 'node:fs';

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
