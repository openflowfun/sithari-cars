/* Prints every model grouped by the body style cards.js assigns it, so a person
   can eyeball the classifier after each scrape. New models fall through to
   "Hatchback" — scan that group first. Run: node scripts/body_report.mjs */

import inventory from '../src/data/inventory.json' with { type: 'json' };
import { normalise } from '../src/scripts/cards.js';

const groups = {};
for (const c of inventory.map(normalise)) {
  const k = `${c.body}|${c.make} ${c.modelHead}`;
  (groups[k] ||= { n: 0, eg: c.model }).n++;
}
let current = '';
for (const [k, { n, eg }] of Object.entries(groups).sort()) {
  const [body, name] = k.split('|');
  if (body !== current) { current = body; console.log(`\n${body}`); }
  console.log(`  ${String(n).padStart(3)}  ${name.padEnd(22)} ${eg.slice(0, 48)}`);
}
