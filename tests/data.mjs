/* Expected values come from the same inventory.json and the same normalise() the
   site uses, so the suite checks that the page is faithful to the data rather
   than pinning one day's stock — it survives every refresh.

   The flip side: a classifier mistake in cards.js would be invisible here, since
   site and test agree on the wrong answer. When the data refreshes, eyeball
   `node scripts/body_report.mjs` — that is a separate, human check. */

import inventory from '../src/data/inventory.json' with { type: 'json' };
import { normalise, money } from '../src/scripts/cards.js';

export const CARS = inventory.map(normalise);
export const N = CARS.length;
export const PAGE = 24;
export const count = pred => CARS.filter(pred).length;
export const noun = n => (n === 1 ? 'car' : 'cars');

/* mirrors render() in src/scripts/vehicles.js */
export function countCopy(n) {
  if (!n) return 'No cars match';
  const all = n === N;
  const notes = [];
  if (!all) notes.push(`of ${N} in stock`);
  if (n > PAGE) notes.push(`showing ${PAGE}`);
  return `${n} ${noun(n)}${all ? ' in stock' : ' match'}` + (notes.length ? ' ' + notes.join(', ') : '');
}

const priced = CARS.filter(c => c.price !== null).map(c => c.price);
const byKm = CARS.filter(c => c.km !== null).sort((a, b) => a.km - b.km);
const years = CARS.map(c => +c.year);

export const EXTREMES = {
  cheapest: money(Math.min(...priced)) + '*',
  dearest: money(Math.max(...priced)) + '*',
  newest: String(Math.max(...years)),
  oldest: String(Math.min(...years)),
  lowestKm: byKm[0].kmLabel,
  highestKm: byKm.at(-1).kmLabel,
  unpriced: CARS.length - priced.length,
};

/* the rarest fuel that has stock — a small, real result set for the sheet test */
export const RARE_FUEL = (() => {
  const tally = {};
  for (const c of CARS) if (c.fuel) tally[c.fuel] = (tally[c.fuel] || 0) + 1;
  const [fuel, n] = Object.entries(tally).sort((a, b) => a[1] - b[1])[0];
  return { fuel, n };
})();
