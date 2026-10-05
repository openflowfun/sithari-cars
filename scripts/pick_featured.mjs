/* Re-pick the homepage's hero strip and featured grid from the current inventory.
   Run after scripts/scrape_inventory.py:  node scripts/pick_featured.mjs

   Hero strip ("Fresh in the yard this week"): the newest arrivals from 2012 on.
   Stock numbers are issued in sequence, so the highest are literally the freshest.
   Featured grid ("In the yard right now"): enough cars for every chip, then the
   newest and lowest-kilometre to fill. Only priced cars with a photo qualify —
   a "POA" card is a weak showcase. One of each model, so it reads as a range. */

import { writeFileSync } from 'node:fs';
import inventory from '../src/data/inventory.json' with { type: 'json' };
import { normalise, CHIPS } from '../src/scripts/cards.js';

const raw = new Map(inventory.map(r => [r.id, r]));
const pool = inventory.map(normalise).filter(c => c.price && c.img);
const key = c => `${c.make} ${c.modelHead}`;

function take(n, ranked, quotas = [], perMake = Infinity) {
  const out = [], models = new Set(), makes = {};
  const add = c => {
    if (out.length >= n || out.includes(c) || models.has(key(c)) || (makes[c.make] || 0) >= perMake) return false;
    out.push(c); models.add(key(c)); makes[c.make] = (makes[c.make] || 0) + 1;
    return true;
  };
  for (const [chip, want] of quotas) {
    let have = out.filter(CHIPS[chip]).length;
    for (const c of ranked) { if (have >= want) break; if (CHIPS[chip](c) && add(c)) have++; }
  }
  for (const c of ranked) add(c);
  return out;
}

const fresh = [...pool].sort((a, b) => Number(b.id) - Number(a.id));
const best = [...pool].sort((a, b) => (b.year - a.year) || ((a.km ?? 1e9) - (b.km ?? 1e9)));

/* the strip is the site's first impression: still the freshest arrivals, but a
   1998 Hilux Surf and a 2001 work van are inventory, not a showcase */
const SHOWCASE_FROM = 2012;
const marquee = take(14, fresh.filter(c => +c.year >= SHOWCASE_FROM), [], 5);
const featured = take(16, best, [['hybrid', 5], ['suv', 5], ['family', 4], ['under15', 5]], 6)
  .sort((a, b) => (b.year - a.year) || ((a.km ?? 1e9) - (b.km ?? 1e9)));

const write = (file, list) =>
  writeFileSync(new URL(`../src/data/${file}`, import.meta.url), JSON.stringify(list.map(c => raw.get(c.id)), null, 1));
write('marquee.json', marquee);
write('featured.json', featured);

const line = c => `    ${c.id}  ${c.title.slice(0, 40).padEnd(40)} $${c.price.toLocaleString('en-NZ')}`;
console.log(`hero strip: ${marquee.length} newest arrivals`);
marquee.slice(0, 5).forEach(c => console.log(line(c)));
console.log(`featured: ${featured.length} cars`);
for (const chip of Object.keys(CHIPS)) console.log(`    chip ${chip.padEnd(8)} ${featured.filter(CHIPS[chip]).length} cars`);
