/* Runs the browser suites against a served build.
     npm test                 build, serve on 4173, run, tear down
     npm run test:dev         run against the dev server already on 5173
     node tests/run.mjs --base http://localhost:1234
   Set CHROME_PATH if Chrome is not in the usual place. */

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { chromePath, reporter, report } from './helpers.mjs';
import listing from './listing.mjs';
import quality from './quality.mjs';

const PORT = 4173;
const arg = process.argv.indexOf('--base');
let base = arg > -1 ? process.argv[arg + 1] : process.env.BASE_URL;
let server = null;

async function waitFor(url, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Nothing answering at ${url} after ${ms}ms`);
}

if (!base) {
  base = `http://localhost:${PORT}`;
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  await waitFor(base + '/index.html');
}

const browser = await puppeteer.launch({
  executablePath: chromePath(), headless: true, args: ['--no-sandbox', '--hide-scrollbars'],
});

let failed = 0;
try {
  for (const [name, suite] of [['listing', listing], ['quality', quality]]) {
    console.log(`\n${name}`);
    const { check, results } = reporter();
    await suite({ browser, base, check });
    failed += report(name, results);
  }
} finally {
  await browser.close();
  server?.kill();
}

console.log(failed ? `${failed} failing` : 'all green');
process.exit(failed ? 1 : 0);
