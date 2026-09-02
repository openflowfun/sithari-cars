/* Vehicle listing. Facets are built from the inventory itself, so the filter
   rail always matches what is actually in the yard. State lives in the URL, so
   any view can be copied out of the address bar and shared. */

import inventoryData from '../data/inventory.json';
import { money, normalise, carHTML } from './cards.js';
import { initNav, initNavState } from './nav.js';
import { initMotion } from './motion.js';

const CARS = inventoryData.map(normalise);
const PAGE = 24;

/* ---------- state ---------- */

const LISTS = ['body', 'make', 'fuel', 'trans'];
const RANGES = ['pmin', 'pmax', 'ymin', 'ymax'];
const SORTS = ['featured', 'price-asc', 'price-desc', 'year-desc', 'year-asc', 'km-asc', 'km-desc'];

const state = { body: [], make: [], fuel: [], trans: [], pmin: '', pmax: '', ymin: '', ymax: '', sort: 'featured' };
let shown = PAGE;

/* Values arriving from the homepage search use Motorcentral's older spelling. */
const ALIASES = { suv: 'SUV / 4x4', '4x4': 'SUV / 4x4', 'rv-suv': 'SUV / 4x4', wagon: 'Station wagon', 'people movers': 'People mover' };
const uniq = a => [...new Set(a)];
const valuesFor = key => uniq(CARS.map(c => FACET[key].get(c)).filter(Boolean));

const FACET = {
  body:  { label: 'Body style',   get: c => c.body },
  make:  { label: 'Make',         get: c => c.make },
  fuel:  { label: 'Fuel',         get: c => c.fuel },
  trans: { label: 'Transmission', get: c => c.transmission },
};

function canonical(key, raw) {
  const options = valuesFor(key);
  const hit = options.find(o => o.toLowerCase() === raw.toLowerCase());
  if (hit) return hit;
  const alias = ALIASES[raw.toLowerCase()];
  return alias && options.includes(alias) ? alias : raw;
}

function readURL() {
  const q = new URLSearchParams(location.search);
  LISTS.forEach(k => {
    state[k] = (q.get(k) || '').split(',').map(s => s.trim()).filter(Boolean).map(v => canonical(k, v));
  });
  RANGES.forEach(k => { state[k] = (q.get(k) || '').replace(/[^\d]/g, ''); });
  const s = q.get('sort');
  state.sort = SORTS.includes(s) ? s : 'featured';
}

function writeURL() {
  const q = new URLSearchParams();
  LISTS.forEach(k => { if (state[k].length) q.set(k, state[k].join(',')); });
  RANGES.forEach(k => { if (state[k]) q.set(k, state[k]); });
  if (state.sort !== 'featured') q.set('sort', state.sort);
  const qs = q.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

/* ---------- filtering ---------- */

/* `skip` leaves one facet out so that facet's own counts show what selecting
   each option would give, rather than always counting zero for the others. */
function matches(c, skip) {
  for (const k of LISTS) {
    if (k !== skip && state[k].length && !state[k].includes(FACET[k].get(c))) return false;
  }
  if (skip !== 'price' && (state.pmin || state.pmax)) {
    if (c.price === null) return false;
    if (state.pmin && c.price < +state.pmin) return false;
    if (state.pmax && c.price > +state.pmax) return false;
  }
  if (skip !== 'year') {
    if (state.ymin && +c.year < +state.ymin) return false;
    if (state.ymax && +c.year > +state.ymax) return false;
  }
  return true;
}

const COMPARE = {
  featured: () => 0,
  'price-asc': (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  'price-desc': (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity),
  'year-desc': (a, b) => b.year - a.year,
  'year-asc': (a, b) => a.year - b.year,
  'km-asc': (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity),
  'km-desc': (a, b) => (b.km ?? -Infinity) - (a.km ?? -Infinity),
};

/* Cars with no price sort to the end of a price sort either way. */
function results() {
  const list = CARS.filter(c => matches(c));
  return state.sort === 'featured' ? list : [...list].sort(COMPARE[state.sort]);
}

/* ---------- the filter rail ---------- */

const STEPS = { pmin: [5000, 10000, 15000, 20000, 25000, 30000], pmax: [10000, 15000, 20000, 25000, 30000, 40000] };
const YEARS = uniq(CARS.map(c => c.year)).sort((a, b) => b - a);

const opts = (values, selected, fmt = v => v) =>
  ['<option value="">Any</option>'].concat(values.map(v =>
    `<option value="${v}"${String(v) === String(selected) ? ' selected' : ''}>${fmt(v)}</option>`)).join('');

function facetGroup(key) {
  const { label } = FACET[key];
  const counts = new Map();
  CARS.filter(c => matches(c, key)).forEach(c => {
    const v = FACET[key].get(c);
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  });
  const values = valuesFor(key).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b));
  const rows = values.map(v => {
    const n = counts.get(v) || 0;
    const on = state[key].includes(v);
    return `<label class="opt${n || on ? '' : ' is-empty'}"><input type="checkbox" data-facet="${key}" value="${v}"` +
      `${on ? ' checked' : ''}${n || on ? '' : ' disabled'}><span>${v}</span><b>${n}</b></label>`;
  }).join('');
  return `<div class="fgroup"><h3 id="f-${key}">${label}</h3><div class="opts" role="group" aria-labelledby="f-${key}">${rows}</div></div>`;
}

function rangeGroup(title, lo, hi, values, fmt) {
  return `<div class="fgroup"><h3>${title}</h3><div class="pair">` +
    `<div class="field"><label for="${lo}">From</label><select id="${lo}" data-range="${lo}">${opts(values[0], state[lo], fmt)}</select></div>` +
    `<div class="field"><label for="${hi}">To</label><select id="${hi}" data-range="${hi}">${opts(values[1], state[hi], fmt)}</select></div>` +
    `</div></div>`;
}

function renderFilters() {
  document.getElementById('filters-body').innerHTML =
    facetGroup('body') +
    rangeGroup('Price', 'pmin', 'pmax', [STEPS.pmin, STEPS.pmax], money) +
    facetGroup('make') +
    facetGroup('fuel') +
    rangeGroup('Year', 'ymin', 'ymax', [[...YEARS].reverse(), YEARS]) +
    facetGroup('trans') +
    '<div class="fgroup"><button class="link" type="button" data-clear>Clear all filters</button></div>';
}

/* ---------- active filter chips ---------- */

const CHIP_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

function activeChips() {
  const chips = [];
  LISTS.forEach(k => state[k].forEach(v =>
    chips.push([`${k}:${v}`, v])));
  if (state.pmin || state.pmax) {
    const from = state.pmin ? money(state.pmin) : 'Any';
    const to = state.pmax ? money(state.pmax) : 'Any';
    chips.push(['price', `${from} – ${to}`]);
  }
  if (state.ymin || state.ymax) chips.push(['year', `${state.ymin || 'Any'} – ${state.ymax || 'Any'}`]);
  return chips;
}

function renderActive() {
  const chips = activeChips();
  document.getElementById('active').innerHTML = chips.length
    ? chips.map(([id, label]) =>
        `<button class="chip chip-x" type="button" data-remove="${id}" aria-label="Remove filter ${label}">${label}${CHIP_X}</button>`).join('') +
      '<button class="chip" type="button" data-clear>Clear all</button>'
    : '';
  const badge = document.getElementById('fbadge');
  badge.textContent = chips.length || '';
}

/* ---------- results ---------- */

const EMPTY = `<div class="empty"><h3>No cars match those filters</h3>` +
  `<p>Try widening the price range or clearing a filter. We land another 50 to 60 cars every month, so call us on 09 836 6301 and we will keep an eye out for you.</p>` +
  `<button class="btn btn-ink" type="button" data-clear>Clear all filters</button></div>`;

function render() {
  const list = results();
  const n = list.length;
  const page = list.slice(0, shown);

  document.getElementById('grid').innerHTML = n ? page.map(c => carHTML(c, 'car')).join('') : EMPTY;

  const noun = n === 1 ? 'car' : 'cars';
  const all = n === CARS.length;
  const notes = [];
  let head = 'No cars match';
  if (n) {
    head = `${n} ${noun}${all ? ' in stock' : ' match'}`;
    if (!all) notes.push(`of ${CARS.length} in stock`);
    if (n > shown) notes.push(`showing ${shown}`);
  }
  document.getElementById('count').innerHTML = head + (notes.length ? ` <span>${notes.join(', ')}</span>` : '');
  document.getElementById('fbar-count').textContent = `${n} ${noun}`;
  document.getElementById('sheet-apply').textContent = n ? `Show ${n} ${noun}` : 'No matches';

  const more = document.getElementById('more');
  const rest = Math.max(n - shown, 0);
  more.hidden = !rest;
  if (rest) more.textContent = `Show ${Math.min(PAGE, rest)} more`;

  renderActive();
  renderFilters();
  writeURL();
}

/* ---------- events ---------- */

function clearAll() {
  LISTS.forEach(k => { state[k] = []; });
  RANGES.forEach(k => { state[k] = ''; });
  shown = PAGE;
  render();
}

document.getElementById('filters').addEventListener('change', e => {
  const box = e.target.closest('input[data-facet]');
  if (box) {
    const { facet } = box.dataset;
    state[facet] = box.checked
      ? [...state[facet], box.value]
      : state[facet].filter(v => v !== box.value);
    shown = PAGE;
    return render();
  }
  const sel = e.target.closest('select[data-range]');
  if (sel) {
    state[sel.dataset.range] = sel.value;
    shown = PAGE;
    render();
  }
});

document.getElementById('sort').addEventListener('change', e => {
  state.sort = e.target.value;
  shown = PAGE;
  render();
});

document.getElementById('more').addEventListener('click', () => {
  shown += PAGE;
  render();
});

document.getElementById('active').addEventListener('click', e => {
  const chip = e.target.closest('[data-remove]');
  if (chip) {
    const [key, ...rest] = chip.dataset.remove.split(':');
    const value = rest.join(':');
    if (key === 'price') { state.pmin = state.pmax = ''; }
    else if (key === 'year') { state.ymin = state.ymax = ''; }
    else state[key] = state[key].filter(v => v !== value);
    shown = PAGE;
    render();
  }
});

document.addEventListener('click', e => {
  if (e.target.closest('[data-clear]')) clearAll();
});

/* ---------- mobile bottom sheet ---------- */

const root = document.documentElement;
const scrim = document.getElementById('scrim');
const openBtn = document.getElementById('sheet-open');
let lenis = null;

function setSheet(open) {
  root.classList.toggle('sheet-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  openBtn.setAttribute('aria-expanded', open);
  if (open) { lenis?.stop(); document.getElementById('sheet-close').focus(); }
  else { lenis?.start(); openBtn.focus(); }
}

openBtn.addEventListener('click', () => setSheet(true));
document.getElementById('sheet-close').addEventListener('click', () => setSheet(false));
document.getElementById('sheet-apply').addEventListener('click', () => setSheet(false));
scrim.addEventListener('click', () => setSheet(false));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && root.classList.contains('sheet-open')) setSheet(false);
});
/* Leaving the sheet breakpoint must not leave the page scroll-locked. */
matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setSheet(false); });

/* ---------- go ---------- */

readURL();
document.getElementById('sort').value = state.sort;
render();
initNav();

initMotion(ctx => { lenis = ctx.lenis; });

/* After initMotion, so it can use ScrollTrigger when the CDN delivered it. */
initNavState(() => document.querySelector('.page-head').offsetHeight);
